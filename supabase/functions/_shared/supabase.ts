import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

import type { ApplyOutcome, FamilyStore } from './backend/commit.ts';
import type { Actor, ParentRole } from './domain/types.ts';
import type { FamilySnapshot } from './domain/rows.ts';
import { HttpError } from './http.ts';
import { safeEqual } from './backend/revenuecat.ts';

export type { SupabaseClient };

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Service-role client. Bypasses RLS, so every function checks the caller itself. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearer(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
}

export async function requireUser(req: Request, admin: SupabaseClient): Promise<User> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'not_authenticated');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'not_authenticated');
  return data.user;
}

/** Scheduled jobs (pg_cron) authenticate with the CRON_SECRET function secret. */
export function isCronRequest(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');
  const token = bearer(req);
  return Boolean(secret && token && safeEqual(token, secret));
}

export type Caller =
  | { kind: 'parent'; userId: string; familyId: string; role: ParentRole; actor: Actor }
  | { kind: 'device'; userId: string; familyId: string; deviceId: string; childIds: string[]; actor: Actor };

/** A parent account or a paired child device; anything else is refused. */
export async function resolveCaller(admin: SupabaseClient, user: User): Promise<Caller> {
  const { data: parent, error: parentError } = await admin
    .from('parents')
    .select('family_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (parentError) throw new Error(parentError.message);
  if (parent) {
    return {
      kind: 'parent',
      userId: user.id,
      familyId: parent.family_id as string,
      role: parent.role as ParentRole,
      actor: { kind: 'parent', parentId: user.id },
    };
  }
  const { data: device, error: deviceError } = await admin
    .from('child_devices')
    .select('id, family_id, child_ids')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (deviceError) throw new Error(deviceError.message);
  if (device) {
    const childIds = device.child_ids as string[];
    return {
      kind: 'device',
      userId: user.id,
      familyId: device.family_id as string,
      deviceId: device.id as string,
      childIds,
      actor: { kind: 'child', childIds },
    };
  }
  throw new HttpError(403, 'forbidden');
}

export function requireParent(caller: Caller, role?: ParentRole): Extract<Caller, { kind: 'parent' }> {
  if (caller.kind !== 'parent' || (role && caller.role !== role)) throw new HttpError(403, 'forbidden');
  return caller;
}

/** The FamilyStore of src/backend/commit.ts on top of the SQL functions. */
export function supabaseStore(admin: SupabaseClient): FamilyStore {
  return {
    async loadSnapshot(familyId) {
      const { data, error } = await admin.rpc('jk_family_snapshot', { p_family_id: familyId, p_child_ids: null });
      if (error) throw new Error(error.message);
      return (data as FamilySnapshot | null) ?? null;
    },
    async wasApplied(familyId, commandId) {
      const { data, error } = await admin
        .from('applied_commands')
        .select('id')
        .eq('family_id', familyId)
        .eq('id', commandId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },
    async applyDiff({ familyId, expectedRevision, commandId, diff }) {
      const { data, error } = await admin.rpc('jk_apply_diff', {
        p_family_id: familyId,
        p_expected_revision: expectedRevision,
        p_command_id: commandId,
        p_diff: diff,
      });
      if (error) throw new Error(error.message);
      return data as ApplyOutcome;
    },
  };
}

/** The snapshot a caller may see (devices: their own children only). */
export async function snapshotFor(admin: SupabaseClient, caller: Caller): Promise<FamilySnapshot | null> {
  const { data, error } = await admin.rpc('jk_family_snapshot', {
    p_family_id: caller.familyId,
    p_child_ids: caller.kind === 'device' ? caller.childIds : null,
  });
  if (error) throw new Error(error.message);
  return (data as FamilySnapshot | null) ?? null;
}

/** One AI call against the family/child daily limits (spec 8). */
export async function takeAiCall(
  admin: SupabaseClient,
  familyId: string,
  childId: string | null,
  limits: { family: number; child: number | null },
): Promise<boolean> {
  const { data, error } = await admin.rpc('jk_ai_take', {
    p_family_id: familyId,
    p_child_id: childId,
    p_family_limit: limits.family,
    p_child_limit: limits.child,
  });
  if (error) throw new Error(error.message);
  return data === true;
}
