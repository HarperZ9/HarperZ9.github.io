#!/usr/bin/env node
// Fit the voices' measured layer to reference recordings of real instruments.
//   node system/site-music/tools/fit.mjs NOTES_DIR
// NOTES_DIR is the folder of single reference notes that system/ear/tools/identity.mjs also reads. For every reference
// note this measures, with the ear's own analysis (system/ear/timbre.js):
//   db    the level of each harmonic in dB relative to all harmonics together. For a blown instrument it is the mean
//         over the sounding note; for a plucked string it is the level at the pluck
//   dec   plucked strings only: how fast each harmonic dies away, in dB per second
//   sh    blown instruments only: how much each harmonic's level wanders while the note sounds, in dB
//   nb    the noise between the harmonics in seven bands (breath, finger, hiss), in dB relative to the harmonics
//   B     the string's inharmonicity
// and writes them to ../measured-data.js as one table per voice, with the source and licence of each. A table holds
// numbers measured from recordings; it holds no audio. Only sources whose licence allows derived works are fitted.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyse } from '../../ear/timbre.js';
import { loadIndex, readNote, SOURCES } from '../../ear/tools/identity.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), half = (v) => Math.round(v * 2) / 2, mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
// which reference notes each voice is fitted to. The other sources of the same instrument are held back, so the judge can
// be asked about a fitted voice with the recordings it was fitted to left out.
export const PLAN = {
  sax: { cls: 'sax', source: ['iowa'], sub: ['alto'], kind: 'blown', domain: 'frequency', K: 32 },
  flute: { cls: 'flute', source: ['iowa'], sub: [''], kind: 'blown', domain: 'frequency', K: 24 },
  clarinet: { cls: 'clarinet', source: ['iowa'], sub: [''], kind: 'blown', domain: 'frequency', K: 32 },
  bassguitar: { cls: 'bassguitar', source: ['bbb-darkblack'], sub: ['finger'], kind: 'plucked', domain: 'harmonic', K: 64 },
  bassmuted: { cls: 'bassguitar-muted', source: ['bbb-darkblack'], sub: ['ghost'], kind: 'plucked', domain: 'harmonic', K: 40 },
  epiano: { cls: 'epiano', source: ['gm-rhodes'], sub: ['tine'], kind: 'plucked', domain: 'harmonic', K: 40 },
  upright: { cls: 'upright', source: ['iowa'], sub: ['pizz'], kind: 'plucked', domain: 'frequency', K: 48 },
};

function fitNote(x, r, plan) {
  const a = analyse(x, r.sr, { m: r.m, span: plan.kind === 'plucked' ? 2.5 : 1.2 }); if (!a) return null;
  const K = Math.min(plan.K, a.K), J = a.tracks.length, out = { m: Math.round(a.m * 100) / 100, B: Math.round(a.B * 1e6) / 1e6, lvl: half(a.levelDb), nb: a.noiseBands.map(half) };
  if (plan.kind === 'blown') { out.db = a.harmDb.slice(0, K).map(half);
    out.sh = Array.from({ length: K }, (_, k) => { const v = []; for (let j = a.bodyFrame; j < J; j++) v.push(10 * Math.log10(a.tracks[j][k] + 1e-20)); const mu = mean(v); return Math.min(4, half(Math.sqrt(mean(v.map((q) => (q - mu) ** 2))))); }); return out; }
  // a plucked string: each harmonic's level falls on a line in dB. Fit the line from the frame where the harmonic peaks
  // to where it meets the floor (60 dB under the strongest harmonic's peak); the line's value at the pluck is the level.
  let top = 0; for (const fr of a.tracks) for (let k = 0; k < K; k++) top = Math.max(top, fr[k]); const floor = top * 1e-6, db0 = [], dec = [];
  for (let k = 0; k < K; k++) { let pj = 0; for (let j = 0; j < J; j++) if (a.tracks[j][k] > a.tracks[pj][k]) pj = j; const ts = [], ys = [];
    for (let j = Math.max(pj, 4); j < J && a.tracks[j][k] > floor; j++) { ts.push(j * a.hopSec); ys.push(10 * Math.log10(a.tracks[j][k])); }
    if (ts.length < 6) { db0.push(10 * Math.log10(a.tracks[pj][k] + 1e-20)); dec.push(null); continue; }
    const mx = mean(ts), my = mean(ys), s = ts.reduce((q, t, i) => q + (t - mx) * (ys[i] - my), 0) / ts.reduce((q, t) => q + (t - mx) ** 2, 0), slope = Math.min(-0.5, Math.max(-300, s));
    db0.push(Math.min(10 * Math.log10(a.tracks[pj][k]) + 3, my - slope * mx)); dec.push(-slope); }
  const known = dec.filter((v) => v !== null), fill = known.length ? Math.max(...known) : 40; const total = db0.reduce((s, v) => s + Math.pow(10, v / 10), 0);
  out.db = db0.map((v) => Math.max(-90, half(v - 10 * Math.log10(total)))); out.dec = dec.map((v) => half(v === null ? fill : v)); return out;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/fit.mjs')) {
  const dir = process.argv[2], index = loadIndex(dir), tables = {};
  for (const [name, plan] of Object.entries(PLAN)) {
    const notes = index.filter((r) => r.ship && r.class === plan.cls && plan.source.includes(r.source) && plan.sub.includes(r.sub)), layers = new Map();
    for (const r of notes) { const f = fitNote(readNote(dir, r), r, plan); if (!f) continue; if (!layers.has(r.vel)) layers.set(r.vel, []); layers.get(r.vel).push(f); }
    const src = SOURCES[plan.source[0]]; tables[name] = { instrument: plan.cls, kind: plan.kind, domain: plan.domain, source: src.name, url: src.url, licence: src.licence, layers: [...layers.entries()].sort((a, b) => a[0] - b[0]).map(([vel, list]) => ({ vel, notes: list.sort((a, b) => a.m - b.m) })) };
    console.log(name.padEnd(11), 'from', plan.source.join('+'), '|', tables[name].layers.map((l) => `strength ${l.vel}: ${l.notes.length} notes, MIDI ${l.notes[0].m.toFixed(0)} to ${l.notes[l.notes.length - 1].m.toFixed(0)}`).join(' | '));
  }
  const head = `// measured-data.js: numbers measured from recordings of real instruments, one table per voice. Written by tools/fit.mjs;\n// do not edit by hand. A table holds harmonic levels, decay rates and noise levels per reference note. It holds no audio.\n// Sources and licences are named in each table. See tools/fit.mjs for what each field means.\n`;
  writeFileSync(path.join(HERE, '..', 'measured-data.js'), `${head}export const TABLES = ${JSON.stringify(tables).replace(/\{"vel"/g, '\n{"vel"').replace(/\{"m"/g, '\n{"m"')};\n`);
}
