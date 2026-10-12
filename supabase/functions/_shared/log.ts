/** Server-side logging: one JSON line per error, visible in the Supabase function logs. */
export function logError(scope: string, error: unknown, extra: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: 'error', scope, message, ...extra }));
}
