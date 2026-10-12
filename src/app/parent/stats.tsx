import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BarChart } from '@/components/BarChart';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { familyStats } from '@/domain/stats';
import { listDevices } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { logError } from '@/lib/log';
import { useFamily, useGameStore } from '@/state/game';
import { useNow } from '@/state/hooks';
import { palette, space } from '@/theme/tokens';

/** The family's own statistics (idépanelen): counted from its data, nothing sent anywhere. */
export default function Stats() {
  const t = useT();
  const state = useFamily();
  const now = useNow();
  const isCloud = useGameStore((s) => s.backend?.kind === 'cloud');
  const [devices, setDevices] = useState<number | null>(null);
  const stats = familyStats(state, now);

  useEffect(() => {
    if (!isCloud) return;
    listDevices()
      .then((rows) => setDevices(rows.length))
      .catch((error) => logError('stats.devices', error));
  }, [isCloud]);

  const tiles = [
    { key: 'attempts', emoji: '🔥', value: String(stats.attempts) },
    { key: 'approvals', emoji: '⭐', value: String(stats.approvals) },
    { key: 'hatched', emoji: '🐣', value: String(stats.hatched) },
    { key: 'activeDays', emoji: '📅', value: `${stats.activeDays} / ${stats.periodDays}` },
  ];
  const weekBars = stats.approvalsPerWeek.map((value, i) => {
    const weeksAgo = stats.approvalsPerWeek.length - 1 - i;
    return {
      key: String(weeksAgo),
      label: weeksAgo === 0 ? t('parent.stats.thisWeek') : t('parent.stats.weeksAgo', { count: weeksAgo }),
      value,
      highlight: weeksAgo === 0,
    };
  });

  return (
    <Screen back="/parent/more" title={t('parent.stats.title')} subtitle={t('parent.stats.period', { count: stats.periodDays })}>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Card key={tile.key} style={styles.tile}>
            <AppText style={styles.emoji}>{tile.emoji}</AppText>
            <AppText variant="title">{tile.value}</AppText>
            <AppText variant="caption" color={palette.inkSoft}>
              {t(`parent.stats.${tile.key}`)}
            </AppText>
          </Card>
        ))}
      </View>

      <Card style={styles.gap}>
        <SectionHeader title={t('parent.stats.perWeek')} />
        <BarChart bars={weekBars} />
      </Card>

      <Card style={styles.row}>
        <AppText style={styles.emoji}>📱</AppText>
        <AppText variant="bodyStrong" style={styles.flex}>
          {t('parent.stats.devices')}
        </AppText>
        <AppText variant="title">{isCloud ? (devices ?? '…') : t('parent.stats.devicesLocal')}</AppText>
      </Card>

      <AppText variant="caption" color={palette.inkSoft}>
        🔒 {t('parent.stats.privacy')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexGrow: 1, flexBasis: '45%', gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  emoji: { fontSize: 28, lineHeight: 34 },
});
