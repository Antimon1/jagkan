import * as Speech from 'expo-speech';

import { logError } from './log';

const LANGUAGE = 'sv-SE';
/** Slightly slower than default so young children can follow. */
const RATE = 0.9;

let enabled = true;

export function setSpeechEnabled(value: boolean): void {
  enabled = value;
  if (!value) Speech.stop();
}

/** Read text aloud with the system voice (spec 9: every child text can be read aloud). */
export function speak(text: string): void {
  if (!enabled || !text.trim()) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: LANGUAGE, rate: RATE, pitch: 1.05 });
  } catch (error) {
    logError('speech.speak', error);
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch (error) {
    logError('speech.stop', error);
  }
}
