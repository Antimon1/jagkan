import { childAge } from './age';
import { BRANCHES } from './constants';
import type { AiChallengePayload, BranchId, Catalog, ChallengeTemplate, Child, FamilyState } from './types';

export interface LibraryFilter {
  query?: string;
  branch?: BranchId | null;
  age?: number | null;
  difficulty?: 1 | 2 | 3 | null;
  /** When false, only the free "grundurval" is returned. */
  includePlus?: boolean;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase('sv-SE').normalize('NFC');
}

export function searchLibrary(catalog: Catalog, filter: LibraryFilter): ChallengeTemplate[] {
  const query = filter.query ? normalize(filter.query.trim()) : '';
  return catalog.templates.filter((t) => {
    if (filter.branch && t.branch !== filter.branch) return false;
    if (filter.difficulty && t.difficulty !== filter.difficulty) return false;
    if (filter.age !== undefined && filter.age !== null && (filter.age < t.ageMin || filter.age > t.ageMax)) {
      return false;
    }
    if (filter.includePlus === false && t.isPlus) return false;
    if (!query) return true;
    const haystack = normalize([t.titleChild, t.titleParent, ...t.tags].join(' '));
    return haystack.includes(query);
  });
}

/** Templates the child has already used (any status but archived). */
function usedTemplateIds(state: FamilyState, childId: string): Set<string> {
  return new Set(
    state.challenges
      .filter((c) => c.childId === childId && c.templateId && c.status !== 'archived')
      .map((c) => c.templateId as string),
  );
}

/**
 * Pick library challenges for a child: age-appropriate, unused, prioritising
 * branches the child has not done yet. Also the fallback when AI output is invalid (spec 8).
 */
export function suggestFromLibrary(
  state: FamilyState,
  catalog: Catalog,
  child: Child,
  nowIso: string,
  count: number,
  includePlus: boolean,
): ChallengeTemplate[] {
  const age = childAge(child, nowIso, state.family.settings.timeZone);
  const used = usedTemplateIds(state, child.id);
  const doneByBranch = new Map<BranchId, number>(BRANCHES.map((b) => [b, 0]));
  for (const c of state.challenges) {
    if (c.childId === child.id && c.status !== 'archived') doneByBranch.set(c.branch, (doneByBranch.get(c.branch) ?? 0) + 1);
  }
  const candidates = searchLibrary(catalog, { age, includePlus }).filter((t) => !used.has(t.id));
  const sorted = [...candidates].sort((a, b) => {
    const branchDiff = (doneByBranch.get(a.branch) ?? 0) - (doneByBranch.get(b.branch) ?? 0);
    if (branchDiff !== 0) return branchDiff;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.id.localeCompare(b.id);
  });
  const picked: ChallengeTemplate[] = [];
  const pickedBranches = new Set<BranchId>();
  for (const t of sorted) {
    if (picked.length >= count) break;
    if (pickedBranches.has(t.branch)) continue;
    picked.push(t);
    pickedBranches.add(t.branch);
  }
  for (const t of sorted) {
    if (picked.length >= count) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked;
}

const MATCH_STOP_WORDS = new Set([
  'och', 'att', 'hon', 'han', 'hen', 'som', 'för', 'med', 'den', 'det', 'är', 'inte', 'när', 'till', 'själv', 'rädd',
]);

/**
 * The library challenge that best matches a parent's free text, e.g. "hon är rädd
 * för att gå på toa själv i skolan" (spec 8 "Egna utmaningar"). Used without AI and
 * as the fallback when AI output is invalid. Returns null when nothing matches.
 */
export function matchTemplate(catalog: Catalog, description: string, age: number): ChallengeTemplate | null {
  const words = normalize(description)
    .split(/[^a-zåäöé]+/)
    .filter((w) => w.length >= 3 && !MATCH_STOP_WORDS.has(w));
  let best: { score: number; template: ChallengeTemplate } | null = null;
  for (const template of catalog.templates) {
    const haystack = normalize(`${template.titleChild} ${template.titleParent} ${template.tags.join(' ')}`);
    const score =
      words.reduce((sum, w) => sum + (haystack.includes(w.slice(0, Math.max(3, w.length - 2))) ? 1 : 0), 0) +
      (age >= template.ageMin && age <= template.ageMax ? 0.5 : 0);
    if (score > 0.5 && (!best || score > best.score)) best = { score, template };
  }
  return best?.template ?? null;
}

export function templateToPayload(t: ChallengeTemplate): AiChallengePayload {
  return {
    titleChild: t.titleChild,
    titleParent: t.titleParent,
    branch: t.branch,
    icon: t.icon,
    parentTip: t.parentTip,
    difficulty: t.difficulty,
    repeatable: t.repeatable,
    ageMin: t.ageMin,
    ageMax: t.ageMax,
  };
}
