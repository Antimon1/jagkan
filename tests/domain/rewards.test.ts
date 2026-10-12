import { availableStars, spendableStars, totalStars } from '@/domain/stars';
import { Driver, SYSTEM } from '../helpers';

function familyWithStars(stars: number) {
  const d = new Driver();
  const child = d.addChild('Evelyn', 2020, 3);
  for (let i = 0; i < stars; i += 1) d.completeIn(child, 'kropp');
  return { d, child };
}

describe('reward shop (spec 7)', () => {
  it('creates rewards and limits the free plan to three', () => {
    const d = new Driver();
    d.run({ type: 'createReward', title: 'Välja middag', icon: '🍝', costStars: 5, childId: null });
    d.run({ type: 'createReward', title: 'Extra saga', icon: '📖', costStars: 3, childId: null });
    d.run({ type: 'createReward', title: 'Biokväll', icon: '🎬', costStars: 20, childId: null });
    expect(d.try({ type: 'createReward', title: 'Glass', icon: '🍦', costStars: 6, childId: null })).toMatchObject({
      ok: false,
      error: 'plus_required',
    });
    d.run({ type: 'archiveReward', rewardId: d.state.rewards[0].id });
    d.run({ type: 'createReward', title: 'Glass', icon: '🍦', costStars: 6, childId: null });
    expect(d.state.rewards.filter((r) => r.active)).toHaveLength(3);
  });

  it('validates reward input', () => {
    const d = new Driver();
    expect(d.try({ type: 'createReward', title: '', icon: '🍝', costStars: 5, childId: null })).toMatchObject({ ok: false });
    expect(d.try({ type: 'createReward', title: 'X', icon: '🍝', costStars: 0, childId: null })).toMatchObject({ ok: false });
    expect(d.try({ type: 'createReward', title: 'X', icon: '🍝', costStars: 5, childId: 'nope' })).toMatchObject({
      ok: false,
      error: 'not_found',
    });
  });

  it('requests, reserves and confirms a reward', () => {
    const { d, child } = familyWithStars(6);
    d.run({ type: 'createReward', title: 'Välja middag', icon: '🍝', costStars: 5, childId: null });
    const rewardId = d.state.rewards[0].id;
    d.run({ type: 'requestReward', rewardId, childId: child }, { kind: 'child', childIds: [child] });
    expect(availableStars(d.state, child)).toBe(1);
    expect(spendableStars(d.state, child)).toBe(6);
    expect(d.try({ type: 'requestReward', rewardId, childId: child })).toMatchObject({ error: 'already_requested' });

    const requestId = d.state.rewardRequests[0].id;
    d.run({ type: 'resolveRewardRequest', requestId, confirm: true });
    expect(spendableStars(d.state, child)).toBe(1);
    expect(totalStars(d.state, child)).toBe(6);
    expect(d.state.rewardRequests[0].status).toBe('confirmed');
    expect(d.state.celebrations.some((c) => c.type === 'reward_confirmed')).toBe(true);
  });

  it('refuses a request the child cannot afford', () => {
    const { d, child } = familyWithStars(2);
    d.run({ type: 'createReward', title: 'Biokväll', icon: '🎬', costStars: 20, childId: null });
    expect(d.try({ type: 'requestReward', rewardId: d.state.rewards[0].id, childId: child })).toMatchObject({
      ok: false,
      error: 'not_enough_stars',
    });
  });

  it('declines a request and releases the reserved stars', () => {
    const { d, child } = familyWithStars(3);
    d.run({ type: 'createReward', title: 'Extra saga', icon: '📖', costStars: 3, childId: null });
    d.run({ type: 'requestReward', rewardId: d.state.rewards[0].id, childId: child });
    d.run({ type: 'resolveRewardRequest', requestId: d.state.rewardRequests[0].id, confirm: false });
    expect(availableStars(d.state, child)).toBe(3);
    expect(d.try({ type: 'resolveRewardRequest', requestId: d.state.rewardRequests[0].id, confirm: true })).toMatchObject({
      error: 'invalid_status',
    });
  });

  it('only lets the named child request a personal reward', () => {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    const a = d.addChild('Evelyn', 2020, 3);
    const b = d.addChild('Rafael', 2021, 6);
    d.completeIn(b, 'kropp');
    d.run({ type: 'createReward', title: 'Extra saga', icon: '📖', costStars: 1, childId: a });
    expect(d.try({ type: 'requestReward', rewardId: d.state.rewards[0].id, childId: b })).toMatchObject({
      error: 'forbidden',
    });
  });

  it('declines pending requests when a reward is archived', () => {
    const { d, child } = familyWithStars(3);
    d.run({ type: 'createReward', title: 'Extra saga', icon: '📖', costStars: 3, childId: null });
    d.run({ type: 'requestReward', rewardId: d.state.rewards[0].id, childId: child });
    d.run({ type: 'archiveReward', rewardId: d.state.rewards[0].id });
    expect(d.state.rewardRequests[0].status).toBe('declined');
  });

  it('updates a reward', () => {
    const d = new Driver();
    d.run({ type: 'createReward', title: 'Extra saga', icon: '📖', costStars: 3, childId: null });
    d.run({ type: 'updateReward', rewardId: d.state.rewards[0].id, costStars: 4, title: 'Två sagor' });
    expect(d.state.rewards[0]).toMatchObject({ costStars: 4, title: 'Två sagor' });
  });
});

describe('family goal (spec 4)', () => {
  it('requires Plus', () => {
    const d = new Driver();
    expect(d.try({ type: 'setFamilyGoal', title: 'Bio', targetStars: 3, rewardText: 'Bio' })).toMatchObject({
      error: 'plus_required',
    });
  });

  it('counts all children and celebrates when the goal is reached', () => {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    const a = d.addChild('Evelyn', 2020, 3);
    const b = d.addChild('Rafael', 2021, 6);
    d.completeIn(a, 'kropp'); // before the goal: does not count
    d.addDays(1);
    d.run({ type: 'setFamilyGoal', title: '3 stjärnor', targetStars: 3, rewardText: 'Bio' });
    d.completeIn(a, 'kropp');
    d.completeIn(b, 'mat');
    expect(d.state.goals[0].reachedAt).toBeNull();
    d.completeIn(b, 'mat');
    expect(d.state.goals[0].reachedAt).not.toBeNull();
    expect(d.events).toEqual(expect.arrayContaining([{ type: 'family_goal_reached', goalId: d.state.goals[0].id }]));
    const goalCelebrations = d.state.celebrations.filter((c) => c.type === 'family_goal');
    expect(goalCelebrations.map((c) => c.childId).sort()).toEqual([a, b].sort());
    expect(d.state.creatures.filter((c) => c.creatureId === 'valley_special_family_goal')).toHaveLength(2);
  });

  it('replaces a running goal with a new one and can cancel', () => {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    d.run({ type: 'setFamilyGoal', title: 'A', targetStars: 10, rewardText: 'Bio' });
    d.run({ type: 'setFamilyGoal', title: 'B', targetStars: 20, rewardText: 'Glass' });
    expect(d.state.goals[0].cancelledAt).not.toBeNull();
    d.run({ type: 'cancelFamilyGoal', goalId: d.state.goals[1].id });
    expect(d.state.goals[1].cancelledAt).not.toBeNull();
  });
});
