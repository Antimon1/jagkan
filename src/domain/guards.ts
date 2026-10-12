import { BRANCHES, WORLDS } from './constants';
import type { Tx } from './tx';
import type { BranchId, ChildChallenge, DomainErrorCode, FamilyState, WorldId } from './types';

export interface Failure {
  ok: false;
  error: DomainErrorCode;
  message?: string;
}

export type HandlerResult = Tx | Failure;

export function fail(error: DomainErrorCode, message?: string): Failure {
  return { ok: false, error, message };
}

export function isFailure(result: HandlerResult): result is Failure {
  return (result as Failure).ok === false;
}

/** Trim and collapse whitespace; returns null when empty or too long. */
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > maxLength) return null;
  return text;
}

export function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  const text = cleanText(value, maxLength);
  return text === null ? undefined : text;
}

export function isBranch(value: unknown): value is BranchId {
  return typeof value === 'string' && (BRANCHES as readonly string[]).includes(value);
}

export function isWorld(value: unknown): value is WorldId {
  return typeof value === 'string' && (WORLDS as readonly string[]).includes(value);
}

export function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** A single emoji or a short symbol, never long text. */
export function cleanIcon(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const icon = value.trim();
  if (icon.length === 0 || [...icon].length > 8) return null;
  return icon;
}

export function findChallenge(state: FamilyState, id: string): ChildChallenge | undefined {
  return state.challenges.find((c) => c.id === id);
}

export function activeCount(state: FamilyState, childId: string): number {
  return state.challenges.filter((c) => c.childId === childId && (c.status === 'active' || c.status === 'requested'))
    .length;
}
