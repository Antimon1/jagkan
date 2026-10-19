import challenges from '../../seed/challenges.json';
import creatures from '../../seed/creatures.json';
import milestones from '../../seed/milestones.json';
import rewardSuggestions from '../../seed/reward_suggestions.json';

import { GAME_SCOPE } from '@/domain/launch';
import type {
  Catalog,
  ChallengeTemplate,
  CreatureSpecies,
  Milestone,
  RewardSuggestion,
  SpecialCreature,
  WorldInfo,
} from '@/domain/types';

/**
 * The static content of the app, read from seed/*.json. Graphics are looked up
 * by `assetKey`, so artwork can be replaced without code changes (spec 5.1).
 * The JSON files are validated against the domain schema in tests/seed.test.ts.
 */
export const catalog: Catalog = {
  scope: GAME_SCOPE,
  templates: challenges as unknown as ChallengeTemplate[],
  worlds: creatures.worlds as unknown as WorldInfo[],
  species: creatures.species as unknown as CreatureSpecies[],
  specials: creatures.specials as unknown as SpecialCreature[],
  milestones: milestones as unknown as Milestone[],
  rewardSuggestions: rewardSuggestions as unknown as RewardSuggestion[],
};
