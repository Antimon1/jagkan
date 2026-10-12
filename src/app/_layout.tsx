import '@/lib/i18n';

import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ParentGateHost } from '@/components/ParentGate';
import { ToastHost } from '@/components/Toast';
import { configureNotifications, onNotificationTap } from '@/lib/notifications';
import { setSoundEnabled } from '@/lib/sound';
import { setSpeechEnabled } from '@/lib/speech';
import { startBackend } from '@/state/bootstrap';
import { useDeviceHydrated, useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';
import { fontSources, palette } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function useSettingsEffects() {
  const settings = useGameStore((s) => s.family?.family.settings);
  useEffect(() => {
    setSoundEnabled(settings?.soundEnabled ?? true);
    setSpeechEnabled(settings?.speechEnabled ?? true);
  }, [settings?.soundEnabled, settings?.speechEnabled]);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontSources);
  const hydrated = useDeviceHydrated();
  const backend = useDeviceStore((s) => s.backend);
  const status = useGameStore((s) => s.status);
  useSettingsEffects();

  useEffect(() => {
    configureNotifications();
    // Approve with at most 2 taps (spec 15): the notification opens the approval screen directly.
    return onNotificationTap((url) => router.push(url as never));
  }, []);

  useEffect(() => {
    if (hydrated) startBackend(backend);
  }, [hydrated, backend]);

  const ready = (fontsLoaded || fontError) && hydrated && status !== 'idle' && status !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg }, animation: 'fade' }} />
        <ParentGateHost />
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: palette.bg } });
