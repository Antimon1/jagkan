import type {
  BranchId,
  Catalog,
  ChallengeReward,
  ChallengeTemplate,
  CreatureSpecies,
  Milestone,
  SpecialCreature,
  SpecialUnlock,
  WorldId,
  WorldInfo,
} from './types';

interface CatalogIndex {
  templates: Map<string, ChallengeTemplate>;
  species: Map<string, CreatureSpecies>;
  specials: Map<string, SpecialCreature>;
  milestones: Map<string, Milestone>;
}

const indexCache = new WeakMap<Catalog, CatalogIndex>();

function index(catalog: Catalog): CatalogIndex {
  const cached = indexCache.get(catalog);
  if (cached) return cached;
  const built: CatalogIndex = {
    templates: new Map(catalog.templates.map((t) => [t.id, t])),
    species: new Map(catalog.species.map((s) => [s.id, s])),
    specials: new Map(catalog.specials.map((s) => [s.id, s])),
    milestones: new Map(catalog.milestones.map((m) => [m.id, m])),
  };
  indexCache.set(catalog, built);
  return built;
}

export function findTemplate(catalog: Catalog, id: string | null): ChallengeTemplate | undefined {
  return id ? index(catalog).templates.get(id) : undefined;
}

/** Custom challenges always give a star. */
export function challengeReward(catalog: Catalog, challenge: { templateId: string | null }): ChallengeReward {
  return findTemplate(catalog, challenge.templateId)?.reward ?? 'star';
}

export function findSpecies(catalog: Catalog, id: string): CreatureSpecies | undefined {
  return index(catalog).species.get(id);
}

export function findSpecial(catalog: Catalog, id: string): SpecialCreature | undefined {
  return index(catalog).specials.get(id);
}

export function findMilestone(catalog: Catalog, id: string): Milestone | undefined {
  return index(catalog).milestones.get(id);
}

export function worldInfo(catalog: Catalog, world: WorldId): WorldInfo | undefined {
  return catalog.worlds.find((w) => w.id === world);
}

/** The three species of a branch in a world, ordered by slot. */
export function branchSpecies(catalog: Catalog, world: WorldId, branch: BranchId): CreatureSpecies[] {
  return catalog.species
    .filter((s) => s.world === world && s.branch === branch)
    .sort((a, b) => a.slot - b.slot);
}

function unlockMatches(a: SpecialUnlock, b: SpecialUnlock): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'milestone' && b.type === 'milestone') return a.milestoneId === b.milestoneId;
  return true;
}

export function specialFor(catalog: Catalog, world: WorldId, unlock: SpecialUnlock): SpecialCreature | undefined {
  return catalog.specials.find((s) => s.world === world && unlockMatches(s.unlock, unlock));
}

export function milestonesAscending(catalog: Catalog): Milestone[] {
  return [...catalog.milestones].sort((a, b) => a.thresholdStars - b.thresholdStars);
}

/** Display name and emoji for any creature id (species stage or special). */
export function creatureDisplay(
  catalog: Catalog,
  creatureId: string,
  stage: number,
): { name: string; emoji: string; assetKey: string; color: string } | undefined {
  const species = findSpecies(catalog, creatureId);
  if (species) {
    const info = species.stages.find((s) => s.stage === stage) ?? species.stages[0];
    return { name: info.name, emoji: info.emoji, assetKey: info.assetKey, color: species.color };
  }
  const special = findSpecial(catalog, creatureId);
  if (special) {
    return { name: special.name, emoji: special.emoji, assetKey: special.assetKey, color: '#F5B800' };
  }
  return undefined;
}
