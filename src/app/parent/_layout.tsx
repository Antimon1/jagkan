import { Redirect, Stack } from 'expo-router';

import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';
import { palette } from '@/theme/tokens';

/** Parent area. A device in child mode is sent back to the child view (spec 9: parental gate). */
export default function ParentLayout() {
  const hasFamily = useGameStore((s) => s.family !== null);
  const mode = useDeviceStore((s) => s.mode);
  const role = useDeviceStore((s) => s.role);

  if (!hasFamily) return <Redirect href="/welcome" />;
  if (mode === 'child' || role === 'child-device') return <Redirect href="/child" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }} />;
}
