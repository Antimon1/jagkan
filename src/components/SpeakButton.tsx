import { Pressable, StyleSheet } from 'react-native';

import { useT } from '@/lib/i18n';
import { speak } from '@/lib/speech';

import { AppText } from './AppText';

export interface SpeakButtonProps {
  text: string;
  size?: number;
  background?: string;
  color?: string;
}

/** Speaker icon that reads the text aloud (spec 9: works for children who cannot read). */
export function SpeakButton({ text, size = 48, background = 'rgba(255,255,255,0.85)', color = '#1F1A2E' }: SpeakButtonProps) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('common.listen')}: ${text}`}
      hitSlop={8}
      onPress={() => speak(text)}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        pressed ? styles.pressed : null,
      ]}>
      <AppText style={{ fontSize: size * 0.48, lineHeight: size * 0.6 }} color={color}>
        🔊
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.92 }] },
});
