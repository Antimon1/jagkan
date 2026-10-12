import { Pressable, StyleSheet, View } from 'react-native';

import { palette, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export const CHALLENGE_ICONS = [
  '⭐', '🧥', '👟', '🪥', '🧼', '🚽', '🛁', '🥪', '🥛', '🍳', '🍎', '🧁', '🍽️', '🧸', '🛏️', '🧺',
  '🧹', '🪴', '🐶', '🚲', '🛴', '🚌', '🚸', '🗺️', '🪙', '🐷', '🛒', '👋', '💛', '🤝', '📞', '🦁',
  '🏊', '📚', '🎤', '🔦', '⚽', '🎨', '🎵', '🧩', '⏰', '🎒', '💪', '🌱', '🏠', '🍝', '📖', '🎬',
];

export const REWARD_ICONS = [
  '🎁', '🍝', '📖', '🎬', '📱', '🍦', '🧁', '🎲', '🛁', '🏕️', '🛝', '🎵', '🥞', '🌙', '🏊', '👫',
  '💃', '🧺', '📚', '🗺️', '💛', '🔦', '🎡', '🚆', '🍿', '🎧', '🧗', '🛏️', '⚽', '🎨',
];

export interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  options?: string[];
  label: string;
}

export function EmojiPicker({ value, onChange, options = CHALLENGE_ICONS, label }: EmojiPickerProps) {
  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      {options.map((emoji) => {
        const selected = emoji === value;
        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={emoji}
            onPress={() => onChange(emoji)}
            style={[styles.cell, selected ? styles.selected : null]}>
            <AppText style={styles.emoji}>{emoji}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cell: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.line,
  },
  selected: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  emoji: { fontSize: 24, lineHeight: 30 },
});
