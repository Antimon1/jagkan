import { upgradeState } from '@/domain/upgrade';
import { Driver, freeTemplate, SYSTEM } from '../helpers';

/** A family saved on the device by a version that still had AI suggestions. */
function legacyFamily() {
  const d = new Driver();
  const child = d.addChild('Evelyn', 2020, 3);
  d.activate(child, freeTemplate('kropp'));
  d.activate(child, freeTemplate('mat'));
  const [first, second] = d.state.challenges;
  return {
    ...d.state,
    challenges: [
      { ...first, source: 'ai', status: 'suggested' },
      { ...second, source: 'library', status: 'active' },
    ],
    aiSuggestions: [{ id: 's1', childId: child, payload: {}, status: 'new', createdAt: d.now }],
  };
}

describe('upgradeState', () => {
  it('drops AI suggestions and turns AI challenges into paused custom challenges', () => {
    const upgraded = upgradeState(legacyFamily());

    expect(upgraded).not.toBeNull();
    expect(upgraded).not.toHaveProperty('aiSuggestions');
    expect(upgraded?.challenges.map((c) => [c.source, c.status])).toEqual([
      ['custom', 'paused'],
      ['library', 'active'],
    ]);
  });

  it('moves a child from a frozen world to Äggdalen and keeps its creatures', () => {
    const d = new Driver().fullGame();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    const child = d.addChild('Bo', 2014, 1);
    d.completeIn(child, 'ute');
    expect(d.state.children[0].world).toBe('explorer');

    const upgraded = upgradeState(d.state);
    expect(upgraded?.children[0].world).toBe('valley');
    expect(upgraded?.creatures.map((c) => c.creatureId)).toEqual(['explorer_ute_1']);
  });

  it('leaves a current family unchanged', () => {
    const d = new Driver();
    d.activate(d.addChild('Rafael', 2021, 6), freeTemplate('ute'));

    expect(upgradeState(d.state)).toEqual(d.state);
  });

  it('rejects anything that is not a saved family', () => {
    expect(upgradeState(null)).toBeNull();
    expect(upgradeState('family')).toBeNull();
    expect(upgradeState({ schemaVersion: 2, challenges: [] })).toBeNull();
    expect(upgradeState({ schemaVersion: 1 })).toBeNull();
  });
});
