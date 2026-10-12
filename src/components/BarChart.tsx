import { StyleSheet, View } from 'react-native';

import { palette, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export interface Bar {
  key: string;
  label: string;
  value: number;
  highlight?: boolean;
}

/** Small vertical bar chart (weekly stars). Values are shown on top of each bar. */
export function BarChart({ bars, color = palette.star, height = 120 }: { bars: Bar[]; color?: string; height?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={bars.map((b) => `${b.label}: ${b.value}`).join(', ')}
      accessible>
      {bars.map((bar) => (
        <View key={bar.key} style={styles.col}>
          <AppText variant="caption" color={palette.inkSoft}>
            {bar.value > 0 ? bar.value : ''}
          </AppText>
          <View style={[styles.track, { height }]}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(3, (bar.value / max) * height),
                  backgroundColor: bar.highlight ? palette.primary : color,
                  opacity: bar.value === 0 ? 0.25 : 1,
                },
              ]}
            />
          </View>
          <AppText variant="caption" color={palette.inkFaint} numberOfLines={1}>
            {bar.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export interface HBar {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function HorizontalBars({ bars }: { bars: HBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View style={styles.hwrap}>
      {bars.map((bar) => (
        <View key={bar.key} style={styles.hrow} accessible accessibilityLabel={`${bar.label}: ${bar.value}`}>
          <AppText variant="caption" style={styles.hlabel} numberOfLines={1}>
            {bar.label}
          </AppText>
          <View style={styles.htrack}>
            <View style={[styles.hbar, { width: `${(bar.value / max) * 100}%`, backgroundColor: bar.color }]} />
          </View>
          <AppText variant="label" style={styles.hvalue}>
            {bar.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  track: { width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  hwrap: { gap: space.sm },
  hrow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hlabel: { width: 120 },
  htrack: { flex: 1, height: 12, backgroundColor: palette.surfaceSunk, borderRadius: radius.pill, overflow: 'hidden' },
  hbar: { height: 12, borderRadius: radius.pill },
  hvalue: { width: 28, textAlign: 'right' },
});
