import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radius, shadow, space } from '@/theme/tokens';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'sunk' | 'primary' | 'star' | 'spark' | 'success' | 'plus';
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
}

const TONES = {
  surface: palette.surface,
  sunk: palette.surfaceSunk,
  primary: palette.primarySoft,
  star: palette.starSoft,
  spark: palette.sparkSoft,
  success: palette.successSoft,
  plus: palette.plusSoft,
};

export function Card({ children, style, tone = 'surface', onPress, accessibilityLabel, padded = true }: CardProps) {
  const content = [
    styles.card,
    tone === 'surface' ? shadow.card : null,
    { backgroundColor: TONES[tone], padding: padded ? space.lg : 0 },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [content, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={content}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
