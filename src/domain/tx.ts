import type {
  Celebration,
  CelebrationType,
  DomainEvent,
  EngineContext,
  FamilyState,
} from './types';

/** An in-progress (immutable) state change: each helper returns a new Tx. */
export interface Tx {
  state: FamilyState;
  events: DomainEvent[];
}

export function startTx(state: FamilyState): Tx {
  return { state, events: [] };
}

export function emit(tx: Tx, ...events: DomainEvent[]): Tx {
  return { ...tx, events: [...tx.events, ...events] };
}

export function patchState(tx: Tx, patch: Partial<FamilyState>): Tx {
  return { ...tx, state: { ...tx.state, ...patch } };
}

export function celebrate(
  tx: Tx,
  ctx: EngineContext,
  childId: string,
  type: CelebrationType,
  payload: Celebration['payload'],
): Tx {
  const celebration: Celebration = {
    id: ctx.newId(),
    familyId: tx.state.family.id,
    childId,
    type,
    payload,
    createdAt: ctx.now,
    seenAt: null,
  };
  return patchState(tx, { celebrations: [...tx.state.celebrations, celebration] });
}

export function replaceById<T extends { id: string }>(list: readonly T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
