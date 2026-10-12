import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { haptic, playSound } from '@/lib/sound';
import { CHILD_TOUCH, radius, space } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface BigButtonProps {
  label: string;
  emoji?: string;
  color: string;
  textColor: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'xl' | 'lg';
  testID?: string;
}

/** Child-sized button: big, bouncy, at least 64 pt (spec 9). */
export function BigButton({ label, emoji, color, textColor, onPress, disabled, style, size = 'xl', testID }: BigButtonProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const height = size === 'xl' ? 84 : CHILD_TOUCH;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPressIn={() => {
        scale.set(withSpring(0.94, { damping: 14, stiffness: 320 }));
      }}
      onPressOut={() => {
        scale.set(withSequence(withSpring(1.04, { damping: 10, stiffness: 300 }), withSpring(1)));
      }}
      onPress={() => {
        haptic('light');
        playSound('tap');
        onPress();
      }}
      style={[styles.button, { backgroundColor: color, minHeight: height, opacity: disabled ? 0.5 : 1 }, animated, style]}>
      <View style={styles.inner}>
        {emoji ? <AppText style={size === 'xl' ? styles.emojiXl : styles.emoji}>{emoji}</AppText> : null}
        <AppText variant={size === 'xl' ? 'childBig' : 'heading'} color={textColor} align="center">
          {label}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  emoji: { fontSize: 28, lineHeight: 34 },
  emojiXl: { fontSize: 36, lineHeight: 44 },
});
