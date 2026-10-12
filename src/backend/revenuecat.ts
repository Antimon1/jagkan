/**
 * RevenueCat webhook events -> families.plus_active (spec 13). The app configures
 * RevenueCat with the family id as app user id, so app_user_id is a family id.
 */

export const PLUS_ENTITLEMENT = 'plus';

export interface PlusChange {
  familyId: string;
  active: boolean;
  /** event_timestamp_ms, so late or repeated events can be ignored (null if missing). */
  eventMs: number | null;
}

export interface WebhookOptions {
  /** Sandbox purchases (test accounts) only count when explicitly allowed, e.g. in a staging project. */
  allowSandbox: boolean;
}

const GRANTING = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function familyIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && UUID.test(v)) : [];
}

/**
 * The Plus changes an event implies. CANCELLATION and BILLING_ISSUE change nothing:
 * the subscription stays active until RevenueCat sends EXPIRATION.
 */
export function plusChangesFromEvent(body: unknown, nowMs: number, options: WebhookOptions): PlusChange[] {
  const event = (body as { event?: Record<string, unknown> } | null)?.event;
  if (!event || typeof event.type !== 'string') return [];
  if (event.environment === 'SANDBOX' && !options.allowSandbox) return [];
  const eventMs = typeof event.event_timestamp_ms === 'number' ? event.event_timestamp_ms : null;
  const appUserId = typeof event.app_user_id === 'string' && UUID.test(event.app_user_id) ? event.app_user_id : null;
  const entitlements = Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [];
  const hasPlus = entitlements.includes(PLUS_ENTITLEMENT);

  if (event.type === 'TRANSFER') {
    return [
      ...familyIds(event.transferred_from).map((familyId) => ({ familyId, active: false, eventMs })),
      ...familyIds(event.transferred_to).map((familyId) => ({ familyId, active: true, eventMs })),
    ];
  }
  if (!appUserId) return [];
  if (event.type === 'EXPIRATION') return hasPlus || entitlements.length === 0 ? [{ familyId: appUserId, active: false, eventMs }] : [];
  if (GRANTING.has(event.type) && hasPlus) {
    const expires = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;
    return [{ familyId: appUserId, active: expires === null || expires > nowMs, eventMs }];
  }
  return [];
}

/** Constant-time comparison for the shared webhook secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
