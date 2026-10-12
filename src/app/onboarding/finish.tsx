import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader, ToggleRow } from '@/components/forms';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { familyLimits } from '@/domain/plan';
import { useT } from '@/lib/i18n';
import { PIN_LENGTH, setPin } from '@/lib/pin';
import { useFamily } from '@/state/game';
import { useDispatch } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

export default function FinishStep() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const limits = familyLimits(state);
  const [pin, setPinValue] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { competitions } = state;
  const confirming = pin.length === PIN_LENGTH;

  const done = async (withPin: boolean) => {
    if (withPin) {
      if (pin !== repeat) {
        setError(t('onboarding.pinMismatch'));
        setRepeat('');
        return;
      }
      setBusy(true);
      await setPin(pin);
      setBusy(false);
    }
    router.replace('/parent');
  };

  return (
    <Screen back title={t('onboarding.modesTitle')} subtitle={t('onboarding.modesHint')}>
      <Card>
        <ToggleRow
          label={t('parent.competitions.self')}
          hint={t('parent.competitions.selfHint')}
          value={competitions.selfModeEnabled}
          onChange={(value) => dispatch({ type: 'updateCompetitions', selfModeEnabled: value })}
        />
        <ToggleRow
          label={t('parent.competitions.duel')}
          hint={limits.siblingDuel ? t('parent.competitions.duelHint') : t('common.plusOnly')}
          value={competitions.siblingDuelEnabled}
          disabled={!limits.siblingDuel || state.children.length < 2}
          onChange={(value) => dispatch({ type: 'updateCompetitions', siblingDuelEnabled: value })}
        />
        <ToggleRow
          label={t('parent.competitions.familyGoal')}
          hint={limits.familyGoal ? t('parent.competitions.familyGoalHint') : t('common.plusOnly')}
          value={competitions.familyGoalEnabled}
          disabled={!limits.familyGoal}
          onChange={(value) => dispatch({ type: 'updateCompetitions', familyGoalEnabled: value })}
        />
      </Card>

      <SectionHeader title={t('onboarding.pinTitle')} />
      <Card style={styles.pinCard}>
        <AppText variant="body" color={palette.inkSoft} align="center">
          {confirming ? t('onboarding.pinRepeat') : t('onboarding.pinHint')}
        </AppText>
        <PinPad
          value={confirming ? repeat : pin}
          onChange={(value) => {
            setError(null);
            if (confirming) setRepeat(value);
            else setPinValue(value);
          }}
        />
        {error ? (
          <AppText variant="label" color={palette.danger} align="center">
            {error}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button
            label={t('onboarding.finish')}
            onPress={() => done(true)}
            disabled={repeat.length !== PIN_LENGTH}
            loading={busy}
            testID="finish"
          />
          <Button label={t('onboarding.pinSkip')} variant="ghost" size="sm" onPress={() => done(false)} testID="finish-skip-pin" />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pinCard: { gap: space.lg, alignItems: 'stretch' },
  actions: { gap: space.sm },
});
