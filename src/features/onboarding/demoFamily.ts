import { catalog } from '@/data/catalog';
import type { Command } from '@/domain/commands';
import { applyCommand } from '@/domain/engine';
import { createFamilyState } from '@/domain/factory';
import type { Actor, BranchId, FamilyState } from '@/domain/types';
import { newId } from '@/lib/ids';

const DAY = 86_400_000;

function firstTemplate(branch: BranchId, ageMax: number, skip: string[] = []): string {
  const t = catalog.templates.find((x) => x.branch === branch && x.ageMax <= ageMax && !x.retired && !skip.includes(x.id));
  return t?.id ?? catalog.templates[0].id;
}

/**
 * A ready-made family for the "Utforska med en exempelfamilj" button and the web
 * preview: two children, eggs in progress, a waiting approval, rewards, a family
 * goal and two weeks of history. Built through the real engine so it is consistent.
 */
export function buildDemoFamily(now: Date = new Date()): FamilyState {
  const year = now.getFullYear();
  const parentId = newId();
  let state = createFamilyState({
    familyId: newId(),
    familyName: 'Familjen Exempel',
    parentId,
    parentName: 'Förälder',
    now: new Date(now.getTime() - 20 * DAY).toISOString(),
  });

  const actors: Record<'parent' | 'child' | 'system', Actor> = {
    parent: { kind: 'parent', parentId },
    child: { kind: 'child', childIds: [] },
    system: { kind: 'system' },
  };

  const run = (command: Command, daysAgo: number, actorKind: 'parent' | 'child' | 'system' = 'parent') => {
    const actor = actorKind === 'child' ? { kind: 'child' as const, childIds: state.children.map((c) => c.id) } : actors[actorKind];
    const result = applyCommand(state, command, actor, {
      now: new Date(now.getTime() - daysAgo * DAY).toISOString(),
      newId,
      catalog,
    });
    if (result.ok) state = result.state;
    return result.ok;
  };

  run({ type: 'setPlus', active: true }, 20, 'system');
  run({ type: 'addChild', firstName: 'Evelyn', birthYear: year - 6, birthMonth: 1 }, 20);
  run({ type: 'addChild', firstName: 'Rafael', birthYear: year - 5, birthMonth: 1 }, 20);
  const [evelyn, rafael] = state.children.map((c) => c.id);
  run({ type: 'updateCompetitions', selfModeEnabled: true }, 20);

  const lastChallenge = () => state.challenges[state.challenges.length - 1]?.id ?? '';
  const completeTemplate = (childId: string, branch: BranchId, daysAgo: number, tries = 1) => {
    const templateId = firstTemplate(
      branch,
      6,
      state.challenges.filter((c) => c.childId === childId).map((c) => c.templateId ?? ''),
    );
    if (!run({ type: 'activateTemplate', childId, templateId }, daysAgo + tries)) return;
    const id = lastChallenge();
    for (let i = tries; i >= 1; i -= 1) run({ type: 'recordAttempt', challengeId: id }, daysAgo + i, 'child');
    run({ type: 'requestCompletion', challengeId: id }, daysAgo, 'child');
    run({ type: 'approveCompletion', challengeId: id, note: null }, daysAgo);
  };

  const plan: [string, BranchId, number, number][] = [
    [evelyn, 'kropp', 16, 2],
    [evelyn, 'mat', 14, 1],
    [rafael, 'mod', 13, 3],
    [evelyn, 'kropp', 11, 1],
    [rafael, 'mat', 10, 1],
    [evelyn, 'hem', 8, 2],
    [rafael, 'kropp', 6, 1],
    [evelyn, 'kropp', 4, 1],
    [rafael, 'hem', 3, 2],
    [evelyn, 'kanslor', 2, 1],
    [rafael, 'mod', 1, 1],
  ];
  plan.forEach(([child, branch, daysAgo, tries]) => completeTemplate(child, branch, daysAgo, tries));

  run({ type: 'createReward', title: 'Välja middag', icon: '🍝', costStars: 5, childId: null }, 9);
  run({ type: 'createReward', title: 'Extra godnattsaga', icon: '📖', costStars: 3, childId: null }, 9);
  run({ type: 'createReward', title: 'Biokväll', icon: '🎬', costStars: 20, childId: null }, 9);
  run({ type: 'setFamilyGoal', title: 'Bio i helgen', targetStars: 15, rewardText: 'Bio med popcorn', endAt: null }, 5);

  // Active eggs, one of them with sparks, one waiting for approval.
  run({ type: 'activateTemplate', childId: evelyn, templateId: firstTemplate('ute', 6) }, 2);
  run({ type: 'recordAttempt', challengeId: lastChallenge() }, 2, 'child');
  run({ type: 'recordAttempt', challengeId: lastChallenge() }, 1, 'child');
  run({ type: 'activateTemplate', childId: evelyn, templateId: firstTemplate('pengar', 6) }, 1);
  run({ type: 'requestCompletion', challengeId: lastChallenge() }, 0, 'child');
  run({ type: 'activateTemplate', childId: rafael, templateId: firstTemplate('kanslor', 6) }, 1);
  run({ type: 'activateTemplate', childId: rafael, templateId: firstTemplate('ute', 6) }, 0);
  run({ type: 'recordAttempt', challengeId: lastChallenge() }, 0, 'child');

  run({ type: 'rollupWeeks' }, 0, 'system');

  // Do not replay two weeks of animations: only the newest ones stay unseen.
  const keepUnseen = new Set(
    state.celebrations
      .filter((c) => now.getTime() - new Date(c.createdAt).getTime() < 1.5 * DAY)
      .map((c) => c.id),
  );
  const seenAt = now.toISOString();
  return {
    ...state,
    celebrations: state.celebrations.map((c) => (keepUnseen.has(c.id) ? c : { ...c, seenAt })),
  };
}

