import { create } from 'zustand';

import { catalog } from '@/data/catalog';
import type { Command } from '@/domain/commands';
import { applyCommand } from '@/domain/engine';
import type { Actor, DomainEvent, EngineContext, EngineResult, FamilyState } from '@/domain/types';
import { newId } from '@/lib/ids';
import { errorMessage, logError } from '@/lib/log';

import type { GameBackend } from './backend';
import { useDeviceStore } from './device';

export type GameStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface GameStore {
  status: GameStatus;
  family: FamilyState | null;
  backend: GameBackend | null;
  /** The signed-in parent (cloud) or the family's first parent (local). */
  parentId: string | null;
  pending: number;
  lastEvents: DomainEvent[];
  lastError: string | null;
  init: (backend: GameBackend, parentId?: string | null) => Promise<void>;
  /** Replace the whole state (onboarding, demo family, server refresh). */
  replace: (state: FamilyState | null) => Promise<void>;
  dispatch: (command: Command, actor?: Actor) => Promise<EngineResult>;
  /** Trusted commands (Plus toggle, library suggestions). Only allowed in local mode. */
  dispatchSystem: (command: Command) => Promise<EngineResult>;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
}

export function engineContext(now: string = new Date().toISOString()): EngineContext {
  return { now, newId, catalog };
}

/** The actor for commands from this device, based on parent/child mode. */
export function currentActor(state: FamilyState, parentId: string | null): Actor {
  const device = useDeviceStore.getState();
  if (device.mode === 'child' || device.role === 'child-device') {
    return { kind: 'child', childIds: device.pairedChildIds ?? state.children.map((c) => c.id) };
  }
  return { kind: 'parent', parentId: parentId ?? state.parents[0]?.id ?? '' };
}

let unwatch: (() => void) | null = null;

export const useGameStore = create<GameStore>()((set, get) => {
  const applyRemote = (state: FamilyState) => {
    const current = get().family;
    if (current && current.family.revision > state.family.revision && get().pending > 0) return;
    set({ family: state, status: 'ready', pending: get().backend?.pending() ?? 0 });
  };

  const commit = async (command: Command, next: FamilyState, previous: FamilyState) => {
    const backend = get().backend;
    if (!backend) return;
    try {
      const outcome = await backend.commit(command, next);
      if (outcome.status === 'synced') applyRemote(outcome.state);
      if (outcome.status === 'rejected') {
        set({ family: outcome.state ?? previous, lastError: outcome.error });
      }
    } catch (error) {
      logError('game.commit', error);
      set({ lastError: errorMessage(error) });
    } finally {
      set({ pending: backend.pending() });
    }
  };

  const runCommand = async (command: Command, actor: Actor): Promise<EngineResult> => {
    const state = get().family;
    if (!state) return { ok: false, error: 'not_found', message: 'no family loaded' };
    const result = applyCommand(state, command, actor, engineContext());
    if (!result.ok) return result;
    set({ family: result.state, lastEvents: result.events, lastError: null });
    await commit(command, result.state, state);
    return result;
  };

  return {
    status: 'idle',
    family: null,
    backend: null,
    parentId: null,
    pending: 0,
    lastEvents: [],
    lastError: null,

    async init(backend, parentId = null) {
      unwatch?.();
      set({ backend, status: 'loading', parentId });
      try {
        const loaded = await backend.load();
        if (!loaded) {
          set({ family: null, status: 'empty' });
          return;
        }
        set({ family: loaded, status: 'ready', parentId: parentId ?? loaded.parents[0]?.id ?? null });
        unwatch = backend.watch(applyRemote);
        // Close finished weeks (duel trophies, records). Idempotent and safe on every start.
        await runCommand({ type: 'rollupWeeks' }, backend.kind === 'local' ? { kind: 'system' } : currentActor(loaded, get().parentId));
      } catch (error) {
        logError('game.init', error);
        set({ status: 'error', lastError: errorMessage(error) });
      }
    },

    async replace(state) {
      const backend = get().backend;
      set({ family: state, status: state ? 'ready' : 'empty', parentId: state?.parents[0]?.id ?? get().parentId });
      if (state && backend?.kind === 'local') {
        await backend.commit({ type: 'rollupWeeks' }, state);
      }
    },

    async dispatch(command, actor) {
      const state = get().family;
      if (!state) return { ok: false, error: 'not_found' };
      return runCommand(command, actor ?? currentActor(state, get().parentId));
    },

    async dispatchSystem(command) {
      if (get().backend?.kind !== 'local') return { ok: false, error: 'forbidden' };
      return runCommand(command, { kind: 'system' });
    },

    async refresh() {
      const backend = get().backend;
      if (!backend) return;
      await backend.flush();
      const loaded = await backend.load();
      if (loaded) applyRemote(loaded);
    },

    async reset() {
      unwatch?.();
      unwatch = null;
      await get().backend?.clear();
      set({ family: null, status: 'empty', lastEvents: [], pending: 0, lastError: null });
    },
  };
});

/** The loaded family. Screens below the root gate can rely on it being present. */
export function useFamily(): FamilyState {
  const family = useGameStore((s) => s.family);
  if (!family) throw new Error('useFamily used before a family was loaded');
  return family;
}

export function useFamilyOrNull(): FamilyState | null {
  return useGameStore((s) => s.family);
}
