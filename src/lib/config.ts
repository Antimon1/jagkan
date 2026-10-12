/**
 * Runtime configuration from EXPO_PUBLIC_* environment variables (see .env.example).
 * Only public values belong here: the Supabase anon key and RevenueCat public SDK keys
 * are designed to ship in apps. Secret keys (Anthropic, service role) live only in
 * Supabase Edge Function secrets.
 */
export interface AppConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  revenueCatIosKey: string | null;
  revenueCatAndroidKey: string | null;
  /** True when a Supabase project is configured, so families can sync between devices. */
  cloudEnabled: boolean;
}

function read(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const config: AppConfig = (() => {
  const supabaseUrl = read(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = read(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  return {
    supabaseUrl,
    supabaseAnonKey,
    revenueCatIosKey: read(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY),
    revenueCatAndroidKey: read(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY),
    cloudEnabled: Boolean(supabaseUrl && supabaseAnonKey),
  };
})();
