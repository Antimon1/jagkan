import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/lib/storage';

export type BackendKind = 'local' | 'cloud';
export type DeviceMode = 'parent' | 'child';
/** In cloud mode a device is either signed in as a parent or paired to children. */
export type DeviceRole = 'parent' | 'child-device';

export interface DeviceState {
  backend: BackendKind | null;
  role: DeviceRole;
  mode: DeviceMode;
  activeChildId: string | null;
  /** Children a paired device may show (cloud child devices). null = all children of the family. */
  pairedChildIds: string[] | null;
  setBackend: (backend: BackendKind | null, role?: DeviceRole) => void;
  enterChildMode: (childId: string | null) => void;
  enterParentMode: () => void;
  setActiveChild: (childId: string | null) => void;
  setPairedChildren: (childIds: string[] | null) => void;
  reset: () => void;
}

const initial = {
  backend: null,
  role: 'parent' as DeviceRole,
  mode: 'parent' as DeviceMode,
  activeChildId: null,
  pairedChildIds: null,
};

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      ...initial,
      setBackend: (backend, role = 'parent') => set({ backend, role }),
      enterChildMode: (childId) => set({ mode: 'child', activeChildId: childId }),
      enterParentMode: () => set({ mode: 'parent' }),
      setActiveChild: (childId) => set({ activeChildId: childId }),
      setPairedChildren: (childIds) => set({ pairedChildIds: childIds }),
      reset: () => set({ ...initial }),
    }),
    {
      name: STORAGE_KEYS.device,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ backend, role, mode, activeChildId, pairedChildIds }) => ({
        backend,
        role,
        mode,
        activeChildId,
        pairedChildIds,
      }),
    },
  ),
);

/** True once the persisted device settings have been read from storage. */
export function useDeviceHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useDeviceStore.persist.onFinishHydration(onChange),
    () => useDeviceStore.persist.hasHydrated(),
    () => false,
  );
}
