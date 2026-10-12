import { HANDICAP_MAX, HANDICAP_MIN, WEEKLY_ROLLUP_HOUR } from './constants';
import { isEarned, weekStars } from './stars';
import { addDays, isWeekClosed, weekStartKey } from './time';
import { celebrate, emit, patchState, type Tx } from './tx';
import type {
  Attempt,
  EngineContext,
  FamilyState,
  WeeklyChildResult,
  WeeklyResult,
} from './types';

const MAX_WEEKS_BACK = 12;

export function handicapFor(state: FamilyState, childId: string): number {
  const value = state.competitions.handicaps[childId];
  if (typeof value !== 'number' || Number.isNaN(value)) return 1;
  return Math.min(HANDICAP_MAX, Math.max(HANDICAP_MIN, value));
}

export interface DuelScore {
  childId: string;
  stars: number;
  score: number;
}

/** Live sibling duel standings for a week (Mon–Sun), with handicap multipliers. */
export function duelScores(state: FamilyState, weekStart: string): DuelScore[] {
  return state.children
    .map((child) => {
      const stars = weekStars(state, child.id, weekStart);
      return { childId: child.id, stars, score: Math.round(stars * handicapFor(state, child.id) * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score);
}

export function duelWinners(scores: DuelScore[]): string[] {
  const top = scores.reduce((max, s) => Math.max(max, s.score), 0);
  if (top <= 0) return [];
  return scores.filter((s) => s.score === top).map((s) => s.childId);
}

export interface WeekStars {
  weekStart: string;
  stars: number;
}

/** Stars per week for the child, oldest first, ending with the current week. */
export function weeklyHistory(state: FamilyState, childId: string, nowIso: string, weeks = MAX_WEEKS_BACK): WeekStars[] {
  const tz = state.family.settings.timeZone;
  const current = weekStartKey(nowIso, tz);
  const totals = new Map<string, number>();
  for (const entry of state.ledger) {
    if (entry.childId !== childId || !isEarned(entry)) continue;
    const key = weekStartKey(entry.createdAt, tz);
    totals.set(key, (totals.get(key) ?? 0) + entry.delta);
  }
  const history: WeekStars[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = addDays(current, -7 * i);
    history.push({ weekStart, stars: totals.get(weekStart) ?? 0 });
  }
  return history;
}

/** Best week before the given week. */
export function recordBefore(state: FamilyState, childId: string, weekStart: string): number {
  const tz = state.family.settings.timeZone;
  const totals = new Map<string, number>();
  for (const entry of state.ledger) {
    if (entry.childId !== childId || !isEarned(entry)) continue;
    const key = weekStartKey(entry.createdAt, tz);
    if (key >= weekStart) continue;
    totals.set(key, (totals.get(key) ?? 0) + entry.delta);
  }
  return [...totals.values()].reduce((max, v) => Math.max(max, v), 0);
}

export interface SelfStats {
  thisWeek: number;
  lastWeek: number;
  record: number;
  toRecord: number;
  isNewRecord: boolean;
  history: WeekStars[];
}

export function selfStats(state: FamilyState, childId: string, nowIso: string): SelfStats {
  const tz = state.family.settings.timeZone;
  const current = weekStartKey(nowIso, tz);
  const thisWeek = weekStars(state, childId, current);
  const lastWeek = weekStars(state, childId, addDays(current, -7));
  const record = recordBefore(state, childId, current);
  return {
    thisWeek,
    lastWeek,
    record,
    toRecord: Math.max(0, record + 1 - thisWeek),
    isNewRecord: thisWeek > record && thisWeek > 0,
    history: weeklyHistory(state, childId, nowIso),
  };
}

/**
 * Positive, never-losing message data for a child in the weekly summary (spec 4:
 * a child never sees that it lost). The UI turns this into text.
 */
export type ChildWeekMessage =
  | { kind: 'winner' }
  | { kind: 'record'; stars: number }
  | { kind: 'toRecord'; remaining: number }
  | { kind: 'effort'; stars: number }
  | { kind: 'start' };

export function weekMessage(result: WeeklyChildResult): ChildWeekMessage {
  if (result.isWinner) return { kind: 'winner' };
  if (result.isRecord) return { kind: 'record', stars: result.stars };
  if (result.stars === 0) return { kind: 'start' };
  const remaining = result.previousRecord + 1 - result.stars;
  if (remaining > 0 && remaining <= 3) return { kind: 'toRecord', remaining };
  return { kind: 'effort', stars: result.stars };
}

function firstWeekToRoll(state: FamilyState): string {
  const tz = state.family.settings.timeZone;
  const rolled = state.weeklyResults.map((r) => r.weekStart).sort();
  const last = rolled[rolled.length - 1];
  if (last) return addDays(last, 7);
  return weekStartKey(state.family.createdAt, tz);
}

/**
 * Close finished weeks: sibling duel trophies, "Bra kämpat"-sparks and personal
 * records. Idempotent. Only the most recent closed week gets celebrations, so a
 * family returning after a long break is not flooded with old animations.
 */
export function rollupWeeks(tx: Tx, ctx: EngineContext): Tx {
  const tz = tx.state.family.settings.timeZone;
  const current = weekStartKey(ctx.now, tz);
  let weekStart = firstWeekToRoll(tx.state);
  const earliest = addDays(current, -7 * MAX_WEEKS_BACK);
  if (weekStart < earliest) weekStart = earliest;

  const closed: string[] = [];
  while (weekStart <= current && isWeekClosed(weekStart, ctx.now, tz, WEEKLY_ROLLUP_HOUR)) {
    closed.push(weekStart);
    weekStart = addDays(weekStart, 7);
  }

  let result = tx;
  closed.forEach((week, index) => {
    result = rollupOneWeek(result, ctx, week, index === closed.length - 1);
  });
  return result;
}

function rollupOneWeek(tx: Tx, ctx: EngineContext, weekStart: string, withCelebrations: boolean): Tx {
  const state = tx.state;
  const duel = state.competitions.siblingDuelEnabled && state.children.length >= 2 && state.family.plusActive;
  const scores = duelScores(state, weekStart);
  const winners = duel ? new Set(duelWinners(scores)) : new Set<string>();

  const results: WeeklyChildResult[] = scores.map((s) => {
    const previousRecord = recordBefore(state, s.childId, weekStart);
    return {
      childId: s.childId,
      stars: s.stars,
      score: s.score,
      isWinner: winners.has(s.childId),
      isRecord: s.stars > previousRecord && s.stars > 0,
      previousRecord,
    };
  });

  const weekly: WeeklyResult = {
    id: ctx.newId(),
    familyId: state.family.id,
    weekStart,
    duel,
    results,
    createdAt: ctx.now,
  };
  let next = patchState(tx, { weeklyResults: [...state.weeklyResults, weekly] });
  next = emit(next, { type: 'week_rolled_up', weekStart });
  if (!withCelebrations) return next;

  for (const r of results) {
    if (r.isWinner) {
      next = celebrate(next, ctx, r.childId, 'week_trophy', { weekStart, stars: r.stars });
    }
    if (duel) {
      const cheer: Attempt = {
        id: ctx.newId(),
        familyId: state.family.id,
        childId: r.childId,
        childChallengeId: null,
        source: 'duel',
        day: addDays(weekStart, 6),
        sparkAwarded: true,
        createdAt: ctx.now,
      };
      next = patchState(next, { attempts: [...next.state.attempts, cheer] });
    }
    if (state.competitions.selfModeEnabled && r.isRecord) {
      next = celebrate(next, ctx, r.childId, 'self_record', { weekStart, stars: r.stars });
    }
  }
  return next;
}
