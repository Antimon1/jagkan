import type { Command } from '@/domain/commands';
import type { FamilyState } from '@/domain/types';
import type { CommitOutcome, GameBackend } from '@/state/backend';
import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';

import { Driver, PARENT_ID } from '../helpers';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let idCounter = 0;
jest.mock('@/lib/ids', () => ({ newId: () => `store-${(idCounter += 1)}` }));

/** A family with one child and one active egg. */
function family(): { state: FamilyState; childId: string; challengeId: string } {
  const d = new Driver();
  const childId = d.addChild('Evelyn', 2020);
  const challengeId = d.custom(childId, 'kropp');
  return { state: d.state, childId, challengeId };
}

function fakeBackend(kind: 'local' | 'cloud', loaded: FamilyState | null, outcomes: (CommitOutcome | Error)[] = []) {
  let remote: ((state: FamilyState) => void) | null = null;
  let pendingCount = 0;
  const commits: Command[] = [];
  const backend: GameBackend = {
    kind,
    load: jest.fn(async () => loaded),
    commit: jest.fn(async (command: Command) => {
      commits.push(command);
      const outcome = outcomes.shift() ?? { status: 'saved' };
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }),
    watch: (onRemote) => {
      remote = onRemote;
      return () => {
        remote = null;
      };
    },
    pending: () => pendingCount,
    flush: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  };
  return {
    backend,
    commits,
    outcomes,
    setPending: (n: number) => {
      pendingCount = n;
    },
    pushRemote: (state: FamilyState) => remote?.(state),
  };
}

const store = () => useGameStore.getState();

describe('game store (optimistic updates, rollback and sync)', () => {
  beforeEach(() => {
    idCounter = 0;
    useGameStore.setState({ status: 'idle', family: null, backend: null, parentId: null, pending: 0, lastEvents: [], lastError: null });
    useDeviceStore.getState().reset();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('loads a local family, picks its parent and closes finished weeks', async () => {
    const { state } = family();
    const fake = fakeBackend('local', state);
    await store().init(fake.backend);

    expect(store().status).toBe('ready');
    expect(store().parentId).toBe(PARENT_ID);
    expect(fake.commits.map((c) => c.type)).toEqual(['rollupWeeks']);
  });

  it('reports an empty device and a failing load', async () => {
    await store().init(fakeBackend('local', null).backend);
    expect(store().status).toBe('empty');

    const broken = fakeBackend('cloud', null);
    (broken.backend.load as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await store().init(broken.backend);
    expect(store()).toMatchObject({ status: 'error', lastError: 'offline' });
  });

  it('applies a command at once and keeps it while it waits in the offline queue', async () => {
    const { state, challengeId } = family();
    const fake = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(fake.backend, PARENT_ID);

    fake.outcomes.push({ status: 'queued' });
    fake.setPending(1);
    const result = await store().dispatch({ type: 'giveSpark', challengeId });

    expect(result.ok).toBe(true);
    expect(store().family?.challenges[0].sparks).toBe(1);
    expect(store().pending).toBe(1);
  });

  it('rolls back to the server state when the server refuses', async () => {
    const { state, challengeId } = family();
    const fake = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(fake.backend, PARENT_ID);

    fake.outcomes.push({ status: 'rejected', error: 'invalid_status', state });
    await store().dispatch({ type: 'giveSpark', challengeId });

    expect(store().family?.challenges[0].sparks).toBe(0);
    expect(store().lastError).toBe('invalid_status');
  });

  it('rolls back to the previous state when a refusal comes without a state', async () => {
    const { state, challengeId } = family();
    const fake = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(fake.backend, PARENT_ID);
    const before = store().family;

    fake.outcomes.push({ status: 'rejected', error: 'forbidden', state: null });
    await store().dispatch({ type: 'giveSpark', challengeId });
    expect(store().family).toBe(before);
  });

  it('keeps the optimistic state and reports the error when sending throws', async () => {
    const { state, challengeId } = family();
    const fake = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(fake.backend, PARENT_ID);

    fake.outcomes.push(new Error('network down'));
    await store().dispatch({ type: 'giveSpark', challengeId });
    expect(store().family?.challenges[0].sparks).toBe(1);
    expect(store().lastError).toBe('network down');
  });

  it('does not send commands the engine refuses', async () => {
    const { state } = family();
    const fake = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(fake.backend, PARENT_ID);

    const result = await store().dispatch({ type: 'giveSpark', challengeId: 'missing' });
    expect(result).toMatchObject({ ok: false, error: 'not_found' });
    expect(fake.commits.map((c) => c.type)).toEqual(['rollupWeeks']);
  });

  it('ignores an older remote state while its own commands are still queued', async () => {
    const { state, challengeId } = family();
    const fake = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(fake.backend, PARENT_ID);
    fake.outcomes.push({ status: 'queued' });
    fake.setPending(1);
    await store().dispatch({ type: 'giveSpark', challengeId });

    fake.pushRemote(state);
    expect(store().family?.challenges[0].sparks).toBe(1);

    fake.setPending(0);
    const newer = { ...state, family: { ...state.family, revision: (store().family?.family.revision ?? 0) + 5 } };
    fake.pushRemote(newer);
    expect(store().family?.family.revision).toBe(newer.family.revision);
  });

  it('acts as the child in child mode, so parent-only commands are refused', async () => {
    const { state, childId, challengeId } = family();
    const fake = fakeBackend('local', state);
    await store().init(fake.backend);
    useDeviceStore.getState().enterChildMode(childId);

    expect(await store().dispatch({ type: 'giveSpark', challengeId })).toMatchObject({ ok: false, error: 'forbidden' });
    expect(await store().dispatch({ type: 'recordAttempt', challengeId })).toMatchObject({ ok: true });
  });

  it('only allows trusted system commands in local mode', async () => {
    const { state } = family();
    const cloud = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(cloud.backend, PARENT_ID);
    expect(await store().dispatchSystem({ type: 'setPlus', active: true })).toMatchObject({ ok: false, error: 'forbidden' });

    await store().init(fakeBackend('local', state).backend);
    expect(await store().dispatchSystem({ type: 'setPlus', active: true })).toMatchObject({ ok: true });
    expect(store().family?.family.plusActive).toBe(true);
  });

  it('refresh sends the queue first and then shows the server state', async () => {
    const { state } = family();
    const fake = fakeBackend('cloud', state, [{ status: 'synced', state }]);
    await store().init(fake.backend, PARENT_ID);
    const renamed = { ...state, family: { ...state.family, name: 'Nytt namn', revision: 99 } };
    (fake.backend.load as jest.Mock).mockResolvedValueOnce(renamed);

    await store().refresh();
    expect(fake.backend.flush).toHaveBeenCalled();
    expect(store().family?.family.name).toBe('Nytt namn');
  });

  it('replace swaps the whole family and saves it in local mode', async () => {
    const fake = fakeBackend('local', null);
    await store().init(fake.backend);
    const { state } = family();

    await store().replace(state);
    expect(store()).toMatchObject({ status: 'ready', parentId: PARENT_ID });
    expect(fake.backend.commit).toHaveBeenCalledWith({ type: 'rollupWeeks' }, state);

    await store().replace(null);
    expect(store().status).toBe('empty');
  });

  it('reset clears the family and the backend storage', async () => {
    const { state } = family();
    const fake = fakeBackend('local', state);
    await store().init(fake.backend);
    await store().reset();

    expect(store()).toMatchObject({ family: null, status: 'empty', pending: 0 });
    expect(fake.backend.clear).toHaveBeenCalled();
  });
});
