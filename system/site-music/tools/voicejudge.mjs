#!/usr/bin/env node
// What is each of our voices heard as. Single notes of every pitched voice, over the range and strengths the pieces use,
// are put to the ear's identity judge (system/ear/identity.js), whose ground truth is notes recorded from real instruments.
//   node system/site-music/tools/voicejudge.mjs [--book FILE] [--json OUT] [--hold SOURCE,SOURCE]
// --hold leaves whole reference sources out of the judge: used to hold back the recordings a voice was fitted to.
// The judge measures likeness on a list of features. A listener decides whether a voice convinces.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyse } from '../../ear/timbre.js';
import { judge, scoreAs } from '../../ear/identity.js';
import { tone, shift, readNote, loadIndex } from '../../ear/tools/identity.mjs';
import { melgram, distance as mdist } from '../../ear/likeness.js';
import { PIECES } from '../pieces.js';

const SR = 48000, HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const pad = (y) => { const x = new Float32Array(y.length + 9600); x.set(y, 4800); return x; }, range = (a, b, step = 3) => { const o = []; for (let m = a; m <= b; m += step) o.push(m); return o; };

// Every pitched voice the pieces use: the class it claims, the notes to try, and how to play one.
export async function voices() {
  const { sax } = await import('../sax.js'), { bassGuitar } = await import('../bassguitar.js'), { tine, softBass, TINE } = await import('../voices.js'), R = await import('../render.js'), out = [];
  for (const [id, P] of Object.entries(PIECES)) {
    const [lo, hi] = P.lead.range, kind = P.band.lead, play = R.leadNote ? (m, v, d, i) => R.leadNote(kind, m, v, d, P.lead.preset, SR, 3 + i) : null;
    out.push({ voice: kind === 'sax' ? 'saxophone' : kind === 'flute' ? 'flute' : 'reed (clarinet)', piece: id, claims: kind === 'sax' ? 'sax' : kind === 'flute' ? 'flute' : 'clarinet', notes: range(lo, hi), vels: [0.45, 0.65, 0.85],
      play: play || (kind === 'sax' ? (m, v, d, i) => sax(m, v, d, P.lead.preset, SR, 3 + i) : await legacyReed(P.lead.preset)) });
    if (P.band.bass === 'guitar' || P.band.fills === 'guitar') out.push({ voice: 'bass guitar', piece: id, claims: 'bassguitar', notes: range(28, 52), vels: [0.45, 0.65, 0.85], play: (m, v, d, i) => bassGuitar(m, v, d, {}, SR, 1 + i) });
    if (P.band.bass === 'guitar') out.push({ voice: 'bass guitar, ghost note', piece: id, claims: 'bassguitar-muted', notes: range(28, 46), vels: [0.5, 0.8], dur: 0.2, play: (m, v, d, i) => bassGuitar(m, v, d, { style: 'ghost' }, SR, 1 + i) });
    if (P.band.bass === 'upright') out.push({ voice: 'upright bass', piece: id, claims: 'upright', notes: range(28, 47), vels: [0.45, 0.65, 0.85], play: (m, v, d, i) => softBass(m, v, d, SR, 1 + i) });
    out.push({ voice: 'electric piano', piece: id, claims: 'epiano', notes: range(43, 82), vels: [0.35, 0.6, 0.85], play: (m, v, d) => tine(m, v, d, { ...TINE, ...P.tine }, SR, 1) });
  }
  return out;
}
async function legacyReed(preset) { const reed = await import('../../../world/sound/sound/v3/instruments/reed.js'); return (m, v, d, i) => reed.note(m, v, d, preset, SR, 3 + i); }

