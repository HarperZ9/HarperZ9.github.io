#!/usr/bin/env node
// Fit the voices' measured layer to reference recordings of real instruments.
//   node system/site-music/tools/fit.mjs NOTES_DIR                         write ../measured-data.js (every table in PLAN)
//   node system/site-music/tools/fit.mjs NOTES_DIR --only NAME --sources a,b --out FILE.json
//                                                                          one table from chosen sources (cross-checks)
// NOTES_DIR is the folder of single reference notes that system/ear/tools/identity.mjs also reads. For every reference
// note this measures, with the ear's own analysis (system/ear/timbre.js, system/ear/pluck.js):
//   db    the level of each harmonic in dB relative to all harmonics together. For a blown instrument it is the mean
//         over the sounding note; for a plucked or struck one it is the level at the pluck
//   dec   plucked and struck only: how fast each harmonic dies away, in dB per second (a line from its peak to the floor)
//   dec0  the same over the first 150 ms (a plucked string sheds its upper harmonics fastest at first)
//   ex    the pluck or strike itself: power in seven octave bands in the first 30 ms above what each band's later decay
//         predicts, in dB against the note 60 to 100 ms in; exT how fast that excess dies, in seconds
//   sh    blown only: how much each harmonic's level wanders while the note sounds, in dB
//   nb    the noise between the harmonics in seven bands (breath, bow, finger, hiss), in dB relative to the harmonics
//   B     the string's inharmonicity
// and writes them to ../measured-data.js as one table per voice, with the source and licence of each. A table fitted
// to more than one source is the mean of the sources, each read at the same pitches and strengths. A table holds
// numbers measured from recordings; it holds no audio. Only sources whose licence allows derived works are fitted.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyse } from '../../ear/timbre.js';
import { excess, twoStage } from '../../ear/pluck.js';
import { loadIndex, readNote, SOURCES } from '../../ear/tools/identity.mjs';
import { around, harmonicsAt } from '../measured.js';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), half = (v) => Math.round(v * 2) / 2, mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// which reference notes each voice is fitted to. The other sources of the same instrument are held back, so a fitted
// voice can be judged against recordings it was not fitted to.
export const PLAN = {
  sax: { cls: 'sax', source: ['iowa'], sub: ['alto'], kind: 'blown', domain: 'frequency', K: 32 },
  saxtenor: { cls: 'sax', source: ['vcsl'], sub: ['tenor'], kind: 'blown', domain: 'frequency', K: 32 },
  saxsoprano: { cls: 'sax', source: ['iowa'], sub: ['soprano'], kind: 'blown', domain: 'frequency', K: 32 },
  saxbaritone: { cls: 'sax', source: ['bear'], sub: ['baritone'], kind: 'blown', domain: 'frequency', K: 40 },
  flute: { cls: 'flute', source: ['iowa'], sub: [''], kind: 'blown', domain: 'frequency', K: 24 },
  altoflute: { cls: 'altoflute', source: ['iowa'], sub: [''], kind: 'blown', domain: 'frequency', K: 24 },
  clarinet: { cls: 'clarinet', source: ['iowa'], sub: [''], kind: 'blown', domain: 'frequency', K: 32 },
  trumpet: { cls: 'trumpet', source: ['iowa'], sub: [''], kind: 'blown', domain: 'frequency', K: 32 },
  uprightarco: { cls: 'uprightarco', source: ['iowa'], sub: ['arco'], kind: 'blown', domain: 'frequency', K: 40 },
  bassguitar: { cls: 'bassguitar', source: ['bbb-darkblack', 'bbb-babyblue'], sub: ['finger'], kind: 'plucked', domain: 'harmonic', K: 64 },
  bassmuted: { cls: 'bassguitar-muted', source: ['bbb-darkblack'], sub: ['ghost'], kind: 'plucked', domain: 'harmonic', K: 40 },
  basspicked: { cls: 'basspicked', source: ['pasta'], sub: ['linguine'], kind: 'plucked', domain: 'harmonic', K: 64 },
  epiano: { cls: 'epiano', source: ['gm-rhodes'], sub: ['tine'], kind: 'plucked', domain: 'harmonic', K: 40 },
  epianoreed: { cls: 'epiano-reed', source: ['wurli'], sub: ['wurlitzer'], kind: 'plucked', domain: 'harmonic', K: 40 },
  epianofm: { cls: 'epiano-fm', source: ['vcsl-tx81z'], sub: ['tx81z'], kind: 'plucked', domain: 'harmonic', K: 40 },
  upright: { cls: 'upright', source: ['iowa', 'meatbass'], sub: ['pizz'], prefix: true, kind: 'plucked', domain: 'frequency', K: 48 },
  piano: { cls: 'piano', source: ['iowa'], sub: [''], kind: 'plucked', domain: 'harmonic', K: 48 },
  vibraphone: { cls: 'vibraphone', source: ['vcsl'], sub: ['soft', 'hard'], kind: 'plucked', domain: 'harmonic', K: 24 },
};
// sources added in round five, beside the ones the identity tool names
export const MORE = {
  sneaky: { name: 'Karoryfer Samples, Sneakybass (double bass)', url: 'https://github.com/sfzinstruments/karoryfer.sneakybass', licence: 'CC0 1.0' },
  dsmolken: { name: "D. Smolken's double bass", url: 'https://github.com/sfzinstruments/dsmolken.double-bass', licence: 'CC0 1.0' },
  vcsl: { name: 'Versilian Community Sample Library (VCSL): Tenor Saxophone; Vibraphone', url: 'https://github.com/sgossner/VCSL', licence: 'CC0 1.0' },
  'vcsl-tx81z': { name: 'Versilian Community Sample Library, TX81Z FM Piano (sampled from a Yamaha TX81Z)', url: 'https://github.com/sgossner/VCSL', licence: 'CC0 1.0' },
  'vcsl-steinway': { name: 'Versilian Community Sample Library, Grand Piano Steinway B', url: 'https://github.com/sgossner/VCSL', licence: 'CC0 1.0' },
  'vcsl-yamaha': { name: 'Versilian Community Sample Library, Upright Piano Yamaha', url: 'https://github.com/sgossner/VCSL', licence: 'CC0 1.0' },
  wurli: { name: "Greg Sullivan's E-Pianos, Wurlitzer EP200 (samples by Greg Sullivan)", url: 'https://github.com/sfzinstruments/GregSullivan.E-Pianos', licence: 'CC BY 3.0 (attribution: Wurlitzer EP200 samples by Greg Sullivan, sfz mapping by kinwie)' },
  bear: { name: 'Karoryfer Samples, Bear Sax (a 1926 Conn baritone saxophone)', url: 'https://github.com/sfzinstruments/karoryfer.bear-sax', licence: 'CC0 1.0' },
  pasta: { name: 'Karoryfer Samples, Pastabass (a Squier Bass VI, picked, flatwound strings)', url: 'https://github.com/sfzinstruments/karoryfer.pastabass', licence: 'CC0 1.0' },
};
const SRC = { ...SOURCES, ...MORE };

