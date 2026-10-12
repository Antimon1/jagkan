import { BAND_BY_WORLD, GRADUATION_SNOOZE_DAYS, MAX_AGE, MIN_AGE, WORLD_BY_BAND } from './constants';
import { daysBetween, localParts } from './time';
import type { AgeBand, Catalog, Child, WorldId } from './types';

/**
 * Age in whole years. We only store birth year and month (spec 12), so the
 * birthday counts as reached on the first day of the birth month.
 */
export function ageAt(birthYear: number, birthMonth: number, nowIso: string, timeZone: string): number {
  const now = localParts(nowIso, timeZone);
  const age = now.year - birthYear - (now.month < birthMonth ? 1 : 0);
  return Math.max(0, age);
}

export function childAge(child: Pick<Child, 'birthYear' | 'birthMonth'>, nowIso: string, timeZone: string): number {
  return ageAt(child.birthYear, child.birthMonth, nowIso, timeZone);
}

export function bandForAge(age: number): AgeBand {
  if (age <= 6) return 1;
  if (age <= 9) return 2;
  return 3;
}

export function worldForAge(age: number): WorldId {
  return WORLD_BY_BAND[bandForAge(age)];
}

/**
 * The world for an age inside the game scope (src/domain/launch.ts): the world of
 * the age band, or else the closest playable world below it. In the beta every
 * child plays in Äggdalen.
 */
export function playableWorldForAge(catalog: Catalog, age: number): WorldId {
  const { worlds } = catalog.scope;
  const preferred = worldForAge(age);
  if (worlds.includes(preferred)) return preferred;
  const below = worlds.filter((w) => BAND_BY_WORLD[w] <= bandForAge(age));
  return below.sort((a, b) => BAND_BY_WORLD[b] - BAND_BY_WORLD[a])[0] ?? worlds[0];
}

export function isSupportedAge(age: number): boolean {
  return age >= MIN_AGE && age <= MAX_AGE;
}

/**
 * When a child has grown into a new age band, the app suggests an "examen"
 * (spec 5). Returns the next world, or null when no graduation is due, the next
 * world is not playable yet or the child recently said "not yet".
 */
export function graduationTarget(
  child: Child,
  nowIso: string,
  timeZone: string,
  playableWorlds: readonly WorldId[],
): WorldId | null {
  const ageBand = bandForAge(childAge(child, nowIso, timeZone));
  const worldBand = BAND_BY_WORLD[child.world];
  if (ageBand <= worldBand) return null;
  if (child.graduationSnoozedAt && daysBetween(child.graduationSnoozedAt, nowIso) < GRADUATION_SNOOZE_DAYS) {
    return null;
  }
  const next = WORLD_BY_BAND[(worldBand + 1) as AgeBand];
  return playableWorlds.includes(next) ? next : null;
}
