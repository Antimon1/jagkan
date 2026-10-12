import { ageAt, childAge, graduationTarget, worldForAge } from '../age';
import type { Command } from '../commands';
import { MAX_ACTIVE_LIMIT, MAX_AGE } from '../constants';
import { unlockSpecial } from '../creatures';
import { cleanText, fail, isIntInRange, isWorld, type HandlerResult } from '../guards';
import { familyLimits } from '../plan';
import { localParts } from '../time';
import { patchState, replaceById, type Tx } from '../tx';
import type { Child, EngineContext, FamilySettings } from '../types';

type Cmd<T extends Command['type']> = Extract<Command, { type: T }>;

const NAME_MAX = 30;
const FAMILY_NAME_MAX = 50;
/** Spec: 4–13 years. We accept a little outside so a 3-year-old sibling can join early. */
const ACCEPTED_MIN_AGE = 3;
const ACCEPTED_MAX_AGE = MAX_AGE + 1;

export function renameFamily(tx: Tx, cmd: Cmd<'renameFamily'>): HandlerResult {
  const name = cleanText(cmd.name, FAMILY_NAME_MAX);
  if (!name) return fail('invalid_input');
  return patchState(tx, { family: { ...tx.state.family, name } });
}

export function updateSettings(tx: Tx, cmd: Cmd<'updateSettings'>): HandlerResult {
  const current = tx.state.family.settings;
  const { notifications, ...rest } = cmd.settings;
  if (rest.maxActiveChallenges !== undefined && !isIntInRange(rest.maxActiveChallenges, 1, MAX_ACTIVE_LIMIT)) {
    return fail('invalid_input');
  }
  if (notifications?.reminderHour !== undefined && !isIntInRange(notifications.reminderHour, 0, 23)) {
    return fail('invalid_input');
  }
  const settings: FamilySettings = {
    ...current,
    ...pickBooleans(rest),
    maxActiveChallenges: rest.maxActiveChallenges ?? current.maxActiveChallenges,
    locale: typeof rest.locale === 'string' ? rest.locale : current.locale,
    timeZone: typeof rest.timeZone === 'string' ? rest.timeZone : current.timeZone,
    notifications: {
      ...current.notifications,
      ...(notifications ?? {}),
    },
  };
  return patchState(tx, { family: { ...tx.state.family, settings } });
}

function pickBooleans(input: Partial<FamilySettings>): Partial<FamilySettings> {
  const out: Partial<FamilySettings> = {};
  if (typeof input.sparkBonusEnabled === 'boolean') out.sparkBonusEnabled = input.sparkBonusEnabled;
  if (typeof input.soundEnabled === 'boolean') out.soundEnabled = input.soundEnabled;
  if (typeof input.speechEnabled === 'boolean') out.speechEnabled = input.speechEnabled;
  return out;
}

export function setPlus(tx: Tx, cmd: Cmd<'setPlus'>): HandlerResult {
  const plusActive = cmd.active === true;
  let result = patchState(tx, { family: { ...tx.state.family, plusActive } });
  if (!plusActive) {
    // Plus-only competition modes switch off with the subscription.
    result = patchState(result, {
      competitions: { ...result.state.competitions, familyGoalEnabled: false, siblingDuelEnabled: false },
    });
  }
  return result;
}

function validBirth(birthYear: unknown, birthMonth: unknown, ctx: EngineContext, timeZone: string): boolean {
  const nowYear = localParts(ctx.now, timeZone).year;
  if (!isIntInRange(birthYear, nowYear - 20, nowYear) || !isIntInRange(birthMonth, 1, 12)) return false;
  const age = ageAt(birthYear, birthMonth, ctx.now, timeZone);
  return age >= ACCEPTED_MIN_AGE && age <= ACCEPTED_MAX_AGE;
}

export function addChild(tx: Tx, cmd: Cmd<'addChild'>, ctx: EngineContext): HandlerResult {
  const { state } = tx;
  const firstName = cleanText(cmd.firstName, NAME_MAX);
  const tz = state.family.settings.timeZone;
  if (!firstName || !validBirth(cmd.birthYear, cmd.birthMonth, ctx, tz)) return fail('invalid_input');
  if (state.children.length >= familyLimits(state).maxChildren) return fail('plus_required');
  const child: Child = {
    id: ctx.newId(),
    familyId: state.family.id,
    firstName,
    birthYear: cmd.birthYear,
    birthMonth: cmd.birthMonth,
    world: worldForAge(ageAt(cmd.birthYear, cmd.birthMonth, ctx.now, tz)),
    avatarCreatureId: null,
    graduationSnoozedAt: null,
    createdAt: ctx.now,
  };
  return patchState(tx, { children: [...state.children, child] });
}

