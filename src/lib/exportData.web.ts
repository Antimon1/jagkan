import type { FamilyState } from '@/domain/types';

import { logError } from './log';

export async function exportFamilyData(state: FamilyState): Promise<boolean> {
  try {
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'JagKan!', data: state }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `jagkan-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (error) {
    logError('export', error);
    return false;
  }
}
