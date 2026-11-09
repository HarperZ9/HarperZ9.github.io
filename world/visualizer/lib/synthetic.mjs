// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// synthetic.mjs: test signals with known tempo, meter and downbeats, for checking the front end.
//   pattern({ bpm, beatsPerBar, bars, rate, style, seed, accent, harmony, noise, swing, jitterMs, startS })
//     -> { audio, truth: { bpm, beatsPerBar, beats, downbeats } }
// Styles: 'waltz' (bass on 1, chord on 2 and 3), 'march' (bass on 1 and 3, chord on 2 and 4), 'pulse' (the same
// chord tone on every beat). accent: share of extra level on the downbeat (0 makes every beat equally loud).
// harmony: true changes the chord each bar (a harmonic-rhythm cue); false holds one chord.
// jitterMs: Gaussian timing jitter (human playing). All randomness is seeded.

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const CHORDS = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];   // C, Am, F, G (MIDI), one per bar
const hz = m => 440 * 2 ** ((m - 69) / 12);

export function pattern({ bpm = 120, beatsPerBar = 4, bars = 16, rate = 48000, style = null, seed = 1, accent = 0.6, harmony = true, noise = 0.003, swing = 0, jitterMs = 0, startS = 0.5 } = {}) {
  const r = mulberry(seed), P = 60 / bpm, dur = startS + bars * beatsPerBar * P + 1.5, n = Math.round(dur * rate);
  const x = new Float32Array(n), beats = [], downbeats = [];
  style ??= beatsPerBar === 3 ? 'waltz' : 'march';
  const add = (t0, fn, len) => { const a = Math.max(0, Math.round(t0 * rate)), L = Math.round(len * rate); for (let i = 0; i < L && a + i < n; i++) x[a + i] += fn(i / rate); };
  const bass = (f, g) => t => g * Math.sin(2 * Math.PI * (f * t + 40 * (1 - Math.exp(-t * 30)) / 30)) * Math.exp(-t * 7);
  const tone = (fs, g) => t => g * fs.reduce((s, f, k) => s + Math.sin(2 * Math.PI * f * t + k) * (1 / (1 + k * 0.3)), 0) / fs.length * Math.exp(-t * 4) * (1 - Math.exp(-t * 400));
  const tick = g => t => g * (r() * 2 - 1) * Math.exp(-t * 90);
  for (let b = 0; b < bars; b++) {
    const ch = harmony ? CHORDS[b % CHORDS.length] : CHORDS[0];
    for (let k = 0; k < beatsPerBar; k++) {
      const t = startS + (b * beatsPerBar + k) * P + (jitterMs ? gauss(r) * jitterMs / 1000 : 0);
      beats.push(t); if (k === 0) downbeats.push(t);
      const g = 0.35 * (k === 0 ? 1 + accent : 1);
      const isBass = style === 'waltz' ? k === 0 : style === 'march' ? k % 2 === 0 : false;
      if (style === 'pulse') add(t, tone(ch.map(hz), g), P * 0.95);
      else if (isBass) add(t, bass(hz(ch[0] - 12), g * 1.4), P * 0.95);
      else add(t, tone(ch.slice(1).map(hz), g * 0.8), P * 0.95);
      add(t + (k % 2 ? swing * P * 0.5 : 0) + P / 2, tick(0.05), 0.06);
      add(t, tick(0.08), 0.05);
    }
  }
  for (let i = 0; i < n; i++) x[i] += noise * (r() * 2 - 1);
  return { audio: { rate, channels: [x] }, truth: { bpm, beatsPerBar, beats, downbeats } };
}

// A series with known structure for the data front end: a cycle of `period` samples, a trend, and step changes.
export function series({ n = 120, period = 12, steps = [40, 85], stepSize = 3, seed = 3 } = {}) {
  const r = mulberry(seed);
  return Float64Array.from({ length: n }, (_, i) => 10 + 0.05 * i + 2 * Math.sin(2 * Math.PI * i / period) + steps.reduce((s, k) => s + (i >= k ? stepSize : 0), 0) + 0.3 * gauss(r));
}
