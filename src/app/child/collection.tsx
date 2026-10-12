import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { SpeakButton } from '@/components/SpeakButton';
import { catalog } from '@/data/catalog';
import { BRANCH_ICONS } from '@/domain/constants';
import { collectionFor, specialsFor, worldsWithCollection } from '@/domain/selectors';
import type { ChildCreature, Stage, WorldId } from '@/domain/types';
import { BigButton } from '@/features/child/BigButton';
import { ChildChrome } from '@/features/child/ChildChrome';
import { useActiveChild, type ActiveChild } from '@/features/child/useActiveChild';
import { CreatureArt } from '@/features/creatures/CreatureArt';
import { useT } from '@/lib/i18n';
import { useDispatch } from '@/state/hooks';
import { radius, space } from '@/theme/tokens';
import { worldTheme } from '@/theme/worlds';

interface Selected {
  name: string;
  personality: string;
  color: string;
  emoji: string;
  stage: Stage;
  world: WorldId;
  special: boolean;
  owned: ChildCreature | null;
  toNext: number | null;
}

export default function Collection() {
  const active = useActiveChild();
  if (!active) return null;
  return <CollectionView active={active} />;
}

function CollectionView({ active }: { active: ActiveChild }) {
  const t = useT();
  const { state, child, theme } = active;
  const worlds = worldsWithCollection(state, child.id, child.world);
  const [world, setWorld] = useState<WorldId>(child.world);
  const [selected, setSelected] = useState<Selected | null>(null);
  const branches = collectionFor(state, catalog, child.id, world);
  const specials = specialsFor(state, catalog, child.id, world);
  const wt = worldTheme(world);

  return (
    <ChildChrome active={active} title={t('child.collection.title')}>
      {worlds.length > 1 ? (
        <View style={styles.tabs}>
          {worlds.map((w) => (
            <Pressable
              key={w}
              accessibilityRole="tab"
              accessibilityState={{ selected: w === world }}
              onPress={() => setWorld(w)}
              style={[styles.tab, { backgroundColor: w === world ? worldTheme(w).primary : theme.surface }]}>
              <AppText variant="heading" color={w === world ? worldTheme(w).onPrimary : theme.ink}>
                {w === child.world ? '' : '🏆 '}
                {t(`worlds.${w}`)}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {branches.map((branch) => (
        <View key={branch.branch} style={[styles.branch, { backgroundColor: wt.surface }]}>
          <View style={styles.branchHeader}>
            <AppText variant="heading" color={wt.ink} style={styles.flex}>
              {BRANCH_ICONS[branch.branch]} {t(`branches.${branch.branch}`)}
            </AppText>
            {branch.isMaster ? (
              <AppText variant="label" color={wt.ink}>
                {t('child.collection.master')}
              </AppText>
            ) : null}
          </View>
          <View style={styles.slots}>
            {branch.slots.map((slot) => (
              <Pressable
                key={slot.species.id}
                accessibilityRole="button"
                accessibilityLabel={slot.owned ? slot.name : t('child.collection.locked')}
                onPress={() =>
                  setSelected({
                    name: slot.owned ? slot.name : '???',
                    personality: slot.owned ? slot.species.personality : t('child.collection.locked'),
                    color: slot.color,
                    emoji: slot.emoji,
                    stage: slot.stage,
                    world,
                    special: false,
                    owned: slot.owned,
                    toNext: slot.toNextStage,
                  })
                }
                style={styles.slot}>
                <CreatureArt world={world} color={slot.color} stage={slot.stage} emoji={slot.emoji} locked={!slot.owned} size={92} />
                <AppText variant="label" color={wt.inkSoft} align="center" numberOfLines={1}>
                  {slot.owned ? slot.name : '?'}
                </AppText>
                {slot.owned ? (
                  <View style={styles.stageDots}>
                    {[1, 2, 3].map((s) => (
                      <View key={s} style={[styles.stageDot, { backgroundColor: s <= slot.stage ? wt.primary : wt.line }]} />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <View style={[styles.branch, { backgroundColor: wt.surface }]}>
        <AppText variant="heading" color={wt.ink}>
          ✨ {t('child.collection.specials')}
        </AppText>
        <View style={styles.specials}>
          {specials.map(({ special, owned }) => (
            <Pressable
              key={special.id}
              accessibilityRole="button"
              accessibilityLabel={owned ? special.name : t('child.collection.specialLocked')}
              onPress={() =>
                setSelected({
                  name: owned ? special.name : '???',
                  personality: owned ? special.personality : t('child.collection.specialLocked'),
                  color: '#F5B800',
                  emoji: special.emoji,
                  stage: 1,
                  world,
                  special: true,
                  owned,
                  toNext: null,
                })
              }
              style={styles.special}>
              <CreatureArt world={world} color="#FFD45C" stage={2} emoji={special.emoji} locked={!owned} special={Boolean(owned)} size={72} />
            </Pressable>
          ))}
        </View>
      </View>

      {selected ? <CreatureModal active={active} selected={selected} onClose={() => setSelected(null)} /> : null}
    </ChildChrome>
  );
}

function CreatureModal({ active, selected, onClose }: { active: ActiveChild; selected: Selected; onClose: () => void }) {
  const t = useT();
  const dispatch = useDispatch();
  const { child } = active;
  const theme = worldTheme(selected.world);
  const isAvatar = selected.owned && child.avatarCreatureId === selected.owned.creatureId;
  const progressText = selected.owned
    ? selected.special
      ? ''
      : selected.toNext === null
        ? t('child.collection.maxStage')
        : `${t('child.collection.stage', { stage: selected.stage })} · ${t('child.collection.toNext', { count: selected.toNext })}`
    : '';
  const spoken = `${selected.name}. ${selected.personality} ${progressText}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.modal, { backgroundColor: theme.surface }]}>
          <CreatureArt
            world={selected.world}
            color={selected.color}
            stage={selected.stage}
            emoji={selected.emoji}
            locked={!selected.owned}
            special={selected.special && Boolean(selected.owned)}
            size={180}
          />
          <AppText variant="childTitle" color={theme.ink} align="center">
            {selected.name}
          </AppText>
          <AppText variant="bodyStrong" color={theme.inkSoft} align="center">
            {selected.personality}
          </AppText>
          {progressText ? (
            <AppText variant="heading" color={theme.ink} align="center">
              {progressText}
            </AppText>
          ) : null}
          <SpeakButton text={spoken} background={theme.surfaceSunk} color={theme.ink} />
          {selected.owned ? (
            <BigButton
              size="lg"
              label={isAvatar ? t('child.collection.isAvatar') : t('child.collection.pickAvatar')}
              emoji={isAvatar ? '✅' : '🖼️'}
              color={theme.primary}
              textColor={theme.onPrimary}
              disabled={Boolean(isAvatar)}
              onPress={() => {
                if (selected.owned) dispatch({ type: 'setAvatar', childId: child.id, creatureId: selected.owned.creatureId });
              }}
              style={styles.fullWidth}
            />
          ) : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tab: { minHeight: 64, paddingHorizontal: space.lg, borderRadius: radius.xl, justifyContent: 'center' },
  branch: { borderRadius: radius.xl, padding: space.lg, gap: space.md },
  branchHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  slots: { flexDirection: 'row', justifyContent: 'space-around', gap: space.sm },
  slot: { alignItems: 'center', gap: space.xs, flex: 1, minHeight: 64 },
  stageDots: { flexDirection: 'row', gap: 4 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  specials: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  special: { minWidth: 64, minHeight: 64, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,14,35,0.6)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  modal: { borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md, width: '100%', maxWidth: 440 },
  fullWidth: { alignSelf: 'stretch' },
});
