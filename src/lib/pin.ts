import * as Crypto from 'expo-crypto';

import { secureDelete, secureGet, secureSet } from './secure';

const PIN_KEY = 'jk_parent_pin';
export const PIN_LENGTH = 4;

interface StoredPin {
  salt: string;
  hash: string;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export async function hasPin(): Promise<boolean> {
  return (await secureGet(PIN_KEY)) !== null;
}

export async function setPin(pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const salt = Crypto.randomUUID();
  const stored: StoredPin = { salt, hash: await hashPin(pin, salt) };
  return secureSet(PIN_KEY, JSON.stringify(stored));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = await secureGet(PIN_KEY);
  if (!raw) return false;
  try {
    const stored = JSON.parse(raw) as StoredPin;
    return (await hashPin(pin, stored.salt)) === stored.hash;
  } catch {
    return false;
  }
}

export async function clearPin(): Promise<void> {
  await secureDelete(PIN_KEY);
}

/**
 * Adult question used when no PIN is set (spec 9: Kids Category requires a
 * parental gate). Two-digit multiplication is hard for young children.
 */
export interface AdultQuestion {
  a: number;
  b: number;
  answer: number;
}

export function makeAdultQuestion(random: () => number = Math.random): AdultQuestion {
  const a = 12 + Math.floor(random() * 8);
  const b = 3 + Math.floor(random() * 6);
  return { a, b, answer: a * b };
}
