import { buildCardPrompt, CARD_SYSTEM_PROMPT, cleanCardText } from './backend/aiPrompts.ts';
import { effectiveNow } from './backend/clientTime.ts';
import { commitCommand, type CommitResult } from './backend/commit.ts';
import { messagesForEvents } from './backend/pushMessages.ts';
import { catalog } from './catalog.ts';
import { findTemplate } from './domain/catalog.ts';
import type { Command } from './domain/commands.ts';
import type { Actor, FamilyState } from './domain/types.ts';
import { askClaude } from './anthropic.ts';
import { logError } from './log.ts';
import { sendPushes } from './push.ts';
import { supabaseStore, takeAiCall, type SupabaseClient } from './supabase.ts';

/** AI calls per family and day (cost control, spec 8). */
export const AI_FAMILY_DAILY_LIMIT = 40;

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
    prepare: (state, command) => withAiCardText(admin, state, command),
  });
  if (result.ok && result.changed) {
    await sendPushes(admin, options.familyId, messagesForEvents(result.state, result.events, catalog));
  }
  return result;
}

/**
 * Plus: Claude writes the collector card text when a parent approves (spec 8,
 * ai-card-text). Any problem keeps the command as is, so the template text is used.
 */
async function withAiCardText(admin: SupabaseClient, state: FamilyState, command: Command): Promise<Command> {
  if (command.type !== 'approveCompletion' || command.cardText || !state.family.plusActive) return command;
  const challenge = state.challenges.find((c) => c.id === command.challengeId);
  const child = challenge ? state.children.find((c) => c.id === challenge.childId) : undefined;
  if (!challenge || !child) return command;
  try {
    if (!(await takeAiCall(admin, state.family.id, null, { family: AI_FAMILY_DAILY_LIMIT, child: null }))) return command;
    const text = await askClaude({
      system: CARD_SYSTEM_PROMPT,
      prompt: buildCardPrompt({
        firstName: child.firstName,
        title: findTemplate(catalog, challenge.templateId)?.titleChild ?? challenge.customTitle ?? '',
        parentNote: command.note ?? null,
        attempts: state.attempts.filter((a) => a.childChallengeId === challenge.id).length,
      }),
      maxTokens: 300,
    });
    const cardText = text ? cleanCardText(text, child.firstName) : null;
    return cardText ? { ...command, cardText } : command;
  } catch (error) {
    logError('ai-card-text', error);
    return command;
  }
}
