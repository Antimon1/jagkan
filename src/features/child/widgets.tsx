import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ProgressBar } from '@/components/forms';
import { SpeakButton } from '@/components/SpeakButton';
import type { ChallengeView, GoalView } from '@/domain/selectors';
import type { FamilyState, WorldId } from '@/domain/types';
import { EggArt } from '@/features/creatures/EggArt';
import { useT } from '@/lib/i18n';
import { radius, shadow, space } from '@/theme/tokens';
import type { WorldTheme } from '@/theme/worlds';

import { childWeekLines } from './weekLines';

export function EggTile({ view, world, theme, width }: { view: ChallengeView; world: WorldId; theme: WorldTheme; width: number }) {
  const t = useT();
  const waiting = view.challenge.status === 'requested';
  return (
    <Pressable
      testID={`egg-${view.challenge.id}`}
      accessibilityRole="button"
      accessibilityLabel={waiting ? `${view.title}. ${t('child.waiting')}` : view.title}
      onPress={() => router.push({ pathname: '/child/challenge/[id]', params: { id: view.challenge.id } })}
      style={({ pressed }) => [styles.tile, shadow.card, { width, backgroundColor: theme.surface }, pressed ? styles.pressed : null]}>
      <EggArt world={world} charge={view.charge} waiting={waiting} icon={view.icon} size={Math.min(130, width * 0.7)} />
      <AppText variant="heading" color={theme.ink} align="center" numberOfLines={2}>
        {view.title}
      </AppText>
      <View style={styles.pips} accessible accessibilityLabel={t('common.sparksLabel', { count: view.charge })}>
        {waiting ? (
          <AppText variant="label" color={theme.inkSoft}>
            ⏳ {t('child.waiting')}
          </AppText>
        ) : (
          [0, 1, 2].map((i) => (
            <AppText key={i} style={[styles.pip, { opacity: i < view.charge ? 1 : 0.22 }]}>
              🔥
            </AppText>
          ))
        )}
      </View>
    </Pressable>
  );
}

export function GoalMeter({ goal, theme }: { goal: GoalView; theme: WorldTheme }) {
  const t = useT();
  const left = Math.max(0, goal.goal.targetStars - goal.progress);
  const text = `${t('child.familyGoal', { title: goal.goal.title })} ${t('child.goalLeft', { count: left })}`;
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <AppText style={styles.goalEmoji}>🎯</AppText>
        <AppText variant="heading" color={theme.ink} style={styles.flex}>
          {goal.goal.title}
        </AppText>
        <SpeakButton text={text} size={40} background={theme.surfaceSunk} color={theme.ink} />
      </View>
      <ProgressBar ratio={goal.ratio} color={theme.primary} track={theme.surfaceSunk} height={20} />
      <AppText variant="bodyStrong" color={theme.inkSoft}>
        ⭐ {goal.progress} / {goal.goal.targetStars} · {t('child.goalLeft', { count: left })}
      </AppText>
    </View>
  );
}

/** Week summary with only positive phrasing and only the child's own numbers (spec 4). */
export function WeekCard({ state, childId, now, theme }: { state: FamilyState; childId: string; now: string; theme: WorldTheme }) {
  const t = useT();
  const lines = childWeekLines(state, childId, now).map((line) => t(line.key, 'count' in line ? { count: line.count } : undefined));
  if (lines.length === 0) return null;
  const text = lines.join(' ');
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <AppText style={styles.goalEmoji}>📅</AppText>
        <View style={styles.flex}>
          {lines.map((line) => (
            <AppText key={line} variant="bodyStrong" color={theme.ink}>
              {line}
            </AppText>
          ))}
        </View>
        <SpeakButton text={text} size={40} background={theme.surfaceSunk} color={theme.ink} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { borderRadius: radius.xl, padding: space.md, alignItems: 'center', gap: space.xs, minHeight: 230 },
  pressed: { transform: [{ scale: 0.97 }] },
  pips: { flexDirection: 'row', gap: 2, minHeight: 26, alignItems: 'center' },
  pip: { fontSize: 18, lineHeight: 24 },
  card: { borderRadius: radius.xl, padding: space.lg, gap: space.sm },
  goalEmoji: { fontSize: 28, lineHeight: 34 },
});
