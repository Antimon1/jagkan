import { effectiveNow } from './backend/clientTime.ts';
import { commitCommand, type CommitResult } from './backend/commit.ts';
import { messagesForEvents } from './backend/pushMessages.ts';
import { catalog } from './catalog.ts';
import type { Command } from './domain/commands.ts';
import type { Actor } from './domain/types.ts';
import { sendPushes } from './push.ts';
import { supabaseStore, type SupabaseClient } from './supabase.ts';

export interface RunOptions {
  familyId: string;
  command: Command;
  actor: Actor;
  commandId: string | null;
  /** When the device queued the action (offline support). */
  clientAt?: unknown;
}

/** Applies a command authoritatively, then notifies the family's devices. */
export async function runCommand(admin: SupabaseClient, options: RunOptions): Promise<CommitResult> {
  const serverNow = () => new Date().toISOString();
  const result = await commitCommand(supabaseStore(admin), {
    familyId: options.familyId,
    command: options.command,
    actor: options.actor,
    commandId: options.commandId,
    catalog,
    // Only parents' queued actions keep their device time. Child devices always get
    // server time, so a device clock cannot be used to collect extra sparks.
    now: () => (options.actor.kind === 'parent' ? effectiveNow(serverNow(), options.clientAt) : serverNow()),
    newId: () => crypto.randomUUID(),
  });
  if (result.ok && result.changed) {
    await sendPushes(admin, options.familyId, messagesForEvents(result.state, result.events));
  }
  return result;
}

