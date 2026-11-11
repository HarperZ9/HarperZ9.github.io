// likeness.js: how far apart two notes of the same pitch are, moment by moment. A second opinion beside the identity
// judge, and a finer one: the judge reads 25 summary numbers per note, and two notes can agree on all of them and still
// differ in ways a listener hears at once.
//   mel spectrogram   the note cut into 21 ms windows every 5 ms, each window summed into 40 bands on the mel scale
//                     (60 Hz to 12 kHz), in dB under the note's own loudest cell, with a floor at -60 dB
//   distance          the root mean square difference in dB between two such pictures, lined up at the onsets, over the
//                     first 0.8 s (or the shorter note), counted only where at least one of the two is above the floor
// Level does not count; the shape of the attack, the balance of harmonics as it moves, the noise between and above the
// harmonics and the decay all do. Two recordings of one instrument at one pitch, from different players and rooms, are
// some distance apart by this measure. That distance is the yardstick: a synthetic note as close to a real one as real
// ones are to each other is inside the instrument's natural variation, on this picture. It is still a picture, not an ear.
import { powerFrames, decimate } from './spectrum.js';

const mel = (f) => 2595 * Math.log10(1 + f / 700), unmel = (v) => 700 * (Math.pow(10, v / 2595) - 1);
export function melgram(x0, sr0, { seconds = 0.8, bands = 40, fmin = 60, fmax = 12000 } = {}) {
  let x = x0, sr = sr0; if (sr > 60000) { x = decimate(x0, 2); sr = sr0 / 2; }
  const F = Math.round(0.004 * sr); let pk = 0; const env = []; for (let s = 0; s + F <= x.length; s += F) { let e = 0; for (let i = s; i < s + F; i++) e += x[i] * x[i]; e = Math.sqrt(e / F); env.push(e); pk = Math.max(pk, e); } if (pk < 1e-6) return null;
  let i10 = 0; while (env[i10] < 0.1 * pk) i10++; let end = env.length - 1; while (end > i10 && env[end] < 0.03 * pk) end--;
  const n = 1024, hop = Math.round(0.005 * sr), on = i10 * F, len = Math.min(Math.round(seconds * sr), (end + 1) * F - on), seg = new Float32Array(len + n), sa = on - n / 2 - Math.round(0.02 * sr); for (let i = 0; i < seg.length; i++) { const k = sa + i; if (k >= 0 && k < x.length) seg[i] = x[k]; }
  const st = powerFrames(seg, sr, { n, hop }), m0 = mel(fmin), m1 = mel(Math.min(fmax, 0.45 * sr)), edge = (i) => unmel(m0 + (m1 - m0) * i / (bands + 1)), tri = [];
  for (let b = 0; b < bands; b++) { const lo = edge(b), mid = edge(b + 1), hi = edge(b + 2), w = []; for (let k = Math.max(1, Math.floor(lo / st.binHz)); k * st.binHz < hi && k < n / 2; k++) { const f = k * st.binHz, g = f < mid ? (f - lo) / (mid - lo) : (hi - f) / (hi - mid); if (g > 0) w.push([k, g]); } if (!w.length) w.push([Math.max(1, Math.round(mid / st.binHz)), 1]); tri.push(w); }
  let top = 1e-20; const rows = st.frames.map((p) => tri.map((w) => { let s = 0; for (const [k, g] of w) s += p[k] * g; top = Math.max(top, s); return s; }));
  return { frames: rows.map((r) => r.map((v) => Math.max(-60, 10 * Math.log10(v / top + 1e-12)))), seconds: len / sr };
}
export function distance(a, b) {
  const J = Math.min(a.frames.length, b.frames.length); let s = 0, c = 0;
  for (let j = 0; j < J; j++) for (let k = 0; k < a.frames[j].length; k++) { const u = a.frames[j][k], v = b.frames[j][k]; if (u > -60 || v > -60) { s += (u - v) ** 2; c++; } }
  return c ? Math.sqrt(s / c) : null;
}
export const likeness = (x, sx, y, sy, opts) => { const a = melgram(x, sx, opts), b = melgram(y, sy, opts); return a && b ? distance(a, b) : null; };
