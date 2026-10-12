import { addDays, dayKey } from './time';
import type { FamilyState } from './types';

export interface FamilyStats {
  periodDays: number;
  /** "Jag försökte!" from the children (parent sparks and duel sparks not included). */
  attempts: number;
  approvals: number;
  hatched: number;
  /** Days with at least one attempt or approval. */
  activeDays: number;
  /** Approvals per week, oldest first, for the last four weeks. */
  approvalsPerWeek: number[];
}

/**
 * The family's own statistics (idépanelen: first-party, no third parties). Counted
 * from data the family already has, so nothing new is tracked.
 */
export function familyStats(state: FamilyState, nowIso: string, periodDays = 28): FamilyStats {
  const tz = state.family.settings.timeZone;
  const today = dayKey(nowIso, tz);
  const first = addDays(today, -(periodDays - 1));
  const inPeriod = (iso: string) => {
    const day = dayKey(iso, tz);
    return day >= first && day <= today;
  };

  const attempts = state.attempts.filter((a) => a.source === 'child' && a.childChallengeId !== null && inPeriod(a.createdAt));
  const approvals = state.completions.filter((c) => inPeriod(c.approvedAt));
  const hatched = state.creatures.filter((c) => !c.isSpecial && inPeriod(c.unlockedAt));
  const activeDays = new Set([...attempts.map((a) => a.createdAt), ...approvals.map((c) => c.approvedAt)].map((iso) => dayKey(iso, tz)));

  const approvalsPerWeek = [3, 2, 1, 0].map((weeksAgo) => {
    const end = addDays(today, -7 * weeksAgo);
    const start = addDays(end, -6);
    return state.completions.filter((c) => {
      const day = dayKey(c.approvedAt, tz);
      return day >= start && day <= end;
    }).length;
  });

  return {
    periodDays,
    attempts: attempts.length,
    approvals: approvals.length,
    hatched: hatched.length,
    activeDays: activeDays.size,
    approvalsPerWeek,
  };
}
