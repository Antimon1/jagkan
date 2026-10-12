import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip, ChipRow } from '@/components/forms';
import { Screen } from '@/components/Screen';
import { showToast } from '@/components/Toast';
import { catalog } from '@/data/catalog';
import { familyLimits } from '@/domain/plan';
import { albumFor } from '@/domain/selectors';
import { CollectorCard } from '@/features/album/CollectorCard';
import { useT } from '@/lib/i18n';
import { exportMediaToLibrary, getMediaIndex, shareMedia, type MediaIndex } from '@/lib/media';
import { useFamily } from '@/state/game';
import { palette, space } from '@/theme/tokens';

export default function ParentAlbum() {
  const t = useT();
  const state = useFamily();
  const params = useLocalSearchParams<{ child?: string }>();
  const [childId, setChildId] = useState<string | null>(params.child ?? state.children[0]?.id ?? null);
  const [media, setMedia] = useState<MediaIndex>({});
  const child = state.children.find((c) => c.id === childId);
  const entries = child ? albumFor(state, catalog, child.id) : [];
  const limits = familyLimits(state);

  useEffect(() => {
    getMediaIndex().then(setMedia).catch(() => setMedia({}));
  }, [state.completions.length]);

  const share = async (completionId: string, text: string) => {
    const item = media[completionId];
    // Sharing is always started by the parent via the system share sheet (spec 10.9).
    if (item) await shareMedia(item);
    else await Share.share({ message: text }).catch(() => undefined);
  };

  const exportAll = async () => {
    const items = entries.map((e) => media[e.completion.id]).filter((m): m is NonNullable<typeof m> => Boolean(m));
    const count = await exportMediaToLibrary(items);
    showToast(t('parent.album.exported', { count }), 'success');
  };

  return (
    <Screen back="/parent/more" title={t('parent.album.title')}>
      <ChipRow>
        {state.children.map((c) => (
          <Chip key={c.id} label={c.firstName} selected={childId === c.id} onPress={() => setChildId(c.id)} />
        ))}
      </ChipRow>
      {entries.length === 0 ? <AppText color={palette.inkSoft}>{t('parent.album.empty')}</AppText> : null}
      {limits.albumExport && entries.length > 0 ? (
        <Button variant="secondary" label={`💾 ${t('parent.album.exportAll')}`} onPress={exportAll} />
      ) : null}
      {child
        ? entries.map((entry) => (
            <View key={entry.completion.id} style={styles.item}>
              <CollectorCard entry={entry} world={child.world} media={media[entry.completion.id]} />
              <Button size="sm" variant="ghost" label={`↗ ${t('parent.album.share')}`} onPress={() => share(entry.completion.id, entry.completion.cardText)} />
            </View>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: space.xs },
});
