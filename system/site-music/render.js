// render.js: bars to sound. Each layer (stem) is rendered on its own, so the ear can check layers against each other and
// against the score. A chunk of bars renders to buffers that run past the chunk's end by the length of the decays; laying
// the next chunk over that tail gives the same samples as one long render, which is how the live form plays without a seam.
import { panInto, rng } from '../../world/sound/sound/v3/instruments/core.js';
import * as funkkit from '../../world/sound/sound/v3/instruments/funkkit.js';
import { room } from '../../world/sound/sound/v3/instruments/space.js';
import { brush, TINE } from './voices.js';
import { LEADS, leadPhrase, leadNote, KEYS, BASSES, PADVOICES, ARPS, PAD_PRESET } from './variants.js';

export const STEMS = ['keys', 'bass', 'sub', 'drums', 'lead', 'pad', 'room'];
export const TAIL = 12;   // seconds a chunk rings past its last bar: a lead phrase that starts in the last bar, note decays, then the room
export const PRE = 0.35;  // seconds of room before a chunk's first beat: an early note, or the lead's breath before a phrase
const PAD = PAD_PRESET;
const ROOM = { rt60: 1.9, damp: 3800, predelay: 0.024, size: 1.2, width: 0.9 };
const SEND = { keys: 0.3, lead: 0.55, drums: 0.22, pad: 0.15 };
const PAN = { ride: 0.45, sweep: -0.3, tap: -0.15, kick: 0, pedal: 0.5, 'fk:kick': 0, 'fk:snare': -0.05, 'fk:rim': -0.2, 'fk:hat': 0.4, 'fk:ohat': 0.4, 'fk:ride': -0.4 };
// Quality levels for the live form on slow devices. "lite" halves the pad's oscillators and drops its chorus; the worker
// can also halve the sample rate on top of it. The offline render always uses "full".
export const QUALITY = { full: { padVoices: 4, padChorus: 0.5 }, lite: { padVoices: 2, padChorus: 0 } };

// The lead voices and every other choice of voice are in variants.js; these names stay for the benches and tests.
export { LEADS, leadNote };

// Swing: an off-beat eighth at x.5 moves to x + swing. Positions between are stretched to match.
export const swung = (beat, swing) => { const b = Math.floor(beat), f = beat - b; return b + (f < 0.5 ? f * 2 * swing : swing + (f - 0.5) * 2 * (1 - swing)); };

// Start time and beat length of each bar. drift (a test defect) raises the tempo steadily by that fraction over 32 bars.
// Every bar starts on a whole sample, so a bar lands on the same samples whether it is rendered alone or inside a longer run.
export function barTimes(bars, piece, { t0 = 0, drift = 0, sr = 48000 } = {}) {
  const out = []; let s = Math.round(t0 * sr);
  for (const b of bars) { const beatSec = 60 / (piece.bpm * (1 + drift * b.index / 32)), len = Math.round(4 * beatSec * sr); out.push({ index: b.index, bar: b.index, role: b.role, s0: s, t0: s / sr, beatSec, t1: (s + len) / sr }); s += len; }
  return out;
}

// What the ear and the sea need from the score, in seconds: the written chords, the lead notes, the bars, and the
// moments the lead falls silent.
export function timeline(bars, piece, opts = {}) {
  const bt = barTimes(bars, piece, opts), chords = [], lead = [], bass = [], rests = [], at = (i, beat) => bt[i].t0 + swung(beat, piece.swing) * bt[i].beatSec;
  bars.forEach((b, i) => { for (const c of b.chords) chords.push({ t0: at(i, c.beat), t1: at(i, c.beat + c.beats), bar: b.index, sym: c.sym, root: c.root, pcs: c.pcs });
    for (const n of b.lead) lead.push({ t0: at(i, n.beat) + 0.09, t1: at(i, n.beat) + Math.max(0.2, n.beats * bt[i].beatSec - 0.05), m: n.m, bar: b.index, kind: n.kind });
    for (const e of b.bass) if (e.style !== 'ghost') bass.push({ t0: at(i, e.beat), t1: at(i, e.beat) + Math.max(0.12, e.beats * bt[i].beatSec), m: e.m, bar: b.index });
    if (b.restAt !== undefined) rests.push(bt[i].t0 + b.restAt * bt[i].beatSec); });
  return { bpm: piece.bpm, swing: piece.swing === 0.5 ? null : piece.swing, chords, lead, bass, rests, bars: bt, phraseBars: 8, phraseOffset: piece.intro ?? 4, end: bt.length ? bt[bt.length - 1].t1 : 0 };
}

