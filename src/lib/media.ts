import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { logError } from './log';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from './storage';

/**
 * Photos and videos of children never leave the device (spec 12). They are copied
 * into the app's document directory and linked to a collector card by completion id.
 * The index is device-local and is never synced.
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

const MEDIA_DIR = 'jagkan-media';

export async function pickMedia(source: 'camera' | 'library'): Promise<PickedMedia | null> {
  try {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 30,
    };
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return null;
    }
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || result.assets.length === 0) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' };
  } catch (error) {
    logError('media.pick', error);
    return null;
  }
}

export async function getMediaIndex(): Promise<MediaIndex> {
  return (await readJson<MediaIndex>(STORAGE_KEYS.localMedia)) ?? {};
}

function extensionOf(uri: string, type: PickedMedia['type']): string {
  const match = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(uri);
  return match ? match[1].toLowerCase() : type === 'video' ? 'mp4' : 'jpg';
}

export async function saveMediaForCompletion(completionId: string, picked: PickedMedia): Promise<LocalMedia | null> {
  try {
    const dir = new Directory(Paths.document, MEDIA_DIR);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const target = new File(dir, `${completionId}.${extensionOf(picked.uri, picked.type)}`);
    if (target.exists) target.delete();
    await new File(picked.uri).copy(target);
    const media: LocalMedia = {
      id: completionId,
      completionId,
      uri: target.uri,
      type: picked.type,
      createdAt: new Date().toISOString(),
    };
    const index = await getMediaIndex();
    await writeJson(STORAGE_KEYS.localMedia, { ...index, [completionId]: media });
    return media;
  } catch (error) {
    logError('media.save', error);
    return null;
  }
}

/** False when the file is gone, e.g. after switching phones; the UI then shows the creature (spec 12). */
export function mediaFileExists(media: LocalMedia): boolean {
  try {
    return new File(media.uri).exists;
  } catch {
    return false;
  }
}

export async function shareMedia(media: LocalMedia): Promise<void> {
  try {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(media.uri);
  } catch (error) {
    logError('media.share', error);
  }
}

/** Save all photos/videos to the device photo library (album export, Plus). Returns the number saved. */
export async function exportMediaToLibrary(items: LocalMedia[]): Promise<number> {
  const { status } = await requestPermissionsAsync();
  if (status !== 'granted') return 0;
  let saved = 0;
  for (const item of items) {
    if (!mediaFileExists(item)) continue;
    try {
      await Asset.create(item.uri);
      saved += 1;
    } catch (error) {
      logError('media.export', error);
    }
  }
  return saved;
}

export async function deleteAllMedia(): Promise<void> {
  try {
    const dir = new Directory(Paths.document, MEDIA_DIR);
    if (dir.exists) dir.delete();
  } catch (error) {
    logError('media.deleteAll', error);
  }
  await removeKey(STORAGE_KEYS.localMedia);
}
