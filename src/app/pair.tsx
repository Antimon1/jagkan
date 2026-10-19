import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { secretFromScan } from '@/features/pairing/pairingLink';
import { pairDevice, type PairSecret } from '@/lib/api';
import { config } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { logError } from '@/lib/log';
import { startBackend } from '@/state/bootstrap';
import { useDeviceStore } from '@/state/device';
import { palette, radius, space } from '@/theme/tokens';

const CODE_LENGTH = 6;

/** "Jag är ett barn": pair this device with a code or QR from the parent (spec 11). */
export default function Pair() {
  const t = useT();
  const params = useLocalSearchParams<{ code?: string; token?: string }>();
  const [code, setCode] = useState(params.code && /^\d{6}$/.test(params.code) ? params.code : '');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const connect = async (secret: PairSecret) => {
    if (busy || ('code' in secret && secret.code.length !== CODE_LENGTH)) return;
    setBusy(true);
    try {
      const result = await pairDevice(secret);
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
    if (value.length === CODE_LENGTH) connect({ code: value });
  };

  // Opened from the QR code with the phone camera: jagkan://pair?token=...
  useEffect(() => {
    const secret = params.token ? secretFromScan(`token=${params.token}`) : null;
    if (!secret || !config.cloudEnabled) return undefined;
    // Pair after the first render, so the screen can show that it is working.
    const timer = setTimeout(() => connect(secret), 0);
    return () => clearTimeout(timer);
    // Only for the link the screen was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

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
                const scanned = secretFromScan(data);
                if (scanned) {
                  setScanning(false);
                  if ('code' in scanned) updateCode(scanned.code);
                  else connect(scanned);
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
        <Button label={t('pair.connect')} onPress={() => connect({ code })} loading={busy} disabled={code.length !== CODE_LENGTH} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: palette.ink },
  card: { gap: space.lg },
});
