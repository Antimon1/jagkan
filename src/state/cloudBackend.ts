import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Command } from '@/domain/commands';
import { snapshotToState, type FamilySnapshot } from '@/domain/rows';
import type { FamilyState } from '@/domain/types';
import { newId } from '@/lib/ids';
import { errorMessage, logError } from '@/lib/log';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage';

import type { CommitOutcome, GameBackend } from './backend';

interface QueuedCommand {
  /** Idempotency key: the server ignores a command id it has already applied. */
  id: string;
  command: Command;
  clientAt: string;
}

interface ActionResponse {
  ok: boolean;
  error?: string;
  snapshot?: FamilySnapshot;
}

const RETRY_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 400;

/** Tables that trigger a refresh when another device changes them (spec 14.1 Realtime). */
const REALTIME_TABLES = ['families', 'child_challenges', 'completions', 'reward_requests', 'family_goals'];

class RejectedError extends Error {}

/**
 * Cloud mode: the server (Edge Function `game-action`) is the source of truth.
 * Commands are applied optimistically on the device, queued (offline support,
 * spec 15 acceptance criteria) and sent in order. After each send the device
 * receives the authoritative snapshot.
 */
export async function createCloudBackend(supabase: SupabaseClient): Promise<GameBackend> {
  let queue: QueuedCommand[] = (await readJson<QueuedCommand[]>(STORAGE_KEYS.outbox)) ?? [];
  let flushing: Promise<void> | null = null;
  let familyId: string | null = null;
  let latest: FamilyState | null = null;
  let lastRejection: { id: string; error: string } | null = null;

  const saveQueue = () => writeJson(STORAGE_KEYS.outbox, queue);

  const load = async (): Promise<FamilyState | null> => {
    const { data, error } = await supabase.rpc('jk_my_snapshot');
    if (error) throw new Error(error.message);
    if (!data) return null;
    latest = snapshotToState(data as FamilySnapshot);
    familyId = latest.family.id;
    return latest;
  };

  const send = async (item: QueuedCommand): Promise<FamilyState | null> => {
    const { data, error } = await supabase.functions.invoke<ActionResponse>('game-action', {
      body: { commandId: item.id, command: item.command, clientAt: item.clientAt },
    });
    if (error) {
      // Supabase wraps non-2xx answers in FunctionsHttpError; the body says why.
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function' && context.status >= 400 && context.status < 500) {
        const body = (await context.json().catch(() => null)) as ActionResponse | null;
        throw new RejectedError(body?.error ?? 'rejected');
      }
      throw new Error(error.message);
    }
    if (!data?.ok) throw new RejectedError(data?.error ?? 'rejected');
    return data.snapshot ? snapshotToState(data.snapshot) : null;
  };

  const flush = async (): Promise<void> => {
    if (flushing) return flushing;
    flushing = (async () => {
      while (queue.length > 0) {
        const item = queue[0];
        try {
          const state = await send(item);
          if (state) latest = state;
        } catch (error) {
          if (error instanceof RejectedError) {
            lastRejection = { id: item.id, error: error.message };
          } else {
            logError('cloud.flush', error);
            return; // offline: keep the queue and retry later
          }
        }
        queue = queue.slice(1);
        await saveQueue();
      }
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  };

  const retryTimer = setInterval(() => {
    if (queue.length > 0) flush().catch(() => undefined);
  }, RETRY_MS);

  return {
    kind: 'cloud',
    load,
    async commit(command: Command): Promise<CommitOutcome> {
      const item: QueuedCommand = { id: newId(), command, clientAt: new Date().toISOString() };
      queue = [...queue, item];
      await saveQueue();
      await flush();
      if (queue.some((q) => q.id === item.id)) return { status: 'queued' };
      if (lastRejection?.id === item.id) {
        const error = lastRejection.error;
        lastRejection = null;
        const fresh = await load().catch(() => latest);
        return { status: 'rejected', error, state: fresh };
      }
      return latest ? { status: 'synced', state: latest } : { status: 'queued' };
    },
    watch(onRemote) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const refresh = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          flush()
            .then(load)
            .then((state) => {
              if (state && queue.length === 0) onRemote(state);
            })
            .catch((error: unknown) => logError('cloud.refresh', errorMessage(error)));
        }, REALTIME_DEBOUNCE_MS);
      };
      let channel: RealtimeChannel | null = null;
      if (familyId) {
        channel = supabase.channel(`family:${familyId}`);
        for (const table of REALTIME_TABLES) {
          const filter = table === 'families' ? `id=eq.${familyId}` : `family_id=eq.${familyId}`;
          channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, refresh);
        }
        channel.subscribe();
      }
      const appState = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        if (timer) clearTimeout(timer);
        appState.remove();
        if (channel) supabase.removeChannel(channel).catch(() => undefined);
      };
    },
    pending: () => queue.length,
    flush,
    async clear() {
      clearInterval(retryTimer);
      queue = [];
      await removeKey(STORAGE_KEYS.outbox);
    },
  };
}
