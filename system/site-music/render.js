// render.js: bars to sound. Each layer (stem) is rendered on its own, so the ear can check layers against each other and
// against the score. A chunk of bars renders to buffers that run past the chunk's end by the length of the decays; laying
// the next chunk over that tail gives the same samples as one long render, which is how the live form plays without a seam.
import { panInto, rng } from '../../world/sound/sound/v3/instruments/core.js';
import * as reed from '../../world/sound/sound/v3/instruments/reed.js';
import * as pads from '../../world/sound/sound/v3/instruments/pads.js';
import { room } from '../../world/sound/sound/v3/instruments/space.js';
import { tine, softBass, brush, TINE } from './voices.js';

export const STEMS = ['keys', 'bass', 'drums', 'lead', 'pad', 'room'];
export const TAIL = 7;   // seconds a chunk rings past its last bar: note decays, then the room
export const PRE = 0.02;  // seconds of room before a chunk's first beat, so a note played a few milliseconds early still fits
const PAD = { voices: 4, detune: 8, cutoff: 1500, motion: 0.45, reso: 1.1, attack: 1.4, release: 2.6, chorus: 0.5, air: 0.08 };
const ROOM = { rt60: 1.9, damp: 3200, predelay: 0.024, size: 1.2, width: 0.9 };
const SEND = { keys: 0.3, lead: 0.55, drums: 0.22, pad: 0.15 };
const PAN = { ride: 0.45, sweep: -0.3, tap: -0.15, kick: 0, pedal: 0.5 };

// The engine's waveguide reed leaves its notes sitting off zero (the ear measured a DC offset of 0.002 to 0.005 on the lead
// layer). A one-pole high-pass at 30 Hz per note takes it out; the note's own fades keep the ends at zero.
function centre(x, sr) { const k = Math.exp(-2 * Math.PI * 30 / sr); let x1 = 0, y = 0; for (let i = 0; i < x.length; i++) { const v = x[i]; y = v - x1 + k * y; x1 = v; x[i] = y; } return x; }

// Swing: an off-beat eighth at x.5 moves to x + swing. Positions between are stretched to match.
export const swung = (beat, swing) => { const b = Math.floor(beat), f = beat - b; return b + (f < 0.5 ? f * 2 * swing : swing + (f - 0.5) * 2 * (1 - swing)); };

// Start time and beat length of each bar. drift (a test defect) raises the tempo steadily by that fraction over 32 bars.
// Every bar starts on a whole sample, so a bar lands on the same samples whether it is rendered alone or inside a longer run.
export function barTimes(bars, piece, { t0 = 0, drift = 0, sr = 48000 } = {}) {
  const out = []; let s = Math.round(t0 * sr);
  for (const b of bars) { const beatSec = 60 / (piece.bpm * (1 + drift * b.index / 32)), len = Math.round(4 * beatSec * sr); out.push({ index: b.index, s0: s, t0: s / sr, beatSec, t1: (s + len) / sr }); s += len; }
  return out;
}

// What the ear needs from the score, in seconds: the written chords and the lead notes.
export function timeline(bars, piece, opts = {}) {
  const bt = barTimes(bars, piece, opts), chords = [], lead = [], at = (i, beat) => bt[i].t0 + swung(beat, piece.swing) * bt[i].beatSec;
  bars.forEach((b, i) => { for (const c of b.chords) chords.push({ t0: at(i, c.beat), t1: at(i, c.beat + c.beats), bar: b.index, sym: c.sym, root: c.root, pcs: c.pcs });
    for (const n of b.lead) lead.push({ t0: at(i, n.beat) + 0.09, t1: at(i, n.beat) + Math.max(0.2, n.beats * bt[i].beatSec - 0.05), m: n.m, bar: b.index }); });
  return { bpm: piece.bpm, swing: piece.swing === 0.5 ? null : piece.swing, chords, lead, bars: bt, end: bt.length ? bt[bt.length - 1].t1 : 0 };
}

