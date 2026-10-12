import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { config } from './config';

let client: SupabaseClient | null = null;

/**
 * Supabase client (EU project, spec 14). Returns null when no project is
 * configured; the app then runs in local mode only.
 */
export function getSupabase(): SupabaseClient | null {
  if (!config.cloudEnabled || !config.supabaseUrl || !config.supabaseAnonKey) return null;
  if (client) return client;
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  if (Platform.OS !== 'web') {
    // Refresh tokens only while the app is in the foreground (Supabase guidance for React Native).
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Cloud sync is not configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY).');
  return supabase;
}
