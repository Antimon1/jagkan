import { playableSpecies, specialFor } from './catalog';
import { STAGE_THRESHOLDS } from './constants';
import { celebrate, emit, patchState, replaceById, type Tx } from './tx';
import type {
  BranchId,
  ChildCreature,
  EngineContext,
  FamilyState,
  SpecialCreature,
  SpecialUnlock,
  Stage,
  WorldId,
} from './types';

export function stageForGrowth(growth: number): Stage {
  if (growth >= STAGE_THRESHOLDS[3]) return 3;
  if (growth >= STAGE_THRESHOLDS[2]) return 2;
  return 1;
}

/** Stars still needed to reach the next stage, or null at the final stage. */
export function starsToNextStage(growth: number): number | null {
  const stage = stageForGrowth(growth);
  if (stage === 3) return null;
  return STAGE_THRESHOLDS[(stage + 1) as Stage] - growth;
}

export function childCreaturesIn(
  state: FamilyState,
  childId: string,
  world: WorldId,
  branch?: BranchId,
): ChildCreature[] {
  return state.creatures.filter(
    (c) => c.childId === childId && c.world === world && !c.isSpecial && (branch === undefined || c.branch === branch),
  );
}

export function hasCreature(state: FamilyState, childId: string, creatureId: string): boolean {
  return state.creatures.some((c) => c.childId === childId && c.creatureId === creatureId);
}

/**
 * Hatch the next creature of a branch (slot 1, then 2, then 3) in the child's world.
 * Returns the species id, or null when every playable species is already hatched.
 */
export function hatchNext(
  tx: Tx,
  ctx: EngineContext,
  childId: string,
  world: WorldId,
  branch: BranchId,
): { tx: Tx; creatureId: string | null } {
  const owned = new Set(childCreaturesIn(tx.state, childId, world, branch).map((c) => c.creatureId));
  const next = playableSpecies(ctx.catalog, world, branch).find((s) => !owned.has(s.id));
  if (!next) return { tx, creatureId: null };

  const creature: ChildCreature = {
    id: ctx.newId(),
    familyId: tx.state.family.id,
    childId,
    creatureId: next.id,
    world,
    branch,
    isSpecial: false,
    stage: 1,
    growth: 0,
    unlockedAt: ctx.now,
  };
  let result = patchState(tx, { creatures: [...tx.state.creatures, creature] });
  result = emit(result, { type: 'creature_hatched', childId, creatureId: next.id });
  return { tx: result, creatureId: next.id };
}

/** Every star in a branch feeds all hatched creatures of that branch (spec 3.2). */
export function feedBranch(tx: Tx, ctx: EngineContext, childId: string, world: WorldId, branch: BranchId): Tx {
  const fed = childCreaturesIn(tx.state, childId, world, branch);
  let result = tx;
  for (const creature of fed) {
    const growth = creature.growth + 1;
    const stage = stageForGrowth(growth);
    result = patchState(result, {
      creatures: replaceById(result.state.creatures, creature.id, { growth, stage }),
    });
    if (stage !== creature.stage) {
      result = emit(result, { type: 'creature_evolved', childId, creatureId: creature.creatureId, stage });
      result = celebrate(result, ctx, childId, 'evolve', { creatureId: creature.creatureId, stage });
    }
  }
  return result;
}

/** Branch master: all playable creatures of a branch in a world have reached stage 3. */
export function isBranchMaster(
  state: FamilyState,
  ctx: EngineContext,
  childId: string,
  world: WorldId,
  branch: BranchId,
): boolean {
  const species = playableSpecies(ctx.catalog, world, branch);
  if (species.length === 0) return false;
  const owned = childCreaturesIn(state, childId, world, branch);
  return species.every((s) => owned.some((c) => c.creatureId === s.id && c.stage === 3));
}

/** Unlock a special creature for the child's world. No-op if already unlocked or not in the catalog. */
export function unlockSpecial(
  tx: Tx,
  ctx: EngineContext,
  childId: string,
  world: WorldId,
  unlock: SpecialUnlock,
  options: { celebrate: boolean },
): { tx: Tx; special: SpecialCreature | null } {
  const special = specialFor(ctx.catalog, world, unlock);
  if (!special || hasCreature(tx.state, childId, special.id)) return { tx, special: null };

  const creature: ChildCreature = {
    id: ctx.newId(),
    familyId: tx.state.family.id,
    childId,
    creatureId: special.id,
    world,
    branch: null,
    isSpecial: true,
    stage: 1,
    growth: 0,
    unlockedAt: ctx.now,
  };
  let result = patchState(tx, { creatures: [...tx.state.creatures, creature] });
  if (options.celebrate) {
    result = celebrate(result, ctx, childId, 'special', { creatureId: special.id, unlock: unlock.type });
  }
  return { tx: result, special };
}
