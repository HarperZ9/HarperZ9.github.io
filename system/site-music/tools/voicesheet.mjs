#!/usr/bin/env node
// A voice sheet: the same eight-bar phrase played alone by each pitched voice and each variant (variants.js), with
// nothing else sounding, so a listener can judge one instrument at a time. The ear's measures cannot say whether a voice
// convinces; this is how a person does. Pads play the phrase's chords; the arpeggio plays over them.
//   node system/site-music/tools/voicesheet.mjs --out DIR [--only PREFIX]
// Writes one 16-bit WAV per voice (no room, no sea, no mastering beyond a fixed peak level). Nothing is played.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LEADS, leadPhrase, KEYS, BASSES, PADVOICES, ARPS, PAD_PRESET, TINE } from '../variants.js';
import { compose } from '../score.js';
import { renderBars } from '../render.js';
import { PIECES } from '../pieces.js';
import { wavBytes } from './render.mjs';

const SR = 48000, BEAT = 60 / 90, LEN = Math.round((32 * BEAT + 3) * SR), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// eight bars in D dorian at 90 beats a minute: [beats, MIDI pitch (0 is a rest), strength]
export const PHRASE = [[1.5, 62, 0.6], [0.5, 65, 0.55], [2, 69, 0.7], [1, 67, 0.6], [1, 65, 0.55], [2, 64, 0.6], [0.5, 62, 0.5], [0.5, 64, 0.55], [1, 65, 0.6], [2, 69, 0.72], [3, 72, 0.8], [1, 0, 0],
  [1.5, 69, 0.7], [0.5, 67, 0.6], [1, 65, 0.6], [1, 64, 0.55], [2, 65, 0.6], [2, 62, 0.5], [1, 64, 0.55], [1, 67, 0.62], [1, 69, 0.7], [1, 72, 0.78], [4, 62, 0.6]];
const CHORDS = [[50, 53, 57, 60, 64], [55, 59, 62, 64, 65], [50, 53, 57, 60, 64], [55, 59, 62, 64, 69], [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60, 64], [55, 59, 62, 65, 69]];   // Dm9, G13 ... a bar each, held two bars as pads
const timed = (shift) => { let t = 0; const out = []; for (const [b, m, v] of PHRASE) { if (m) out.push({ t: t * BEAT, dur: b * BEAT * 0.94, m: m + shift, vel: v }); t += b; } return out; };
const mono = (notes, play) => { const x = new Float32Array(LEN); notes.forEach((n, i) => { const y = play(n, i), at = Math.round((0.3 + n.t) * SR); for (let k = 0; k < y.length && at + k < x.length; k++) x[at + k] += y[k]; }); return [x, x]; };
const lead = (kind, shift = 0, preset = {}) => { const notes = timed(shift).map((n, i, a) => ({ ...n, slur: i > 0 && Math.abs(n.m - a[i - 1].m) <= 2 && n.t - (a[i - 1].t + a[i - 1].dur) < 0.1 })), r = leadPhrase(kind, notes, preset, SR, 7), x = new Float32Array(LEN); x.set(r.x.subarray(0, Math.min(r.x.length, LEN))); return [x, x]; };
const pad = (name) => { const L = new Float32Array(LEN), R = new Float32Array(LEN); for (let c = 0; c < 4; c++) { const p = PADVOICES[name].play(CHORDS[2 * c].slice(0, 4), 0.5, 8 * BEAT, { ...PAD_PRESET }, SR, 11 + c), at = Math.round((0.3 + c * 8 * BEAT) * SR); for (let i = 0; i < p.L.length && at + i < LEN; i++) { L[at + i] += p.L[i]; R[at + i] += p.R[i]; } } return [L, R]; };
const arp = (name) => mono(CHORDS.flatMap((ch, b) => Array.from({ length: 16 }, (_, k) => ({ t: (b * 4 + k / 4) * BEAT, dur: BEAT / 4 * 0.9, m: [...ch, ...ch.map((m) => m + 12)][k % (2 * ch.length)], vel: k % 4 ? 0.45 : 0.62 }))), (n) => ARPS[name].play(n.m, n.vel, n.dur, SR));
// the upright as a player walks it: sixteen bars of Low Tide's bass line, the bass alone
const walk = () => { const P = PIECES['low-tide'], sc = compose('low-tide', { seed: 1, bars: 22 }), r = renderBars(sc.bars.slice(6), P, { sr: SR, seed: 1 }), s = r.stems.bass; return [s.L.slice(0, Math.min(s.L.length, r.pre + r.n + SR)), s.R.slice(0, Math.min(s.R.length, r.pre + r.n + SR))]; };

const LEAD_SHIFT = { flute: 12, 'flute-plain': 12, 'flute-breathy': 12, altoflute: 12, shakuhachi: 12, soprano: 0, baritone: 0 };
export const SHEETS = {};
for (const k of Object.keys(LEADS)) SHEETS[`lead-${k}`] = () => lead(k, LEAD_SHIFT[k] ?? 0);
for (const k of Object.keys(KEYS)) SHEETS[`keys-${k}`] = () => mono(timed(0), (n) => KEYS[k].play(n.m, n.vel, n.dur, TINE, SR));
for (const k of Object.keys(BASSES)) SHEETS[`bass-${k}`] = () => mono(timed(-24), (n, i) => BASSES[k].play(n.m, n.vel, n.dur, { style: 'finger' }, SR, 1 + i));
for (const k of Object.keys(PADVOICES)) SHEETS[`pad-${k}`] = () => pad(k);
for (const k of Object.keys(ARPS)) SHEETS[`arp-${k}`] = () => arp(k);
SHEETS['bass-upright-walk'] = walk;

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/voicesheet.mjs')) {
  const out = arg('--out', null), only = arg('--only', ''); if (!out) { console.error('pass --out DIR'); process.exit(2); } mkdirSync(out, { recursive: true });
  for (const [name, make] of Object.entries(SHEETS)) { if (!name.startsWith(only)) continue; const [L, R] = make(); let pk = 0; for (const c of [L, R]) for (const v of c) pk = Math.max(pk, Math.abs(v)); const g = 0.5 / (pk || 1), a = Float32Array.from(L, (v) => v * g), b = L === R ? a : Float32Array.from(R, (v) => v * g);
    writeFileSync(path.join(out, `voice-${name}.wav`), wavBytes([a, b], SR)); console.log(`voice-${name}.wav`, (a.length / SR).toFixed(1), 's'); }
}
