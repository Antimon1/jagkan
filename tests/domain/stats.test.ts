import { familyStats } from '@/domain/stats';
import { Driver, freeTemplate } from '../helpers';

const CHILD = (childId: string) => ({ kind: 'child' as const, childIds: [childId] });

describe('family statistics (first-party, from existing data)', () => {
  it('counts attempts, approvals, hatchings and active days in the period', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const egg = d.activate(child, freeTemplate('kropp'));
    d.run({ type: 'recordAttempt', challengeId: egg }, CHILD(child));
    d.addDays(1).run({ type: 'recordAttempt', challengeId: egg }, CHILD(child));
    d.run({ type: 'approveCompletion', challengeId: egg });
    d.addDays(1).run({ type: 'approveCompletion', challengeId: d.custom(child, 'kropp') });
    d.run({ type: 'giveSpark', challengeId: d.custom(child, 'mat') });

    expect(familyStats(d.state, d.now)).toEqual({
      periodDays: 28,
      attempts: 2,
      approvals: 2,
      hatched: 1,
      activeDays: 3,
      approvalsPerWeek: [0, 0, 0, 2],
    });
  });

  it('leaves out what happened before the period', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.completeIn(child, 'mat');
    d.addDays(30);

    expect(familyStats(d.state, d.now)).toMatchObject({ approvals: 0, hatched: 0, activeDays: 0, approvalsPerWeek: [0, 0, 0, 0] });
    expect(familyStats(d.state, d.now, 31)).toMatchObject({ approvals: 1, hatched: 1, activeDays: 1 });
  });
});
