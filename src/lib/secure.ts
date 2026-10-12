import * as SecureStore from 'expo-secure-store';

import { logError } from './log';

/** Encrypted on-device storage for small secrets (PIN hash, device credentials). */
export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    logError(`secure.get ${key}`, error);
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch (error) {
    logError(`secure.set ${key}`, error);
    return false;
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    logError(`secure.delete ${key}`, error);
  }
}
