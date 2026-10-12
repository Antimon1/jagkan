// Pairs a child device (spec 11): the device signs in anonymously, then trades the
// six-digit code for access to the chosen children only.
import { HttpError, json, readBody, serve } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

interface PairOutcome {
  ok: boolean;
  error?: string;
  familyId?: string;
  childIds?: string[];
}

const STATUS_BY_ERROR: Record<string, number> = { rate_limited: 429, forbidden: 403 };

serve('pair-device', async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (!user.is_anonymous) throw new HttpError(403, 'forbidden');

  const body = await readBody(req);
  const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'invalid_code');
  const platform = typeof body.platform === 'string' ? body.platform.slice(0, 20) : null;

  const { data, error } = await admin.rpc('jk_pair_device', { p_user_id: user.id, p_code: code, p_platform: platform });
  if (error) throw new Error(error.message);
  const outcome = data as PairOutcome;
  if (!outcome.ok) {
    const reason = outcome.error ?? 'invalid_code';
    throw new HttpError(STATUS_BY_ERROR[reason] ?? 400, reason);
  }
  return json({ familyId: outcome.familyId, childIds: outcome.childIds });
});
