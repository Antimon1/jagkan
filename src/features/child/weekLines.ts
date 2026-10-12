import { selfStats } from '@/domain/competitions';
import type { FamilyState } from '@/domain/types';

export type WeekLine =
  | { key: 'child.week.mine'; count: number }
  | { key: 'child.week.newRecord' }
  | { key: 'child.week.toRecord'; count: number };

/**
 * The child's week card shows only the child's own numbers, also when the sibling
 * duel is on: no leader and no siblings' scores (idépanelen). Parents see the duel.
 */
export function childWeekLines(state: FamilyState, childId: string, now: string): WeekLine[] {
  const { competitions } = state;
  const duelOn = competitions.siblingDuelEnabled && state.children.length > 1 && state.family.plusActive;
  if (!competitions.selfModeEnabled && !duelOn) return [];
  const stats = selfStats(state, childId, now);
  const lines: WeekLine[] = [{ key: 'child.week.mine', count: stats.thisWeek }];
  if (!competitions.selfModeEnabled) return lines;
  if (stats.isNewRecord) lines.push({ key: 'child.week.newRecord' });
  else if (stats.record > 0) lines.push({ key: 'child.week.toRecord', count: stats.toRecord });
  return lines;
}
