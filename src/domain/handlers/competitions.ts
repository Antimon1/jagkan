import type { Command } from '../commands';
import { rollupWeeks as rollup } from '../competitions';
import { HANDICAP_MAX, HANDICAP_MIN } from '../constants';
import { cleanText, fail, isIntInRange, type HandlerResult } from '../guards';
import { familyLimits } from '../plan';
import { activeGoal } from '../progress';
import { patchState, replaceById, type Tx } from '../tx';
import type { EngineContext, FamilyGoal } from '../types';

type Cmd<T extends Command['type']> = Extract<Command, { type: T }>;

const TITLE_MAX = 60;
const TARGET_MAX = 1000;

export function setFamilyGoal(tx: Tx, cmd: Cmd<'setFamilyGoal'>, ctx: EngineContext): HandlerResult {
  if (!familyLimits(tx.state).familyGoal) return fail('plus_required');
  const title = cleanText(cmd.title, TITLE_MAX);
  const rewardText = cleanText(cmd.rewardText, TITLE_MAX);
  if (!title || !rewardText || !isIntInRange(cmd.targetStars, 1, TARGET_MAX)) return fail('invalid_input');
  if (cmd.endAt && Number.isNaN(new Date(cmd.endAt).getTime())) return fail('invalid_input');

  // Only one goal at a time: a new goal replaces the running one.
  const running = activeGoal({ ...tx.state, competitions: { ...tx.state.competitions, familyGoalEnabled: true } }, ctx.now);
  const goals = running ? replaceById(tx.state.goals, running.id, { cancelledAt: ctx.now }) : tx.state.goals;
  const goal: FamilyGoal = {
    id: ctx.newId(),
    familyId: tx.state.family.id,
    title,
    targetStars: cmd.targetStars,
    rewardText,
    startAt: ctx.now,
    endAt: cmd.endAt ?? null,
    reachedAt: null,
    cancelledAt: null,
    createdAt: ctx.now,
  };
  return patchState(tx, {
    goals: [...goals, goal],
    competitions: { ...tx.state.competitions, familyGoalEnabled: true },
  });
}

export function cancelFamilyGoal(tx: Tx, cmd: Cmd<'cancelFamilyGoal'>, ctx: EngineContext): HandlerResult {
  const goal = tx.state.goals.find((g) => g.id === cmd.goalId);
  if (!goal) return fail('not_found');
  if (goal.reachedAt || goal.cancelledAt) return tx;
  return patchState(tx, { goals: replaceById(tx.state.goals, goal.id, { cancelledAt: ctx.now }) });
}

export function updateCompetitions(tx: Tx, cmd: Cmd<'updateCompetitions'>): HandlerResult {
  const limits = familyLimits(tx.state);
  if ((cmd.familyGoalEnabled && !limits.familyGoal) || (cmd.siblingDuelEnabled && !limits.siblingDuel)) {
    return fail('plus_required');
  }
  let handicaps = tx.state.competitions.handicaps;
  if (cmd.handicaps) {
    const entries = Object.entries(cmd.handicaps);
    const valid = entries.every(
      ([childId, value]) =>
        tx.state.children.some((c) => c.id === childId) &&
        typeof value === 'number' &&
        value >= HANDICAP_MIN &&
        value <= HANDICAP_MAX,
    );
    if (!valid) return fail('invalid_input');
    handicaps = { ...handicaps, ...cmd.handicaps };
  }
  return patchState(tx, {
    competitions: {
      familyGoalEnabled: cmd.familyGoalEnabled ?? tx.state.competitions.familyGoalEnabled,
      siblingDuelEnabled: cmd.siblingDuelEnabled ?? tx.state.competitions.siblingDuelEnabled,
      selfModeEnabled: cmd.selfModeEnabled ?? tx.state.competitions.selfModeEnabled,
      handicaps,
    },
  });
}

export function rollupWeeks(tx: Tx, _cmd: Cmd<'rollupWeeks'>, ctx: EngineContext): HandlerResult {
  return rollup(tx, ctx);
}
