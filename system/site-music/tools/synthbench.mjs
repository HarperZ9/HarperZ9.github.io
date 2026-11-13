#!/usr/bin/env node
// What the ear can say about the designed voices (variants.js marked designed and played): no recording stands behind
// them, so there is no likeness verdict. Per voice, over a fixed phrase that repeats pitches at different strengths:
//   tuning        the strongest partial of each held note against the nearest whole harmonic of the written pitch, in
//                 cents (worst note); a bell's partials are not whole harmonics, so its reading is its own inharmonicity
//   level         the note level in dB (mean), and its spread over the phrase
//   brightness    octaves of spectral centroid per 10 dB of level (system/ear/note.js): does a harder note get brighter
//   movement      spectral flux inside held notes (0 for a frozen tone)
//   copies        how alike two notes of the same pitch are as waveforms over their first 150 ms (1 is a copy)
//   node system/site-music/tools/synthbench.mjs [--json OUT]
import { writeFileSync } from 'node:fs';
import { bench, SR } from './voicebench.mjs';
import { noteStats } from '../../ear/note.js';
import { partialFrames } from '../../ear/pitch.js';
import { mtof } from '../../ear/spectrum.js';
import { LEADS, KEYS, BASSES, TINE, leadNote } from '../variants.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PHRASE = (base) => [[0, 0.6, 0.5], [3, 0.5, 0.45], [0, 0.9, 0.7], [5, 0.4, 0.75], [3, 0.6, 0.55], [0, 0.5, 0.6], [7, 1.1, 0.85], [5, 0.5, 0.5], [3, 0.6, 0.6], [0, 1.4, 0.9], [0, 0.5, 0.35], [-2, 1.6, 0.6]].map(([d, dur, v]) => [base + d, dur, v]);
function tuning(x, notes) { let worst = 0; for (const n of notes) { const a = Math.round((n.t0 + 0.12) * SR), b = Math.round(Math.min(n.t1, n.t0 + 0.5) * SR); if (b - a < 4096) continue; const pf = partialFrames(x.subarray(a, b), SR, { fmin: 25, max: 6 }).frames[0]; if (!pf || !pf.length) continue;
  const f0 = mtof(n.m), k = Math.max(1, Math.round(pf[0].f / f0)), near = 1200 * Math.log2(pf[0].f / (k * f0)); if (Math.abs(near) > Math.abs(worst)) worst = near; } return worst; }   // against the nearest whole harmonic of the written pitch
export function measure(play, base) {
  const b = bench(PHRASE(base), play, 0.15), s = noteStats(b.x, SR, b.notes), lv = s.rows.map((r) => r.levelDb), mu = lv.reduce((p, q) => p + q, 0) / Math.max(1, lv.length);
  return { tuningCents: tuning(b.x, b.notes), levelDb: mu, levelSpreadDb: Math.sqrt(lv.reduce((p, q) => p + (q - mu) ** 2, 0) / Math.max(1, lv.length)), levelSlope: s.levelSlope, flux: s.flux, repeatMean: s.repeatMean, repeatMax: s.repeatMax };
}
const designed = [];
for (const [k, L] of Object.entries(LEADS)) if (L.how !== 'measured') designed.push([`lead ${k} (${L.how})`, (m, v, d, i) => leadNote(k, m - (L.shift || 0), v, d, {}, SR, 3 + i), 62]);   // a variant that sounds in another octave or key is asked for the written pitch it will sound at
for (const [k, K] of Object.entries(KEYS)) if (K.how !== 'measured') designed.push([`keys ${k} (${K.how})`, (m, v, d, i) => K.play(m, v, d, TINE, SR, 1 + (i % 3)), 60]);   // as the renderer plays chord notes: three variants per note
for (const [k, B] of Object.entries(BASSES)) if (B.how !== 'measured') designed.push([`bass ${k} (${B.how})`, (m, v, d, i) => B.play(m, v, d, { style: 'finger' }, SR, 1 + i), 38]);

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/synthbench.mjs')) {
  const f = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? 'n/a' : v.toFixed(d)), out = [];
  for (const [name, play, base] of designed) { const r = measure(play, base); out.push({ name, ...r });
    console.log(`${name.padEnd(30)} tuning worst ${f(r.tuningCents, 1)} c | level ${f(r.levelDb, 1)} dB (spread ${f(r.levelSpreadDb, 1)}) | brightness ${f(r.levelSlope)} oct/10 dB | movement ${f(r.flux, 4)} | copies mean ${f(r.repeatMean, 3)}, max ${f(r.repeatMax, 3)}`); }
  const o = arg('--json', null); if (o) writeFileSync(o, JSON.stringify(out, null, 1));
}
