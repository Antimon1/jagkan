/** How far back an offline action may be dated (spec 15: offline sparks are queued and synced later). */
export const MAX_OFFLINE_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Allowed clock skew for devices that run slightly ahead. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * The time a parent's queued offline action counts as happening: the device time,
 * but only within a short window and never in the future. Child devices always get
 * server time (supabase/functions/_shared/game.ts).
 */
export function effectiveNow(serverNow: string, clientAt: unknown): string {
  if (typeof clientAt !== 'string') return serverNow;
  const client = Date.parse(clientAt);
  const server = Date.parse(serverNow);
  if (Number.isNaN(client) || Number.isNaN(server)) return serverNow;
  if (client > server + MAX_CLOCK_SKEW_MS || client < server - MAX_OFFLINE_AGE_MS) return serverNow;
  return new Date(Math.min(client, server)).toISOString();
}
