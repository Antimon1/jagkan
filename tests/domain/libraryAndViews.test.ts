import { catalog } from '@/data/catalog';
import { templateCardText } from '@/domain/cardText';
import { searchLibrary, suggestFromLibrary } from '@/domain/library';
import {
  albumFor,
  branchStats,
  collectionFor,
  eggsForChild,
  familyGoalView,
  milestoneProgress,
  pendingApprovals,
  pendingRewardRequests,
  shopFor,
  specialsFor,
  unseenCelebrations,
  worldsWithCollection,
} from '@/domain/selectors';
import { Driver, freeTemplate, SYSTEM } from '../helpers';

describe('challenge library (spec 6.1)', () => {
  it('filters by branch, age, difficulty and text', () => {
    const results = searchLibrary(catalog, { branch: 'mat', age: 5, includePlus: true });
    expect(results.length).toBeGreaterThan(5);
    expect(results.every((t) => t.branch === 'mat' && t.ageMin <= 5 && t.ageMax >= 5)).toBe(true);
    expect(searchLibrary(catalog, { query: 'BLIXTLÅS' }).map((t) => t.id)).toContain('kropp_blixtlas_01');
    expect(searchLibrary(catalog, { difficulty: 3 }).every((t) => t.difficulty === 3)).toBe(true);
  });

  it('hides Plus challenges for free families', () => {
    expect(searchLibrary(catalog, { includePlus: false }).every((t) => !t.isPlus)).toBe(true);
    expect(searchLibrary(catalog, { includePlus: false })).toHaveLength(42);
  });

  it('suggests unused, age-appropriate challenges spread over branches', () => {
    const d = new Driver();
    const childId = d.addChild('Evelyn', 2020, 3);
    d.activate(childId, freeTemplate('kropp'));
    const child = d.state.children[0];
    const picks = suggestFromLibrary(d.state, catalog, child, d.now, 3, true);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.branch)).size).toBe(3);
    expect(picks.some((p) => p.branch === 'kropp')).toBe(false);
    expect(picks.every((p) => p.ageMin <= 6)).toBe(true);
  });
});

describe('collector card template (spec 6.3)', () => {
  it('writes a warm third-person text without pronouns', () => {
    const text = templateCardText({ firstName: 'Evelyn', title: 'Dra upp blixtlåset själv', attempts: 4, branch: 'kropp', seed: 'x' });
    expect(text).toContain('Evelyn');
    expect(text).toContain('4');
    expect(text).not.toMatch(/\b(hon|han|hen)\b/i);
    const single = templateCardText({ firstName: 'Rafael', title: 'Smaka en ny mat', attempts: 1, branch: 'mod', seed: 'y' });
    expect(single).toContain('Rafael');
  });

  it('is stable for the same seed', () => {
    const input = { firstName: 'Evelyn', title: 'X', attempts: 0, branch: 'mat' as const, seed: 'abc' };
    expect(templateCardText(input)).toBe(templateCardText(input));
  });
});

describe('selectors for the child and parent views', () => {
  function setup() {
    const d = new Driver();
    d.run({ type: 'setPlus', active: true }, SYSTEM);
    const child = d.addChild('Evelyn', 2020, 3);
    const egg = d.activate(child, freeTemplate('kropp'));
    d.completeIn(child, 'mat');
    d.run({ type: 'recordAttempt', challengeId: egg });
    d.run({ type: 'requestCompletion', challengeId: egg });
    return { d, child, egg };
  }

  it('shows eggs with charge and the pending approvals', () => {
    const { d, child, egg } = setup();
    const eggs = eggsForChild(d.state, catalog, child);
    expect(eggs).toHaveLength(1);
    expect(eggs[0]).toMatchObject({ charge: 1, title: 'Dra upp blixtlåset själv', icon: '🧥' });
    const pending = pendingApprovals(d.state, catalog);
    expect(pending.map((p) => p.view.challenge.id)).toEqual([egg]);
    expect(pending[0].child.firstName).toBe('Evelyn');
  });

  it('builds the collection with silhouettes, specials and trophy worlds', () => {
    const { d, child } = setup();
    const collection = collectionFor(d.state, catalog, child, 'valley');
    expect(collection).toHaveLength(7);
    const mat = collection.find((b) => b.branch === 'mat');
    expect(mat?.slots[0].owned).not.toBeNull();
    expect(mat?.slots[1].owned).toBeNull();
    expect(mat?.slots[0].toNextStage).toBe(2);
    expect(specialsFor(d.state, catalog, child, 'valley')).toHaveLength(10);
    expect(worldsWithCollection(d.state, child, 'valley')).toEqual(['valley']);
  });

  it('computes milestone progress, album, branch stats and the shop', () => {
    const { d, child } = setup();
    expect(milestoneProgress(d.state, catalog, child)).toMatchObject({ total: 1, remaining: 4, current: null });
    const album = albumFor(d.state, catalog, child);
    expect(album).toHaveLength(1);
    expect(album[0].creature?.name).toBe('Bullis');
    expect(branchStats(d.state, child).mat).toBe(1);

    d.run({ type: 'createReward', title: 'Saga', icon: '📖', costStars: 1, childId: null });
    d.run({ type: 'createReward', title: 'Bio', icon: '🎬', costStars: 20, childId: null });
    const shop = shopFor(d.state, child);
    expect(shop.map((s) => s.affordable)).toEqual([true, false]);
    d.run({ type: 'requestReward', rewardId: shop[0].reward.id, childId: child });
    expect(shopFor(d.state, child)[0].pending).toBe(true);
    expect(pendingRewardRequests(d.state)).toHaveLength(1);
  });

  it('lists unseen celebrations and marks them seen', () => {
    const { d, child } = setup();
    const unseen = unseenCelebrations(d.state, child);
    expect(unseen.length).toBeGreaterThan(0);
    d.run(
      { type: 'markCelebrationsSeen', childId: child, celebrationIds: unseen.map((c) => c.id) },
      { kind: 'child', childIds: [child] },
    );
    expect(unseenCelebrations(d.state, child)).toHaveLength(0);
  });

  it('shows family goal progress', () => {
    const { d, child } = setup();
    expect(familyGoalView(d.state, d.now)).toBeNull();
    d.addDays(1);
    d.run({ type: 'setFamilyGoal', title: 'Bio', targetStars: 4, rewardText: 'Bio' });
    d.completeIn(child, 'hem');
    expect(familyGoalView(d.state, d.now)).toMatchObject({ progress: 1, ratio: 0.25 });
  });
});
