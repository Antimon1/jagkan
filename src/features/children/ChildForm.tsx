import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip, ChipRow, TextField } from '@/components/forms';
import { useT } from '@/lib/i18n';
import { palette, space } from '@/theme/tokens';

export interface ChildFormValue {
  firstName: string;
  birthYear: number;
  birthMonth: number;
}

export interface ChildFormProps {
  initial?: ChildFormValue;
  submitLabel: string;
  onSubmit: (value: ChildFormValue) => void | Promise<void>;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function ChildForm({ initial, submitLabel, onSubmit }: ChildFormProps) {
  const t = useT();
  const year = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => year - 3 - i);
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [birthYear, setBirthYear] = useState<number | null>(initial?.birthYear ?? null);
  const [birthMonth, setBirthMonth] = useState<number | null>(initial?.birthMonth ?? null);
  const [busy, setBusy] = useState(false);
  const valid = firstName.trim().length > 0 && birthYear !== null && birthMonth !== null;

  const submit = async () => {
    if (!valid || birthYear === null || birthMonth === null) return;
    setBusy(true);
    await onSubmit({ firstName: firstName.trim(), birthYear, birthMonth });
    setBusy(false);
    if (!initial) {
      setFirstName('');
      setBirthYear(null);
      setBirthMonth(null);
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label={t('onboarding.childName')}
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        autoComplete="off"
        maxLength={30}
        testID="child-name"
      />
      <View style={styles.group}>
        <AppText variant="label" color={palette.inkSoft}>
          {t('onboarding.birthYear')}
        </AppText>
        <ChipRow>
          {years.map((y) => (
            <Chip key={y} label={String(y)} selected={birthYear === y} onPress={() => setBirthYear(y)} />
          ))}
        </ChipRow>
      </View>
      <View style={styles.group}>
        <AppText variant="label" color={palette.inkSoft}>
          {t('onboarding.birthMonth')}
        </AppText>
        <ChipRow>
          {MONTHS.map((m, i) => (
            <Chip key={m} label={m} selected={birthMonth === i + 1} onPress={() => setBirthMonth(i + 1)} />
          ))}
        </ChipRow>
      </View>
      <Button label={submitLabel} onPress={submit} disabled={!valid} loading={busy} testID="child-submit" />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  group: { gap: space.sm },
});
