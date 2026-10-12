import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader, Stepper, TextField, ToggleRow } from '@/components/forms';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { MAX_ACTIVE_LIMIT } from '@/domain/constants';
import type { Parent } from '@/domain/types';
import { createInvite, deleteCloudFamily, removeCoparent, signOut } from '@/lib/api';
import { confirmAsync } from '@/lib/confirm';
import { exportFamilyData } from '@/lib/exportData';
import { useT } from '@/lib/i18n';
import { logError } from '@/lib/log';
import { deleteAllMedia } from '@/lib/media';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/notifications';
import { clearPin, hasPin, PIN_LENGTH, setPin } from '@/lib/pin';
import { useDeviceStore } from '@/state/device';
import { useFamily, useGameStore } from '@/state/game';
import { useDispatch, useIsAdmin } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

export default function Settings() {
  const t = useT();
  const state = useFamily();
  const dispatch = useDispatch();
  const isCloud = useGameStore((s) => s.backend?.kind === 'cloud');
  const isAdmin = useIsAdmin();
  const { settings } = state.family;
  const [name, setName] = useState(state.family.name);
  const [pinExists, setPinExists] = useState(false);
  const [pinDraft, setPinDraft] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);

  useEffect(() => {
    hasPin().then(setPinExists).catch(() => setPinExists(false));
  }, [pinDraft]);

  // Keep the local daily reminder in sync with the setting (spec 1: automatic reminders).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (settings.notifications.reminders) {
      scheduleDailyReminder(settings.notifications.reminderHour, t('parent.settings.reminderTitle'), t('parent.settings.reminderBody'));
    } else {
      cancelDailyReminder();
    }
  }, [settings.notifications.reminders, settings.notifications.reminderHour, t]);

  const savePin = async (value: string) => {
    if (value.length !== PIN_LENGTH) return;
    await setPin(value);
    setPinDraft(null);
    showToast(t('common.done'), 'success');
  };

  const deleteFamily = async () => {
    if (!(await confirmAsync(t('parent.settings.deleteConfirm'), t('common.delete'), t('common.cancel')))) return;
    try {
      if (isCloud) await deleteCloudFamily();
      await deleteAllMedia();
      await clearPin();
      await useGameStore.getState().reset();
      if (isCloud) await signOut().catch(() => undefined);
      useDeviceStore.getState().reset();
      showToast(t('parent.settings.deleted'), 'success');
      router.replace('/welcome');
    } catch (error) {
      logError('settings.delete', error);
      showToast(t('common.somethingWrong'), 'error');
    }
  };

  const removeParent = async (parent: Parent) => {
    const question = t('parent.settings.removeCoparentConfirm', { name: parent.displayName });
    if (!(await confirmAsync(question, t('parent.settings.removeCoparent'), t('common.cancel')))) return;
    try {
      await removeCoparent(parent.id);
      await useGameStore.getState().refresh();
      showToast(t('parent.settings.removedCoparent', { name: parent.displayName }), 'success');
    } catch (error) {
      logError('settings.removeCoparent', error);
      showToast(t('common.somethingWrong'), 'error');
    }
  };

  return (
    <Screen back="/parent/more" title={t('parent.settings.title')}>
      <SectionHeader title={t('parent.settings.family')} />
      <Card style={styles.gap}>
        <TextField label={t('parent.settings.familyName')} value={name} onChangeText={setName} maxLength={50} />
        <Button
          size="sm"
          variant="secondary"
          label={t('common.save')}
          disabled={name.trim() === state.family.name || !name.trim()}
          onPress={() => dispatch({ type: 'renameFamily', name }, { success: t('common.done') })}
        />
      </Card>

      <SectionHeader title={t('parent.settings.game')} />
      <Card>
        <ToggleRow
          label={t('parent.settings.sparkBonus')}
          value={settings.sparkBonusEnabled}
          onChange={(value) => dispatch({ type: 'updateSettings', settings: { sparkBonusEnabled: value } })}
        />
        <Stepper
          label={t('parent.settings.maxActive')}
          value={settings.maxActiveChallenges}
          min={1}
          max={MAX_ACTIVE_LIMIT}
          onChange={(value) => dispatch({ type: 'updateSettings', settings: { maxActiveChallenges: value } })}
        />
        <ToggleRow label={t('parent.settings.sound')} value={settings.soundEnabled} onChange={(value) => dispatch({ type: 'updateSettings', settings: { soundEnabled: value } })} />
        <ToggleRow label={t('parent.settings.speech')} value={settings.speechEnabled} onChange={(value) => dispatch({ type: 'updateSettings', settings: { speechEnabled: value } })} />
      </Card>

      <SectionHeader title={t('parent.settings.notifications')} />
      <Card>
        <ToggleRow
          label={t('parent.settings.notifyApprovals')}
          value={settings.notifications.approvals}
          onChange={(value) => dispatch({ type: 'updateSettings', settings: { notifications: { approvals: value } } })}
        />
        <ToggleRow
          label={t('parent.settings.notifyWeekly')}
          value={settings.notifications.weeklySummary}
          onChange={(value) => dispatch({ type: 'updateSettings', settings: { notifications: { weeklySummary: value } } })}
        />
        <ToggleRow
          label={t('parent.settings.notifyReminders')}
          value={settings.notifications.reminders}
          onChange={(value) => dispatch({ type: 'updateSettings', settings: { notifications: { reminders: value } } })}
        />
        {settings.notifications.reminders ? (
          <Stepper
            label={t('parent.settings.reminderHour', { hour: settings.notifications.reminderHour })}
            value={settings.notifications.reminderHour}
            min={6}
            max={21}
            format={(v) => `${v}:00`}
            onChange={(value) => dispatch({ type: 'updateSettings', settings: { notifications: { reminderHour: value } } })}
          />
        ) : null}
      </Card>

      <SectionHeader title={t('parent.settings.security')} />
      <Card style={styles.gap}>
        {pinDraft !== null ? (
          <>
            <PinPad value={pinDraft} onChange={(value) => { setPinDraft(value); if (value.length === PIN_LENGTH) savePin(value); }} />
            <Button size="sm" variant="ghost" label={t('common.cancel')} onPress={() => setPinDraft(null)} />
          </>
        ) : (
          <View style={styles.row}>
            <Button size="sm" label={t('parent.settings.changePin')} onPress={() => setPinDraft('')} />
            {pinExists ? (
              <Button
                size="sm"
                variant="secondary"
                label={t('parent.settings.removePin')}
                onPress={async () => {
                  await clearPin();
                  setPinExists(false);
                }}
              />
            ) : null}
          </View>
        )}
      </Card>

      <SectionHeader title={t('parent.settings.subscription')} />
      <Card style={styles.gap}>
        <AppText variant="bodyStrong" color={state.family.plusActive ? palette.success : palette.ink}>
          {state.family.plusActive ? `✅ ${t('parent.settings.plusActive')}` : t('parent.settings.plusInactive')}
        </AppText>
        <Button size="sm" variant="plus" label={t('parent.settings.getPlus')} onPress={() => router.push('/parent/paywall')} />
      </Card>

      <SectionHeader title={t('parent.settings.parents')} />
      <Card style={styles.gap}>
        {state.parents.map((parent) => (
          <View key={parent.id} style={styles.member}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {parent.displayName}
            </AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              {t(parent.role === 'admin' ? 'parent.settings.roleAdmin' : 'parent.settings.roleCoparent')}
            </AppText>
            {isAdmin && isCloud && parent.role === 'coparent' ? (
              <Button size="sm" variant="danger" label={t('parent.settings.removeCoparent')} onPress={() => removeParent(parent)} />
            ) : null}
          </View>
        ))}
        {isCloud && !isAdmin ? (
          <AppText variant="caption" color={palette.inkSoft}>
            {t('parent.settings.adminOnly')}
          </AppText>
        ) : isCloud ? (
          <>
            <AppText variant="caption" color={palette.inkSoft}>
              {t('parent.settings.coParentHint')}
            </AppText>
            {invite ? (
              <AppText variant="display" align="center" style={styles.code}>
                {invite}
              </AppText>
            ) : null}
            <Button
              size="sm"
              label={t('parent.settings.coParent')}
              onPress={async () => {
                try {
                  setInvite((await createInvite()).code);
                } catch (error) {
                  logError('settings.invite', error);
                  showToast(t('common.somethingWrong'), 'error');
                }
              }}
            />
          </>
        ) : (
          <AppText variant="caption" color={palette.inkSoft}>
            {t('parent.settings.coParentLocal')}
          </AppText>
        )}
      </Card>

      <SectionHeader title={t('parent.settings.data')} />
      <Card style={styles.gap}>
        <AppText variant="caption" color={palette.inkSoft}>
          {t('parent.settings.storage')}: {isCloud ? t('parent.settings.storageCloud') : t('parent.settings.storageLocal')}
        </AppText>
        <Button size="sm" variant="secondary" label={t('parent.settings.export')} onPress={() => exportFamilyData(state)} />
        {isAdmin ? <Button size="sm" variant="danger" label={t('parent.settings.deleteFamily')} onPress={deleteFamily} /> : null}
        {isCloud ? (
          <Button
            size="sm"
            variant="ghost"
            label={t('auth.signOut')}
            onPress={async () => {
              await signOut().catch(() => undefined);
              await useGameStore.getState().reset();
              useDeviceStore.getState().reset();
              router.replace('/welcome');
            }}
          />
        ) : null}
      </Card>

      <SectionHeader title={t('parent.settings.privacy')} />
      <Card tone="sunk" style={styles.gap}>
        <AppText variant="caption" color={palette.inkSoft}>
          🔒 {t('parent.settings.privacyText')}
        </AppText>
        <AppText variant="caption" color={palette.inkFaint}>
          {t('parent.settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  code: { letterSpacing: 4 },
  flex: { flex: 1 },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
