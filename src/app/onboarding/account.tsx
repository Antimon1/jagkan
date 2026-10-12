import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Divider, TextField } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { sendLoginCode, signInWithApple, verifyLoginCode } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { errorMessage, logError } from '@/lib/log';
import { startBackend } from '@/state/bootstrap';
import { useDeviceStore } from '@/state/device';
import { useGameStore } from '@/state/game';
import { palette, space } from '@/theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parent sign-in for cloud sync (spec 10.1: e-post eller Sign in with Apple/Google). */
export default function AccountStep() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const afterSignIn = async () => {
    useDeviceStore.getState().setBackend('cloud', 'parent');
    useDeviceStore.getState().enterParentMode();
    await startBackend('cloud');
    const family = useGameStore.getState().family;
    router.replace(family ? '/parent' : '/onboarding/family');
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      logError('account', error);
      showToast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back="/welcome" title={t('onboarding.accountTitle')} subtitle={t('onboarding.accountHint')}>
      <Card style={styles.card}>
        <TextField
          label={t('auth.email')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!sent}
        />
        {sent ? (
          <>
            <AppText variant="caption" color={palette.inkSoft}>
              {t('auth.codeSent', { email })}
            </AppText>
            <TextField
              label={t('auth.code')}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={8}
              autoComplete="one-time-code"
            />
            <Button
              label={t('auth.verify')}
              loading={busy}
              disabled={code.length < 6}
              onPress={() => run(async () => {
                await verifyLoginCode(email.trim(), code.trim());
                await afterSignIn();
              })}
            />
          </>
        ) : (
          <Button
            label={t('auth.sendCode')}
            loading={busy}
            disabled={!EMAIL.test(email.trim())}
            onPress={() => run(async () => {
              await sendLoginCode(email.trim());
              setSent(true);
            })}
          />
        )}
        {Platform.OS === 'ios' ? (
          <Button
            label={t('auth.apple')}
            variant="secondary"
            onPress={() => run(async () => {
              await signInWithApple();
              await afterSignIn();
            })}
          />
        ) : null}
      </Card>

      <Divider />
      <View style={styles.local}>
        <Button
          label={t('onboarding.useLocal')}
          variant="ghost"
          onPress={() => {
            useDeviceStore.getState().setBackend('local');
            router.push('/onboarding/family');
          }}
        />
        <AppText variant="caption" color={palette.inkFaint} align="center">
          {t('welcome.localNote')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  local: { gap: space.xs },
});
