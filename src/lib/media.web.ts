import * as ImagePicker from 'expo-image-picker';

import { logError } from './log';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from './storage';

/**
 * Web preview: photos stay in this browser (IndexedDB), never on a server.
 * Same API as media.ts so screens do not care about the platform.
 */
export interface LocalMedia {
  id: string;
  completionId: string;
  uri: string;
  type: 'image' | 'video';
  createdAt: string;
}

export interface PickedMedia {
  uri: string;
  type: 'image' | 'video';
}

export type MediaIndex = Record<string, LocalMedia>;

const DB_NAME = 'jagkan-media';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function pickMedia(source: 'camera' | 'library'): Promise<PickedMedia | null> {
  try {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || result.assets.length === 0) return null;
    return { uri: result.assets[0].uri, type: 'image' };
  } catch (error) {
    logError('media.pick', error);
    return null;
  }
}

const objectUrls = new Map<string, string>();

export async function getMediaIndex(): Promise<MediaIndex> {
  const index = (await readJson<MediaIndex>(STORAGE_KEYS.localMedia)) ?? {};
  const resolved: MediaIndex = {};
  for (const [key, media] of Object.entries(index)) {
    try {
      let url = objectUrls.get(key);
      if (!url) {
        const blob = await getBlob(key);
        if (!blob) continue;
        url = URL.createObjectURL(blob);
        objectUrls.set(key, url);
      }
      resolved[key] = { ...media, uri: url };
    } catch (error) {
      logError('media.index', error);
    }
  }
  return resolved;
}

export async function saveMediaForCompletion(completionId: string, picked: PickedMedia): Promise<LocalMedia | null> {
  try {
    const blob = await (await fetch(picked.uri)).blob();
    await putBlob(completionId, blob);
    const media: LocalMedia = {
      id: completionId,
      completionId,
      uri: completionId,
      type: picked.type,
      createdAt: new Date().toISOString(),
    };
    const index = (await readJson<MediaIndex>(STORAGE_KEYS.localMedia)) ?? {};
    await writeJson(STORAGE_KEYS.localMedia, { ...index, [completionId]: media });
    objectUrls.delete(completionId);
    return media;
  } catch (error) {
    logError('media.save', error);
    return null;
  }
}

export function mediaFileExists(media: LocalMedia): boolean {
  return media.uri.startsWith('blob:');
}

export async function shareMedia(media: LocalMedia): Promise<void> {
  try {
    const blob = await (await fetch(media.uri)).blob();
    const file = new File([blob], `jagkan-${media.completionId}.jpg`, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
  } catch (error) {
    logError('media.share', error);
  }
}

export async function exportMediaToLibrary(items: LocalMedia[]): Promise<number> {
  let saved = 0;
  for (const item of items) {
    if (!mediaFileExists(item)) continue;
    const link = document.createElement('a');
    link.href = item.uri;
    link.download = `jagkan-${item.completionId}.jpg`;
    link.click();
    saved += 1;
  }
  return saved;
}

export async function deleteAllMedia(): Promise<void> {
  try {
    indexedDB.deleteDatabase(DB_NAME);
  } catch (error) {
    logError('media.deleteAll', error);
  }
  await removeKey(STORAGE_KEYS.localMedia);
}