export function fitNote(x, r, plan) {
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
  const two = twoStage(a, K);
  // with an early rate measured, the level at the pluck is the harmonic's own peak, not the later line drawn back to it
  for (let k = 0; k < K; k++) if (two.early[k] !== null) { let pv = 0; for (let j = 0; j < Math.min(J, 6); j++) pv = Math.max(pv, a.tracks[j][k]); db0[k] = 10 * Math.log10(pv + 1e-20); }
  const known = dec.filter((v) => v !== null), fill = known.length ? Math.max(...known) : 40; const total = db0.reduce((s, v) => s + Math.pow(10, v / 10), 0);
  out.db = db0.map((v) => Math.max(-90, half(v - 10 * Math.log10(total)))); out.dec = dec.map((v) => half(v === null ? fill : v));
  out.dec0 = two.early.map((v, k) => half(v === null ? out.dec[k] : Math.max(v, out.dec[k])));
  const e = excess(x, r.sr); out.ex = e ? e.db.map(half) : Array(7).fill(-80); out.exT = e ? Math.round(e.tau * 1000) / 1000 : 0.01;
  return out;
}

function fitSource(dir, index, plan, source) {
  const notes = index.filter((r) => r.ship && r.class === plan.cls && r.source === source && plan.sub.some((s) => r.sub === s || (plan.prefix && r.sub.startsWith(s)))), layers = new Map();
  for (const r of notes) { const f = fitNote(readNote(dir, r), r, plan); if (!f) continue; if (!layers.has(r.vel)) layers.set(r.vel, []); layers.get(r.vel).push(f); }
  return { domain: plan.domain, kind: plan.kind, layers: [...layers.entries()].sort((a, b) => a[0] - b[0]).map(([vel, list]) => ({ vel, notes: list.sort((a, b) => a.m - b.m) })) };
}
// Several sources: each read at the same grid of pitches (every two semitones over its own range) and strengths, then
// averaged where they overlap, so neighbouring notes do not jump from one instrument to another.
function merge(tables, plan) {
  const vels = [0.2, 0.6, 0.95], K = plan.K, ms = (t) => t.layers.flatMap((l) => l.notes.map((n) => n.m)), lo = Math.min(...tables.map((t) => Math.min(...ms(t)))), hi = Math.max(...tables.map((t) => Math.max(...ms(t))));
  const keys = plan.kind === 'plucked' ? ['dec', 'dec0'] : ['sh'], layers = vels.map((vel) => ({ vel, notes: [] }));
  for (let m = Math.ceil(lo); m <= Math.floor(hi); m += 2) for (const L of layers) {
    const parts = tables.filter((t) => Math.min(...ms(t)) - 1 <= m && m <= Math.max(...ms(t)) + 1); if (!parts.length) continue;
    const one = parts.map((t) => { const near = around(t, m, L.vel), o = { db: Array.from(harmonicsAt(t, m, L.vel, K, new Float32Array(K), 'db', near)) };
      for (const k of keys) o[k] = Array.from(harmonicsAt(t, m, L.vel, K, new Float32Array(K), k, near));
      for (const k of ['nb', 'ex']) if (near[0].note[k]) o[k] = near[0].note[k].map((_, b) => near.reduce((s, { note, w }) => s + w * note[k][b], 0));
      for (const k of ['B', 'lvl', 'exT']) if (near[0].note[k] !== undefined) o[k] = near.reduce((s, { note, w }) => s + w * note[k], 0); return o; });
    const avg = (k) => (Array.isArray(one[0][k]) ? one[0][k].map((_, i) => half(mean(one.map((o) => o[k][i])))) : Math.round(mean(one.map((o) => o[k])) * 1e6) / 1e6), n = { m };
    for (const k of Object.keys(one[0])) n[k] = avg(k); L.notes.push(n);
  }
  return { domain: plan.domain, kind: plan.kind, layers };
}
export function fitTable(dir, index, name, plan, sources = plan.source) {
  const per = sources.map((s) => fitSource(dir, index, plan, s)).filter((t) => t.layers.length); if (!per.length) return null;
  const t = per.length > 1 ? merge(per, plan) : per[0], src = sources.map((s) => SRC[s]);
  return { instrument: plan.cls, ...t, source: src.map((s) => s.name).join(' + '), url: [...new Set(src.map((s) => s.url))].join(' '), licence: [...new Set(src.map((s) => s.licence))].join('; ') };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/fit.mjs')) {
  const dir = process.argv[2], index = loadIndex(dir), only = arg('--only', null);
  if (only) { const plan = PLAN[only], t = fitTable(dir, index, only, plan, (arg('--sources', '') || plan.source.join(',')).split(',')); writeFileSync(arg('--out'), JSON.stringify(t)); console.log(only, 'from', t.source, t.layers.map((l) => `${l.vel}: ${l.notes.length}`).join(' | ')); process.exit(0); }
  const tables = {};
  for (const [name, plan] of Object.entries(PLAN)) {
    const t = fitTable(dir, index, name, plan); if (!t) { console.log(name.padEnd(12), 'no notes; skipped'); continue; } tables[name] = t;
    console.log(name.padEnd(12), 'from', plan.source.join('+'), '|', t.layers.map((l) => `strength ${l.vel}: ${l.notes.length} notes, MIDI ${l.notes[0].m.toFixed(0)} to ${l.notes[l.notes.length - 1].m.toFixed(0)}`).join(' | '));
  }
  const head = `// measured-data.js: numbers measured from recordings of real instruments, one table per voice. Written by tools/fit.mjs;\n// do not edit by hand. A table holds harmonic levels, decay rates and noise levels per reference note. It holds no audio.\n// Sources and licences are named in each table. See tools/fit.mjs for what each field means.\n`;
  writeFileSync(path.join(HERE, '..', 'measured-data.js'), `${head}export const TABLES = ${JSON.stringify(tables).replace(/\{"vel"/g, '\n{"vel"').replace(/\{"m"/g, '\n{"m"')};\n`);
}
