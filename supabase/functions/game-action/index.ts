// Applies one game command from a parent or a paired child device (spec 14.2).
// The same engine as in the app runs here and is the source of truth; the answer
// is the snapshot the caller may see. Covers `approve-completion` and
// `ai-card-text` from the spec (see _shared/game.ts).
import type { Command } from '../_shared/domain/commands.ts';
import { runCommand } from '../_shared/game.ts';
import { HttpError, isUuid, json, readBody, serve } from '../_shared/http.ts';
import { adminClient, requireUser, resolveCaller, snapshotFor } from '../_shared/supabase.ts';

function isCommand(value: unknown): value is Command {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

serve('game-action', async (req) => {
  const admin = adminClient();
  const caller = await resolveCaller(admin, await requireUser(req, admin));
  const { commandId, command, clientAt } = await readBody(req);
  if (!isUuid(commandId) || !isCommand(command)) throw new HttpError(400, 'invalid_input');

  const result = await runCommand(admin, { familyId: caller.familyId, command, actor: caller.actor, commandId, clientAt });
  if (!result.ok) {
    // A lasting revision conflict is temporary: 503 makes the device keep the command and retry.
    if (result.error === 'conflict') return json({ ok: false, error: 'busy' }, 503);
    return json({ ok: false, error: result.error }, result.error === 'forbidden' ? 403 : 422);
  }
  return json({ ok: true, snapshot: await snapshotFor(admin, caller) });
});
