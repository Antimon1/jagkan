import type { FamilyState } from '@/domain/types';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage';

import type { GameBackend } from './backend';

/**
 * Everything on this device (no account). Parent and child share the device and
 * switch with the parental gate (spec 11: "Föräldraläge på samma enhet").
 */
export function createLocalBackend(): GameBackend {
  return {
    kind: 'local',
    async load() {
      const state = await readJson<FamilyState>(STORAGE_KEYS.localFamily);
      return state && state.schemaVersion === 1 ? state : null;
    },
    async commit(_command, next) {
      const ok = await writeJson(STORAGE_KEYS.localFamily, next);
      return ok ? { status: 'saved' } : { status: 'rejected', error: 'storage', state: null };
    },
    watch() {
      return () => undefined;
    },
    pending() {
      return 0;
    },
    async flush() {},
    async clear() {
      await removeKey(STORAGE_KEYS.localFamily);
    },
  };
}

export async function saveLocalFamily(state: FamilyState): Promise<boolean> {
  return writeJson(STORAGE_KEYS.localFamily, state);
}
