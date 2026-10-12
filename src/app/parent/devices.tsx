import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow, SectionHeader } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { startChildMode } from '@/features/parent/handoff';
import { createPairingCode, listDevices, removeDevice, type DeviceRow, type PairingCode } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { logError } from '@/lib/log';
import { useFamily, useGameStore } from '@/state/game';
import { palette, space } from '@/theme/tokens';

export default function Devices() {
  const t = useT();
  const state = useFamily();
  const isCloud = useGameStore((s) => s.backend?.kind === 'cloud');

  if (!isCloud) {
    return (
      <Screen back="/parent/more" title={t('parent.devices.title')}>
        <Card style={styles.gap}>
          <AppText variant="heading">📱 {t('parent.devices.localTitle')}</AppText>
          <AppText variant="body" color={palette.inkSoft}>
            {t('parent.devices.localHint')}
          </AppText>
          <Button label={t('parent.devices.useAsChild')} onPress={() => startChildMode(state)} />
        </Card>
        <Card tone="sunk">
          <AppText variant="caption" color={palette.inkSoft}>
            ☁️ {t('parent.devices.cloudNeeded')}
          </AppText>
        </Card>
      </Screen>
    );
  }
  return <CloudDevices />;
}

function CloudDevices() {
  const t = useT();
  const state = useFamily();
  const [selected, setSelected] = useState<string[]>(state.children.map((c) => c.id));
  const [code, setCode] = useState<PairingCode | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    listDevices().then(setDevices).catch((error: unknown) => logError('devices.list', error));
  }, []);
  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      setCode(await createPairingCode(selected));
    } catch (error) {
      logError('devices.code', error);
      showToast(t('common.somethingWrong'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const names = (ids: string[]) =>
    ids.map((id) => state.children.find((c) => c.id === id)?.firstName ?? '?').join(', ');

  return (
    <Screen back="/parent/more" title={t('parent.devices.title')}>
      <Card style={styles.gap}>
        <AppText variant="heading">{t('parent.devices.pairTitle')}</AppText>
        <AppText variant="caption" color={palette.inkSoft}>
          {t('parent.devices.pairHint')}
        </AppText>
        <AppText variant="label" color={palette.inkSoft}>
          {t('parent.devices.chooseChildren')}
        </AppText>
        <ChipRow>
          {state.children.map((c) => (
            <Chip key={c.id} label={c.firstName} selected={selected.includes(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </ChipRow>
        <Button label={t('parent.devices.createCode')} onPress={create} loading={busy} disabled={selected.length === 0} />
        {code ? (
          <View style={styles.code}>
            <QRCode value={`jagkan://pair?code=${code.code}`} size={180} />
            <AppText variant="hero" style={styles.digits} accessibilityLabel={code.code.split('').join(' ')}>
              {code.code.slice(0, 3)} {code.code.slice(3)}
            </AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              {t('parent.devices.codeValid')}
            </AppText>
          </View>
        ) : null}
      </Card>

      <SectionHeader title={t('parent.devices.connected')} action={<Button size="sm" variant="ghost" label="↻" onPress={refresh} />} />
      {devices.length === 0 ? <AppText color={palette.inkSoft}>{t('parent.devices.noDevices')}</AppText> : null}
      {devices.map((device) => (
        <Card key={device.id} style={styles.row}>
          <AppText style={styles.icon}>{device.platform === 'ios' ? '📱' : device.platform === 'android' ? '🤖' : '💻'}</AppText>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{names(device.child_ids)}</AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              {t('parent.devices.lastSeen', {
                date: new Date(device.last_seen ?? device.created_at).toLocaleString('sv-SE'),
              })}
            </AppText>
          </View>
          <Button
            size="sm"
            variant="danger"
            label={t('parent.devices.remove')}
            onPress={async () => {
              try {
                await removeDevice(device.id);
                refresh();
              } catch (error) {
                logError('devices.remove', error);
                showToast(t('common.somethingWrong'), 'error');
              }
            }}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 28, lineHeight: 34 },
  code: { alignItems: 'center', gap: space.sm, paddingTop: space.md },
  digits: { letterSpacing: 6 },
});
