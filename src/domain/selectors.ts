import { bandForAge, childAge, graduationTarget } from './age';
import { branchSpecies, creatureDisplay, findTemplate, milestonesAscending } from './catalog';
import { BRANCHES, SPARKS_PER_BONUS_STAR } from './constants';
import { starsToNextStage } from './creatures';
import { activeGoal, goalProgress } from './progress';
import { availableStars, canEarnBonusStar, totalStars } from './stars';
import type {
  BranchId,
  Catalog,
  Celebration,
  ChallengeReward,
  Child,
  ChildChallenge,
  ChildCreature,
  Completion,
  CreatureSpecies,
  FamilyGoal,
  FamilyState,
  Milestone,
  Reward,
  RewardRequest,
  Stage,
  WorldId,
} from './types';

export function findChild(state: FamilyState, childId: string): Child | undefined {
  return state.children.find((c) => c.id === childId);
}

export interface ChallengeView {
  challenge: ChildChallenge;
  title: string;
  parentTitle: string;
  icon: string;
  tip: string | null;
  difficulty: number | null;
  /** 0..3 charge shown on the egg. */
  charge: number;
  reward: ChallengeReward;
}

/**
 * `bonusAvailable` (see canEarnBonusStar): the egg fills up towards a bonus star and
 * starts over. Without a bonus to earn it stays full until a parent approves.
 */
export function challengeView(catalog: Catalog, challenge: ChildChallenge, bonusAvailable = true): ChallengeView {
  const template = findTemplate(catalog, challenge.templateId);
  const charge = bonusAvailable
    ? challenge.sparks % SPARKS_PER_BONUS_STAR
    : Math.min(challenge.sparks, SPARKS_PER_BONUS_STAR);
  return {
    challenge,
    reward: template?.reward ?? 'star',
    title: template?.titleChild ?? challenge.customTitle ?? '',
    parentTitle: template?.titleParent ?? challenge.customTitle ?? '',
    icon: template?.icon ?? challenge.customIcon ?? '⭐',
    tip: template?.parentTip ?? challenge.customTip ?? null,
    difficulty: template?.difficulty ?? null,
    charge,
  };
}

function views(state: FamilyState, catalog: Catalog, list: ChildChallenge[]): ChallengeView[] {
  return list.map((c) => challengeView(catalog, c, canEarnBonusStar(state, catalog, c)));
}

/** Eggs on the child's home screen: active and waiting-for-parent challenges. */
export function eggsForChild(state: FamilyState, catalog: Catalog, childId: string): ChallengeView[] {
  return views(
    state,
    catalog,
    state.challenges
      .filter((c) => c.childId === childId && (c.status === 'active' || c.status === 'requested'))
      .sort((a, b) => (a.activatedAt ?? a.createdAt).localeCompare(b.activatedAt ?? b.createdAt)),
  );
}

export function challengesByStatus(
  state: FamilyState,
  catalog: Catalog,
  childId: string,
  statuses: ChildChallenge['status'][],
): ChallengeView[] {
  return views(
    state,
    catalog,
    state.challenges.filter((c) => c.childId === childId && statuses.includes(c.status)),
  );
}

export interface PendingApproval {
  child: Child;
  view: ChallengeView;
}

/** Waiting approvals for the parent overview, oldest first. */
export function pendingApprovals(state: FamilyState, catalog: Catalog): PendingApproval[] {
  return state.challenges
    .filter((c) => c.status === 'requested')
    .sort((a, b) => (a.requestedAt ?? '').localeCompare(b.requestedAt ?? ''))
    .flatMap((c) => {
      const child = findChild(state, c.childId);
      return child ? [{ child, view: challengeView(catalog, c, canEarnBonusStar(state, catalog, c)) }] : [];
    });
}

export interface PendingRewardRequest {
  child: Child;
  request: RewardRequest;
  reward: Reward | undefined;
}

export function pendingRewardRequests(state: FamilyState): PendingRewardRequest[] {
  return state.rewardRequests
    .filter((r) => r.status === 'requested')
    .flatMap((request) => {
      const child = findChild(state, request.childId);
      return child ? [{ child, request, reward: state.rewards.find((r) => r.id === request.rewardId) }] : [];
    });
}

export interface CreatureSlotView {
  species: CreatureSpecies;
  owned: ChildCreature | null;
  stage: Stage;
  name: string;
  emoji: string;
  color: string;
  toNextStage: number | null;
}

export interface BranchCollectionView {
  branch: BranchId;
  slots: CreatureSlotView[];
  isMaster: boolean;
}

/** The collection for one world, grouped by branch. Locked creatures are shown as silhouettes. */
export function collectionFor(
  state: FamilyState,
  catalog: Catalog,
  childId: string,
  world: WorldId,
): BranchCollectionView[] {
  const owned = state.creatures.filter((c) => c.childId === childId && c.world === world && !c.isSpecial);
  return BRANCHES.map((branch) => {
    const slots = branchSpecies(catalog, world, branch).map((species) => {
      const mine = owned.find((c) => c.creatureId === species.id) ?? null;
      const stage = mine?.stage ?? 1;
      const info = species.stages.find((s) => s.stage === stage) ?? species.stages[0];
      return {
        species,
        owned: mine,
        stage,
        name: info.name,
        emoji: info.emoji,
        color: species.color,
        toNextStage: mine ? starsToNextStage(mine.growth) : null,
      };
    });
    return { branch, slots, isMaster: slots.length > 0 && slots.every((s) => s.owned?.stage === 3) };
  });
}

