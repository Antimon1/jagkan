import { logError } from './log';

/**
 * Web fallback: expo-secure-store is not available in browsers, so the web
 * preview keeps these values in localStorage. The web build is a preview/demo,
 * the real app runs on iOS and Android.
 */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    return storage()?.getItem(`secure.${key}`) ?? null;
  } catch (error) {
    logError(`secure.get ${key}`, error);
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<boolean> {
  try {
    storage()?.setItem(`secure.${key}`, value);
    return true;
  } catch (error) {
    logError(`secure.set ${key}`, error);
    return false;
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    storage()?.removeItem(`secure.${key}`);
  } catch (error) {
    logError(`secure.delete ${key}`, error);
  }
}
