import type { PushMessage } from './backend/pushMessages.ts';
import { logError } from './log.ts';
import type { SupabaseClient } from './supabase.ts';

/** Expo push service (spec 14: Expo Notifications). */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

interface TokenRow {
  token: string;
  parent_id: string | null;
  device_id: string | null;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/** Sends the messages to the family's registered devices. Never throws: a failed push must not fail the action. */
export async function sendPushes(admin: SupabaseClient, familyId: string, messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const [{ data: tokens, error: tokenError }, { data: devices, error: deviceError }] = await Promise.all([
      admin.from('push_tokens').select('token, parent_id, device_id').eq('family_id', familyId),
      admin.from('child_devices').select('id, child_ids').eq('family_id', familyId),
    ]);
    if (tokenError || deviceError) throw new Error(tokenError?.message ?? deviceError?.message);
    const rows = (tokens ?? []) as TokenRow[];
    const childIdsByDevice = new Map((devices ?? []).map((d) => [d.id as string, d.child_ids as string[]]));

    const outgoing = messages.flatMap((message) =>
      rows
        .filter((row) =>
          message.audience.kind === 'parents'
            ? row.parent_id !== null
            : row.device_id !== null && (childIdsByDevice.get(row.device_id) ?? []).includes(message.audience.childId),
        )
        .map((row) => ({ to: row.token, title: message.title, body: message.body, data: { url: message.url }, sound: 'default' })),
    );

    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    for (let i = 0; i < outgoing.length; i += BATCH_SIZE) {
      const batch = outgoing.slice(i, i + BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
      if (!response.ok) {
        logError('push', `HTTP ${response.status}`);
        continue;
      }
      const { data: tickets } = (await response.json()) as { data?: ExpoTicket[] };
      const stale = (tickets ?? [])
        .map((ticket, index) => (ticket.details?.error === 'DeviceNotRegistered' ? batch[index].to : null))
        .filter((token): token is string => token !== null);
      if (stale.length) await admin.from('push_tokens').delete().in('token', stale);
    }
  } catch (error) {
    logError('push', error, { familyId });
  }
}
