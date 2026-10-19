import { DEFAULT_COMPETITIONS } from '@/domain/constants';
import { childWeekLines } from '@/features/child/weekLines';
import { Driver, freeTemplate, SYSTEM } from './helpers';

function siblings() {
  const d = new Driver();
  d.run({ type: 'setPlus', active: true }, SYSTEM);
  const evelyn = d.addChild('Evelyn', 2020, 3);
  const rafael = d.addChild('Rafael', 2019, 8);
  for (const [child, branch] of [[rafael, 'kropp'], [rafael, 'mat'], [evelyn, 'ute']] as const) {
    d.run({ type: 'approveCompletion', challengeId: d.activate(child, freeTemplate(branch)) });
  }
  return { d, evelyn, rafael };
}

describe("the child's week card", () => {
  it('keeps the sibling duel off by default', () => {
    expect(DEFAULT_COMPETITIONS.siblingDuelEnabled).toBe(false);
  });

  it('shows only the child its own stars when the duel is on', () => {
    const { d, evelyn } = siblings();
    d.run({ type: 'updateCompetitions', siblingDuelEnabled: true, selfModeEnabled: false });

    expect(childWeekLines(d.state, evelyn, d.now)).toEqual([{ key: 'child.week.mine', count: 1 }]);
  });

  it('adds the personal record in "mot mig själv"', () => {
    const { d, rafael } = siblings();

    expect(childWeekLines(d.state, rafael, d.now)).toEqual([
      { key: 'child.week.mine', count: 2 },
      { key: 'child.week.newRecord' },
    ]);
  });

  it('shows nothing when no competition is on', () => {
    const { d, evelyn } = siblings();
    d.run({ type: 'updateCompetitions', selfModeEnabled: false });

    expect(childWeekLines(d.state, evelyn, d.now)).toEqual([]);
  });
});
