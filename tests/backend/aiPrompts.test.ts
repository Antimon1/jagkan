import {
  buildCardPrompt,
  buildCustomPrompt,
  buildWeeklyPrompt,
  cleanCardText,
  extractJson,
  isSafeForAge,
  parseChallenges,
  parseCustomChallenge,
} from '@/backend/aiPrompts';
import { catalog } from '@/data/catalog';
import { matchTemplate } from '@/domain/library';
import type { AiChallengePayload } from '@/domain/types';

import { Driver, freeTemplate, START } from '../helpers';

const VALID: AiChallengePayload = {
  titleChild: 'Bre en smörgås',
  titleParent: 'Bre en egen smörgås till frukost',
  branch: 'mat',
  icon: '🥪',
  parentTip: 'Ställ fram allt på en låg hylla.',
  difficulty: 1,
  repeatable: true,
  ageMin: 4,
  ageMax: 7,
};

describe('AI prompts', () => {
  it('sends age, world and challenge history but never the child name', () => {
    const driver = new Driver();
    const childId = driver.addChild('Evelyn', 2021);
    driver.activate(childId, freeTemplate());
    const child = driver.state.children[0];
    const prompt = JSON.parse(buildWeeklyPrompt(driver.state, child, catalog, START, 3));

    expect(prompt.alder).toBe(5);
    expect(prompt.varld).toBe('valley');
    expect(prompt.aktiva).toHaveLength(1);
    expect(prompt.grenarSomSaknas.length).toBeGreaterThan(0);
    expect(JSON.stringify(prompt)).not.toContain('Evelyn');
  });

  it('limits the custom description and includes the card inputs', () => {
    expect(JSON.parse(buildCustomPrompt(6, 'x'.repeat(900))).beskrivning).toHaveLength(500);
    expect(JSON.parse(buildCardPrompt({ firstName: 'Evelyn', title: 'Cykla', parentNote: null, attempts: 2 }))).toEqual({
      fornamn: 'Evelyn',
      utmaning: 'Cykla',
      foralderns_kommentar: '',
      antal_forsok: 2,
    });
  });
});

describe('AI output validation', () => {
  it('reads JSON inside code fences and rejects prose', () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Här är: [1, 2]')).toEqual([1, 2]);
    expect(extractJson('inget json här')).toBeNull();
    expect(extractJson('{trasig')).toBeNull();
  });

  it('accepts valid, age-appropriate, distinct challenges', () => {
    const second = { ...VALID, titleChild: 'Duka bordet', branch: 'hem' };
    expect(parseChallenges(JSON.stringify({ challenges: [VALID, second] }), 5, 3)).toHaveLength(2);
    expect(parseChallenges(JSON.stringify([VALID]), 5, 3)).toHaveLength(1);
  });

  it('falls back (null) on invalid, duplicate, unsafe or wrong-age output', () => {
    expect(parseChallenges('{"challenges": []}', 5, 3)).toBeNull();
    expect(parseChallenges(JSON.stringify({ challenges: [{ ...VALID, branch: 'okänd' }] }), 5, 3)).toBeNull();
    expect(parseChallenges(JSON.stringify({ challenges: [VALID, VALID] }), 5, 3)).toBeNull();
    expect(parseChallenges(JSON.stringify({ challenges: [VALID] }), 10, 3)).toBeNull();
    const knife = { ...VALID, titleChild: 'Skär gurka med kniv' };
    expect(parseChallenges(JSON.stringify({ challenges: [knife] }), 5, 3)).toBeNull();
  });

  it('allows risky tools only for older children with an adult', () => {
    const stove = { ...VALID, titleParent: 'Steka ägg på spisen med en vuxen', ageMin: 9, ageMax: 13 };
    expect(isSafeForAge(stove, 10)).toBe(true);
    expect(isSafeForAge(stove, 6)).toBe(false);
    expect(isSafeForAge({ ...stove, titleParent: 'Steka ägg på spisen' }, 10)).toBe(false);
  });

  it('parses a custom challenge with or without the wrapper', () => {
    expect(parseCustomChallenge(JSON.stringify({ challenge: VALID }), 5)).toEqual(VALID);
    expect(parseCustomChallenge(JSON.stringify(VALID), 5)).toEqual(VALID);
    expect(parseCustomChallenge('nej', 5)).toBeNull();
  });

  it('keeps warm card texts and rejects negative or nameless ones', () => {
    expect(cleanCardText('"Evelyn cyklade hela vägen!"', 'Evelyn')).toBe('Evelyn cyklade hela vägen!');
    expect(cleanCardText('Evelyn misslyckades först.', 'Evelyn')).toBeNull();
    expect(cleanCardText('Barnet cyklade.', 'Evelyn')).toBeNull();
    expect(cleanCardText(`Evelyn ${'a'.repeat(500)}`, 'Evelyn')).toBeNull();
  });
});

describe('library match (AI fallback)', () => {
  it('finds a library challenge from a free-text description', () => {
    const match = matchTemplate(catalog, 'Hon vill lära sig cykla utan stödhjul', 6);
    expect(match?.titleChild.toLowerCase()).toContain('cykla');
    expect(matchTemplate(catalog, 'xyz', 6)).toBeNull();
  });
});
