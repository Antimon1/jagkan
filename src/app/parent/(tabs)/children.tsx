import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { familyLimits } from '@/domain/plan';
import { ChildSummaryCard } from '@/features/parent/cards';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { useNow } from '@/state/hooks';

export default function ChildrenTab() {
  const t = useT();
  const state = useFamily();
  const now = useNow();
  const canAdd = state.children.length < familyLimits(state).maxChildren;

  return (
    <Screen title={t('parent.tabs.children')}>
      {state.children.map((child) => (
        <ChildSummaryCard key={child.id} child={child} state={state} now={now} />
      ))}
      {canAdd ? (
        <Button label={t('onboarding.addChild')} variant="secondary" onPress={() => router.push('/parent/child/new')} />
      ) : (
        <Card tone="plus" onPress={() => router.push('/parent/paywall')}>
          <AppText variant="body">{t('onboarding.freeLimit')}</AppText>
        </Card>
      )}
    </Screen>
  );
}
