import { Redirect, Stack } from 'expo-router';

import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';

export default function ChildLayout() {
  const hasFamily = useGameStore((s) => s.family !== null);
  const mode = useDeviceStore((s) => s.mode);
  const role = useDeviceStore((s) => s.role);
  if (!hasFamily) return <Redirect href="/welcome" />;
  if (mode !== 'child' && role !== 'child-device') return <Redirect href="/parent" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
