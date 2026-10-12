import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { FamilyState } from '@/domain/types';

import { logError } from './log';

/** "Exportera all data (JSON)" (spec 12). Photos are not included: they stay on the device. */
export async function exportFamilyData(state: FamilyState): Promise<boolean> {
  try {
    const file = new File(Paths.cache, `jagkan-export-${new Date().toISOString().slice(0, 10)}.json`);
    if (file.exists) file.delete();
    file.write(JSON.stringify({ exportedAt: new Date().toISOString(), app: 'JagKan!', data: state }, null, 2));
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'JagKan! export' });
    return true;
  } catch (error) {
    logError('export', error);
    return false;
  }
}
