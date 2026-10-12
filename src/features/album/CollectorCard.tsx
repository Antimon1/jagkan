import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { AlbumEntry } from '@/domain/selectors';
import type { WorldId } from '@/domain/types';
import { CreatureArt } from '@/features/creatures/CreatureArt';
import { mediaFileExists, type LocalMedia } from '@/lib/media';
import { BRANCH_COLORS, palette, radius, shadow, space } from '@/theme/tokens';

export interface CollectorCardProps {
  entry: AlbumEntry;
  world: WorldId;
  media?: LocalMedia;
  /** Child view: show the drawn creature instead of photos from other devices (spec 9). */
  compact?: boolean;
}

/** Collector card (spec 6.3): title, date, creature, branch and a proud third-person text. */
export function CollectorCard({ entry, world, media, compact }: CollectorCardProps) {
  const showPhoto = media && media.type === 'image' && mediaFileExists(media);
  const color = BRANCH_COLORS[entry.completion.branch];
  return (
    <View style={[styles.card, shadow.card, { borderColor: color }]}>
      <View style={[styles.band, { backgroundColor: color }]}>
        <AppText variant="label" color="#FFFFFF" numberOfLines={1} style={styles.flex}>
          {entry.icon} {entry.title}
        </AppText>
        <AppText variant="caption" color="#FFFFFF">
          {new Date(entry.completion.approvedAt).toLocaleDateString('sv-SE')}
        </AppText>
      </View>
      <View style={styles.art}>
        {showPhoto ? (
          <Image source={{ uri: media.uri }} style={styles.photo} accessibilityIgnoresInvertColors />
        ) : entry.creature ? (
          <CreatureArt world={entry.completion.world ?? world} color={entry.creature.color} stage={1} emoji={entry.creature.emoji} size={compact ? 96 : 120} />
        ) : (
          <AppText style={styles.bigIcon}>{entry.icon}</AppText>
        )}
      </View>
      {entry.creature ? (
        <AppText variant="heading" align="center">
          {entry.creature.name}
        </AppText>
      ) : null}
      {!compact ? (
        <AppText variant="body" align="center" style={styles.text}>
          {entry.completion.cardText}
        </AppText>
      ) : null}
      {entry.completion.parentNote && !compact ? (
        <AppText variant="caption" color={palette.inkSoft} align="center">
          ”{entry.completion.parentNote}”
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 3,
    overflow: 'hidden',
    paddingBottom: space.lg,
    gap: space.sm,
  },
  band: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  art: { alignItems: 'center', paddingTop: space.sm },
  photo: { width: '90%', aspectRatio: 4 / 3, borderRadius: radius.md },
  bigIcon: { fontSize: 64, lineHeight: 76 },
  text: { paddingHorizontal: space.lg },
});
