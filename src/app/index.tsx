import { Redirect } from 'expo-router';

import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';

/** Entry: send the device to welcome, the parent area or the child view. */
export default function Index() {
  const family = useGameStore((s) => s.family);
  const mode = useDeviceStore((s) => s.mode);
  const role = useDeviceStore((s) => s.role);

  if (!family) return <Redirect href="/welcome" />;
  if (mode === 'child' || role === 'child-device') return <Redirect href="/child" />;
  return <Redirect href="/parent" />;
}
