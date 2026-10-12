// "Radera familjen" (spec 12, GDPR). Admin parent only. Deletes all family data
// (cascades), the anonymous child-device users and the family's parent accounts.
// Photos were never uploaded, so there is nothing else to remove.
import { json, serve } from '../_shared/http.ts';
import { logError } from '../_shared/log.ts';
import { adminClient, requireParent, requireUser, resolveCaller } from '../_shared/supabase.ts';

serve('delete-family', async (req) => {
  const admin = adminClient();
  const caller = requireParent(await resolveCaller(admin, await requireUser(req, admin)), 'admin');

  const [{ data: devices, error: deviceError }, { data: parents, error: parentError }] = await Promise.all([
    admin.from('child_devices').select('auth_user_id').eq('family_id', caller.familyId),
    admin.from('parents').select('id').eq('family_id', caller.familyId),
  ]);
  if (deviceError || parentError) throw new Error(deviceError?.message ?? parentError?.message);

  const { error } = await admin.from('families').delete().eq('id', caller.familyId);
  if (error) throw new Error(error.message);

  const userIds = [...(devices ?? []).map((d) => d.auth_user_id as string), ...(parents ?? []).map((p) => p.id as string)];
  for (const userId of userIds) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) logError('delete-family.user', deleteError.message, { userId });
  }
  return json({ ok: true });
});
