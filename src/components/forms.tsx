import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';

import { haptic } from '@/lib/sound';
import { palette, radius, space, type as typeScale } from '@/theme/tokens';

import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <AppText variant="label" color={palette.inkSoft}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.inkFaint}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" color={palette.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={palette.inkFaint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: string;
  color?: string;
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, icon, color = palette.primary, disabled }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}>
      <AppText variant="label" color={selected ? '#FFFFFF' : palette.ink}>
        {icon ? `${icon} ` : ''}
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export interface ToggleRowProps {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  badge?: ReactNode;
}

export function ToggleRow({ label, hint, value, onChange, disabled, badge }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <View style={styles.inline}>
          <AppText variant="bodyStrong">{label}</AppText>
          {badge}
        </View>
        {hint ? (
          <AppText variant="caption" color={palette.inkSoft}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: palette.primary, false: palette.line }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, step = 1, format = String, onChange }: StepperProps) {
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next * 100) / 100));
    if (clamped !== value) {
      haptic('light');
      onChange(clamped);
    }
  };
  return (
    <View style={styles.toggleRow}>
      <AppText variant="bodyStrong" style={styles.flex}>
        {label}
      </AppText>
      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} minus`}
          onPress={() => set(value - step)}
          style={styles.stepButton}>
          <AppText variant="title" color={palette.primary}>
            −
          </AppText>
        </Pressable>
        <AppText variant="heading" style={styles.stepValue} accessibilityLiveRegion="polite">
          {format(value)}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} plus`}
          onPress={() => set(value + step)}
          style={styles.stepButton}>
          <AppText variant="title" color={palette.primary}>
            +
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function ProgressBar({ ratio, color = palette.star, track = palette.line, height = 10 }: {
  ratio: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: track, height, borderRadius: height / 2 }]}>
      <View style={{ width: `${clamped * 100}%`, backgroundColor: color, height, borderRadius: height / 2 }} />
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="overline" color={palette.inkSoft} accessibilityRole="header">
        {title}
      </AppText>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: space.xs },
  input: {
    ...typeScale.body,
    color: palette.ink,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 50,
  },
  inputError: { borderColor: palette.danger },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    minHeight: 38,
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 44, textAlign: 'center' },
  track: { width: '100%', overflow: 'hidden' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  divider: { height: 1, backgroundColor: palette.line },
});
