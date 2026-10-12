import type { Command } from '../domain/commands';
import { applyCommand } from '../domain/engine';
import { diffStates, snapshotToState, type FamilySnapshot, type StateDiff } from '../domain/rows';
import type { Actor, Catalog, DomainErrorCode, DomainEvent, FamilyState } from '../domain/types';

/**
 * The server side of a game command (Edge Function `game-action` and the system
 * jobs). Pure TypeScript: the Edge Functions plug in Supabase, the database tests
 * plug in PGlite. Copied to supabase/functions/_shared by scripts/sync-shared.mjs.
 */

export type ApplyOutcome = 'applied' | 'conflict' | 'duplicate';

export interface FamilyStore {
  /** The full family snapshot (server view), or null when the family does not exist. */
  loadSnapshot(familyId: string): Promise<FamilySnapshot | null>;
  /** True when the family has already applied a command with this idempotency key. */
  wasApplied(familyId: string, commandId: string): Promise<boolean>;
  /**
   * Writes the diff in one transaction. 'conflict' when another write moved the
   * family revision first, 'duplicate' when the command id was already applied.
   */
  applyDiff(input: { familyId: string; expectedRevision: number; commandId: string | null; diff: StateDiff }): Promise<ApplyOutcome>;
}

export interface CommitInput {
  familyId: string;
  command: Command;
  actor: Actor;
  /** Idempotency key from the device outbox; null for system jobs. */
  commandId: string | null;
  catalog: Catalog;
  now: () => string;
  newId: () => string;
}

export type CommitError = DomainErrorCode | 'conflict';

export type CommitResult =
  | { ok: true; state: FamilyState; events: DomainEvent[]; duplicate: boolean; changed: boolean }
  | { ok: false; error: CommitError; message?: string };

export const MAX_COMMIT_ATTEMPTS = 3;

/** True when the command changed anything besides the revision counter. */
export function hasChanges(before: FamilyState, after: FamilyState, diff: StateDiff): boolean {
  if (diff.upserts.length > 0 || diff.deletes.length > 0 || diff.competitions) return true;
  const strip = (state: FamilyState) => JSON.stringify({ ...state.family, revision: 0 });
  return strip(before) !== strip(after);
}

export async function commitCommand(store: FamilyStore, input: CommitInput): Promise<CommitResult> {
  const { familyId, actor, commandId } = input;
  if (commandId && (await store.wasApplied(familyId, commandId))) {
    const snapshot = await store.loadSnapshot(familyId);
    if (!snapshot) return { ok: false, error: 'not_found' };
    return { ok: true, state: snapshotToState(snapshot), events: [], duplicate: true, changed: false };
  }

  const { command } = input;
  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt += 1) {
    const snapshot = await store.loadSnapshot(familyId);
    if (!snapshot) return { ok: false, error: 'not_found' };
    const state = snapshotToState(snapshot);

    const result = applyCommand(state, command, actor, { now: input.now(), newId: input.newId, catalog: input.catalog });
    if (!result.ok) return { ok: false, error: result.error, message: result.message };

    const diff = diffStates(state, result.state);
    if (!hasChanges(state, result.state, diff)) {
      return { ok: true, state, events: result.events, duplicate: false, changed: false };
    }

    const outcome = await store.applyDiff({ familyId, expectedRevision: state.family.revision, commandId, diff });
    if (outcome === 'conflict') continue;
    if (outcome === 'duplicate') {
      const fresh = await store.loadSnapshot(familyId);
      return { ok: true, state: fresh ? snapshotToState(fresh) : state, events: [], duplicate: true, changed: false };
    }
    return { ok: true, state: result.state, events: result.events, duplicate: false, changed: true };
  }
  return { ok: false, error: 'conflict' };
}
