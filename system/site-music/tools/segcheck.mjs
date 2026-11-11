#!/usr/bin/env node
// Where in a note a voice differs from real recordings. For each reference note of the class asked for, from the
// sources asked for, the voice plays the same pitch and strength; both are drawn as mel spectrograms (system/ear/
// likeness.js) over 1.5 s and compared over the whole note and per segment: attack, early, sustain, tail. Beside it the
// yardstick: each reference note against the nearest note of another source (moved to the same pitch by resampling).
//   node system/site-music/tools/segcheck.mjs NOTES_DIR --voice NAME --against SRC[,SRC] [--table FILE.json] [--json OUT]
// NAME is a key of VOICES in tools/voiceset.mjs. Bass voices are drawn from 30 Hz (others from 60 Hz), so the
// fundamental of a low string is in the picture. Medians over the notes; smaller is closer. A picture, not an ear.
import { readFileSync, writeFileSync } from 'node:fs';
import { melgram, distance, segmentDistances, flattened, SEGMENTS } from '../../ear/likeness.js';
import { readNote, loadIndex, shift } from '../../ear/tools/identity.mjs';
import { VOICES } from './voiceset.mjs';

const SR = 48000, arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const med = (a) => { const q = a.filter((z) => z !== null && Number.isFinite(z)).sort((x, y) => x - y); return q.length ? q[Math.floor(q.length / 2)] : null; };
const pad = (y) => { const x = new Float32Array(y.length + 9600); x.set(y, 4800); return x; };
const row = (gs) => ({ whole: distance(gs[0], gs[1]), flat: distance(flattened(gs[0]), flattened(gs[1])), ...segmentDistances(gs[0], gs[1]) });

export function segcheck(dir, index, voice, against, { table = null, cap = 16, seconds = 1.5 } = {}) {
  const v = VOICES[voice], mo = { seconds, fmin: v.fmin || 60 }, ok = (q) => q.class === v.cls && q.m >= (v.minM ?? 0) && !q.hold && q.ship !== false && (!v.sub || v.sub.some((s) => q.sub.startsWith(s))), refs = index.filter((r) => ok(r) && against.includes(r.source)), step = Math.max(1, Math.ceil(refs.length / cap)), ours = [], real = [];
  // the yardstick: another source of the instrument; with none, the neighbouring note of the same source (not independent)
  const others = index.filter((q) => ok(q) && !against.includes(q.source)), yard = others.length ? 'another source' : 'the neighbouring note of the same source';
  refs.forEach((r, i) => { if (i % step) return; const a = melgram(readNote(dir, r), r.sr, mo); if (!a) return;
    const y = melgram(pad(v.play(r.m, r.vel, v.dur || 1.6, i, table)), SR, mo); if (y) ours.push(row([y, a]));
    const pool = others.length ? others.filter((q) => Math.abs(q.m - r.m) <= 2.5) : refs.filter((q) => q !== r && q.vel === r.vel && Math.abs(q.m - r.m) <= 4.6), peer = pool.sort((p, q) => Math.abs(p.m - r.m) + Math.abs(p.vel - r.vel) - Math.abs(q.m - r.m) - Math.abs(q.vel - r.vel))[0];
    if (peer) { const b = melgram(shift(readNote(dir, peer), r.m - peer.m), peer.sr, mo); if (b) real.push(row([b, a])); } });
  const sum = (rows) => Object.fromEntries(['whole', 'flat', ...Object.keys(SEGMENTS)].map((k) => [k, med(rows.map((q) => q[k]))]));
  return { voice, against, notes: ours.length, ours: sum(ours), realNotes: real.length, real: sum(real), yardstick: yard };
}
export const fmt = (s) => { const f = (o) => ['whole', 'flat', ...Object.keys(SEGMENTS)].map((k) => `${k} ${o[k] === null ? 'n/a' : o[k].toFixed(1)}`).join(' | '); return `${s.voice} against ${s.against.join('+')} (${s.notes} notes)\n  ours:      ${f(s.ours)}\n  real-real: ${f(s.real)} (${s.realNotes} pairs, ${s.yardstick})`; };

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/segcheck.mjs')) {
  const dir = process.argv[2], t = arg('--table', null), s = segcheck(dir, loadIndex(dir), arg('--voice'), arg('--against').split(','), { table: t ? JSON.parse(readFileSync(t, 'utf8')) : null });
  console.log(fmt(s)); const out = arg('--json', null); if (out) writeFileSync(out, JSON.stringify(s, null, 1));
}