// A slow stereo chorus for the electric piano: each side hears itself again a few milliseconds late, the delay drifting.
function chorus(st, sr, o0) {
  const n = st.L.length, size = Math.ceil(0.03 * sr), bl = new Float32Array(size), br = new Float32Array(size); let w = 0;
  for (let s = 0; s < n; s++) { const t = (o0 + s) / sr, dl = (0.009 + 0.0025 * Math.sin(2 * Math.PI * 0.33 * t)) * sr, dr = (0.011 + 0.0025 * Math.sin(2 * Math.PI * 0.27 * t + 1.9)) * sr;
    bl[w] = st.L[s]; br[w] = st.R[s]; const tap = (b, d) => { const p = w - d, i = Math.floor(p), f = p - i, a = b[((i % size) + size) % size], c = b[(((i + 1) % size) + size) % size]; return a + (c - a) * f; };
    const wl = tap(br, dl), wr = tap(bl, dr); st.L[s] = 0.82 * st.L[s] + 0.38 * wl; st.R[s] = 0.82 * st.R[s] + 0.38 * wr; w = (w + 1) % size; }
}

// Render a run of bars to stems. Returns { stems: { name: { L, R } }, pre (samples before the first beat), n (samples in the
// bars), length (all samples: pre, bars and tail) }. The next chunk starts n samples after this one.
// opts.defects plants errors for the ear's controls: { transpose: { stem: semitones }, shiftBar: { bar, semis },
// detune: { note, cents }, drift }. The score is left as written, so the ear has something to disagree with.
export function renderBars(bars, piece, { sr = 48000, seed = 1, origin = 0, defects = {}, cache = new Map(), quality = 'full' } = {}) {
  const bt = barTimes(bars, piece, { t0: 0, drift: defects.drift || 0, sr }), body = bt.length ? bt[bt.length - 1].t1 : 0, n = Math.round(body * sr), pre = Math.round(PRE * sr), len = pre + n + Math.round(TAIL * sr);
  const stems = Object.fromEntries(STEMS.map((k) => [k, { L: new Float32Array(len), R: new Float32Array(len) }])), tr = defects.transpose || {}, sh = defects.shiftBar || { bar: -1, semis: 0 }, Q = QUALITY[quality] || QUALITY.full;
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }, q = (v, steps = 16) => Math.round(v * steps) / steps, kit = { ...funkkit.meta.presets['brushed-room'], ...piece.kit }, tp = { ...TINE, ...piece.tine }, B = piece.band, kn = B.keys || 'tine', KV = KEYS[kn] || KEYS.tine, bassVoice = B.bassVoice || (B.bass === 'sub' ? 'guitar' : B.bass);
  let leadCount = defects.leadOffset || 0;
  bars.forEach((b, i) => {
    const T = bt[i], at = (beat, j = 0) => pre + T.s0 + Math.round((swung(beat, piece.swing) * T.beatSec + j) * sr), shift = b.index === sh.bar ? sh.semis : 0;
    for (const e of b.keys) e.notes.forEach((m0, k) => { const ks = kn === 'tine' ? 1 : 1 + ((b.index + k) % 3), m = m0 + (tr.keys || 0) + shift, dur = q(e.beats * T.beatSec, 8), vel = q(e.vel - 0.02 * k);
      panInto(stems.keys.L, stems.keys.R, memo(`k:${kn}:${m}:${vel}:${dur}:${ks}`, () => KV.play(m, vel, dur, tp, sr, ks)), at(e.beat, e.j + k * e.roll), KV.pan(m, k, e.notes.length), 1); });
    for (const e of b.bass) { const m = e.m + (tr.bass || 0) + shift, dur = q(e.beats * T.beatSec, 8), vel = q(e.vel), bv = e.voice === 'guitar' ? B.fillVoice || 'guitar' : bassVoice, vb = defects.staticBass ? 0 : (b.index * 7 + Math.round(e.beat * 4)) % 11, from = e.slideFrom === undefined ? null : e.slideFrom + (tr.bass || 0) + shift;
      panInto(stems.bass.L, stems.bass.R, memo(`b:${bv}:${m}:${vel}:${dur}:${e.style}:${from}:${vb}`, () => (BASSES[bv] || BASSES.upright).play(m, vel, dur, { style: e.style || 'finger', slideFrom: from }, sr, 1 + vb)), at(e.beat, e.j), 0, 1); }
    for (const e of b.sub) { const ss = (B.subVoice || 'sub') === 'sub' ? 1 : 1 + ((b.index + Math.round(e.beat * 4)) % 3), m = e.m + (tr.sub || 0) + shift, dur = q(e.beats * T.beatSec, 8), vel = q(e.vel), from = e.slideFrom === undefined ? null : e.slideFrom + (tr.sub || 0) + shift;
      panInto(stems.sub.L, stems.sub.R, memo(`s:${B.subVoice || 'sub'}:${m}:${vel}:${dur}:${from}:${ss}`, () => (BASSES[B.subVoice || 'sub']).play(m, vel, dur, { slideFrom: from }, sr, ss)), at(e.beat), 0, 1); }
    if (B.arp && b.level !== 'none' && b.role !== 'intro') arpeggio(b, T, at, stems, piece, sr, memo, tr.keys || 0);
    for (const e of b.drums) { const vel = q(e.vel, 12), dur = e.dur ? q(e.dur * T.beatSec, 4) : 0, v = (b.index + Math.round(e.beat * 4)) % 3, fk = e.piece.startsWith('fk:');
      panInto(stems.drums.L, stems.drums.R, memo(`d:${e.piece}:${vel}:${dur}:${v}`, () => (fk ? funkkit.hit(e.piece.slice(3), vel, kit, sr, 11 + v) : e.piece === 'sweep' ? brush.sweep(dur, vel, sr, v + 1) : e.piece === 'kick' ? brush.kick(vel, sr) : brush[e.piece](vel, sr, v + 1))), at(e.beat, e.j), PAN[e.piece] ?? 0, 1); }
    for (const e of b.pad) { const p = (PADVOICES[B.pad || 'pad'] || PADVOICES.pad).play(e.notes.map((m) => m + (tr.pad || 0) + shift), e.vel, e.beats * T.beatSec, { ...PAD, ...piece.pad, voices: Q.padVoices, chorus: Q.padChorus }, sr, seed * 131 + b.index * 7 + Math.round(e.beat)), a = at(e.beat);
      for (let s = 0; s < p.L.length && a + s < len; s++) { stems.pad.L[a + s] += p.L[s]; stems.pad.R[a + s] += p.R[s]; } }
    // Every lead plays a phrase on one breath: the whole phrase is rendered where it starts.
    // (staticLead is a planted defect: every note the same wave, no breath, no vibrato, no scoop.)
    const preset = piece.lead.preset;
    if (!defects.staticLead) { if (b.phrase) { const ph = b.phrase, first = ph[0], sec = (beat) => swung(beat, piece.swing) * T.beatSec, notes = ph.map((e) => { const k = leadCount++; return { t: sec(e.beat) - sec(first.beat), dur: e.beats * T.beatSec, m: e.m + (tr.lead || 0) + (defects.detune && defects.detune.note === k ? defects.detune.cents / 100 : 0), vel: e.vel, slur: e.slur }; });
        const r = leadPhrase(B.lead, notes, preset, sr, seed * 17 + b.index * 5 + Math.round(first.beat * 2)); panInto(stems.lead.L, stems.lead.R, r.x, at(first.beat, first.j || 0) - r.pre, -0.12, 1); } }
    else for (const e of b.lead) { const k = leadCount++, m = e.m + (tr.lead || 0) + (defects.detune && defects.detune.note === k ? defects.detune.cents / 100 : 0), dur = e.beats * T.beatSec;
      panInto(stems.lead.L, stems.lead.R, memo(`L:${m}:${Math.round(dur * 8)}`, () => leadNote(B.lead, m, 0.6, dur, { ...preset, noise: 0, vibrato: 0, scoop: 0, drift: 0, keys: 0 }, sr, 3)), at(e.beat, e.j || 0), -0.12, 1); }
  });
  // the electric piano's stereo movement, on the absolute clock so chunks agree: a tremolo that pans, or a slow chorus
  const o0 = Math.round(origin * sr) - pre;
  if (B.keysFx === 'chorus') chorus(stems.keys, sr, o0); else for (let s = 0; s < len; s++) { const mod = 0.2 * Math.sin(2 * Math.PI * 4.3 * (o0 + s) / sr); stems.keys.L[s] *= 1 - mod; stems.keys.R[s] *= 1 + mod; }
  const sL = new Float32Array(len - Math.round(3 * sr)), sR = new Float32Array(sL.length);
  for (const [k, g] of Object.entries(SEND)) for (let s = 0; s < sL.length; s++) { sL[s] += stems[k].L[s] * g; sR[s] += stems[k].R[s] * g; }
  const wet = room(sL, sR, ROOM, sr, 3); stems.room.L.set(wet.L.subarray(0, len)); stems.room.R.set(wet.R.subarray(0, len));
  return { stems, n, pre, length: len, times: bt, leadCount };
}

