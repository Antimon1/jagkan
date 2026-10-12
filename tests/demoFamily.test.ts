import { buildDemoFamily } from '@/features/onboarding/demoFamily';
import { pendingApprovals, unseenCelebrations } from '@/domain/selectors';
import { totalStars } from '@/domain/stars';
import { catalog } from '@/data/catalog';

let counter = 0;
jest.mock('@/lib/ids', () => ({ newId: () => `demo-${(counter += 1)}` }));

describe('demo family', () => {
  const state = buildDemoFamily(new Date('2026-10-07T08:00:00.000Z'));

  it('has two children with stars, creatures and history', () => {
    expect(state.family.plusActive).toBe(true);
    expect(state.children.map((c) => c.firstName)).toEqual(['Evelyn', 'Rafael']);
    for (const child of state.children) {
      expect(totalStars(state, child.id)).toBeGreaterThan(3);
      expect(state.creatures.some((c) => c.childId === child.id && !c.isSpecial)).toBe(true);
    }
    expect(state.weeklyResults.length).toBeGreaterThan(0);
  });

  it('has a waiting approval, rewards, a family goal and suggestions', () => {
    expect(pendingApprovals(state, catalog)).toHaveLength(1);
    expect(state.rewards).toHaveLength(3);
    expect(state.goals).toHaveLength(1);
    expect(state.aiSuggestions.length).toBeGreaterThan(0);
  });

  it('only keeps recent celebrations unseen', () => {
    const unseen = state.children.flatMap((c) => unseenCelebrations(state, c.id));
    expect(unseen.length).toBeLessThan(state.celebrations.length);
  });
});
