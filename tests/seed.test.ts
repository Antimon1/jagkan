import { z } from 'zod';

import challenges from '../seed/challenges.json';
import creatures from '../seed/creatures.json';
import milestones from '../seed/milestones.json';
import rewardSuggestions from '../seed/reward_suggestions.json';
import { BAND_AGES, BRANCHES, WORLDS } from '@/domain/constants';

const branch = z.enum(BRANCHES as [string, ...string[]]);
const world = z.enum(WORLDS as [string, ...string[]]);
const age = z.number().int().min(4).max(13);

const challengeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    branch,
    ageMin: age,
    ageMax: age,
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    titleChild: z.string().min(3).max(60),
    titleParent: z.string().min(3).max(120),
    icon: z.string().min(1).max(16),
    parentTip: z.string().min(10).max(300),
    repeatable: z.boolean(),
    reward: z.enum(['star', 'praise']),
    tags: z.array(z.string()).min(1).max(3),
    isPlus: z.boolean(),
    retired: z.boolean(),
  })
  .strict()
  .refine((c) => c.ageMin <= c.ageMax, 'ageMin <= ageMax');

const stage = z.object({
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  name: z.string().min(2),
  emoji: z.string().min(1),
  assetKey: z.string().regex(/^[a-z]+\/[a-z0-9_]+$/),
});

const creaturesSchema = z.object({
  version: z.literal(1),
  worlds: z.array(z.object({ id: world, name: z.string(), band: z.number(), ageMin: age, ageMax: age }).passthrough()).length(3),
  species: z
    .array(
      z.object({
        id: z.string(),
        world,
        branch,
        slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        personality: z.string().min(5),
        stages: z.array(stage).length(3),
      }),
    )
    .length(WORLDS.length * BRANCHES.length * 3),
  specials: z
    .array(
      z.object({
        id: z.string(),
        world,
        name: z.string(),
        emoji: z.string(),
        assetKey: z.string(),
        personality: z.string(),
        unlock: z.union([
          z.object({ type: z.literal('milestone'), milestoneId: z.string() }),
          z.object({ type: z.enum(['first_spark', 'family_goal', 'graduation']) }),
        ]),
      }),
    )
    .length(30),
});

const active = challenges.filter((c) => !c.retired);

/** Active challenges a child in each branch and age band can get (spec 6.4). */
function cells() {
  return BRANCHES.flatMap((branch) =>
    ([1, 2, 3] as const).map((band) => {
      const { min, max } = BAND_AGES[band];
      const list = active.filter((c) => c.branch === branch && c.ageMax >= min && c.ageMin <= max);
      return { cell: `${branch} ${min}-${max}`, count: list.length, free: list.filter((c) => !c.isPlus).length };
    }),
  );
}

/** Knives, heat, water, traffic and tools (idépanelen: never without a grown-up for the age). */
const RISKY =
  /kockkniv|vass kniv|barnkniv|\bskära|hacka|\bspis|\bugn|stekpanna|grill|brasa|\beld|tändsticka|\bbada\b|badplats|simm|simhall|hopptorn|kanot|snorkl|\bisen?\b|skridsko|fiska|trafik|gatan|övergångsställ|korsning|\bcykla|\bbuss|\btåg|eluttag|elcentral|strykjärn|symaskin|hammare|\bborr|sågen|svamp|i vattnet|under vattnet|öppet vatten|klätter|klättra/i;
const GROWN_UP = /vuxen|vuxna|tillsammans|bredvid|instruktör|livräddning|badvakt/i;

describe('seed data (spec 6.4 and 5)', () => {
  it('has at least 500 valid, unique challenges', () => {
    const parsed = z.array(challengeSchema).parse(challenges);
    expect(active.length).toBeGreaterThanOrEqual(500);
    expect(new Set(parsed.map((c) => c.id)).size).toBe(parsed.length);
  });

  it('has at least 20 challenges in every branch and age band', () => {
    expect(cells().filter((c) => c.count < 20)).toEqual([]);
  });

  it('has at least two free challenges in every branch and age band (spec 13)', () => {
    expect(cells().filter((c) => c.free < 2)).toEqual([]);
  });

  it('has no duplicate child titles among active challenges', () => {
    const titles = active.map((c) => c.titleChild.toLocaleLowerCase('sv-SE').replace(/[!.]+$/, ''));
    expect(titles.filter((title, i) => titles.indexOf(title) !== i)).toEqual([]);
  });

  it('asks for a grown-up whenever a challenge involves knives, heat, water, traffic or tools', () => {
    const unsafe = active
      .filter((c) => RISKY.test([c.titleChild, c.titleParent, ...c.tags].join(' ')))
      .filter((c) => !GROWN_UP.test(`${c.titleParent} ${c.parentTip}`))
      .map((c) => c.id);
    expect(unsafe).toEqual([]);
  });

  it('keeps praise cards for emotion and kindness branches', () => {
    const branches = new Set(active.filter((c) => c.reward === 'praise').map((c) => c.branch));
    expect([...branches].sort()).toEqual(['kanslor', 'omtanke']);
  });

  it('includes the examples from the spec', () => {
    const titles = challenges.map((c) => c.titleChild);
    for (const title of ['Dra upp blixtlåset själv', 'Bre min egen smörgås', 'Knyta skorna', 'Åka kollektivtrafik själv', 'Simma 25 meter']) {
      expect(titles).toContain(title);
    }
  });

  it('has 3 creatures per branch in every world and 10 specials per world', () => {
    const parsed = creaturesSchema.parse(creatures);
    for (const w of WORLDS) {
      for (const b of BRANCHES) {
        const slots = parsed.species.filter((s) => s.world === w && s.branch === b).map((s) => s.slot).sort();
        expect(slots).toEqual([1, 2, 3]);
      }
      expect(parsed.specials.filter((s) => s.world === w)).toHaveLength(10);
    }
    const ids = [...parsed.species.map((s) => s.id), ...parsed.specials.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links every milestone special to a milestone', () => {
    const milestoneIds = new Set(milestones.map((m) => m.id));
    for (const s of creatures.specials) {
      if (s.unlock.type === 'milestone') expect(milestoneIds.has((s.unlock as { milestoneId: string }).milestoneId)).toBe(true);
    }
    expect(milestones.map((m) => m.thresholdStars)).toEqual([5, 10, 25, 50, 100, 200, 365]);
  });

  it('has reward suggestions including the spec examples', () => {
    const titles = rewardSuggestions.map((r) => r.title);
    expect(titles).toEqual(expect.arrayContaining(['Välja middag', 'Extra godnattsaga', 'Biokväll', '30 min extra skärmtid']));
    expect(rewardSuggestions.every((r) => r.costStars >= 1 && r.ageMin <= r.ageMax)).toBe(true);
  });

  it('never uses losing or failing language in child-facing texts', () => {
    const banned = /förlor|förlust|misslyck|dålig|sämst|fel på dig/i;
    const texts = [
      ...challenges.map((c) => c.titleChild),
      ...creatures.species.flatMap((s) => [s.personality, ...s.stages.map((x) => x.name)]),
      ...creatures.specials.map((s) => s.personality),
    ];
    expect(texts.filter((t) => banned.test(t))).toEqual([]);
  });
});