// Render a run of bars to stems. Returns { stems: { name: { L, R } }, pre (samples before the first beat), n (samples in the
// bars), length (all samples: pre, bars and tail) }. The next chunk starts n samples after this one.
// opts.defects plants errors for the ear's controls: { transpose: { stem: semitones }, shiftBar: { bar, semis },
// detune: { note, cents }, drift }. The score is left as written, so the ear has something to disagree with.
export function renderBars(bars, piece, { sr = 48000, seed = 1, origin = 0, defects = {}, cache = new Map() } = {}) {
  const bt = barTimes(bars, piece, { t0: 0, drift: defects.drift || 0, sr }), body = bt.length ? bt[bt.length - 1].t1 : 0, n = Math.round(body * sr), pre = Math.round(PRE * sr), len = pre + n + Math.round(TAIL * sr);
  const stems = Object.fromEntries(STEMS.map((k) => [k, { L: new Float32Array(len), R: new Float32Array(len) }])), tr = defects.transpose || {}, sh = defects.shiftBar || { bar: -1, semis: 0 };
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }, q = (v, steps = 16) => Math.round(v * steps) / steps;
  let leadCount = defects.leadOffset || 0;
  bars.forEach((b, i) => {
    const T = bt[i], at = (beat, j = 0) => pre + T.s0 + Math.round((swung(beat, piece.swing) * T.beatSec + j) * sr), shift = b.index === sh.bar ? sh.semis : 0;
    for (const e of b.keys) e.notes.forEach((m0, k) => { const m = m0 + (tr.keys || 0) + shift, dur = q(e.beats * T.beatSec, 8), vel = q(e.vel - 0.02 * k);
      panInto(stems.keys.L, stems.keys.R, memo(`k:${m}:${vel}:${dur}`, () => tine(m, vel, dur, { ...TINE, ...piece.tine }, sr, 1)), at(e.beat, e.j + k * e.roll), (k / (e.notes.length - 1) - 0.5) * 0.9, 1); });
    for (const e of b.bass) { const m = e.m + (tr.bass || 0) + shift, dur = q(e.beats * T.beatSec, 8), vel = q(e.vel); panInto(stems.bass.L, stems.bass.R, memo(`b:${m}:${vel}:${dur}`, () => softBass(m, vel, dur, sr, 1)), at(e.beat, e.j), 0, 1); }
    for (const e of b.drums) { const vel = q(e.vel, 12), dur = e.dur ? q(e.dur * T.beatSec, 4) : 0, v = (b.index + Math.round(e.beat * 2)) % 3;
      panInto(stems.drums.L, stems.drums.R, memo(`d:${e.piece}:${vel}:${dur}:${v}`, () => (e.piece === 'sweep' ? brush.sweep(dur, vel, sr, v + 1) : e.piece === 'kick' ? brush.kick(vel, sr) : brush[e.piece](vel, sr, v + 1))), at(e.beat, e.j), PAN[e.piece], 1); }
    for (const e of b.pad) { const p = pads.chord(e.notes.map((m) => m + (tr.pad || 0) + shift), e.vel, e.beats * T.beatSec, PAD, sr, seed * 131 + b.index * 7 + Math.round(e.beat)), a = at(e.beat);
      for (let s = 0; s < p.L.length && a + s < len; s++) { stems.pad.L[a + s] += p.L[s]; stems.pad.R[a + s] += p.R[s]; } }
    for (const e of b.lead) { const k = leadCount++, m = e.m + (tr.lead || 0) + (defects.detune && defects.detune.note === k ? defects.detune.cents / 100 : 0);
      panInto(stems.lead.L, stems.lead.R, centre(reed.note(m, e.vel, e.beats * T.beatSec, piece.lead.preset, sr, seed * 17 + b.index * 5 + Math.round(e.beat * 2)), sr), at(e.beat), -0.12, 1); }
  });
  // the electric piano's slow stereo tremolo, on the absolute clock so chunks agree
  const o0 = Math.round(origin * sr) - pre; for (let s = 0; s < len; s++) { const mod = 0.2 * Math.sin(2 * Math.PI * 4.3 * (o0 + s) / sr); stems.keys.L[s] *= 1 - mod; stems.keys.R[s] *= 1 + mod; }
  const sL = new Float32Array(len - Math.round(3 * sr)), sR = new Float32Array(sL.length);
  for (const [k, g] of Object.entries(SEND)) for (let s = 0; s < sL.length; s++) { sL[s] += stems[k].L[s] * g; sR[s] += stems[k].R[s] * g; }
  const wet = room(sL, sR, ROOM, sr, 3); stems.room.L.set(wet.L.subarray(0, len)); stems.room.R.set(wet.R.subarray(0, len));
  return { stems, n, pre, length: len, times: bt, leadCount };
}

// Stems to one stereo music bus at the piece's levels.
export function mixStems(stems, piece, { only = STEMS } = {}) {
  const len = stems.keys.L.length, L = new Float32Array(len), R = new Float32Array(len);
  for (const k of only) { const g = Math.pow(10, (piece.mix[k] ?? 0) / 20); for (let s = 0; s < len; s++) { L[s] += stems[k].L[s] * g; R[s] += stems[k].R[s] * g; } }
  return { L, R };
}
export { rng };
