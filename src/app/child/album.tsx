import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { SpeakButton } from '@/components/SpeakButton';
import { catalog } from '@/data/catalog';
import { albumFor } from '@/domain/selectors';
import { CollectorCard } from '@/features/album/CollectorCard';
import { ChildChrome } from '@/features/child/ChildChrome';
import { useActiveChild } from '@/features/child/useActiveChild';
import { useT } from '@/lib/i18n';
import { getMediaIndex, type MediaIndex } from '@/lib/media';
import { radius, space } from '@/theme/tokens';

/** Collector cards in time order (spec 9). Photos only show when they exist on this device. */
export default function ChildAlbum() {
  const t = useT();
  const active = useActiveChild();
  const [media, setMedia] = useState<MediaIndex>({});
  const completions = active?.state.completions.length ?? 0;

  useEffect(() => {
    getMediaIndex().then(setMedia).catch(() => setMedia({}));
  }, [completions]);

  if (!active) return null;
  const { state, child, theme } = active;
  const entries = albumFor(state, catalog, child.id);

  return (
    <ChildChrome active={active} title={t('child.album.title')}>
      {entries.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.surface }]}>
          <AppText style={styles.icon}>📸</AppText>
          <AppText variant="heading" color={theme.ink} align="center">
            {t('child.album.empty')}
          </AppText>
        </View>
      ) : null}
      {entries.map((entry) => (
        <View key={entry.completion.id} style={styles.item}>
          <CollectorCard entry={entry} world={child.world} media={media[entry.completion.id]} />
          <View style={styles.speak}>
            <SpeakButton text={entry.completion.cardText} background={theme.surface} color={theme.ink} />
          </View>
        </View>
      ))}
    </ChildChrome>
  );
}

const styles = StyleSheet.create({
  empty: { borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md },
  icon: { fontSize: 56, lineHeight: 66 },
  item: { gap: space.xs },
  speak: { alignItems: 'center', marginTop: -space.xl },
});
