import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { startChildMode } from '@/features/parent/handoff';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { palette, radius, shadow, space } from '@/theme/tokens';

interface Item {
  emoji: string;
  label: string;
  onPress: () => void;
  tone: string;
}

export default function More() {
  const t = useT();
  const state = useFamily();
  const go = (href: Href) => () => router.push(href);
  const items: Item[] = [
    { emoji: '🏆', label: t('parent.more.competitions'), onPress: go('/parent/competitions'), tone: palette.starSoft },
    { emoji: '📸', label: t('parent.more.album'), onPress: go('/parent/album'), tone: palette.sparkSoft },
    { emoji: '📊', label: t('parent.more.stats'), onPress: go('/parent/stats'), tone: palette.primarySoft },
    { emoji: '📱', label: t('parent.more.devices'), onPress: go('/parent/devices'), tone: palette.successSoft },
    { emoji: '⚙️', label: t('parent.more.settings'), onPress: go('/parent/settings'), tone: palette.surfaceSunk },
    { emoji: '💎', label: t('parent.more.plus'), onPress: go('/parent/paywall'), tone: palette.plusSoft },
    { emoji: '🧒', label: t('parent.more.childMode'), onPress: () => startChildMode(state), tone: '#FFE1EC' },
  ];

  return (
    <Screen title={t('parent.more.title')}>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [styles.tile, shadow.card, pressed ? styles.pressed : null]}>
            <View style={[styles.iconWrap, { backgroundColor: item.tone }]}>
              <AppText style={styles.icon}>{item.emoji}</AppText>
            </View>
            <AppText variant="heading" align="center">
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
    gap: space.sm,
    minHeight: 130,
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.97 }] },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28, lineHeight: 34 },
});
