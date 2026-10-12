import { Platform } from 'react-native';

import { requireSupabase } from './supabase';

/**
 * Calls to the Supabase backend (cloud mode only). Every function throws on
 * failure; screens catch and show a friendly message.
 */

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('empty response');
  return result.data;
}

// --- Parent accounts --------------------------------------------------------

export async function sendLoginCode(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyLoginCode(email: string, token: string): Promise<string> {
  const { data, error } = await requireSupabase().auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) throw new Error(error?.message ?? 'login failed');
  return data.user.id;
}

/** Sign in with Apple (iOS). Requires the Apple provider to be enabled in Supabase. */
export async function signInWithApple(): Promise<string> {
  if (Platform.OS !== 'ios') throw new Error('Apple sign-in is only available on iOS');
  const AppleAuthentication = await import('expo-apple-authentication');
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!credential.identityToken) throw new Error('no identity token');
  const { data, error } = await requireSupabase().auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error || !data.user) throw new Error(error?.message ?? 'login failed');
  return data.user.id;
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut();
}

export async function createCloudFamily(familyName: string, displayName: string): Promise<string> {
  return check(
    await requireSupabase().rpc('jk_create_family', { p_family_name: familyName, p_display_name: displayName }),
  ) as string;
}

// --- Co-parents (spec 2: invited with a code) -------------------------------

export async function createInvite(): Promise<{ code: string; expiresAt: string }> {
  const rows = check(await requireSupabase().rpc('jk_create_invite')) as { code: string; expires_at: string }[];
  return { code: rows[0].code, expiresAt: rows[0].expires_at };
}

/** Throws 'invalid_code' for an unknown, used or expired code. */
export async function acceptInvite(code: string, displayName: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc('jk_accept_invite', { p_code: code, p_display_name: displayName });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('invalid_code');
  return data as string;
}

// --- Child devices (spec 11) -----------------------------------------------

export interface PairingCode {
  code: string;
  expiresAt: string;
}

export async function createPairingCode(childIds: string[]): Promise<PairingCode> {
  const rows = check(await requireSupabase().rpc('jk_create_pairing_code', { p_child_ids: childIds })) as {
    code: string;
    expires_at: string;
  }[];
  return { code: rows[0].code, expiresAt: rows[0].expires_at };
}

export interface PairResult {
  familyId: string;
  childIds: string[];
}

/** Child device: anonymous session + pairing code = a device token for the paired children only. */
export async function pairDevice(code: string): Promise<PairResult> {
  const supabase = requireSupabase();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
  }
  const { data, error } = await supabase.functions.invoke<PairResult>('pair-device', {
    body: { code, platform: Platform.OS },
  });
  if (error || !data) throw new Error(error?.message ?? 'pairing failed');
  await supabase.auth.refreshSession();
  return data;
}

export interface DeviceRow {
  id: string;
  child_ids: string[];
  platform: string | null;
  created_at: string;
  last_seen: string | null;
}

export async function listDevices(): Promise<DeviceRow[]> {
  return check(
    await requireSupabase().from('child_devices').select('id, child_ids, platform, created_at, last_seen').order('created_at'),
  ) as DeviceRow[];
}

export async function removeDevice(deviceId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('jk_remove_device', { p_device_id: deviceId });
  if (error) throw new Error(error.message);
}

// --- Push -------------------------------------------------------------------

export async function registerPushToken(token: string): Promise<void> {
  const { error } = await requireSupabase().rpc('jk_register_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) throw new Error(error.message);
}

// --- Edge Functions ---------------------------------------------------------

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke<T>(name, { body });
  if (error || !data) throw new Error(error?.message ?? `${name} failed`);
  return data;
}

// --- Data (GDPR, spec 12) ---------------------------------------------------

export async function deleteCloudFamily(): Promise<void> {
  await invoke<{ ok: boolean }>('delete-family', {});
}
