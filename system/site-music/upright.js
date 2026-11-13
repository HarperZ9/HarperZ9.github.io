// upright.js: a plucked double bass (upright bass), played like a player plays it.
// The string is the measured layer (measured.js, plucked.js). Since round five its table is fitted to two recorded
// basses at once (University of Iowa pizzicato and Karoryfer Meatbass, read at the same pitches and averaged), and
// holds what a listener hears in a pluck that steady harmonic levels miss:
//   thump        the finger itself: what a listener hears as the thump is, in these recordings, mostly the harmonics'
//                own first 30 ms (each starts at its measured peak and falls at its measured early rate). The burst of
//                noise left above that (measured per octave band) is 28 to 63 dB under the note; it is played at half
//                level from 200 Hz up (measured, scaled)
//   two speeds   each harmonic dies faster in the first 150 ms than after it, so the upper harmonics fall away early and
//                the fundamental rings on (measured)
//   body         harmonic levels are read as a spectral envelope by frequency, so the body's resonances and the wood
//                between 100 and 250 Hz stay where they are while the note moves (measured)
// and what this file adds, designed and not measured (no recording here isolates them):
//   settle       the string starts a few cents sharp and falls back over about 40 ms. The measured settle had no
//                consistent sign over fifteen reference notes, so it is kept small
//   damping      when the hand stops the string (the next note, or a lifted finger) the tone dies over about 70 ms with a
//                soft click of the finger
//   slide        a note can start on another pitch and glide into this one while the string sounds, with the faint
//                hiss of a finger on a wound string
//   sympathy     open strings (E1, A1, D2, G2) whose harmonics meet the played note's ring quietly and keep ringing
//   ghost        a dead note: the string is touched and stopped at once, mostly thump with a trace of pitch
import { mtof, rng, velocity, expDecay, edges, Biquad } from '../../world/sound/sound/v3/instruments/core.js';
import { plucked } from './plucked.js';
import { TABLES, around, harmonicsAt } from './measured.js';

export const UPRIGHT = { knee: 0.15, early: 1, thump: 0.5, thumpFrom: 1, settle: 6, settleTau: 0.04, release: 0.07, click: 1, sympathy: 1, hiss: 1 };
const GAIN = 0.97,   // level matched to round four on the bench phrase (tools/voicebench.mjs BASS), so the mix holds
  OPEN = [28, 33, 38, 43];

// o: { from (MIDI pitch a slide starts on), ghost, table (a measured table in place of TABLES.upright), p (UPRIGHT) }
export function upright(m, vel, dur, o = {}, sr = 48000, seed = 1) {
  const p = { ...UPRIGHT, ...(o.p || {}) }, table = o.table || TABLES.upright, ghost = !!o.ghost, V = velocity(vel, { curve: 1.3 }), r = rng(seed * 104729 + Math.round(m * 17));
  const hold = ghost ? Math.min(dur, 0.035) : dur, slide = o.from !== undefined && o.from !== null;
  const x = plucked(table, m, vel, dur, { hold, release: ghost ? 0.018 : p.release, attack: 0.004, from: slide ? o.from : null, glide: 0.07, cents: ghost ? 0 : p.settle * (0.4 + 0.6 * vel), centsTau: p.settleTau, thump: ghost ? 1.6 : p.thump, knee: p.knee, early: p.early, thumpFrom: p.thumpFrom, tail: 0.3, kmax: 48 }, sr, seed * 13 + 1);
  const len = x.length, f0 = mtof(m), at = Math.round(hold * sr), click = new Biquad('bp', 900, 1.4, sr), hiss = new Biquad('bp', 1800, 1.5, sr);
  let lv = 0; for (let i = Math.round(0.06 * sr); i < Math.min(len, Math.round(0.1 * sr)); i++) lv += x[i] * x[i]; lv = Math.sqrt(lv / Math.max(1, Math.round(0.04 * sr)));
  for (let i = 0; i < len; i++) { const t = i / sr, n = r() * 2 - 1; let y = 0;
    if (!ghost && i >= at && p.click) y += 0.08 * p.click * lv * click.tick(n) * expDecay(t - hold, 0.01);   // the finger stopping the string
    if (slide && p.hiss) y += 0.05 * p.hiss * lv * hiss.tick(n) * Math.sin(Math.PI * Math.min(1, t / 0.09));   // the finger moving along the string
    x[i] += y; }
  if (!ghost && p.sympathy) sympathy(x, table, m, vel, hold, lv, p.sympathy, sr, r);
  const g = V.gain * GAIN; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.001, 0.02);
}

// Open strings that share a harmonic with the played note (within 10 cents) take up that harmonic quietly, 30 dB under
// the played harmonic, rising over 80 ms and dying slowly; they are not stopped when the note is.
function sympathy(x, table, m, vel, hold, lv, amount, sr, r) {
  const f0 = mtof(m), K = 8, db = harmonicsAt(table, m, vel, K, new Float32Array(K), 'db', around(table, m, vel)), tones = [];
  for (const s of OPEN) { if (Math.abs(s - m) < 0.5 || (m - s >= 0 && m - s <= 7 && s === Math.max(...OPEN.filter((q) => q <= m)))) continue;   // the string being played rings already
    for (let j = 1; j <= 6; j++) { const fs = j * mtof(s); for (let h = 1; h <= K; h++) if (Math.abs(1200 * Math.log2(fs / (h * f0))) < 10) tones.push({ f: fs, a: amount * lv * Math.SQRT2 * Math.pow(10, (db[h - 1] - 30) / 20), ph: r() * 6.28 }); } }
  for (const q of tones) { const w = 2 * Math.PI * q.f / sr; for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] += q.a * (1 - Math.exp(-t / 0.08)) * Math.exp(-t / 1.6) * Math.sin(q.ph + w * i); } }
}
