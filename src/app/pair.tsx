import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { pairDevice } from '@/lib/api';
import { config } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { logError } from '@/lib/log';
import { startBackend } from '@/state/bootstrap';
import { useDeviceStore } from '@/state/device';
import { palette, radius, space } from '@/theme/tokens';

const CODE_LENGTH = 6;

function codeFromScan(data: string): string | null {
  const match = /code=(\d{6})/.exec(data) ?? /^(\d{6})$/.exec(data.trim());
  return match ? match[1] : null;
}

/** "Jag är ett barn": pair this device with a code or QR from the parent (spec 11). */
export default function Pair() {
  const t = useT();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code && /^\d{6}$/.test(params.code) ? params.code : '');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const connect = async (value: string) => {
    if (busy || value.length !== CODE_LENGTH) return;
    setBusy(true);
    try {
      const result = await pairDevice(value);
      const device = useDeviceStore.getState();
      device.setBackend('cloud', 'child-device');
      device.setPairedChildren(result.childIds);
      device.enterChildMode(result.childIds.length === 1 ? result.childIds[0] : null);
      await startBackend('cloud');
      showToast(t('pair.success'), 'success');
      router.replace('/child');
    } catch (error) {
      logError('pair', error);
      showToast(t('pair.failed'), 'error');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  /** Connect automatically when all six digits are in. */
  const updateCode = (value: string) => {
    setCode(value);
    if (value.length === CODE_LENGTH) connect(value);
  };

  if (!config.cloudEnabled) {
    return (
      <Screen back="/welcome" title={t('pair.title')}>
        <Card>
          <AppText variant="body">{t('pair.cloudOff')}</AppText>
        </Card>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.replace('/welcome')} />
      </Screen>
    );
  }

  return (
    <Screen back="/welcome" title={t('pair.title')} subtitle={t('pair.hint')}>
      {Platform.OS !== 'web' ? (
        scanning && permission?.granted ? (
          <View style={styles.camera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                const scanned = codeFromScan(data);
                if (scanned) {
                  setScanning(false);
                  updateCode(scanned);
                }
              }}
            />
          </View>
        ) : (
          <Button
            label={`📷 ${t('pair.scan')}`}
            size="lg"
            onPress={async () => {
              const result = permission?.granted ? permission : await requestPermission();
              if (result.granted) setScanning(true);
              else showToast(t('pair.cameraDenied'));
            }}
          />
        )
      ) : null}
      <Card style={styles.card}>
        <AppText variant="heading" align="center">
          {t('pair.enterCode')}
        </AppText>
        <PinPad value={code} onChange={updateCode} secret={false} maxLength={CODE_LENGTH} length={CODE_LENGTH} />
        <Button label={t('pair.connect')} onPress={() => connect(code)} loading={busy} disabled={code.length !== CODE_LENGTH} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: palette.ink },
  card: { gap: space.lg },
});
