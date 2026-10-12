import type { Command } from '@/domain/commands';
import type { FamilyState } from '@/domain/types';

export type CommitOutcome =
  /** Saved on this device (local mode). */
  | { status: 'saved' }
  /** Waiting in the offline queue; will be sent when the network is back. */
  | { status: 'queued' }
  /** The server accepted the command and returned the authoritative state. */
  | { status: 'synced'; state: FamilyState }
  /** The server refused the command; the app rolls back to `state`. */
  | { status: 'rejected'; error: string; state: FamilyState | null };

export interface GameBackend {
  kind: 'local' | 'cloud';
  load(): Promise<FamilyState | null>;
  commit(command: Command, next: FamilyState): Promise<CommitOutcome>;
  /** Listen for changes made on other devices. Returns an unsubscribe function. */
  watch(onRemote: (state: FamilyState) => void): () => void;
  /** Number of commands waiting to be sent. */
  pending(): number;
  /** Try to send queued commands now. */
  flush(): Promise<void>;
  clear(): Promise<void>;
}
