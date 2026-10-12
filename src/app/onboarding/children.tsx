import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { childAge } from '@/domain/age';
import { familyLimits } from '@/domain/plan';
import { ChildAvatar } from '@/features/children/ChildAvatar';
import { ChildForm } from '@/features/children/ChildForm';
import { useT } from '@/lib/i18n';
import { useFamily } from '@/state/game';
import { useDispatch } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

export default function ChildrenStep() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const limits = familyLimits(state);
  const canAddMore = state.children.length < limits.maxChildren;
  const now = new Date().toISOString();

  return (
    <Screen
      title={t('onboarding.childrenTitle')}
      subtitle={t('onboarding.childrenHint')}
      footer={
        <Button
          label={t('common.next')}
          onPress={() => router.push('/onboarding/starter')}
          disabled={state.children.length === 0}
          testID="children-next"
        />
      }>
      {state.children.map((child) => (
        <Card key={child.id} style={styles.row}>
          <ChildAvatar child={child} state={state} size={48} />
          <View style={styles.flex}>
            <AppText variant="heading">{child.firstName}</AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              {childAge(child, now, state.family.settings.timeZone)} år · {t(`worlds.${child.world}`)}
            </AppText>
          </View>
        </Card>
      ))}
      {canAddMore ? (
        <Card>
          <ChildForm
            submitLabel={state.children.length ? t('onboarding.addAnother') : t('onboarding.addChild')}
            onSubmit={async (value) => {
              await dispatch({ type: 'addChild', ...value });
            }}
          />
        </Card>
      ) : (
        <Card tone="plus">
          <AppText variant="body">{t('onboarding.freeLimit')}</AppText>
        </Card>
      )}
      {state.children.length === 0 ? (
        <AppText variant="caption" color={palette.inkFaint} align="center">
          {t('onboarding.noChildren')}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
