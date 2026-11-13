#!/usr/bin/env node
// Point the ear at any 16-bit PCM WAV file and print its report.
//   node system/ear/tools/listen.mjs FILE.wav [--bpm N] [--lead-in SECONDS] [--phrase BARS] [--offset BARS] [--json]
// With --bpm the ear also lays a bar grid over the file (four beats to the bar, starting after the lead-in), which is
// what the repetition measure needs. Without a score it cannot compare chords, and it reads timing from the whole mix.
import { readFileSync } from 'node:fs';
import { listen, summary } from '../index.js';

export function readWav(file) {
  const b = readFileSync(file), v = new DataView(b.buffer, b.byteOffset, b.byteLength); let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) { const id = b.toString('latin1', o, o + 4), size = v.getUint32(o + 4, true); if (id === 'fmt ') fmt = { channels: v.getUint16(o + 10, true), sr: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) }; if (id === 'data') { data = { at: o + 8, size }; break; } o += 8 + size + (size & 1); }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('expected a 16-bit PCM WAV file');
  const n = Math.floor(data.size / 2 / fmt.channels), channels = Array.from({ length: fmt.channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.channels; c++) channels[c][i] = v.getInt16(data.at + (i * fmt.channels + c) * 2, true) / 32768;
  return { channels, sr: fmt.sr };
}

// A plain bar grid for a file with a known tempo: [{ t0, t1, bar }].
export function barGrid(seconds, bpm, leadIn = 0, beats = 4) { const bar = beats * 60 / bpm, out = []; for (let i = 0; leadIn + (i + 1) * bar <= seconds; i++) out.push({ bar: i, t0: leadIn + i * bar, t1: leadIn + (i + 1) * bar }); return out; }

if (process.argv[2] && !process.argv[2].startsWith('--')) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; }, audio = readWav(process.argv[2]), bpm = +arg('--bpm', 0);
  const score = bpm ? { bpm, bars: barGrid(audio.channels[0].length / audio.sr, bpm, +arg('--lead-in', 0)), phraseBars: +arg('--phrase', 8), phraseOffset: +arg('--offset', 0) } : null;
  const r = listen(audio, { score });
  console.log(process.argv.includes('--json') ? JSON.stringify({ level: { ...r.level, momentary: undefined, shortTerm: undefined }, balance: r.balance, entries: { maxRiseDb: r.entries.maxRiseDb, at: r.entries.at }, repetition: r.repetition && { ...r.repetition, pairs: undefined }, low: r.low, flags: r.flags }) : summary(r));
}