// An arpeggio over the bar's chords (band.arp): sixteenth notes up through the voicing and an octave above, accented on
// the beat, from its own random stream (the composition is not touched), through a delay a dotted eighth long that
// alternates sides (tempo-synced: the repeats land on the grid).
function arpeggio(b, T, at, stems, piece, sr, memo, tr) {
  const r = rng(7919 + b.index * 31), A = ARPS[piece.band.arp] || ARPS.pluck, step = T.beatSec / 4, dl = Math.round(0.75 * T.beatSec * sr), n = Math.round(4.6 * T.beatSec * sr) + 4 * dl, L = new Float32Array(n), R = new Float32Array(n), a0 = at(0);
  for (const ch of b.chords) { const pool = [...ch.voicing, ...ch.voicing.map((m) => m + 12)].sort((x, y) => x - y); for (let k = 0; k < ch.beats * 4; k++) { if (r() < 0.12) continue;
    const m = pool[k % pool.length] + tr, vel = Math.round((k % 4 === 0 ? 0.62 : 0.42 + 0.08 * r()) * 16) / 16, sd = 1 + (k % 4), x = memo(`a:${m}:${vel}:${Math.round(step * 1000)}:${sd}`, () => A.play(m, vel, step * 0.9, sr, sd)), o = Math.round((ch.beat * T.beatSec + k * step) * sr);
    panInto(L, R, x, o, 0, 1); } }
  for (let i = dl; i < n; i++) { const fb = 0.38; L[i] += fb * R[i - dl] * 0.9; R[i] += fb * L[i - dl]; }   // ping-pong: each repeat crosses to the other side
  for (let i = 0; i < n && a0 + i < stems.keys.L.length; i++) { stems.keys.L[a0 + i] += 0.5 * L[i]; stems.keys.R[a0 + i] += 0.5 * R[i]; }
}

// Stems to one stereo music bus at the piece's levels.
export function mixStems(stems, piece, { only = STEMS } = {}) {
  const len = stems.keys.L.length, L = new Float32Array(len), R = new Float32Array(len);
  for (const k of only) { const g = Math.pow(10, (piece.mix[k] ?? 0) / 20); if (g < 0.002) continue; for (let s = 0; s < len; s++) { L[s] += stems[k].L[s] * g; R[s] += stems[k].R[s] * g; } }
  return { L, R };
}
export { rng };
