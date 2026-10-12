import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { catalog } from '@/data/catalog';
import { creatureDisplay, findSpecies } from '@/domain/catalog';
import type { Child, FamilyState } from '@/domain/types';
import { CreatureArt } from '@/features/creatures/CreatureArt';
import { palette } from '@/theme/tokens';

const AVATAR_COLORS = ['#FFD6E5', '#D5F2E8', '#FFF0B8', '#E6DCFF', '#FFE2CC', '#D6EBFF'];

export function ChildAvatar({ child, state, size = 56 }: { child: Child; state: FamilyState; size?: number }) {
  const owned = child.avatarCreatureId
    ? state.creatures.find((c) => c.childId === child.id && c.creatureId === child.avatarCreatureId)
    : undefined;
  const display = owned ? creatureDisplay(catalog, owned.creatureId, owned.stage) : undefined;
  const background = AVATAR_COLORS[child.firstName.charCodeAt(0) % AVATAR_COLORS.length];

  if (owned && display) {
    const species = findSpecies(catalog, owned.creatureId);
    return (
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
        <CreatureArt
          world={owned.world}
          color={display.color}
          stage={owned.stage}
          emoji={display.emoji}
          size={size * 0.92}
          special={!species}
        />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={child.firstName}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      <AppText variant="title" style={{ fontSize: size * 0.42, lineHeight: size * 0.52 }} color={palette.ink}>
        {child.firstName.charAt(0).toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
