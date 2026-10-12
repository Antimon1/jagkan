import { catalog } from '@/data/catalog';
import { childAge } from '@/domain/age';
import { matchTemplate, suggestFromLibrary, templateToPayload } from '@/domain/library';
import type { AiChallengePayload, Child, FamilyState } from '@/domain/types';
import { requestAiCustomChallenge, requestAiSuggestions } from '@/lib/api';
import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';
import { useGameStore } from '@/state/game';

/** Spec 8: "Ge mig fler" max 3 times per day (also enforced on the server). */
export const MORE_PER_DAY = 3;

interface UsageRecord {
  day: string;
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function moreLeftToday(childId: string): Promise<number> {
  const usage = (await readJson<Record<string, UsageRecord>>(STORAGE_KEYS.aiUsage)) ?? {};
  const record = usage[childId];
  return record && record.day === today() ? Math.max(0, MORE_PER_DAY - record.count) : MORE_PER_DAY;
}

async function countUse(childId: string): Promise<void> {
  const usage = (await readJson<Record<string, UsageRecord>>(STORAGE_KEYS.aiUsage)) ?? {};
  const record = usage[childId];
  const count = record && record.day === today() ? record.count + 1 : 1;
  await writeJson(STORAGE_KEYS.aiUsage, { ...usage, [childId]: { day: today(), count } });
}

/**
 * Weekly suggestions for a child. Cloud + Plus: the Edge Function asks Claude and
 * stores the result. Local mode (no backend for the API key): picks from the library,
 * which is also the server's fallback when AI output is invalid (spec 8).
 */
export async function fetchSuggestions(state: FamilyState, child: Child): Promise<{ fallback: boolean }> {
  if ((await moreLeftToday(child.id)) <= 0) throw new Error('limit');
  await countUse(child.id);
  const game = useGameStore.getState();
  if (game.backend?.kind === 'cloud') {
    const result = await requestAiSuggestions(child.id);
    await game.refresh();
    return { fallback: result.fallback };
  }
  const items = suggestFromLibrary(state, catalog, child, new Date().toISOString(), 3, state.family.plusActive)
    .filter((t) => !state.aiSuggestions.some((s) => s.childId === child.id && s.payload.titleChild === t.titleChild))
    .map(templateToPayload);
  if (items.length) await game.dispatchSystem({ type: 'addAiSuggestions', childId: child.id, items });
  return { fallback: true };
}

/** Turn a parent's free text into a challenge draft (spec 8 "Egna utmaningar"). */
export async function draftCustomChallenge(state: FamilyState, child: Child, description: string): Promise<AiChallengePayload | null> {
  const game = useGameStore.getState();
  if (game.backend?.kind === 'cloud' && state.family.plusActive) {
    return requestAiCustomChallenge(child.id, description);
  }
  const age = childAge(child, new Date().toISOString(), state.family.settings.timeZone);
  const template = matchTemplate(catalog, description, age);
  return template ? templateToPayload(template) : null;
}