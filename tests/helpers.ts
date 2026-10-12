import { catalog } from '@/data/catalog';
import { applyCommand } from '@/domain/engine';
import { createFamilyState } from '@/domain/factory';
import type { Command } from '@/domain/commands';
import { FULL_GAME_SCOPE } from '@/domain/launch';
import type { Actor, BranchId, Catalog, DomainEvent, EngineContext, FamilyState } from '@/domain/types';

export const PARENT_ID = 'parent-1';
export const PARENT: Actor = { kind: 'parent', parentId: PARENT_ID };
export const SYSTEM: Actor = { kind: 'system' };

/** Wednesday 2026-10-07 10:00 in Stockholm. */
export const START = '2026-10-07T08:00:00.000Z';

/** The whole game, including the content frozen for the beta (src/domain/launch.ts). */
export const fullGameCatalog: Catalog = { ...catalog, scope: FULL_GAME_SCOPE };

export function makeCtx(now: string = START, prefix = 'id', gameCatalog: Catalog = catalog): EngineContext {
  let n = 0;
  return {
    now,
    newId: () => {
      n += 1;
      return `${prefix}-${n}`;
    },
    catalog: gameCatalog,
  };
}

export function emptyFamily(now: string = START): FamilyState {
  return createFamilyState({
    familyId: 'family-1',
    familyName: 'Familjen Test',
    parentId: PARENT_ID,
    parentName: 'Förälder',
    now,
  });
}

/** Deep-freeze so tests fail loudly if the engine mutates its input. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export class Driver {
  state: FamilyState;
  events: DomainEvent[] = [];
  private seq = 0;
  now: string;
  catalog: Catalog = catalog;

  constructor(state: FamilyState = emptyFamily(), now: string = START) {
    this.state = state;
    this.now = now;
  }

  at(now: string): this {
    this.now = now;
    return this;
  }

  /** Play with every world, all creature slots and the specials (frozen in the beta). */
  fullGame(): this {
    this.catalog = fullGameCatalog;
    return this;
  }

  /** Advance the clock by whole days (keeps the same time of day). */
  addDays(days: number): this {
    this.now = new Date(new Date(this.now).getTime() + days * 86_400_000).toISOString();
    return this;
  }

  run(command: Command, actor: Actor = PARENT): FamilyState {
    const result = this.try(command, actor);
    if (!result.ok) throw new Error(`${command.type} failed: ${result.error} ${result.message ?? ''}`);
    return this.state;
  }

  try(command: Command, actor: Actor = PARENT) {
    this.seq += 1;
    const result = applyCommand(deepFreeze(this.state), command, actor, makeCtx(this.now, `c${this.seq}`, this.catalog));
    if (result.ok) {
      this.state = result.state;
      this.events = result.events;
    }
    return result;
  }

  addChild(firstName: string, birthYear: number, birthMonth = 1): string {
    this.run({ type: 'addChild', firstName, birthYear, birthMonth });
    return this.state.children[this.state.children.length - 1].id;
  }

  activate(childId: string, templateId: string): string {
    this.run({ type: 'activateTemplate', childId, templateId });
    return this.state.challenges[this.state.challenges.length - 1].id;
  }

  custom(childId: string, branch: BranchId, title = 'Egen utmaning', repeatable = false): string {
    this.run({ type: 'addCustomChallenge', childId, title, branch, icon: '⭐', repeatable });
    return this.state.challenges[this.state.challenges.length - 1].id;
  }

  /** Complete a fresh custom challenge in a branch (activate + approve). */
  completeIn(childId: string, branch: BranchId): string {
    const id = this.custom(childId, branch);
    this.run({ type: 'approveCompletion', challengeId: id });
    return id;
  }
}

export function freeTemplate(branch?: string, ageMax = 6): string {
  const t = catalog.templates.find(
    (x) => !x.isPlus && !x.retired && x.reward === 'star' && x.ageMax <= ageMax && (!branch || x.branch === branch),
  );
  if (!t) throw new Error('no free template');
  return t.id;
}

export function plusTemplate(ageMax = 6): string {
  const t = catalog.templates.find((x) => x.isPlus && !x.retired && x.reward === 'star' && x.ageMax <= ageMax);
  if (!t) throw new Error('no plus template');
  return t.id;
}
