import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { requestParentAccess } from '@/components/ParentGate';
import { SpeakButton } from '@/components/SpeakButton';
import { catalog } from '@/data/catalog';
import { eggsForChild, familyGoalView, graduationFor, unseenCelebrations } from '@/domain/selectors';
import type { WorldId } from '@/domain/types';
import { ChildAvatar } from '@/features/children/ChildAvatar';
import { BigButton } from '@/features/child/BigButton';
import { CelebrationOverlay } from '@/features/child/CelebrationOverlay';
import { ChildChrome } from '@/features/child/ChildChrome';
import { useActiveChild, useVisibleChildren, type ActiveChild } from '@/features/child/useActiveChild';
import { EggTile, GoalMeter, WeekCard } from '@/features/child/widgets';
import { useT } from '@/lib/i18n';
import { speak } from '@/lib/speech';
import { useDeviceStore } from '@/state/device';
import { useFamily } from '@/state/game';
import { useDispatch, useNow } from '@/state/hooks';
import { palette, radius, shadow, space } from '@/theme/tokens';
import { worldTheme } from '@/theme/worlds';

export default function ChildHome() {
  const active = useActiveChild();
  if (!active) return <ProfilePicker />;
  return <Home active={active} />;
}

function ProfilePicker() {
  const t = useT();
  const state = useFamily();
  const children = useVisibleChildren();
  const role = useDeviceStore((s) => s.role);
  return (
    <SafeAreaView style={styles.pickerRoot}>
      <View style={styles.pickerHeader}>
        <AppText variant="display" align="center">
          {t('child.whoAreYou')}
        </AppText>
        <SpeakButton text={t('child.whoAreYou')} />
      </View>
      <View style={styles.pickerGrid}>
        {children.map((child, i) => (
          <Animated.View key={child.id} entering={FadeInUp.delay(i * 80).springify()}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={child.firstName}
              onPress={() => {
                speak(t('child.hello', { name: child.firstName }));
                useDeviceStore.getState().setActiveChild(child.id);
              }}
              style={({ pressed }) => [styles.profile, shadow.card, { backgroundColor: worldTheme(child.world).bgAccent }, pressed ? styles.pressed : null]}>
              <ChildAvatar child={child} state={state} size={120} />
              <AppText variant="childTitle" align="center">
                {child.firstName}
              </AppText>
            </Pressable>
          </Animated.View>
        ))}
      </View>
      {role !== 'child-device' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('child.parentMode')}
          style={styles.parentLink}
          onPress={async () => {
            if (await requestParentAccess()) {
              useDeviceStore.getState().enterParentMode();
            }
          }}>
          <AppText variant="label" color={palette.inkSoft}>
            🔒 {t('child.parentMode')}
          </AppText>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function Home({ active }: { active: ActiveChild }) {
  const t = useT();
  const dispatch = useDispatch();
  const now = useNow();
  const { width } = useWindowDimensions();
  const { state, child, theme } = active;
  const [dismissed, setDismissed] = useState<string[]>([]);
  const eggs = eggsForChild(state, catalog, child.id);
  const goal = familyGoalView(state, now);
  const graduation = graduationFor(state, catalog, child.id, now);
  const celebrations = unseenCelebrations(state, child.id).filter((c) => !dismissed.includes(c.id));
  const columns = width >= 700 ? 3 : 2;
  const contentWidth = Math.min(width, 900) - space.lg * 2;
  const tileWidth = (contentWidth - space.md * (columns - 1)) / columns;
  const greeting = t('child.hello', { name: child.firstName });

  return (
    <ChildChrome active={active} title={greeting}>
      {graduation ? <GraduationCard active={active} target={graduation} /> : null}
      <WeekCard state={state} childId={child.id} now={now} theme={theme} />
      {goal ? <GoalMeter goal={goal} theme={theme} /> : null}

      <View style={styles.sectionHeader}>
        <AppText variant="childBig" color={theme.ink}>
          {t('child.myEggs')}
        </AppText>
      </View>
      {eggs.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.surface }]}>
          <AppText style={styles.emptyEmoji}>🥚</AppText>
          <AppText variant="heading" color={theme.ink} align="center">
            {t('child.noEggs')}
          </AppText>
          <SpeakButton text={t('child.noEggs')} background={theme.surfaceSunk} color={theme.ink} />
        </View>
      ) : (
        <View style={styles.grid}>
          {eggs.map((view, i) => (
            <Animated.View key={view.challenge.id} entering={FadeInUp.delay(i * 70).springify().damping(14)}>
              <EggTile view={view} world={child.world} theme={theme} width={tileWidth} />
            </Animated.View>
          ))}
        </View>
      )}

      {celebrations.length > 0 ? (
        <CelebrationOverlay
          celebrations={celebrations}
          state={state}
          world={child.world}
          theme={theme}
          onDone={(ids) => {
            setDismissed((prev) => [...prev, ...ids]);
            dispatch({ type: 'markCelebrationsSeen', childId: child.id, celebrationIds: ids }, { quiet: true });
          }}
        />
      ) : null}
    </ChildChrome>
  );
}

function GraduationCard({ active, target }: { active: ActiveChild; target: WorldId }) {
  const t = useT();
  const dispatch = useDispatch();
  const { child, theme } = active;
  const body = t('child.graduation.body', { world: t(`worlds.${target}`) });
  return (
    <View style={[styles.graduation, { backgroundColor: worldTheme(target).bgAccent }]}>
      <AppText style={styles.emptyEmoji}>🎓</AppText>
      <AppText variant="childTitle" color={theme.ink} align="center">
        {t('child.graduation.title')}
      </AppText>
      <AppText variant="bodyStrong" color={theme.ink} align="center">
        {body}
      </AppText>
      <SpeakButton text={`${t('child.graduation.title')} ${body}`} background={theme.surface} color={theme.ink} />
      <BigButton
        label={t('child.graduation.go')}
        emoji="🚀"
        color={worldTheme(target).primary}
        textColor={worldTheme(target).onPrimary}
        onPress={() => dispatch({ type: 'changeWorld', childId: child.id, world: target })}
        style={styles.fullWidth}
      />
      <BigButton
        label={t('child.graduation.later')}
        size="lg"
        color={theme.surface}
        textColor={theme.ink}
        onPress={() => dispatch({ type: 'snoozeGraduation', childId: child.id })}
        style={styles.fullWidth}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pickerRoot: { flex: 1, backgroundColor: palette.bg, justifyContent: 'center', padding: space.lg, gap: space.xxl },
  pickerHeader: { alignItems: 'center', gap: space.md },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg },
  profile: { width: 180, borderRadius: radius.xl, padding: space.lg, alignItems: 'center', gap: space.md },
  pressed: { transform: [{ scale: 0.96 }] },
  parentLink: { alignSelf: 'center', padding: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  empty: { borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md },
  emptyEmoji: { fontSize: 56, lineHeight: 66 },
  graduation: { borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md },
  fullWidth: { alignSelf: 'stretch' },
});
