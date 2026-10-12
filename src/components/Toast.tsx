import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { palette, radius, shadow, space } from '@/theme/tokens';

import { AppText } from './AppText';

type ToastTone = 'info' | 'success' | 'error';

interface ToastState {
  message: string | null;
  tone: ToastTone;
  key: number;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

export const useToast = create<ToastState>()((set) => ({
  message: null,
  tone: 'info',
  key: 0,
  show: (message, tone = 'info') => set((s) => ({ message, tone, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

export function showToast(message: string, tone: ToastTone = 'info') {
  useToast.getState().show(message, tone);
}

const TONES: Record<ToastTone, { bg: string; fg: string }> = {
  info: { bg: palette.ink, fg: '#FFFFFF' },
  success: { bg: palette.success, fg: '#FFFFFF' },
  error: { bg: palette.danger, fg: '#FFFFFF' },
};

const DURATION_MS = 3200;

export function ToastHost() {
  const { message, tone, key, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, key, hide]);

  if (!message) return null;
  const colors = TONES[tone];
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + space.xxl }]}>
      <Animated.View
        key={key}
        entering={FadeInDown.springify().damping(16)}
        exiting={FadeOutDown}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, shadow.lifted, { backgroundColor: colors.bg }]}>
        <AppText variant="bodyStrong" color={colors.fg} align="center">
          {message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    maxWidth: 520,
  },
});
