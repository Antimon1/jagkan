import { commitCommand, hasChanges, MAX_COMMIT_ATTEMPTS, type ApplyOutcome, type FamilyStore } from '@/backend/commit';
import { catalog } from '@/data/catalog';
import type { Command } from '@/domain/commands';
import { COLLECTION_TABLES, diffStates, snapshotToState, stateToSnapshot, type CollectionKey, type StateDiff } from '@/domain/rows';
import type { FamilyState } from '@/domain/types';

import { Driver, emptyFamily, freeTemplate, PARENT, START } from '../helpers';

/** In-memory stand-in for the database: applies diffs to a stored snapshot. */
class MemoryStore implements FamilyStore {
  applied = new Set<string>();
  writes: StateDiff[] = [];
  /** Outcomes to return before applying for real (simulates concurrent writers). */
  forced: ApplyOutcome[] = [];

  constructor(public state: FamilyState | null) {}

  async loadSnapshot() {
    return this.state ? stateToSnapshot(this.state) : null;
  }

  async wasApplied(_familyId: string, commandId: string) {
    return this.applied.has(commandId);
  }

  async applyDiff(input: { expectedRevision: number; commandId: string | null; diff: StateDiff }): Promise<ApplyOutcome> {
    const forced = this.forced.shift();
    if (forced) return forced;
    if (!this.state || input.expectedRevision !== this.state.family.revision) return 'conflict';
    if (input.commandId) this.applied.add(input.commandId);
    this.writes.push(input.diff);
    const snapshot = stateToSnapshot(this.state);
    for (const { table, rows } of input.diff.upserts) {
      const key = (Object.keys(COLLECTION_TABLES) as CollectionKey[]).find((k) => COLLECTION_TABLES[k] === table) as CollectionKey;
      const existing = snapshot[key] as Record<string, unknown>[];
      const ids = new Set(rows.map((r) => r.id));
      (snapshot as unknown as Record<string, unknown>)[key] = [...existing.filter((r) => !ids.has(r.id)), ...rows];
    }
    if (input.diff.family) snapshot.family = input.diff.family;
    if (input.diff.competitions) snapshot.competitions = input.diff.competitions;
    this.state = snapshotToState(snapshot);
    return 'applied';
  }
}

function seeded(): { store: MemoryStore; childId: string; challengeId: string } {
  const driver = new Driver();
  const childId = driver.addChild('Evelyn', 2021);
  const challengeId = driver.activate(childId, freeTemplate());
  return { store: new MemoryStore(driver.state), childId, challengeId };
}

function input(command: Command, commandId: string | null = 'cmd-1') {
  let n = 0;
  return {
    familyId: 'family-1',
    command,
    actor: PARENT,
    commandId,
    catalog,
    now: () => START,
    newId: () => `srv-${(n += 1)}`,
  };
}

describe('commitCommand', () => {
  it('applies a command and writes only the changed rows', async () => {
    const { store, challengeId } = seeded();
    const result = await commitCommand(store, input({ type: 'giveSpark', challengeId }));

    expect(result.ok && result.changed).toBe(true);
    expect(store.state?.challenges[0].sparks).toBe(1);
    const tables = store.writes[0].upserts.map((u) => u.table);
    expect(tables).toEqual(expect.arrayContaining(['child_challenges', 'attempts']));
    expect(tables).not.toContain('children');
  });

  it('returns the stored state for a command id it has already applied', async () => {
    const { store, challengeId } = seeded();
    await commitCommand(store, input({ type: 'requestCompletion', challengeId }));
    const again = await commitCommand(store, input({ type: 'requestCompletion', challengeId }));

    expect(again).toMatchObject({ ok: true, duplicate: true, changed: false });
    expect(store.writes).toHaveLength(1);
  });

  it('passes domain errors through without writing', async () => {
    const { store } = seeded();
    const result = await commitCommand(store, input({ type: 'giveSpark', challengeId: 'missing' }));

    expect(result).toEqual({ ok: false, error: 'not_found', message: undefined });
    expect(store.writes).toHaveLength(0);
  });

  it('retries on a revision conflict and gives up after the limit', async () => {
    const { store, challengeId } = seeded();
    store.forced = ['conflict'];
    expect((await commitCommand(store, input({ type: 'giveSpark', challengeId }))).ok).toBe(true);

    store.forced = Array(MAX_COMMIT_ATTEMPTS).fill('conflict');
    expect(await commitCommand(store, input({ type: 'giveSpark', challengeId }, 'cmd-2'))).toEqual({ ok: false, error: 'conflict' });
  });

  it('skips the write when nothing but the revision would change', async () => {
    const { store } = seeded();
    const result = await commitCommand(store, { ...input({ type: 'rollupWeeks' }, null), actor: { kind: 'system' } });

    expect(result).toMatchObject({ ok: true, changed: false });
    expect(store.writes).toHaveLength(0);
  });

  it('runs prepare once and uses the prepared command', async () => {
    const { store, challengeId } = seeded();
    const prepare = jest.fn(async (_state: FamilyState, command: Command) => ({ ...command, cardText: 'Evelyn klarade det!' }) as Command);
    store.forced = ['conflict'];
    await commitCommand(store, { ...input({ type: 'approveCompletion', challengeId }), prepare });

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(store.state?.completions[0].cardText).toBe('Evelyn klarade det!');
  });

  it('reports a missing family', async () => {
    const store = new MemoryStore(null);
    expect(await commitCommand(store, input({ type: 'rollupWeeks' }))).toEqual({ ok: false, error: 'not_found' });
  });

  it('hasChanges ignores the revision counter only', () => {
    const before = emptyFamily();
    const bumped = { ...before, family: { ...before.family, revision: 5 } };
    expect(hasChanges(before, bumped, diffStates(before, bumped))).toBe(false);
    const renamed = { ...bumped, family: { ...bumped.family, name: 'Nytt' } };
    expect(hasChanges(before, renamed, diffStates(before, renamed))).toBe(true);
  });
});
