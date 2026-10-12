import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { logError } from './log';

const SOURCES = {
  pop: require('../../assets/sounds/pop.wav'),
  tap: require('../../assets/sounds/tap.wav'),
  spark: require('../../assets/sounds/spark.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  hatch: require('../../assets/sounds/hatch.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  fanfare: require('../../assets/sounds/fanfare.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

let enabled = true;
let modeSet = false;
const players = new Map<SoundName, AudioPlayer>();

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

function player(name: SoundName): AudioPlayer {
  const existing = players.get(name);
  if (existing) return existing;
  const created = createAudioPlayer(SOURCES[name]);
  players.set(name, created);
  return created;
}

/** Play a short effect (spec 9: sounds can be turned off in settings). */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: false }).catch((error: unknown) => logError('sound.mode', error));
    }
    const p = player(name);
    p.seekTo(0).catch(() => undefined);
    p.play();
  } catch (error) {
    logError(`sound.play ${name}`, error);
  }
}

export type HapticKind = 'light' | 'success' | 'heavy';

export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
  run.catch(() => undefined);
}
