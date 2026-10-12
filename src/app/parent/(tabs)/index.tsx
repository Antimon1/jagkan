import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { catalog } from '@/data/catalog';
import { familyGoalView, pendingApprovals, pendingRewardRequests } from '@/domain/selectors';
import { ApprovalCard, ChildSummaryCard, GoalCard, RewardRequestCard } from '@/features/parent/cards';
import { startChildMode } from '@/features/parent/handoff';
import { useT } from '@/lib/i18n';
import { useFamily, useGameStore } from '@/state/game';
import { useNow } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

export default function Overview() {
  const t = useT();
  const state = useFamily();
  const parentId = useGameStore((s) => s.parentId);
  const pending = useGameStore((s) => s.pending);
  const now = useNow();
  const parent = state.parents.find((p) => p.id === parentId) ?? state.parents[0];
  const approvals = pendingApprovals(state, catalog);
  const rewardRequests = pendingRewardRequests(state);
  const goal = familyGoalView(state, now);

  return (
    <Screen
      title={state.family.name}
      subtitle={pending > 0 ? t('common.offline') : t('parent.overview.greeting', { name: parent?.displayName ?? '' })}
      right={
        state.family.plusActive ? (
          <View style={styles.plus}>
            <AppText variant="label" color="#FFFFFF">
              {t('common.plus')}
            </AppText>
          </View>
        ) : null
      }>
      <SectionHeader title={t('parent.overview.waiting')} />
      {approvals.length === 0 && rewardRequests.length === 0 ? (
        <Card tone="success">
          <AppText variant="bodyStrong" color={palette.success}>
            ✅ {t('parent.overview.nothingWaiting')}
          </AppText>
        </Card>
      ) : null}
      {approvals.map((item, i) => (
        <Animated.View key={item.view.challenge.id} entering={FadeInDown.delay(i * 60)}>
          <ApprovalCard item={item} state={state} />
        </Animated.View>
      ))}
      {rewardRequests.map((item) => (
        <RewardRequestCard key={item.request.id} item={item} state={state} />
      ))}

      {goal ? <GoalCard goal={goal} /> : null}

      <SectionHeader title={t('parent.tabs.children')} />
      {state.children.length === 0 ? (
        <Button label={t('parent.overview.addFirstChild')} onPress={() => router.push('/parent/child/new')} />
      ) : null}
      {state.children.map((child) => (
        <ChildSummaryCard key={child.id} child={child} state={state} now={now} />
      ))}

      {state.children.length > 0 ? (
        <Card tone="star" style={styles.handoff}>
          <AppText variant="heading">🧒 {t('parent.overview.childMode')}</AppText>
          <AppText variant="caption" color={palette.inkSoft}>
            {t('parent.overview.childModeHint')}
          </AppText>
          <Button label={t('parent.overview.childMode')} variant="primary" onPress={() => startChildMode(state)} testID="start-child-mode" />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  plus: {
    backgroundColor: palette.plus,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  handoff: { gap: space.sm },
});
