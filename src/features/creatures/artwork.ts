import type { ImageSourcePropType } from 'react-native';

/**
 * Finished creature artwork by `assetKey` (seed/creatures.json). CreatureArt shows
 * the image when its key is listed here and the vector placeholder otherwise, so
 * artwork can arrive one picture at a time.
 *
 * Files: assets/creatures/<world>/<branch>_<slot>_s<stage>.png, transparent PNG,
 * 1024 × 1024 px. The beta needs the 27 Äggdalen images listed in
 * docs/grafik-brief-aggdalen.md. Add one line per finished image, for example:
 *
 *   'valley/kropp_1_s1': require('../../../assets/creatures/valley/kropp_1_s1.png'),
 */
export const CREATURE_ARTWORK: Readonly<Record<string, ImageSourcePropType>> = {};

export function creatureArtwork(assetKey: string | undefined): ImageSourcePropType | undefined {
  return assetKey ? CREATURE_ARTWORK[assetKey] : undefined;
}
