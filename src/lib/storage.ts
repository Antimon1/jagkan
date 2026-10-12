import AsyncStorage from '@react-native-async-storage/async-storage';

import { logError } from './log';

/**
 * Small JSON key-value store for device-local data (AsyncStorage on native,
 * localStorage on web). Failures are logged and reported as `null`/`false`
 * so callers can show a friendly message instead of crashing.
 */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    logError(`storage.read ${key}`, error);
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logError(`storage.write ${key}`, error);
    return false;
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    logError(`storage.remove ${key}`, error);
  }
}

export const STORAGE_KEYS = {
  device: 'jk.device.v1',
  localFamily: 'jk.family.v1',
  outbox: 'jk.outbox.v1',
  localMedia: 'jk.media.v1',
} as const;
