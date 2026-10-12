import { useCallback, useEffect, useState } from 'react';

import { showToast } from '@/components/Toast';
import type { Command } from '@/domain/commands';
import type { EngineResult } from '@/domain/types';
import { useT } from '@/lib/i18n';

import { useGameStore } from './game';

type OkResult = Extract<EngineResult, { ok: true }>;

/** Dispatch a command and show a friendly toast when it is refused. */
export function useDispatch() {
  const t = useT();
  return useCallback(
    async (command: Command, options?: { success?: string; quiet?: boolean }): Promise<OkResult | null> => {
      const result = await useGameStore.getState().dispatch(command);
      if (!result.ok) {
        if (!options?.quiet) showToast(t(`errors.${result.error}`), 'error');
        return null;
      }
      if (options?.success) showToast(options.success, 'success');
      return result;
    },
    [t],
  );
}

/** Current time, refreshed every minute (for week/day boundaries in the UI). */
export function useNow(intervalMs = 60_000): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
