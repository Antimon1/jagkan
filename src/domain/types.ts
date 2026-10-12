/**
 * JagKan! domain types.
 *
 * Everything in src/domain is pure TypeScript without external imports so the
 * exact same rules can run in the app (local/offline mode) and in the Supabase
 * Edge Functions (Deno). Keep it that way: no react, no expo, no npm packages.
 */

export type BranchId = 'kropp' | 'mat' | 'hem' | 'tid' | 'ute' | 'pengar' | 'kanslor' | 'omtanke' | 'mod';
export type WorldId = 'valley' | 'dino' | 'explorer';
export type AgeBand = 1 | 2 | 3;
export type Difficulty = 1 | 2 | 3;
export type Stage = 1 | 2 | 3;

export type ChallengeStatus = 'active' | 'requested' | 'completed' | 'paused' | 'archived';
export type ChallengeSource = 'library' | 'custom';
export type ParentRole = 'admin' | 'coparent';
export type LedgerReason = 'completion' | 'spark_bonus' | 'reward_redeem' | 'adjust';
export type RewardRequestStatus = 'requested' | 'confirmed' | 'declined';
export type AttemptSource = 'child' | 'parent' | 'duel';

// ---------------------------------------------------------------------------
// Catalog (static seed data, read from seed/*.json)
// ---------------------------------------------------------------------------

/**
 * What approving a challenge gives. Pure emotion and value acts (saying sorry,
 * comforting, sharing, thanking, calming down) give a praise card without a star,
 * so a child never trades feelings for stars (idépanelen).
 */
export type ChallengeReward = 'star' | 'praise';

export interface ChallengeTemplate {
  id: string;
  branch: BranchId;
  ageMin: number;
  ageMax: number;
  difficulty: Difficulty;
  titleChild: string;
  titleParent: string;
  icon: string;
  parentTip: string;
  repeatable: boolean;
  reward: ChallengeReward;
  tags: string[];
  isPlus: boolean;
  /**
   * Hidden from the library and suggestions (for example pure chores), but kept so
   * that challenges families already use keep working.
   */
  retired: boolean;
}

export interface WorldInfo {
  id: WorldId;
  name: string;
  band: AgeBand;
  ageMin: number;
  ageMax: number;
  eggLabel: string;
  attemptVerb: string;
  doneVerb: string;
  style: string;
}

export interface CreatureStageInfo {
  stage: Stage;
  name: string;
  emoji: string;
  assetKey: string;
}

export interface CreatureSpecies {
  id: string;
  world: WorldId;
  branch: BranchId;
  slot: 1 | 2 | 3;
  color: string;
  personality: string;
  stages: CreatureStageInfo[];
}

export type SpecialUnlock =
  | { type: 'milestone'; milestoneId: string }
  | { type: 'first_spark' }
  | { type: 'family_goal' }
  | { type: 'graduation' };

export interface SpecialCreature {
  id: string;
  world: WorldId;
  name: string;
  emoji: string;
  assetKey: string;
  personality: string;
  unlock: SpecialUnlock;
}

export interface Milestone {
  id: string;
  thresholdStars: number;
  title: string;
  backgroundKey: string;
  emoji: string;
}

export interface RewardSuggestion {
  id: string;
  title: string;
  icon: string;
  costStars: number;
  ageMin: number;
  ageMax: number;
}

/** What the game offers (src/domain/launch.ts): worlds, creatures per branch and specials. */
export interface GameScope {
  worlds: readonly WorldId[];
  slotsPerBranch: 1 | 2 | 3;
  specials: boolean;
}

export interface Catalog {
  /** The part of the content the game runs on. The rest stays in the catalog, frozen. */
  scope: GameScope;
  templates: ChallengeTemplate[];
  worlds: WorldInfo[];
  species: CreatureSpecies[];
  specials: SpecialCreature[];
  milestones: Milestone[];
  rewardSuggestions: RewardSuggestion[];
}

// ---------------------------------------------------------------------------
// Family state (synced between devices)
// ---------------------------------------------------------------------------

export interface NotificationSettings {
  approvals: boolean;
  weeklySummary: boolean;
  reminders: boolean;
  /** Hour of day (0-23) for the daily reminder. */
  reminderHour: number;
}

export interface FamilySettings {
  /** 3 sparks on the same challenge give 1 bonus star. */
  sparkBonusEnabled: boolean;
  maxActiveChallenges: number;
  soundEnabled: boolean;
  speechEnabled: boolean;
  locale: string;
  timeZone: string;
  notifications: NotificationSettings;
}

export interface Family {
  id: string;
  name: string;
  createdAt: string;
  plusActive: boolean;
  settings: FamilySettings;
  /** Bumped on every write; used for realtime refresh. */
  revision: number;
}

export interface Parent {
  id: string;
  familyId: string;
  role: ParentRole;
  displayName: string;
  createdAt: string;
}

export interface Child {
  id: string;
  familyId: string;
  firstName: string;
  birthYear: number;
  birthMonth: number;
  /** The world the child currently plays in (chosen at creation from age). */
  world: WorldId;
  avatarCreatureId: string | null;
  graduationSnoozedAt: string | null;
  createdAt: string;
}

export interface ChildChallenge {
  id: string;
  familyId: string;
  childId: string;
  templateId: string | null;
  customTitle: string | null;
  customIcon: string | null;
  customTip: string | null;
  branch: BranchId;
  status: ChallengeStatus;
  source: ChallengeSource;
  repeatable: boolean;
  sparks: number;
  /** Day key (YYYY-MM-DD) of the last spark the child earned on this challenge. */
  lastSparkDay: string | null;
  repeatCount: number;
  createdAt: string;
  activatedAt: string | null;
  requestedAt: string | null;
  completedAt: string | null;
}

