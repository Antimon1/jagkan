// RevenueCat -> families.plus_active (spec 13). Configure the webhook in RevenueCat
// with the Authorization header value "Bearer <REVENUECAT_WEBHOOK_SECRET>".
// Sandbox purchases are ignored unless REVENUECAT_ALLOW_SANDBOX=true (staging).
// A non-200 answer makes RevenueCat retry, so real failures throw.
import { plusChangesFromEvent, safeEqual } from '../_shared/backend/revenuecat.ts';
import { runCommand } from '../_shared/game.ts';
import { HttpError, json, readBody, serve } from '../_shared/http.ts';
import { adminClient, requireEnv, type SupabaseClient } from '../_shared/supabase.ts';

/** False for an event older than (or equal to) the last one applied for the family. */
async function isNewest(admin: SupabaseClient, familyId: string, eventMs: number | null): Promise<boolean> {
  if (eventMs === null) return true;
  const { data, error } = await admin.rpc('jk_plus_event_is_newer', { p_family_id: familyId, p_event_ms: eventMs });
  if (error) throw new Error(error.message);
  return data === true;
}

serve('revenuecat-webhook', async (req) => {
  const expected = `Bearer ${requireEnv('REVENUECAT_WEBHOOK_SECRET')}`;
  if (!safeEqual(req.headers.get('Authorization') ?? '', expected)) throw new HttpError(401, 'not_authenticated');

  const body = await readBody(req);
  const admin = adminClient();
  const allowSandbox = Deno.env.get('REVENUECAT_ALLOW_SANDBOX') === 'true';
  for (const change of plusChangesFromEvent(body, Date.now(), { allowSandbox })) {
    if (!(await isNewest(admin, change.familyId, change.eventMs))) continue;
    const result = await runCommand(admin, {
      familyId: change.familyId,
      command: { type: 'setPlus', active: change.active },
      actor: { kind: 'system' },
      commandId: null,
    });
    // A deleted family has nothing left to update.
    if (!result.ok && result.error !== 'not_found') throw new Error(`setPlus failed: ${result.error}`);
  }
  return json({ ok: true });
});
