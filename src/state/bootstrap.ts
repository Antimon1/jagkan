import { getSupabase } from '@/lib/supabase';
import { logError } from '@/lib/log';

import { createCloudBackend } from './cloudBackend';
import { useDeviceStore, type BackendKind } from './device';
import { useGameStore } from './game';
import { createLocalBackend } from './localBackend';

/** Connect the game store to the backend chosen for this device. */
export async function startBackend(kind: BackendKind | null): Promise<void> {
  const game = useGameStore.getState();
  if (kind === 'local') {
    await game.init(createLocalBackend());
    return;
  }
  if (kind === 'cloud') {
    const supabase = getSupabase();
    if (!supabase) {
      // The build has no cloud config (e.g. web preview): fall back to local mode.
      useDeviceStore.getState().setBackend('local');
      await game.init(createLocalBackend());
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        useGameStore.setState({ status: 'empty', family: null });
        return;
      }
      const role = useDeviceStore.getState().role;
      await game.init(await createCloudBackend(supabase), role === 'parent' ? data.session.user.id : null);
    } catch (error) {
      logError('bootstrap.cloud', error);
      useGameStore.setState({ status: 'error' });
    }
    return;
  }
  useGameStore.setState({ status: 'empty', family: null });
}