export interface Attempt {
  id: string;
  familyId: string;
  childId: string;
  /** null for general sparks (e.g. the "Bra kämpat"-spark after a duel week). */
  childChallengeId: string | null;
  source: AttemptSource;
  day: string;
  sparkAwarded: boolean;
  createdAt: string;
}

export interface Completion {
  id: string;
  familyId: string;
  childId: string;
  childChallengeId: string;
  approvedBy: string | null;
  approvedAt: string;
  parentNote: string | null;
  cardText: string;
  /** Species id hatched by this completion (null if the branch was already full or repeat). */
  creatureId: string | null;
  world: WorldId;
  branch: BranchId;
  isFirst: boolean;
  attemptsCount: number;
}

export interface StarEntry {
  id: string;
  familyId: string;
  childId: string;
  delta: number;
  reason: LedgerReason;
  refId: string | null;
  branch: BranchId | null;
  world: WorldId | null;
  note: string | null;
  createdAt: string;
}

export interface ChildCreature {
  id: string;
  familyId: string;
  childId: string;
  /** Species id or special creature id. */
  creatureId: string;
  world: WorldId;
  branch: BranchId | null;
  isSpecial: boolean;
  stage: Stage;
  /** Stars fed to this creature since it hatched. */
  growth: number;
  unlockedAt: string;
}

export interface ChildMilestone {
  id: string;
  familyId: string;
  childId: string;
  milestoneId: string;
  reachedAt: string;
}

export interface Reward {
  id: string;
  familyId: string;
  title: string;
  icon: string;
  costStars: number;
  /** null = available for all children. */
  childId: string | null;
  active: boolean;
  createdAt: string;
}

export interface RewardRequest {
  id: string;
  familyId: string;
  rewardId: string;
  childId: string;
  costStars: number;
  status: RewardRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface FamilyGoal {
  id: string;
  familyId: string;
  title: string;
  targetStars: number;
  rewardText: string;
  startAt: string;
  endAt: string | null;
  reachedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface Competitions {
  familyGoalEnabled: boolean;
  siblingDuelEnabled: boolean;
  selfModeEnabled: boolean;
  /** childId -> multiplier, e.g. 1.5 */
  handicaps: Record<string, number>;
}

export interface WeeklyChildResult {
  childId: string;
  stars: number;
  score: number;
  isWinner: boolean;
  isRecord: boolean;
  previousRecord: number;
}

export interface WeeklyResult {
  id: string;
  familyId: string;
  /** Monday, YYYY-MM-DD in the family time zone. */
  weekStart: string;
  duel: boolean;
  results: WeeklyChildResult[];
  createdAt: string;
}

export type CelebrationType =
  | 'hatch'
  | 'grow'
  | 'praise'
  | 'evolve'
  | 'bonus_star'
  | 'milestone'
  | 'special'
  | 'branch_master'
  | 'family_goal'
  | 'week_trophy'
  | 'self_record'
  | 'reward_confirmed';

export interface Celebration {
  id: string;
  familyId: string;
  childId: string;
  type: CelebrationType;
  payload: Record<string, string | number | boolean | null>;
  createdAt: string;
  seenAt: string | null;
}

export interface FamilyState {
  schemaVersion: 1;
  family: Family;
  parents: Parent[];
  children: Child[];
  challenges: ChildChallenge[];
  attempts: Attempt[];
  completions: Completion[];
  creatures: ChildCreature[];
  milestones: ChildMilestone[];
  ledger: StarEntry[];
  rewards: Reward[];
  rewardRequests: RewardRequest[];
  goals: FamilyGoal[];
  competitions: Competitions;
  weeklyResults: WeeklyResult[];
  celebrations: Celebration[];
}

// ---------------------------------------------------------------------------
// Engine plumbing
// ---------------------------------------------------------------------------

export interface EngineContext {
  /** ISO timestamp for "now". Injected so rules are deterministic and testable. */
  now: string;
  newId: () => string;
  catalog: Catalog;
}

export type Actor =
  | { kind: 'parent'; parentId: string }
  | { kind: 'child'; childIds: string[] }
  | { kind: 'system' };

export type DomainErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'invalid_input'
  | 'invalid_status'
  | 'max_active_reached'
  | 'plus_required'
  | 'not_enough_stars'
  | 'already_requested'
  | 'already_exists';

export type DomainEvent =
  | { type: 'spark_added'; childId: string; challengeId: string; sparks: number }
  | { type: 'spark_already_today'; childId: string; challengeId: string }
  | { type: 'bonus_star'; childId: string; challengeId: string }
  | { type: 'completion_requested'; childId: string; challengeId: string }
  | { type: 'challenge_completed'; childId: string; challengeId: string; completionId: string }
  | { type: 'creature_hatched'; childId: string; creatureId: string }
  | { type: 'creature_evolved'; childId: string; creatureId: string; stage: Stage }
  | { type: 'milestone_reached'; childId: string; milestoneId: string }
  | { type: 'branch_master'; childId: string; branch: BranchId; world: WorldId }
  | { type: 'family_goal_reached'; goalId: string }
  | { type: 'reward_requested'; childId: string; requestId: string }
  | { type: 'reward_resolved'; childId: string; requestId: string; confirmed: boolean }
  | { type: 'week_rolled_up'; weekStart: string };

export type EngineResult =
  | { ok: true; state: FamilyState; events: DomainEvent[] }
  | { ok: false; error: DomainErrorCode; message?: string };
