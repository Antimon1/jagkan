import type { ChallengeSource, ChallengeStatus, ChildChallenge, FamilyState } from './types';

type LegacyChallenge = Omit<ChildChallenge, 'status' | 'source'> & {
  status: ChallengeStatus | 'suggested';
  source: ChallengeSource | 'ai';
};

type LegacyState = Omit<FamilyState, 'challenges'> & {
  challenges: LegacyChallenge[];
  aiSuggestions?: unknown;
};

function upgradeChallenge(challenge: LegacyChallenge): ChildChallenge {
  return {
    ...challenge,
    status: challenge.status === 'suggested' ? 'paused' : challenge.status,
    source: challenge.source === 'ai' ? 'custom' : challenge.source,
  };
}

/**
 * Brings a family saved by an older app version up to date. Local families are
 * stored as JSON on the device, so they can still hold fields the engine no longer
 * knows. Returns null for anything that is not a family state.
 *
 * - AI was removed: the `aiSuggestions` list is dropped, AI challenges become custom
 *   challenges, and suggestions still waiting for a free slot become paused.
 */
export function upgradeState(raw: unknown): FamilyState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const legacy = raw as LegacyState;
  if (legacy.schemaVersion !== 1 || !Array.isArray(legacy.challenges)) return null;
  const { aiSuggestions: _removed, ...rest } = legacy;
  return { ...rest, challenges: legacy.challenges.map(upgradeChallenge) };
}
