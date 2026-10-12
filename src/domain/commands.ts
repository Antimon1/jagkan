import type {
  AiChallengePayload,
  BranchId,
  FamilySettings,
  NotificationSettings,
  WorldId,
} from './types';

/**
 * Every state change in JagKan! is a serializable command. The same command
 * runs optimistically on the device (offline queue) and authoritatively on the
 * server (Edge Function `game-action`).
 */
export type Command =
  // Family & children (parent)
  | { type: 'renameFamily'; name: string }
  | {
      type: 'updateSettings';
      settings: Partial<Omit<FamilySettings, 'notifications'>> & { notifications?: Partial<NotificationSettings> };
    }
  | { type: 'setPlus'; active: boolean }
  | { type: 'addChild'; firstName: string; birthYear: number; birthMonth: number }
  | { type: 'updateChild'; childId: string; firstName?: string; birthYear?: number; birthMonth?: number }
  | { type: 'removeChild'; childId: string }
  // Challenges (parent)
  | { type: 'activateTemplate'; childId: string; templateId: string }
  | {
      type: 'addCustomChallenge';
      childId: string;
      title: string;
      branch: BranchId;
      icon: string;
      tip?: string | null;
      repeatable?: boolean;
    }
  | { type: 'setChallengeStatus'; challengeId: string; status: 'active' | 'paused' | 'archived' }
  | { type: 'approveCompletion'; challengeId: string; note?: string | null; cardText?: string | null }
  | { type: 'giveSpark'; challengeId: string }
  // Child actions (child device or parent)
  | { type: 'recordAttempt'; challengeId: string }
  | { type: 'requestCompletion'; challengeId: string }
  // Rewards
  | { type: 'createReward'; title: string; icon: string; costStars: number; childId: string | null }
  | {
      type: 'updateReward';
      rewardId: string;
      title?: string;
      icon?: string;
      costStars?: number;
      childId?: string | null;
    }
  | { type: 'archiveReward'; rewardId: string }
  | { type: 'requestReward'; rewardId: string; childId: string }
  | { type: 'resolveRewardRequest'; requestId: string; confirm: boolean }
  // Competitions
  | { type: 'setFamilyGoal'; title: string; targetStars: number; rewardText: string; endAt?: string | null }
  | { type: 'cancelFamilyGoal'; goalId: string }
  | {
      type: 'updateCompetitions';
      familyGoalEnabled?: boolean;
      siblingDuelEnabled?: boolean;
      selfModeEnabled?: boolean;
      handicaps?: Record<string, number>;
    }
  | { type: 'rollupWeeks' }
  // AI suggestions
  | { type: 'addAiSuggestions'; childId: string; items: AiChallengePayload[] }
  | { type: 'resolveAiSuggestion'; suggestionId: string; accept: boolean }
  // Collection & worlds
  | { type: 'markCelebrationsSeen'; childId: string; celebrationIds: string[] }
  | { type: 'setAvatar'; childId: string; creatureId: string }
  | { type: 'changeWorld'; childId: string; world: WorldId }
  | { type: 'snoozeGraduation'; childId: string };

export type CommandType = Command['type'];

/** Commands a paired child device may send (spec 14.1 RLS rules), always for its own children. */
export const CHILD_COMMANDS: ReadonlySet<CommandType> = new Set<CommandType>([
  'recordAttempt',
  'requestCompletion',
  'requestReward',
  'markCelebrationsSeen',
  'setAvatar',
  'changeWorld',
  'snoozeGraduation',
  'rollupWeeks',
]);

/** Commands only trusted server code may send (RevenueCat webhook, AI functions, demo mode). */
export const SYSTEM_COMMANDS: ReadonlySet<CommandType> = new Set<CommandType>(['setPlus', 'addAiSuggestions']);
