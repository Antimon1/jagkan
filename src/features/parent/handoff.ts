import { router } from 'expo-router';

import type { FamilyState } from '@/domain/types';
import { useDeviceStore } from '@/state/device';

/** Hand the device to a child (spec 11: shared device with profile picker). */
export function startChildMode(state: FamilyState, childId?: string): void {
  const only = state.children.length === 1 ? state.children[0].id : null;
  useDeviceStore.getState().enterChildMode(childId ?? only);
  router.replace('/child');
}
