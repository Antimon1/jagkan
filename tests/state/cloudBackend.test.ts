import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Command } from '@/domain/commands';
import { stateToSnapshot } from '@/domain/rows';
import { STORAGE_KEYS } from '@/lib/storage';
import { createCloudBackend } from '@/state/cloudBackend';

import { emptyFamily } from '../helpers';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let idCounter = 0;
jest.mock('@/lib/ids', () => ({ newId: () => `cmd-${(idCounter += 1)}` }));

type Reply = 'ok' | 'offline' | 'busy' | { reject: string } | { rejectHttp: string };

interface Sent {
  commandId: string;
  command: Command;
  clientAt: string;
}

/** A stand-in for the Supabase client: the game-action function answers from `replies`. */
function fakeSupabase(replies: Reply[] = []) {
  const state = emptyFamily();
  const sent: Sent[] = [];
  const http = (status: number, body: unknown) => ({
    data: null,
    error: { message: `HTTP ${status}`, context: { status, json: async () => body } },
  });
  const handlers: (() => void)[] = [];
  interface FakeChannel {
    on: (event: string, filter: unknown, handler: () => void) => FakeChannel;
    subscribe: () => FakeChannel;
  }
  const channel: FakeChannel = {
    on: jest.fn((_event: string, _filter: unknown, handler: () => void) => {
      handlers.push(handler);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const client = {
    sent,
    replies,
    handlers,
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(async () => 'ok'),
    rpc: jest.fn(async () => ({ data: stateToSnapshot(state), error: null })),
    functions: {
      invoke: jest.fn(async (_name: string, { body }: { body: Sent }) => {
        sent.push(body);
        const reply = replies.length ? replies.shift() : 'ok';
        if (reply === 'offline') return { data: null, error: new Error('Failed to fetch') };
        if (reply === 'busy') return http(503, { ok: false, error: 'busy' });
        if (typeof reply === 'object' && 'rejectHttp' in reply) return http(422, { ok: false, error: reply.rejectHttp });
        if (typeof reply === 'object' && 'reject' in reply) return { data: { ok: false, error: reply.reject }, error: null };
        return { data: { ok: true, snapshot: stateToSnapshot(state) }, error: null };
      }),
    },
  };
  return client;
}

const asClient = (fake: ReturnType<typeof fakeSupabase>) => fake as unknown as SupabaseClient;
const spark = (challengeId: string): Command => ({ type: 'recordAttempt', challengeId });
const next = emptyFamily();

async function storedQueue(): Promise<{ id: string }[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.outbox);
  return raw ? JSON.parse(raw) : [];
}

describe('cloud backend: the offline queue (spec 15: works offline for the child)', () => {
  const backends: { clear: () => Promise<void> }[] = [];
  const create = async (fake: ReturnType<typeof fakeSupabase>) => {
    const backend = await createCloudBackend(asClient(fake));
    backends.push(backend);
    return backend;
  };

  beforeEach(async () => {
    idCounter = 0;
    await AsyncStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await Promise.all(backends.splice(0).map((b) => b.clear()));
    jest.restoreAllMocks();
  });

  it('sends a command and returns the server state', async () => {
    const fake = fakeSupabase();
    const backend = await create(fake);
    const outcome = await backend.commit(spark('a'), next);

    expect(outcome).toMatchObject({ status: 'synced', state: { family: { id: next.family.id } } });
    expect(fake.sent).toEqual([{ commandId: 'cmd-1', command: spark('a'), clientAt: expect.any(String) }]);
    expect(backend.pending()).toBe(0);
    expect(await storedQueue()).toEqual([]);
  });

  it('keeps commands in order while offline and stores them on the device', async () => {
    const fake = fakeSupabase(['offline', 'offline']);
    const backend = await create(fake);

    expect(await backend.commit(spark('a'), next)).toEqual({ status: 'queued' });
    expect(await backend.commit(spark('b'), next)).toEqual({ status: 'queued' });
    expect(backend.pending()).toBe(2);
    expect((await storedQueue()).map((q) => q.id)).toEqual(['cmd-1', 'cmd-2']);

    await backend.flush();
    expect(backend.pending()).toBe(0);
    // The oldest command is always retried first, with the same idempotency key:
    // the second command is never sent before the first one has been accepted.
    expect(fake.sent.map((s) => s.commandId)).toEqual(['cmd-1', 'cmd-1', 'cmd-1', 'cmd-2']);
    expect(fake.sent.at(-1)?.command).toEqual(spark('b'));
  });

  it('keeps the time the child acted, not the time the queue was sent', async () => {
    const fake = fakeSupabase(['offline']);
    const backend = await create(fake);
    await backend.commit(spark('a'), next);
    const queuedAt = fake.sent[0].clientAt;

    await backend.flush();
    expect(fake.sent[1].clientAt).toBe(queuedAt);
  });

  it('sends a stored queue after a restart', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.outbox,
      JSON.stringify([{ id: 'saved-1', command: spark('a'), clientAt: '2026-10-07T08:00:00.000Z' }]),
    );
    const fake = fakeSupabase();
    const backend = await create(fake);

    expect(backend.pending()).toBe(1);
    await backend.flush();
    expect(fake.sent).toEqual([{ commandId: 'saved-1', command: spark('a'), clientAt: '2026-10-07T08:00:00.000Z' }]);
    expect(backend.pending()).toBe(0);
  });

  it('drops a refused command, reports it with fresh state and goes on with the rest', async () => {
    const fake = fakeSupabase([{ reject: 'invalid_status' }]);
    const backend = await create(fake);
    const outcome = await backend.commit(spark('a'), next);

    expect(outcome).toMatchObject({ status: 'rejected', error: 'invalid_status', state: { family: { id: next.family.id } } });
    expect(fake.rpc).toHaveBeenCalledWith('jk_my_snapshot');
    expect(backend.pending()).toBe(0);
    expect(await backend.commit(spark('b'), next)).toMatchObject({ status: 'synced' });
  });

  it('treats a 4xx answer as refused but keeps the command on 503 (server busy)', async () => {
    const refused = fakeSupabase([{ rejectHttp: 'forbidden' }]);
    expect(await (await create(refused)).commit(spark('a'), next)).toMatchObject({ status: 'rejected', error: 'forbidden' });

    const busy = fakeSupabase(['busy']);
    const backend = await create(busy);
    expect(await backend.commit(spark('a'), next)).toEqual({ status: 'queued' });
    expect(backend.pending()).toBe(1);
  });

  it('a refused command in the middle does not block the commands behind it', async () => {
    const fake = fakeSupabase(['offline', 'offline']);
    const backend = await create(fake);
    await backend.commit(spark('a'), next);
    await backend.commit(spark('b'), next);
    fake.replies.push({ reject: 'not_found' }, 'ok');

    await backend.flush();
    expect(backend.pending()).toBe(0);
    expect(fake.sent.slice(2).map((s) => s.commandId)).toEqual(['cmd-1', 'cmd-2']);
  });

  it('never sends the same command twice when flushes overlap', async () => {
    const fake = fakeSupabase(['offline']);
    const backend = await create(fake);
    await backend.commit(spark('a'), next);

    await Promise.all([backend.flush(), backend.flush(), backend.flush()]);
    expect(fake.sent.map((s) => s.commandId)).toEqual(['cmd-1', 'cmd-1']);
  });

  it('retries the queue every 30 seconds', async () => {
    jest.useFakeTimers();
    try {
      const fake = fakeSupabase(['offline']);
      const backend = await create(fake);
      await backend.commit(spark('a'), next);
      expect(backend.pending()).toBe(1);

      await jest.advanceTimersByTimeAsync(30_000);
      expect(backend.pending()).toBe(0);
      expect(fake.sent).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('refreshes when another device changes the family, but not while its own commands wait', async () => {
    jest.useFakeTimers();
    try {
      const fake = fakeSupabase();
      const backend = await create(fake);
      await backend.load();
      const onRemote = jest.fn();
      const stop = backend.watch(onRemote);
      expect(fake.channel).toHaveBeenCalledWith(`family:${next.family.id}`);
      expect(fake.handlers).toHaveLength(5);

      fake.handlers[0]();
      fake.handlers[1](); // a burst of changes gives one refresh
      await jest.advanceTimersByTimeAsync(400);
      expect(onRemote).toHaveBeenCalledTimes(1);

      fake.replies.push('offline', 'offline');
      await backend.commit(spark('a'), next);
      fake.handlers[2]();
      await jest.advanceTimersByTimeAsync(400);
      expect(onRemote).toHaveBeenCalledTimes(1);

      stop();
      expect(fake.removeChannel).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('clear empties the queue on the device', async () => {
    const fake = fakeSupabase(['offline']);
    const backend = await createCloudBackend(asClient(fake));
    await backend.commit(spark('a'), next);
    await backend.clear();

    expect(backend.pending()).toBe(0);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.outbox)).toBeNull();
  });
});
