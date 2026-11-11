#!/usr/bin/env node
// A voice sheet: the same eight-bar phrase played alone by each pitched voice, with nothing else sounding, so a listener
// can judge one instrument at a time. The ear's measures cannot say whether a voice convinces; this is how a person does.
//   node system/site-music/tools/voicesheet.mjs --out DIR
// Writes one 16-bit WAV per voice (no room, no sea, no mastering beyond a fixed peak level). Nothing is played.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { blownPhrase } from '../blown.js';
import { LEADS } from '../render.js';
import { bassGuitar } from '../bassguitar.js';
import { tine, softBass, TINE } from '../voices.js';
import { wavBytes } from './render.mjs';

const SR = 48000, BEAT = 60 / 90, arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// eight bars in D dorian at 90 beats a minute: [beats, MIDI pitch (0 is a rest), strength]
export const PHRASE = [[1.5, 62, 0.6], [0.5, 65, 0.55], [2, 69, 0.7], [1, 67, 0.6], [1, 65, 0.55], [2, 64, 0.6], [0.5, 62, 0.5], [0.5, 64, 0.55], [1, 65, 0.6], [2, 69, 0.72], [3, 72, 0.8], [1, 0, 0],
  [1.5, 69, 0.7], [0.5, 67, 0.6], [1, 65, 0.6], [1, 64, 0.55], [2, 65, 0.6], [2, 62, 0.5], [1, 64, 0.55], [1, 67, 0.62], [1, 69, 0.7], [1, 72, 0.78], [4, 62, 0.6]];
const timed = (shift) => { let t = 0; const out = []; for (const [b, m, v] of PHRASE) { if (m) out.push({ t: t * BEAT, dur: b * BEAT * 0.94, m: m + shift, vel: v }); t += b; } return out; };
const mixNotes = (notes, play) => { const x = new Float32Array(Math.round((32 * BEAT + 2) * SR)); notes.forEach((n, i) => { const y = play(n, i), at = Math.round((0.3 + n.t) * SR); for (let k = 0; k < y.length && at + k < x.length; k++) x[at + k] += y[k]; }); return x; };
const blownSheet = (kind, shift, preset = {}) => { const notes = timed(shift).map((n, i, a) => ({ ...n, slur: i > 0 && Math.abs(n.m - a[i - 1].m) <= 2 && n.t - (a[i - 1].t + a[i - 1].dur) < 0.1 })), r = blownPhrase(notes, LEADS[kind].table, { ...LEADS[kind].base, ...preset }, SR, 7), x = new Float32Array(Math.round((32 * BEAT + 2) * SR)); x.set(r.x.subarray(0, Math.min(r.x.length, x.length))); return x; };

export const SHEETS = {
  saxophone: () => blownSheet('sax', 0), flute: () => blownSheet('flute', 12, { vibrato: 0.01, scoop: 0.3 }), clarinet: () => blownSheet('reed', 0, { vibrato: 0.006, scoop: 0.4 }),
  'electric-piano': () => mixNotes(timed(0), (n) => tine(n.m, n.vel, n.dur, TINE, SR, 1)),
  'upright-bass': () => mixNotes(timed(-24), (n, i) => softBass(n.m, n.vel, n.dur, SR, 1 + i)),
  'bass-guitar': () => mixNotes(timed(-24), (n, i) => bassGuitar(n.m, n.vel, n.dur, {}, SR, 1 + i)),
};

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/voicesheet.mjs')) {
  const out = arg('--out', null); if (!out) { console.error('pass --out DIR'); process.exit(2); } mkdirSync(out, { recursive: true });
  for (const [name, make] of Object.entries(SHEETS)) { const x = make(); let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); const g = 0.5 / (pk || 1); for (let i = 0; i < x.length; i++) x[i] *= g;
    writeFileSync(path.join(out, `voice-${name}.wav`), wavBytes([x, x], SR)); console.log(`voice-${name}.wav`, (x.length / SR).toFixed(1), 's'); }
}
