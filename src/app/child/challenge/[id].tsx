import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { BounceIn, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { SpeakButton } from '@/components/SpeakButton';
import { catalog } from '@/data/catalog';
import { challengeView } from '@/domain/selectors';
import { canEarnBonusStar } from '@/domain/stars';
import type { DomainEvent } from '@/domain/types';
import { BigButton } from '@/features/child/BigButton';
import { actionFeedback } from '@/features/child/feedback';
import { useActiveChild } from '@/features/child/useActiveChild';
import { EggArt } from '@/features/creatures/EggArt';
import { useT } from '@/lib/i18n';
import { haptic, playSound } from '@/lib/sound';
import { speak } from '@/lib/speech';
import { useDispatch } from '@/state/hooks';
import { radius, space } from '@/theme/tokens';

type Feedback = { text: string; emoji: string } | null;

/** Tap an egg: big icon, read-aloud title and two huge buttons (spec 9). */
export default function ChildChallenge() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const active = useActiveChild();
  const dispatch = useDispatch();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [shown, setShown] = useState(0);
  const challenge = active?.state.challenges.find((c) => c.id === id && c.childId === active.child.id);
  const view = challenge && active ? challengeView(catalog, challenge, canEarnBonusStar(active.state, catalog, challenge)) : null;

  useEffect(() => {
    if (view) speak(view.title);
    // Read the title once when the egg opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!active || !challenge || !view) {
    return null;
  }
  const { theme, child } = active;
  const waiting = challenge.status === 'requested';
  const closed = challenge.status !== 'active' && !waiting;

  const respond = (action: 'tried' | 'did', events: DomainEvent[] | null) => {
    const next = actionFeedback(action, events);
    if (!next) return;
    if (next.haptic) haptic(next.haptic);
    if (next.sound) playSound(next.sound);
    const text = t(next.textKey);
    setFeedback({ text, emoji: next.emoji });
    setShown((n) => n + 1);
    speak(text);
  };

  const tried = async () => {
    const result = await dispatch({ type: 'recordAttempt', challengeId: challenge.id });
    respond('tried', result ? result.events : null);
  };

  const did = async () => {
    const result = await dispatch({ type: 'requestCompletion', challengeId: challenge.id }, { quiet: true });
    respond('did', result ? result.events : null);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/child'))}
          style={[styles.back, { backgroundColor: theme.surface }]}>
          <AppText variant="childBig" color={theme.ink}>
            ‹
          </AppText>
        </Pressable>
        <AppText variant="heading" color={theme.inkSoft}>
          {child.firstName}
        </AppText>
      </View>

      <View style={styles.center}>
        <EggArt world={child.world} charge={view.charge} waiting={waiting} icon={view.icon} size={200} />
        <View style={styles.titleRow}>
          <AppText variant="childTitle" color={theme.ink} align="center" style={styles.title}>
            {view.title}
          </AppText>
          <SpeakButton text={view.title} size={56} background={theme.surface} color={theme.ink} />
        </View>
        <View style={styles.pips} accessible accessibilityLabel={t('common.sparksLabel', { count: view.charge })}>
          {[0, 1, 2].map((i) => (
            <AppText key={i} style={[styles.pip, { opacity: i < view.charge ? 1 : 0.2 }]}>
              🔥
            </AppText>
          ))}
        </View>
        {feedback ? (
          <Animated.View key={feedback.text + shown} entering={BounceIn} style={[styles.feedback, { backgroundColor: theme.surface }]}>
            <AppText style={styles.feedbackEmoji}>{feedback.emoji}</AppText>
            <AppText variant="childBig" color={theme.ink} style={styles.flex}>
              {feedback.text}
            </AppText>
          </Animated.View>
        ) : waiting ? (
          <Animated.View entering={FadeIn} style={[styles.feedback, { backgroundColor: theme.surface }]}>
            <AppText style={styles.feedbackEmoji}>⏳</AppText>
            <AppText variant="childBig" color={theme.ink} style={styles.flex}>
              {t('child.waiting')}
            </AppText>
          </Animated.View>
        ) : null}
      </View>

      {!closed ? (
        <View style={styles.buttons}>
          <BigButton
            testID="child-tried"
            label={t('child.tried')}
            color={theme.tryColor}
            textColor={theme.dark ? '#1A0E00' : '#3A1A00'}
            onPress={tried}
            disabled={waiting}
          />
          <BigButton
            testID="child-did"
            label={t('child.did')}
            color={theme.doneColor}
            textColor={theme.onPrimary}
            onPress={did}
            disabled={waiting}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  back: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, maxWidth: 600 },
  title: { flexShrink: 1 },
  pips: { flexDirection: 'row', gap: space.sm },
  pip: { fontSize: 34, lineHeight: 42 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.xl,
    padding: space.lg,
    maxWidth: 560,
    width: '100%',
  },
  feedbackEmoji: { fontSize: 40, lineHeight: 48 },
  buttons: { gap: space.md, padding: space.lg, width: '100%', maxWidth: 600, alignSelf: 'center' },
});
