import type { CelebrationType, DomainEvent } from '@/domain/types';
import type { HapticKind, SoundName } from '@/lib/sound';

/** What the child sees and hears right after tapping a button on the egg (spec 9). */
export interface ActionFeedback {
  textKey: 'child.sparkTomorrow' | 'child.bonusStar' | 'child.sparkGot' | 'child.sentToParent' | 'child.alreadySent';
  emoji: string;
  sound: SoundName | null;
  haptic: HapticKind | null;
}

/**
 * The egg screen never shows confetti. "Jag klarade det!" only gets a calm "a
 * grown-up will look", because the parent may give a spark instead. The party comes
 * with the hatching that approval creates (CONFETTI_CELEBRATIONS).
 *
 * `events` is null when the command was not accepted.
 */
export function actionFeedback(action: 'tried' | 'did', events: DomainEvent[] | null): ActionFeedback | null {
  if (action === 'did') {
    return events
      ? { textKey: 'child.sentToParent', emoji: '⏳', sound: 'chime', haptic: 'light' }
      : { textKey: 'child.alreadySent', emoji: '⏳', sound: null, haptic: null };
  }
  if (!events) return null;
  if (events.some((e) => e.type === 'spark_already_today')) {
    return { textKey: 'child.sparkTomorrow', emoji: '🔥', sound: null, haptic: null };
  }
  if (events.some((e) => e.type === 'bonus_star')) {
    return { textKey: 'child.bonusStar', emoji: '⭐', sound: 'fanfare', haptic: 'success' };
  }
  return { textKey: 'child.sparkGot', emoji: '🔥', sound: 'spark', haptic: 'success' };
}

/**
 * Celebrations that play confetti. Asking for approval creates none of them, so a
 * child only gets confetti for a challenge once a parent has approved it.
 */
export const CONFETTI_CELEBRATIONS: ReadonlySet<CelebrationType> = new Set<CelebrationType>([
  'hatch',
  'evolve',
  'milestone',
  'special',
  'branch_master',
  'family_goal',
  'week_trophy',
  'self_record',
  'reward_confirmed',
]);