// Judge one voice. Returns counts of what its notes were heard as, its mean score against the class it claims, that
// class's limit, the nearest class on average, and the score a plain sawtooth gets against the same class at the same pitches.
export function judgeVoice(v, book, { hold = [] } = {}) {
  const skip = hold.length ? (r) => hold.includes(r.source) : null, heard = {}, nearest = {}, rows = [], own = [], saw = []; let i = 0;
  for (const m of v.notes) for (const vel of v.vels) { const a = analyse(pad(v.play(m, vel, v.dur || 1.5, i++)), SR, { m }); if (!a) continue; const r = judge(a.vector, a.m, book, { skip }), d = scoreAs(a.vector, a.m, book, v.claims, { skip });
    heard[r.heard] = (heard[r.heard] || 0) + 1; if (r.best) nearest[r.best] = (nearest[r.best] || 0) + 1; rows.push({ m, vel, heard: r.heard, best: r.best, d: r.d, asClaimed: d, margin: r.margin, values: a.values }); if (Number.isFinite(d)) own.push(d);
    const s = analyse(tone('saw', m), SR, { m }), sd = s ? scoreAs(s.vector, s.m, book, v.claims, { skip }) : Infinity; if (Number.isFinite(sd)) saw.push(sd); }
  const mean = (a) => (a.length ? a.reduce((s, q) => s + q, 0) / a.length : null), n = rows.length, top = Object.entries(nearest).sort((a, b) => b[1] - a[1])[0];
  return { voice: v.voice, piece: v.piece, claims: v.claims, notes: n, heard, named: (heard[v.claims] || 0) / Math.max(1, n), nearestClass: top ? top[0] : null, nearestShare: top ? top[1] / n : 0, asClaimed: mean(own), limit: book.limits[v.claims] ?? null, sawtooth: mean(saw), rows };
}
export const lineOf = (r) => { const f = (x) => (x === null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2)); return `${(r.voice + ' in ' + r.piece).padEnd(44)} claims ${r.claims.padEnd(16)} named as it in ${String(Math.round(100 * r.named)).padStart(3)} % of ${String(r.notes).padStart(2)} notes | heard: ${Object.entries(r.heard).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${c}`).join(', ')} | nearest class ${r.nearestClass} (${Math.round(100 * r.nearestShare)} %) | score as ${r.claims} ${f(r.asClaimed)}, limit ${f(r.limit)}, a sawtooth scores ${f(r.sawtooth)}`; };

// The finer second opinion (system/ear/likeness.js): our voice against each reference note of the instrument it claims,
// played at that note's pitch and strength; beside it the yardstick (two real recordings of the instrument against each
// other: another source when there is one, the neighbouring note of the same source when there is not) and a sawtooth.
// All in dB of mel-spectrogram distance; smaller is closer. Medians over up to `cap` reference notes.
export function likenessOf(v, dir, index, { cap = 24 } = {}) {
  const med = (a) => { const q = a.filter((z) => z !== null).sort((x, y) => x - y); return q.length ? q[Math.floor(q.length / 2)] : null; }, all = index.filter((r) => r.class === v.claims && !r.hold), step = Math.max(1, Math.ceil(all.length / cap)), ours = [], real = [], saw = []; let other = false;
  all.forEach((r, i) => { if (i % step) return; const A = readNote(dir, r), a = melgram(A, r.sr); if (!a) return;
    const y = melgram(pad(v.play(r.m, r.vel, v.dur || 1.5, i)), SR), s = melgram(tone('saw', r.m), SR); if (y) ours.push(mdist(y, a)); if (s) saw.push(mdist(s, a));
    const cross = all.filter((q) => q.source !== r.source && Math.abs(q.m - r.m) <= 1.6 && Math.abs(q.vel - r.vel) <= 0.3), same = all.filter((q) => q !== r && q.source === r.source && Math.abs(q.m - r.m) <= 3.6 && q.vel === r.vel), peers = cross.length ? cross : same; if (cross.length) other = true;
    for (const q of peers.slice(0, 3)) { const b = melgram(shift(readNote(dir, q), r.m - q.m), q.sr); if (b) real.push(mdist(b, a)); } });
  return { ours: med(ours), real: med(real), sawtooth: med(saw), yardstick: other ? 'another source' : 'the neighbouring note of the same source', notes: ours.length };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/voicejudge.mjs')) {
  const book = JSON.parse(readFileSync(arg('--book', path.join(HERE, '..', '..', 'ear', 'identity-refs.json')), 'utf8')), hold = (arg('--hold', '') || '').split(',').filter(Boolean), all = [];
  const notes = arg('--notes', null), index = notes ? loadIndex(notes) : null, f = (x) => (x === null ? 'n/a' : x.toFixed(1)), seen = new Set(), only = arg('--only', null);
  for (const v of await voices()) { if (only && !v.voice.startsWith(only)) continue; if (!book.limits[v.claims]) { console.log(`${v.voice} in ${v.piece}: no reference notes for ${v.claims} in this book`); continue; } const r = judgeVoice(v, book, { hold }); all.push(r); console.log(lineOf(r));
    if (index && !seen.has(v.voice)) { seen.add(v.voice); r.likeness = likenessOf(v, notes, index); console.log(`    moment by moment, ${r.likeness.notes} notes: ours to a real one ${f(r.likeness.ours)} dB | a real one to ${r.likeness.yardstick} ${f(r.likeness.real)} dB | a sawtooth to a real one ${f(r.likeness.sawtooth)} dB`); } }
  const out = arg('--json', null); if (out) writeFileSync(out, JSON.stringify(all.map(({ rows, ...r }) => ({ ...r, rows: rows.map(({ values, ...q }) => q) })), null, 1));
}
