import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader, TextField } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { createFamilyState } from '@/domain/factory';
import { acceptInvite, createCloudFamily } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { newId } from '@/lib/ids';
import { logError } from '@/lib/log';
import { startBackend } from '@/state/bootstrap';
import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';
import { createLocalBackend } from '@/state/localBackend';
import { palette } from '@/theme/tokens';

export default function FamilyStep() {
  const t = useT();
  const [familyName, setFamilyName] = useState('');
  const [parentName, setParentName] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const isCloud = useDeviceStore((s) => s.backend === 'cloud');
  const valid = familyName.trim().length > 0 && parentName.trim().length > 0;

  const join = async () => {
    setBusy(true);
    try {
      await acceptInvite(inviteCode.trim().toUpperCase(), parentName.trim());
      await startBackend('cloud');
      router.replace('/parent');
    } catch (error) {
      logError('onboarding.join', error);
      showToast(t('common.somethingWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const device = useDeviceStore.getState();
      if (device.backend === 'cloud') {
        await createCloudFamily(familyName.trim(), parentName.trim());
        await startBackend('cloud');
      } else {
        device.setBackend('local');
        const game = useGameStore.getState();
        await game.init(createLocalBackend());
        await game.replace(
          createFamilyState({
            familyId: newId(),
            familyName: familyName.trim(),
            parentId: newId(),
            parentName: parentName.trim(),
            now: new Date().toISOString(),
          }),
        );
      }
      useDeviceStore.getState().enterParentMode();
      router.replace('/onboarding/children');
    } catch (error) {
      logError('onboarding.family', error);
      showToast(t('common.somethingWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      back="/welcome"
      title={t('onboarding.familyTitle')}
      footer={<Button label={t('common.next')} onPress={next} disabled={!valid} loading={busy} testID="family-next" />}>
      <AppText variant="body" color={palette.inkSoft}>
        {t('welcome.subtitle')}
      </AppText>
      <TextField
        label={t('onboarding.familyName')}
        placeholder={t('onboarding.familyPlaceholder')}
        value={familyName}
        onChangeText={setFamilyName}
        maxLength={50}
        testID="family-name"
      />
      <TextField
        label={t('onboarding.yourName')}
        placeholder={t('onboarding.yourNamePlaceholder')}
        value={parentName}
        onChangeText={setParentName}
        maxLength={30}
        testID="parent-name"
      />
      {isCloud ? (
        <>
          <SectionHeader title={t('auth.joinTitle')} />
          <Card style={{ gap: 12 }}>
            <AppText variant="caption" color={palette.inkSoft}>
              {t('auth.joinHint')}
            </AppText>
            <TextField
              label={t('auth.joinCode')}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={8}
            />
            <Button
              label={t('auth.join')}
              variant="secondary"
              onPress={join}
              loading={busy}
              disabled={inviteCode.trim().length < 6 || !parentName.trim()}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
