import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { SpeakButton } from '@/components/SpeakButton';
import { catalog } from '@/data/catalog';
import { creatureDisplay, findSpecial } from '@/domain/catalog';
import type { BranchId, Celebration, FamilyState, Stage, WorldId } from '@/domain/types';
import { CreatureArt } from '@/features/creatures/CreatureArt';
import { EggArt } from '@/features/creatures/EggArt';
import { useT, type TFunction } from '@/lib/i18n';
import { playSound, type SoundName } from '@/lib/sound';
import { speak } from '@/lib/speech';
import { radius, space } from '@/theme/tokens';
import type { WorldTheme } from '@/theme/worlds';

import { Confetti } from './Confetti';

const HATCH_SHAKE_MS = 1100;

interface Visual {
  text: string;
  sound: SoundName;
  confetti: boolean;
  creature?: { id: string; stage: Stage; world: WorldId; special: boolean };
  emoji?: string;
  hatch?: boolean;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function describe(c: Celebration, state: FamilyState, world: WorldId, t: TFunction): Visual {
  const creatureId = str(c.payload.creatureId);
  const owned = creatureId ? state.creatures.find((x) => x.childId === c.childId && x.creatureId === creatureId) : undefined;
  const display = creatureId ? creatureDisplay(catalog, creatureId, Number(c.payload.stage ?? owned?.stage ?? 1)) : undefined;
  const creature = creatureId
    ? { id: creatureId, stage: (Number(c.payload.stage ?? 1) as Stage) || 1, world: owned?.world ?? world, special: Boolean(findSpecial(catalog, creatureId)) }
    : undefined;
  switch (c.type) {
    case 'hatch':
      return {
        text:
          world === 'explorer'
            ? t('child.celebrate.hatchExplorer', { name: display?.name ?? '' })
            : t('child.celebrate.hatch', { egg: t(`worlds.${world}Egg`), name: display?.name ?? '' }),
        sound: 'hatch',
        confetti: true,
        creature: creature ? { ...creature, stage: 1 } : undefined,
        hatch: true,
      };
    case 'grow':
      return { text: t('child.celebrate.grow'), sound: 'spark', confetti: false, emoji: '⭐' };
    case 'evolve':
      return { text: t('child.celebrate.evolve', { name: display?.name ?? '' }), sound: 'chime', confetti: true, creature };
    case 'bonus_star':
      return { text: t('child.celebrate.bonus'), sound: 'spark', confetti: false, emoji: '🔥⭐' };
    case 'milestone': {
      const specialId = str(c.payload.specialId);
      return {
        text: t('child.celebrate.milestone', { title: str(c.payload.title), count: Number(c.payload.threshold ?? 0) }),
        sound: 'fanfare',
        confetti: true,
        creature: specialId ? { id: specialId, stage: 1, world, special: true } : undefined,
        emoji: specialId ? undefined : '🌟',
      };
    }
    case 'special':
      return { text: t('child.celebrate.special', { name: display?.name ?? '' }), sound: 'fanfare', confetti: true, creature: creature ? { ...creature, special: true } : undefined };
    case 'branch_master':
      return {
        text: t('child.celebrate.branchMaster', { branch: t(`branches.${str(c.payload.branch) as BranchId}`) }),
        sound: 'fanfare',
        confetti: true,
        emoji: '🥇',
      };
    case 'family_goal':
      return { text: t('child.celebrate.familyGoal', { title: str(c.payload.title) }), sound: 'fanfare', confetti: true, emoji: '🎉' };
    case 'week_trophy':
      return { text: t('child.celebrate.trophy'), sound: 'fanfare', confetti: true, emoji: '🏆' };
    case 'self_record':
      return { text: t('child.celebrate.record', { count: Number(c.payload.stars ?? 0) }), sound: 'fanfare', confetti: true, emoji: '📈' };
    case 'reward_confirmed':
      return { text: t('child.celebrate.reward', { title: str(c.payload.title) }), sound: 'coin', confetti: true, emoji: str(c.payload.icon) || '🎁' };
    default:
      return { text: '', sound: 'chime', confetti: false, emoji: '⭐' };
  }
}

export interface CelebrationOverlayProps {
  celebrations: Celebration[];
  state: FamilyState;
  world: WorldId;
  theme: WorldTheme;
  onDone: (ids: string[]) => void;
}

/** Plays queued celebrations one by one: hatching, evolving, milestones... (spec 6.3 step 4, spec 9). */
export function CelebrationOverlay({ celebrations, state, world, theme, onDone }: CelebrationOverlayProps) {
  const [index, setIndex] = useState(0);
  const current = celebrations[index];
  if (!current) return null;

  const next = () => {
    if (index + 1 < celebrations.length) setIndex(index + 1);
    else onDone(celebrations.map((c) => c.id));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={next}>
      <CelebrationItem
        key={current.id}
        celebration={current}
        position={index}
        total={celebrations.length}
        state={state}
        world={world}
        theme={theme}
        onNext={next}
      />
    </Modal>
  );
}

interface CelebrationItemProps {
  celebration: Celebration;
  position: number;
  total: number;
  state: FamilyState;
  world: WorldId;
  theme: WorldTheme;
  onNext: () => void;
}

function CelebrationItem({ celebration, position, total, state, world, theme, onNext }: CelebrationItemProps) {
  const t = useT();
  const visual = describe(celebration, state, world, t);
  const [cracked, setCracked] = useState(!visual.hatch);

  useEffect(() => {
    const reveal = () => {
      playSound(visual.sound);
      speak(visual.text);
    };
    if (!visual.hatch) {
      reveal();
      return undefined;
    }
    const timer = setTimeout(() => {
      setCracked(true);
      reveal();
    }, HATCH_SHAKE_MS);
    return () => clearTimeout(timer);
    // Runs once per celebration (the component is keyed by id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creatureInfo = visual.creature ? creatureDisplay(catalog, visual.creature.id, visual.creature.stage) : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${visual.text}. ${t('child.celebrate.tapToContinue')}`}
      onPress={() => cracked && onNext()}
      style={[styles.backdrop, { backgroundColor: theme.dark ? 'rgba(5,12,24,0.92)' : 'rgba(255,248,240,0.96)' }]}>
      <Confetti playKey={cracked && visual.confetti ? position + 1 : 0} />
      <View style={styles.center}>
        {!cracked && visual.hatch ? (
          <EggArt world={visual.creature?.world ?? world} charge={3} waiting size={180} />
        ) : (
          <Animated.View entering={ZoomIn.springify().damping(9).stiffness(140)} style={styles.art}>
            {visual.creature && creatureInfo ? (
              <CreatureArt
                world={visual.creature.world}
                color={creatureInfo.color}
                stage={visual.creature.stage}
                emoji={creatureInfo.emoji}
                special={visual.creature.special}
                size={200}
              />
            ) : (
              <AppText style={styles.bigEmoji}>{visual.emoji}</AppText>
            )}
          </Animated.View>
        )}
        {cracked ? (
          <Animated.View entering={FadeIn.delay(250)} style={[styles.bubble, { backgroundColor: theme.surface }]}>
            <AppText variant="childTitle" color={theme.ink} align="center">
              {visual.text}
            </AppText>
            <SpeakButton text={visual.text} background={theme.surfaceSunk} color={theme.ink} />
          </Animated.View>
        ) : null}
        {cracked ? (
          <AppText variant="label" color={theme.inkSoft} align="center">
            👆 {t('child.celebrate.tapToContinue')}
            {total > 1 ? `  (${position + 1}/${total})` : ''}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  center: { alignItems: 'center', gap: space.xl, maxWidth: 520, width: '100%' },
  art: { alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  bigEmoji: { fontSize: 120, lineHeight: 140 },
  bubble: { borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md, width: '100%' },
});
