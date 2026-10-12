import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/sound';
import { palette, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  /** Show dots (PIN) or the digits (answer to a question). */
  secret?: boolean;
  maxLength?: number;
}

export function PinPad({ value, onChange, length = 4, secret = true, maxLength = 4 }: PinPadProps) {
  const press = (key: string) => {
    if (!key) return;
    haptic('light');
    if (key === '⌫') onChange(value.slice(0, -1));
    else if (value.length < maxLength) onChange(value + key);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.display} accessibilityLiveRegion="polite">
        {secret ? (
          Array.from({ length }).map((_, i) => (
            <View key={i} style={[styles.dot, i < value.length ? styles.dotFilled : null]} />
          ))
        ) : (
          <AppText variant="display">{value || ' '}</AppText>
        )}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, i) => (
          <Pressable
            key={`${key}-${i}`}
            disabled={!key}
            accessibilityRole="button"
            accessibilityLabel={key === '⌫' ? 'Radera' : key}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, !key ? styles.keyEmpty : null, pressed ? styles.keyPressed : null]}>
            <AppText variant="title">{key}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.lg },
  display: { flexDirection: 'row', gap: space.md, height: 44, alignItems: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: palette.inkSoft },
  dotFilled: { backgroundColor: palette.primary, borderColor: palette.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 264, gap: space.sm, justifyContent: 'center' },
  key: {
    width: 80,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceSunk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyPressed: { backgroundColor: palette.primarySoft },
});
