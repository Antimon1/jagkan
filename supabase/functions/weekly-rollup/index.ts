// Sunday-evening job (spec 14.2): closes the week for every family (results,
// trophies, records), sends the weekly summary and cleans up expired codes.
// Called by pg_cron with the CRON_SECRET; see docs/backend.md.
import { weeklySummaryMessage } from '../_shared/backend/pushMessages.ts';
import { runCommand } from '../_shared/game.ts';
import { HttpError, json, serve } from '../_shared/http.ts';
import { logError } from '../_shared/log.ts';
import { sendPushes } from '../_shared/push.ts';
import { adminClient, isCronRequest } from '../_shared/supabase.ts';

const PAGE = 500;

serve('weekly-rollup', async (req) => {
  if (!isCronRequest(req)) throw new HttpError(401, 'not_authenticated');
  const admin = adminClient();
  let families = 0;
  let rolled = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from('families').select('id').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const { id } of data ?? []) {
      families += 1;
      try {
        const result = await runCommand(admin, {
          familyId: id as string,
          command: { type: 'rollupWeeks' },
          actor: { kind: 'system' },
          commandId: null,
        });
        if (!result.ok || !result.changed) continue;
        rolled += 1;
        const weeks = new Set(result.events.flatMap((e) => (e.type === 'week_rolled_up' ? [e.weekStart] : [])));
        const latest = result.state.weeklyResults.filter((w) => weeks.has(w.weekStart)).at(-1);
        const message = latest ? weeklySummaryMessage(result.state, latest) : null;
        if (message) await sendPushes(admin, id as string, [message]);
      } catch (error) {
        logError('weekly-rollup', error, { familyId: id });
      }
    }
    if (!data || data.length < PAGE) break;
  }
  const { error } = await admin.rpc('jk_cleanup');
  if (error) logError('weekly-rollup.cleanup', error.message);
  return json({ ok: true, families, rolled });
});