export function specialsFor(state: FamilyState, catalog: Catalog, childId: string, world: WorldId) {
  return catalog.specials
    .filter((s) => s.world === world)
    .map((special) => ({
      special,
      owned: state.creatures.find((c) => c.childId === childId && c.creatureId === special.id) ?? null,
    }));
}

/** Worlds where the child owns at least one creature (trophy tabs, spec 5). */
export function worldsWithCollection(state: FamilyState, childId: string, current: WorldId): WorldId[] {
  const worlds = new Set<WorldId>([current]);
  for (const c of state.creatures) if (c.childId === childId) worlds.add(c.world);
  const order: WorldId[] = ['valley', 'dino', 'explorer'];
  return order.filter((w) => worlds.has(w));
}

export function ownedCount(state: FamilyState, childId: string): number {
  return state.creatures.filter((c) => c.childId === childId).length;
}

export interface MilestoneProgress {
  current: Milestone | null;
  next: Milestone | null;
  remaining: number;
  total: number;
}

export function milestoneProgress(state: FamilyState, catalog: Catalog, childId: string): MilestoneProgress {
  const total = totalStars(state, childId);
  const sorted = milestonesAscending(catalog);
  const reached = sorted.filter((m) => m.thresholdStars <= total);
  const next = sorted.find((m) => m.thresholdStars > total) ?? null;
  return {
    current: reached[reached.length - 1] ?? null,
    next,
    remaining: next ? next.thresholdStars - total : 0,
    total,
  };
}

export function childTitle(state: FamilyState, catalog: Catalog, childId: string): string | null {
  return milestoneProgress(state, catalog, childId).current?.title ?? null;
}

export interface GoalView {
  goal: FamilyGoal;
  progress: number;
  ratio: number;
}

export function familyGoalView(state: FamilyState, nowIso: string): GoalView | null {
  const goal = activeGoal(state, nowIso);
  if (!goal) return null;
  const progress = goalProgress(state, goal);
  return { goal, progress, ratio: Math.min(1, progress / goal.targetStars) };
}

/** Most recently reached goal, to keep showing the celebration banner for a while. */
export function lastReachedGoal(state: FamilyState): FamilyGoal | null {
  const reached = state.goals.filter((g) => g.reachedAt).sort((a, b) => (b.reachedAt ?? '').localeCompare(a.reachedAt ?? ''));
  return reached[0] ?? null;
}

export function unseenCelebrations(state: FamilyState, childId: string): Celebration[] {
  return state.celebrations
    .filter((c) => c.childId === childId && !c.seenAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface ShopItem {
  reward: Reward;
  affordable: boolean;
  pending: boolean;
}

export function shopFor(state: FamilyState, childId: string): ShopItem[] {
  const available = availableStars(state, childId);
  return state.rewards
    .filter((r) => r.active && (r.childId === null || r.childId === childId))
    .sort((a, b) => a.costStars - b.costStars)
    .map((reward) => ({
      reward,
      affordable: available >= reward.costStars,
      pending: state.rewardRequests.some(
        (r) => r.rewardId === reward.id && r.childId === childId && r.status === 'requested',
      ),
    }));
}

export interface AlbumEntry {
  completion: Completion;
  title: string;
  icon: string;
  creature: { name: string; emoji: string; color: string } | null;
  praise: boolean;
}

export function albumFor(state: FamilyState, catalog: Catalog, childId: string): AlbumEntry[] {
  return state.completions
    .filter((c) => c.childId === childId)
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
    .map((completion) => {
      const challenge = state.challenges.find((c) => c.id === completion.childChallengeId);
      const view = challenge ? challengeView(catalog, challenge) : null;
      const owned = completion.creatureId
        ? state.creatures.find((c) => c.childId === childId && c.creatureId === completion.creatureId)
        : undefined;
      const display = completion.creatureId
        ? creatureDisplay(catalog, completion.creatureId, owned?.stage ?? 1)
        : undefined;
      return {
        completion,
        title: view?.title ?? '',
        icon: view?.icon ?? '⭐',
        creature: display ? { name: display.name, emoji: display.emoji, color: display.color } : null,
        praise: view?.reward === 'praise',
      };
    });
}

export function branchStats(state: FamilyState, childId: string): Record<BranchId, number> {
  const stats = Object.fromEntries(BRANCHES.map((b) => [b, 0])) as Record<BranchId, number>;
  for (const c of state.completions) if (c.childId === childId) stats[c.branch] += 1;
  return stats;
}

export function childBand(child: Child, nowIso: string, timeZone: string) {
  return bandForAge(childAge(child, nowIso, timeZone));
}

export function graduationFor(state: FamilyState, childId: string, nowIso: string): WorldId | null {
  const child = findChild(state, childId);
  return child ? graduationTarget(child, nowIso, state.family.settings.timeZone) : null;
}
