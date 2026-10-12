import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/sound';
import { palette, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'star' | 'spark' | 'plus';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg' | 'sm';
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: palette.primary, fg: palette.onPrimary },
  secondary: { bg: palette.surface, fg: palette.ink, border: palette.line },
  ghost: { bg: 'transparent', fg: palette.primary },
  danger: { bg: palette.dangerSoft, fg: palette.danger },
  star: { bg: palette.star, fg: '#2A1D00' },
  spark: { bg: palette.sparkSoft, fg: '#8A3300' },
  plus: { bg: palette.plus, fg: '#FFFFFF' },
};

const SIZES = {
  sm: { height: 38, paddingHorizontal: space.md, text: 'label' as const },
  md: { height: 50, paddingHorizontal: space.lg, text: 'bodyStrong' as const },
  lg: { height: 60, paddingHorizontal: space.xl, text: 'heading' as const },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const colors = VARIANTS[variant];
  const dims = SIZES[size];
  const inactive = disabled || loading;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      onPressIn={() => {
        scale.set(withSpring(0.96, { damping: 15, stiffness: 300 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 12, stiffness: 260 }));
      }}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={[
        styles.base,
        {
          height: dims.height,
          paddingHorizontal: dims.paddingHorizontal,
          backgroundColor: colors.bg,
          borderColor: colors.border ?? 'transparent',
          opacity: inactive ? 0.5 : 1,
        },
        animated,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText variant={dims.text} color={colors.fg} numberOfLines={1}>
            {label}
          </AppText>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
