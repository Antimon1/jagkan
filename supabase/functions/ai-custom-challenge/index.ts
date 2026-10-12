// Turns a parent's free text into a challenge draft (spec 8 "Egna utmaningar", Plus).
// Returns a draft only: the parent edits and creates it in the app.
import { buildCustomPrompt, CUSTOM_SYSTEM_PROMPT, parseCustomChallenge } from '../_shared/backend/aiPrompts.ts';
import { catalog } from '../_shared/catalog.ts';
import { childAge } from '../_shared/domain/age.ts';
import { matchTemplate, templateToPayload } from '../_shared/domain/library.ts';
import { snapshotToState } from '../_shared/domain/rows.ts';
import type { AiChallengePayload } from '../_shared/domain/types.ts';
import { askClaude } from '../_shared/anthropic.ts';
import { AI_FAMILY_DAILY_LIMIT } from '../_shared/game.ts';
import { HttpError, isUuid, json, readBody, serve } from '../_shared/http.ts';
import { adminClient, requireParent, requireUser, resolveCaller, supabaseStore, takeAiCall } from '../_shared/supabase.ts';

const DESCRIPTION_MIN = 3;
const DESCRIPTION_MAX = 500;

serve('ai-custom-challenge', async (req) => {
  const admin = adminClient();
  const caller = requireParent(await resolveCaller(admin, await requireUser(req, admin)));
  const { childId, description } = await readBody(req);
  if (!isUuid(childId) || typeof description !== 'string') throw new HttpError(400, 'invalid_input');
  const text = description.trim();
  if (text.length < DESCRIPTION_MIN || text.length > DESCRIPTION_MAX) throw new HttpError(400, 'invalid_input');

  const snapshot = await supabaseStore(admin).loadSnapshot(caller.familyId);
  if (!snapshot) throw new HttpError(404, 'not_found');
  const state = snapshotToState(snapshot);
  if (!state.family.plusActive) throw new HttpError(403, 'plus_required');
  const child = state.children.find((c) => c.id === childId);
  if (!child) throw new HttpError(404, 'not_found');
  const age = childAge(child, new Date().toISOString(), state.family.settings.timeZone);

  let challenge: AiChallengePayload | null = null;
  if (await takeAiCall(admin, caller.familyId, null, { family: AI_FAMILY_DAILY_LIMIT, child: null })) {
    const answer = await askClaude({ system: CUSTOM_SYSTEM_PROMPT, prompt: buildCustomPrompt(age, text), maxTokens: 600 });
    challenge = answer ? parseCustomChallenge(answer, age) : null;
  }
  const fallback = challenge === null;
  if (!challenge) {
    const template = matchTemplate(catalog, text, age);
    challenge = template ? templateToPayload(template) : null;
  }
  if (!challenge) throw new HttpError(422, 'no_suggestion');
  return json({ challenge, fallback });
});
