import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CreatureArt } from '@/features/creatures/CreatureArt';
import { EggArt } from '@/features/creatures/EggArt';
import { buildDemoFamily } from '@/features/onboarding/demoFamily';
import { config } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';
import { createLocalBackend } from '@/state/localBackend';
import { palette, radius, shadow, space } from '@/theme/tokens';

interface ChoiceProps {
  emoji: string;
  title: string;
  hint: string;
  onPress: () => void;
  tone: string;
  delay: number;
  testID: string;
}

function Choice({ emoji, title, hint, onPress, tone, delay, testID }: ChoiceProps) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(18)}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={hint}
        onPress={onPress}
        style={({ pressed }) => [styles.choice, shadow.card, pressed ? styles.pressed : null]}>
        <View style={[styles.choiceIcon, { backgroundColor: tone }]}>
          <AppText style={styles.choiceEmoji}>{emoji}</AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            {hint}
          </AppText>
        </View>
        <AppText variant="title" color={palette.inkFaint}>
          ›
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

export default function Welcome() {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const startParent = () => {
    if (config.cloudEnabled) router.push('/onboarding/account');
    else {
      useDeviceStore.getState().setBackend('local');
      router.push('/onboarding/family');
    }
  };

  const startDemo = async () => {
    if (busy) return;
    setBusy(true);
    const device = useDeviceStore.getState();
    device.setBackend('local');
    device.enterParentMode();
    const game = useGameStore.getState();
    await game.init(createLocalBackend());
    await game.replace(buildDemoFamily());
    setBusy(false);
    router.replace('/parent');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View pointerEvents="none" style={[styles.blob, styles.blobPink]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobMint]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobSun]} />
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.eggRow}>
            <EggArt world="valley" charge={2} size={84} />
            <View style={styles.heroCreature}>
              <CreatureArt world="valley" color="#FF9EC2" stage={3} emoji="🌟" size={118} />
            </View>
            <EggArt world="dino" charge={1} size={84} />
          </View>
          <AppText variant="overline" color={palette.primary} align="center">
            {t('common.appName')}
          </AppText>
          <AppText variant="hero" align="center" accessibilityRole="header">
            {t('welcome.title')}
          </AppText>
          <AppText variant="body" color={palette.inkSoft} align="center" style={styles.subtitle}>
            {t('welcome.subtitle')}
          </AppText>
        </View>
        <View style={styles.choices}>
          <Choice
            testID="welcome-parent"
            emoji="👋"
            title={t('welcome.parent')}
            hint={t('welcome.parentHint')}
            onPress={startParent}
            tone={palette.primarySoft}
            delay={100}
          />
          {config.cloudEnabled ? (
            <Choice
              testID="welcome-child"
              emoji="🧒"
              title={t('welcome.child')}
              hint={t('welcome.childHint')}
              onPress={() => router.push('/pair')}
              tone={palette.starSoft}
              delay={180}
            />
          ) : null}
          <Choice
            testID="welcome-demo"
            emoji="✨"
            title={t('welcome.demo')}
            hint={t('welcome.demoHint')}
            onPress={startDemo}
            tone={palette.sparkSoft}
            delay={260}
          />
          {!config.cloudEnabled ? (
            <AppText variant="caption" color={palette.inkFaint} align="center">
              {t('welcome.localNote')}
            </AppText>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, overflow: 'hidden' },
  flex: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    gap: space.xxl,
  },
  hero: { alignItems: 'center', gap: space.sm },
  eggRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, marginBottom: space.md },
  heroCreature: { marginBottom: -space.sm },
  subtitle: { maxWidth: 420 },
  choices: { gap: space.md },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  choiceIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  choiceEmoji: { fontSize: 26, lineHeight: 32 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobPink: { width: 320, height: 320, backgroundColor: '#FFE1EC', top: -120, right: -100 },
  blobMint: { width: 260, height: 260, backgroundColor: '#DDF4E9', bottom: -80, left: -90 },
  blobSun: { width: 140, height: 140, backgroundColor: '#FFF3C9', top: 140, left: -40 },
});
