// Generates the placeholder sound effects in assets/sounds as small 16-bit mono WAV files.
// Run: node scripts/generate-sounds.mjs  (replace with real sound design before launch, spec 15 fas 6)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

/** notes: [frequencyHz, startSec, durationSec, volume, wave] */
function render(notes, totalSec) {
  const samples = new Float32Array(Math.ceil(totalSec * RATE));
  for (const [freq, start, dur, vol = 0.5, wave = 'sine'] of notes) {
    const from = Math.floor(start * RATE);
    const len = Math.floor(dur * RATE);
    for (let i = 0; i < len && from + i < samples.length; i += 1) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.008);
      const release = Math.exp(-4 * (t / dur));
      const phase = 2 * Math.PI * freq * t;
      let v = Math.sin(phase);
      if (wave === 'bell') v = 0.7 * Math.sin(phase) + 0.2 * Math.sin(phase * 2.01) + 0.1 * Math.sin(phase * 3.98);
      if (wave === 'soft') v = Math.sin(phase) * (1 - 0.3 * Math.sin(phase * 0.5));
      samples[from + i] += v * vol * attack * release;
    }
  }
  return samples;
}

function sweep(f0, f1, dur, vol) {
  const samples = new Float32Array(Math.ceil(dur * RATE));
  let phase = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const t = i / RATE;
    const f = f0 + (f1 - f0) * (t / dur);
    phase += (2 * Math.PI * f) / RATE;
    samples[i] = Math.sin(phase) * vol * Math.exp(-6 * (t / dur)) * Math.min(1, t / 0.005);
  }
  return samples;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A5 = 880, D6 = 1174.66;

const sounds = {
  pop: sweep(380, 900, 0.12, 0.6),
  tap: render([[660, 0, 0.06, 0.35, 'soft']], 0.08),
  spark: render([[E5, 0, 0.18, 0.4, 'bell'], [A5, 0.07, 0.25, 0.35, 'bell']], 0.35),
  chime: render([[G5, 0, 0.35, 0.4, 'bell'], [C6, 0.12, 0.5, 0.35, 'bell']], 0.65),
  hatch: render(
    [
      [C5, 0, 0.2, 0.4, 'bell'],
      [E5, 0.12, 0.2, 0.4, 'bell'],
      [G5, 0.24, 0.2, 0.4, 'bell'],
      [C6, 0.36, 0.6, 0.45, 'bell'],
      [E5, 0.36, 0.6, 0.2, 'soft'],
    ],
    1.0,
  ),
  coin: render([[1318.5, 0, 0.08, 0.35, 'bell'], [1760, 0.07, 0.3, 0.35, 'bell']], 0.4),
  fanfare: render(
    [
      [G5, 0, 0.15, 0.4, 'bell'],
      [G5, 0.16, 0.15, 0.4, 'bell'],
      [C6, 0.32, 0.25, 0.4, 'bell'],
      [D6, 0.55, 0.15, 0.35, 'bell'],
      [C6, 0.7, 0.7, 0.45, 'bell'],
    ],
    1.4,
  ),
};

mkdirSync(outDir, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(outDir, `${name}.wav`), toWav(samples));
}
console.log(`Wrote ${Object.keys(sounds).length} sounds to ${outDir}`);
