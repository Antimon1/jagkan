// Weekly AI challenge suggestions (spec 8, Plus). Called by a parent ("Ge mig fler",
// max 3 per child and day) or by the Sunday-evening cron job for all Plus families.
// Invalid AI output falls back to the library; the parent always reviews first.
import { buildWeeklyPrompt, parseChallenges, WEEKLY_SYSTEM_PROMPT } from '../_shared/backend/aiPrompts.ts';
import { catalog } from '../_shared/catalog.ts';
import { childAge } from '../_shared/domain/age.ts';
import { AI_MORE_PER_DAY, AI_SUGGESTIONS_PER_WEEK } from '../_shared/domain/constants.ts';
import { suggestFromLibrary, templateToPayload } from '../_shared/domain/library.ts';
import { snapshotToState } from '../_shared/domain/rows.ts';
import type { AiChallengePayload, FamilyState } from '../_shared/domain/types.ts';
import { askClaude } from '../_shared/anthropic.ts';
import { AI_FAMILY_DAILY_LIMIT, runCommand } from '../_shared/game.ts';
import { HttpError, isUuid, json, readBody, serve } from '../_shared/http.ts';
import { logError } from '../_shared/log.ts';
import {
  adminClient,
  isCronRequest,
  requireParent,
  requireUser,
  resolveCaller,
  supabaseStore,
  takeAiCall,
  type SupabaseClient,
} from '../_shared/supabase.ts';

const WEEK_MS = 6 * 24 * 60 * 60 * 1000;

async function loadState(admin: SupabaseClient, familyId: string): Promise<FamilyState> {
  const snapshot = await supabaseStore(admin).loadSnapshot(familyId);
  if (!snapshot) throw new HttpError(404, 'not_found');
  return snapshotToState(snapshot);
}

async function suggestForChild(
  admin: SupabaseClient,
  state: FamilyState,
  childId: string,
  manual: boolean,
): Promise<{ added: number; fallback: boolean }> {
  const child = state.children.find((c) => c.id === childId);
  if (!child) throw new HttpError(404, 'not_found');
  const now = new Date().toISOString();
  const age = childAge(child, now, state.family.settings.timeZone);

  const allowed = await takeAiCall(admin, state.family.id, manual ? childId : null, {
    family: AI_FAMILY_DAILY_LIMIT,
    child: manual ? AI_MORE_PER_DAY : null,
  });
  if (!allowed && manual) throw new HttpError(429, 'limit');

  let items: AiChallengePayload[] | null = null;
  if (allowed) {
    const text = await askClaude({
      system: WEEKLY_SYSTEM_PROMPT,
      prompt: buildWeeklyPrompt(state, child, catalog, now, AI_SUGGESTIONS_PER_WEEK),
      maxTokens: 1500,
    });
    items = text ? parseChallenges(text, age, AI_SUGGESTIONS_PER_WEEK) : null;
  }
  const fallback = items === null;
  if (!items) {
    const suggested = new Set(state.aiSuggestions.filter((s) => s.childId === childId).map((s) => s.payload.titleChild));
    items = suggestFromLibrary(state, catalog, child, now, AI_SUGGESTIONS_PER_WEEK, true)
      .filter((t) => !suggested.has(t.titleChild))
      .map(templateToPayload);
  }
  if (items.length === 0) return { added: 0, fallback };

  const result = await runCommand(admin, {
    familyId: state.family.id,
    command: { type: 'addAiSuggestions', childId, items },
    actor: { kind: 'system' },
    commandId: null,
  });
  if (!result.ok) throw new HttpError(422, result.error);
  return { added: items.length, fallback };
}

/** Cron: every child in a Plus family that has no fresh suggestions waiting. */
async function suggestForAllPlusFamilies(admin: SupabaseClient): Promise<{ children: number }> {
  const { data, error } = await admin.from('families').select('id').eq('plus_active', true);
  if (error) throw new Error(error.message);
  let children = 0;
  for (const { id } of data ?? []) {
    try {
      const state = await loadState(admin, id as string);
      const cutoff = Date.now() - WEEK_MS;
      for (const child of state.children) {
        const fresh = state.aiSuggestions.filter(
          (s) => s.childId === child.id && s.status === 'new' && Date.parse(s.createdAt) > cutoff,
        );
        if (fresh.length >= AI_SUGGESTIONS_PER_WEEK) continue;
        await suggestForChild(admin, await loadState(admin, id as string), child.id, false);
        children += 1;
      }
    } catch (error) {
      logError('ai-weekly-suggestions.cron', error, { familyId: id });
    }
  }
  return { children };
}

serve('ai-weekly-suggestions', async (req) => {
  const admin = adminClient();
  if (isCronRequest(req)) return json({ ok: true, ...(await suggestForAllPlusFamilies(admin)) });

  const caller = requireParent(await resolveCaller(admin, await requireUser(req, admin)));
  const { childId } = await readBody(req);
  if (!isUuid(childId)) throw new HttpError(400, 'invalid_input');
  const state = await loadState(admin, caller.familyId);
  if (!state.family.plusActive) throw new HttpError(403, 'plus_required');
  return json(await suggestForChild(admin, state, childId, true));
});