export function updateChild(tx: Tx, cmd: Cmd<'updateChild'>, ctx: EngineContext): HandlerResult {
  const child = tx.state.children.find((c) => c.id === cmd.childId);
  if (!child) return fail('not_found');
  const firstName = cmd.firstName === undefined ? child.firstName : cleanText(cmd.firstName, NAME_MAX);
  const birthYear = cmd.birthYear ?? child.birthYear;
  const birthMonth = cmd.birthMonth ?? child.birthMonth;
  if (!firstName || !validBirth(birthYear, birthMonth, ctx, tx.state.family.settings.timeZone)) {
    return fail('invalid_input');
  }
  return patchState(tx, {
    children: replaceById(tx.state.children, child.id, { firstName, birthYear, birthMonth }),
  });
}

export function removeChild(tx: Tx, cmd: Cmd<'removeChild'>): HandlerResult {
  const { state } = tx;
  if (!state.children.some((c) => c.id === cmd.childId)) return fail('not_found');
  const keep = <T extends { childId: string }>(list: T[]): T[] => list.filter((item) => item.childId !== cmd.childId);
  const handicaps = Object.fromEntries(
    Object.entries(state.competitions.handicaps).filter(([childId]) => childId !== cmd.childId),
  );
  return patchState(tx, {
    children: state.children.filter((c) => c.id !== cmd.childId),
    challenges: keep(state.challenges),
    attempts: keep(state.attempts),
    completions: keep(state.completions),
    creatures: keep(state.creatures),
    milestones: keep(state.milestones),
    ledger: keep(state.ledger),
    rewardRequests: keep(state.rewardRequests),
    celebrations: keep(state.celebrations),
    rewards: state.rewards.map((r) => (r.childId === cmd.childId ? { ...r, childId: null, active: false } : r)),
    competitions: { ...state.competitions, handicaps },
    weeklyResults: state.weeklyResults.map((w) => ({
      ...w,
      results: w.results.filter((r) => r.childId !== cmd.childId),
    })),
  });
}

/**
 * Switch world. Free plan: only the world that fits the child's age (spec 13).
 * Moving up from the previous band is the "examen" and unlocks a diploma creature.
 */
export function changeWorld(tx: Tx, cmd: Cmd<'changeWorld'>, ctx: EngineContext): HandlerResult {
  const child = tx.state.children.find((c) => c.id === cmd.childId);
  if (!child) return fail('not_found');
  if (!isWorld(cmd.world)) return fail('invalid_input');
  if (child.world === cmd.world) return tx;
  const tz = tx.state.family.settings.timeZone;
  const ageWorld = worldForAge(childAge(child, ctx.now, tz));
  if (!familyLimits(tx.state).allWorlds && cmd.world !== ageWorld) return fail('plus_required');

  const isGraduation = graduationTarget({ ...child, graduationSnoozedAt: null }, ctx.now, tz) === cmd.world;
  let result = tx;
  if (isGraduation) {
    result = unlockSpecial(result, ctx, child.id, child.world, { type: 'graduation' }, { celebrate: true }).tx;
  }
  return patchState(result, {
    children: replaceById(result.state.children, child.id, { world: cmd.world, graduationSnoozedAt: null }),
  });
}

export function snoozeGraduation(tx: Tx, cmd: Cmd<'snoozeGraduation'>, ctx: EngineContext): HandlerResult {
  if (!tx.state.children.some((c) => c.id === cmd.childId)) return fail('not_found');
  return patchState(tx, {
    children: replaceById(tx.state.children, cmd.childId, { graduationSnoozedAt: ctx.now }),
  });
}

export function setAvatar(tx: Tx, cmd: Cmd<'setAvatar'>): HandlerResult {
  if (!tx.state.children.some((c) => c.id === cmd.childId)) return fail('not_found');
  const owned = tx.state.creatures.some((c) => c.childId === cmd.childId && c.creatureId === cmd.creatureId);
  if (!owned) return fail('forbidden');
  return patchState(tx, {
    children: replaceById(tx.state.children, cmd.childId, { avatarCreatureId: cmd.creatureId }),
  });
}

export function markCelebrationsSeen(tx: Tx, cmd: Cmd<'markCelebrationsSeen'>, ctx: EngineContext): HandlerResult {
  const ids = new Set(cmd.celebrationIds);
  return patchState(tx, {
    celebrations: tx.state.celebrations.map((c) =>
      c.childId === cmd.childId && ids.has(c.id) && !c.seenAt ? { ...c, seenAt: ctx.now } : c,
    ),
  });
}
