import { stageForGrowth, starsToNextStage } from '@/domain/creatures';
import { totalStars } from '@/domain/stars';
import { Driver, SYSTEM } from '../helpers';

describe('creature growth (spec 3.2)', () => {
  it('maps growth to stages: 3 stars = stage 2, 10 stars = stage 3', () => {
    expect(stageForGrowth(0)).toBe(1);
    expect(stageForGrowth(2)).toBe(1);
    expect(stageForGrowth(3)).toBe(2);
    expect(stageForGrowth(9)).toBe(2);
    expect(stageForGrowth(10)).toBe(3);
    expect(starsToNextStage(1)).toBe(2);
    expect(starsToNextStage(4)).toBe(6);
    expect(starsToNextStage(12)).toBeNull();
  });

  it('hatches slot 1, 2, 3 of a branch and then only feeds them', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.completeIn(child, 'mat');
    d.completeIn(child, 'mat');
    d.completeIn(child, 'mat');
    const hatched = d.state.creatures.filter((c) => c.branch === 'mat').map((c) => c.creatureId);
    expect(hatched).toEqual(['valley_mat_1', 'valley_mat_2', 'valley_mat_3']);

    d.completeIn(child, 'mat');
    expect(d.state.completions[3].creatureId).toBeNull();
    expect(d.state.celebrations.some((c) => c.type === 'grow')).toBe(true);
    expect(d.state.creatures.filter((c) => c.branch === 'mat')).toHaveLength(3);
  });

  it('evolves creatures with stars in their branch and celebrates', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.completeIn(child, 'kropp');
    d.completeIn(child, 'kropp');
    d.completeIn(child, 'kropp');
    const first = () => d.state.creatures.find((c) => c.creatureId === 'valley_kropp_1');
    expect(first()).toMatchObject({ growth: 3, stage: 2 });
    expect(d.events).toEqual(
      expect.arrayContaining([{ type: 'creature_evolved', childId: child, creatureId: 'valley_kropp_1', stage: 2 }]),
    );
    for (let i = 0; i < 7; i += 1) d.completeIn(child, 'kropp');
    expect(first()).toMatchObject({ growth: 10, stage: 3 });
  });

  it('does not feed creatures of other branches', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.completeIn(child, 'kropp');
    d.completeIn(child, 'mat');
    d.completeIn(child, 'mat');
    expect(d.state.creatures.find((c) => c.creatureId === 'valley_kropp_1')?.growth).toBe(1);
  });

  it('awards branch master when all three creatures reach stage 3', () => {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    d.run({ type: 'updateSettings', settings: { maxActiveChallenges: 10 } });
    const child = d.addChild('Evelyn', 2020, 3);
    for (let i = 0; i < 11; i += 1) d.completeIn(child, 'mod');
    expect(d.state.celebrations.some((c) => c.type === 'branch_master')).toBe(false);
    d.completeIn(child, 'mod');
    expect(d.state.celebrations.filter((c) => c.type === 'branch_master')).toHaveLength(1);
    d.completeIn(child, 'mod');
    expect(d.state.celebrations.filter((c) => c.type === 'branch_master')).toHaveLength(1);
  });

  it('gives stars but hatches only once for repeatable challenges (spec 6.2)', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    const id = d.custom(child, 'hem', 'Bädda sängen 7 dagar i rad', true);
    d.run({ type: 'approveCompletion', challengeId: id });
    expect(d.state.challenges[0]).toMatchObject({ status: 'active', repeatCount: 1 });
    d.run({ type: 'requestCompletion', challengeId: id });
    d.run({ type: 'approveCompletion', challengeId: id });
    expect(totalStars(d.state, child)).toBe(2);
    expect(d.state.creatures.filter((c) => !c.isSpecial)).toHaveLength(1);
    expect(d.state.completions.map((c) => c.isFirst)).toEqual([true, false]);
  });
});

describe('milestones (spec 3.4)', () => {
  it('reaches the 5-star milestone and unlocks the special creature', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    for (let i = 0; i < 4; i += 1) d.completeIn(child, 'kropp');
    expect(d.state.milestones).toHaveLength(0);
    d.completeIn(child, 'kropp');
    expect(d.state.milestones.map((m) => m.milestoneId)).toEqual(['m5']);
    expect(d.state.creatures.some((c) => c.creatureId === 'valley_special_m5')).toBe(true);
    const celebration = d.state.celebrations.find((c) => c.type === 'milestone');
    expect(celebration?.payload).toMatchObject({ milestoneId: 'm5', title: 'Lilla hjälten', specialId: 'valley_special_m5' });
  });

  it('lets the child pick an unlocked creature as avatar, but not a locked one', () => {
    const d = new Driver();
    const child = d.addChild('Evelyn', 2020, 3);
    d.completeIn(child, 'kropp');
    d.run({ type: 'setAvatar', childId: child, creatureId: 'valley_kropp_1' });
    expect(d.state.children[0].avatarCreatureId).toBe('valley_kropp_1');
    expect(d.try({ type: 'setAvatar', childId: child, creatureId: 'valley_mod_3' })).toMatchObject({
      ok: false,
      error: 'forbidden',
    });
  });
});
