import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/forms';
import { catalog } from '@/data/catalog';
import type { GoalView, PendingApproval, PendingRewardRequest } from '@/domain/selectors';
import { eggsForChild, milestoneProgress } from '@/domain/selectors';
import { weekStars } from '@/domain/stars';
import { weekStartKey } from '@/domain/time';
import type { Child, FamilyState } from '@/domain/types';
import { ChildAvatar } from '@/features/children/ChildAvatar';
import { useT } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { useDispatch } from '@/state/hooks';
import { palette, radius, space } from '@/theme/tokens';

export function ApprovalCard({ item, state }: { item: PendingApproval; state: FamilyState }) {
  const t = useT();
  const dispatch = useDispatch();
  const { child, view } = item;
  const attempts = state.attempts.filter((a) => a.childChallengeId === view.challenge.id).length;

  return (
    <Card style={styles.approval}>
      <View style={styles.row}>
        <ChildAvatar child={child} state={state} size={44} />
        <View style={styles.flex}>
          <AppText variant="label" color={palette.inkSoft}>
            {t('parent.overview.says', { name: child.firstName })}
          </AppText>
          <AppText variant="heading">
            {view.icon} {view.parentTitle}
          </AppText>
          <AppText variant="caption" color={palette.inkFaint}>
            {t('parent.approve.attempts', { count: attempts })} · {t(`branches.${view.challenge.branch}`)}
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label={t('parent.overview.approve')}
          variant="star"
          style={styles.flex}
          testID={`approve-${view.challenge.id}`}
          onPress={async () => {
            const result = await dispatch(
              { type: 'approveCompletion', challengeId: view.challenge.id },
              { success: t('parent.approve.approved', { name: child.firstName }) },
            );
            if (result) playSound('chime');
          }}
        />
        <Button
          label={t('parent.overview.spark')}
          variant="spark"
          onPress={() => dispatch({ type: 'giveSpark', challengeId: view.challenge.id }, { success: t('parent.approve.sparkHint') })}
        />
        <Button
          label={t('parent.overview.details')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/parent/approve/[id]', params: { id: view.challenge.id } })}
        />
      </View>
    </Card>
  );
}

export function RewardRequestCard({ item, state }: { item: PendingRewardRequest; state: FamilyState }) {
  const t = useT();
  const dispatch = useDispatch();
  return (
    <Card style={styles.approval} tone="star">
      <View style={styles.row}>
        <ChildAvatar child={item.child} state={state} size={44} />
        <View style={styles.flex}>
          <AppText variant="heading">
            {t('parent.overview.rewardWants', { name: item.child.firstName, reward: item.reward?.title ?? '' })}
          </AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            {item.reward?.icon} ⭐ {item.request.costStars}
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label={t('parent.overview.confirm')}
          style={styles.flex}
          onPress={async () => {
            const ok = await dispatch({ type: 'resolveRewardRequest', requestId: item.request.id, confirm: true });
            if (ok) playSound('coin');
          }}
        />
        <Button
          label={t('parent.overview.decline')}
          variant="secondary"
          onPress={() => dispatch({ type: 'resolveRewardRequest', requestId: item.request.id, confirm: false })}
        />
      </View>
    </Card>
  );
}

export function ChildSummaryCard({ child, state, now }: { child: Child; state: FamilyState; now: string }) {
  const t = useT();
  const week = weekStars(state, child.id, weekStartKey(now, state.family.settings.timeZone));
  const active = eggsForChild(state, catalog, child.id).length;
  const progress = milestoneProgress(state, catalog, child.id);
  const ratio = progress.next
    ? (progress.total - (progress.current?.thresholdStars ?? 0)) /
      (progress.next.thresholdStars - (progress.current?.thresholdStars ?? 0))
    : 1;

  return (
    <Card
      onPress={() => router.push({ pathname: '/parent/child/[id]', params: { id: child.id } })}
      accessibilityLabel={child.firstName}
      style={styles.childCard}>
      <View style={styles.row}>
        <ChildAvatar child={child} state={state} size={56} />
        <View style={styles.flex}>
          <AppText variant="title">{child.firstName}</AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            {progress.current ? `${progress.current.emoji} ${progress.current.title} · ` : ''}
            {t(`worlds.${child.world}`)}
          </AppText>
        </View>
        <View style={styles.starPill}>
          <AppText variant="heading" color="#5A3E00">
            ⭐ {progress.total}
          </AppText>
        </View>
      </View>
      <View style={styles.stats}>
        <Stat value={`${week}`} label={t('parent.overview.thisWeek')} />
        <Stat value={`${active}`} label={t('parent.overview.activeLabel')} />
      </View>
      {progress.next ? (
        <View style={styles.progress}>
          <ProgressBar ratio={ratio} />
          <AppText variant="caption" color={palette.inkSoft}>
            {t('parent.overview.nextMilestone', { count: progress.remaining, title: progress.next.title })}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="display">{value}</AppText>
      <AppText variant="caption" color={palette.inkSoft}>
        {label}
      </AppText>
    </View>
  );
}

export function GoalCard({ goal }: { goal: GoalView }) {
  const t = useT();
  return (
    <Card tone="primary" style={styles.goal} onPress={() => router.push('/parent/competitions')}>
      <AppText variant="overline" color={palette.primary}>
        🎯 {t('parent.competitions.familyGoal')}
      </AppText>
      <AppText variant="heading">{goal.goal.title}</AppText>
      <ProgressBar ratio={goal.ratio} color={palette.primary} track="#FFFFFF" height={14} />
      <AppText variant="caption" color={palette.inkSoft}>
        {t('parent.competitions.goalProgress', { progress: goal.progress, target: goal.goal.targetStars })} · {goal.goal.rewardText}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  approval: { gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  childCard: { gap: space.md },
  starPill: {
    backgroundColor: palette.starSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  stats: { flexDirection: 'row', gap: space.xl },
  stat: { gap: 0 },
  progress: { gap: space.xs },
  goal: { gap: space.sm },
});
