// timbre.js: what one note sounds like, apart from its pitch and loudness. Timbre is the quality that lets a listener tell
// a saxophone from a clarinet playing the same note at the same level. These measures put numbers on the parts of it that
// the acoustics literature treats as carrying instrument identity. analyse() reads one note; features() turns the reading
// into a fixed list of numbers that identity.js compares against notes recorded from real instruments.
//   harmonic       a partial at a whole multiple of the fundamental frequency f0; harmonic 1 is the fundamental
//   h1 .. h8       level of each of the first eight harmonics, in dB relative to all harmonics together
//   hi             level of everything above the eighth harmonic, on the same scale
//   odd/even       harmonics 3, 5, 7, 9 against 2, 4, 6, 8, in dB (a clarinet's closed cylinder favours odd ones)
//   centroid       the power-weighted mean harmonic number, as log2: how bright the note is for its pitch
//   mel cepstrum   the mel scale spaces frequency the way hearing does (close to linear under 1 kHz, logarithmic above).
//                  Sixteen mel bands from 80 Hz to 8 kHz give the spectral envelope in fixed frequency terms, where an
//                  instrument's body resonances sit; the cosine transform of their dB levels (cepstral coefficients c1 to
//                  c6) describes that envelope's shape in six numbers that do not depend on level
//   attack         log10 of the seconds the level takes to rise from 10 to 90 percent
//   overshoot      the level in the first 60 ms against the level 150 to 300 ms in, in dB (struck and plucked notes start
//                  loud; blown and bowed notes do not)
//   decay          the slope of the level over the note, in dB per second
//   noise          noise-to-harmonic ratio in dB: power between the harmonics (breath, bow, hiss) against power on them
//   attack noise   the share of power above the eighth harmonic in the first 20 ms against the same share later, in dB
//   tilt           brightness at the end of the analysed span against its start, in octaves
//   inharmonicity  B in f_k = k f0 sqrt(1 + B k^2): how far a stiff string's partials run sharp (0 for a blown pipe)
//   flux           how much the balance of harmonics moves from moment to moment
// Vibrato rate and depth are measured and reported, and are left out of the comparison: they belong to the player.
// Only the first 1.2 s of a note is read, so a long held note and a short one are compared over the same span.
import { fft } from '../../world/sound/sound/dsp.js';
import { powerFrames, decimate, mtof, ftom } from './spectrum.js';
import { inharmonicity } from './note.js';

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0), dB = (p) => 10 * Math.log10(Math.max(p, 1e-20)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slopeOf = (xs, ys) => { const mx = mean(xs), my = mean(ys); let n = 0, d = 0; for (let i = 0; i < xs.length; i++) { n += (xs[i] - mx) * (ys[i] - my); d += (xs[i] - mx) ** 2; } return d ? n / d : 0; };
export const FEATURES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'hi', 'oddEven', 'centroid', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'attack', 'overshoot', 'decay', 'noise', 'attackNoise', 'tilt', 'inharmonicity', 'flux'];
export const BANDS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];   // edges of the bands the leftover noise is summed into, Hz

// Fundamental frequency by autocorrelation: the shortest lag at which the note lines up with itself again.
export function pitchOf(x, sr, { fmin = 27, fmax = 2200 } = {}) {
  const n = 16384, N = 2 * n, re = new Float64Array(N), im = new Float64Array(N), len = Math.min(n, x.length); if (len < 512) return 0;
  for (let i = 0; i < len; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / len)); fft(re, im);
  for (let i = 0; i < N; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; } fft(re, im);
  let a = Math.floor(sr / fmax); const b = Math.min(Math.ceil(sr / fmin), n - 2); while (a < b - 2 && re[a] > 0.3 * re[0]) a++;   // step past the peak at zero lag
  let top = 0; for (let i = a; i <= b; i++) top = Math.max(top, re[i]);
  for (let i = a + 1; i < b; i++) if (re[i] >= 0.9 * top && re[i] >= re[i - 1] && re[i] >= re[i + 1]) { const d = re[i - 1] - 2 * re[i] + re[i + 1]; return sr / (i + (d ? 0.5 * (re[i - 1] - re[i + 1]) / d : 0)); }
  return 0;
}

const mel = (f) => 2595 * Math.log10(1 + f / 700), unmel = (v) => 700 * (Math.pow(10, v / 2595) - 1);
// Sixteen triangular mel bands over a power spectrum, as dB relative to their sum, then the first six cepstral coefficients.
export function melCepstrum(power, binHz, { bands = 16, fmin = 80, fmax = 8000, coefs = 6 } = {}) {
  const e = new Float64Array(bands), m0 = mel(fmin), m1 = mel(fmax), edge = (i) => unmel(m0 + (m1 - m0) * i / (bands + 1));
  for (let b = 0; b < bands; b++) { const lo = edge(b), mid = edge(b + 1), hi = edge(b + 2); for (let k = Math.max(1, Math.ceil(lo / binHz)); k * binHz < hi && k < power.length; k++) { const f = k * binHz; e[b] += power[k] * (f < mid ? (f - lo) / (mid - lo) : (hi - f) / (hi - mid)); } }
  const total = e.reduce((s, v) => s + v, 0) || 1e-20, L = Array.from(e, (v) => Math.max(-80, dB(v / total))), c = [];
  for (let i = 1; i <= coefs; i++) c.push(L.reduce((s, v, b) => s + v * Math.cos(Math.PI * i * (b + 0.5) / bands), 0) / bands);
  return { bandsDb: L, c };
}

// Read one note. x holds the note with a little silence before it; m is the written pitch as a MIDI number when known.
// Returns null for silence. tracks holds the power of each harmonic in every frame (frame j is centred hopSec * j after
// the onset), which the fitting tool reads to shape a voice's partials over time.
export function analyse(x0, sr0, { m = null, span = 1.2 } = {}) {
  let x = x0, sr = sr0; if (sr > 60000) { x = decimate(x0, 2); sr = sr0 / 2; }
  const F = Math.round(0.004 * sr), env = []; for (let s = 0; s + F <= x.length; s += F) { let e = 0; for (let i = s; i < s + F; i++) e += x[i] * x[i]; env.push(Math.sqrt(e / F)); }
  let pk = 0; for (const v of env) pk = Math.max(pk, v); if (pk < 1e-6) return null;
  let i10 = 0; while (env[i10] < 0.1 * pk) i10++; const near = Math.min(env.length, i10 + Math.round(0.4 * sr / F)); let pkA = 0; for (let i = i10; i < near; i++) pkA = Math.max(pkA, env[i]);
  let i90 = i10; while (i90 < near - 1 && env[i90] < 0.9 * pkA) i90++; let iEnd = env.length - 1; while (iEnd > i10 && env[iEnd] < 0.03 * pk) iEnd--;
  const t0 = i10 * F / sr, attackSec = Math.max(0.001, (i90 - i10) * F / sr), dur = Math.min(span, (iEnd + 1) * F / sr - t0); if (dur < 0.03) return null;
  const on = Math.round(t0 * sr), first = x.subarray(Math.min(x.length - 1, on + Math.round(Math.min(0.08, dur * 0.3) * sr)), Math.min(x.length, on + Math.round(dur * sr)));
  let f0 = m === null ? pitchOf(first, sr) : mtof(m); if (!f0) return null;
  const n = f0 < 90 ? 8192 : 4096, hop = n / 8, seg = new Float32Array(Math.round(dur * sr) + n), sa = on - n / 2; for (let i = 0; i < seg.length; i++) { const k = sa + i; if (k >= 0 && k < x.length) seg[i] = x[k]; }
  const st = powerFrames(seg, sr, { n, hop }), bin = st.binHz, J = st.frames.length, bodyA = Math.min(J - 1, Math.ceil(Math.min(Math.max(attackSec, 0.04) + 0.02, 0.4 * dur) / st.hopSec)), body = st.frames.slice(bodyA), avg = new Float64Array(n / 2);
  for (const p of body) for (let b = 0; b < avg.length; b++) avg[b] += p[b] / body.length;
  // the fundamental, refined from the first six harmonics of the averaged spectrum; then the string's stiffness
  { let num = 0, den = 0; for (let k = 1; k <= 6; k++) { const c = Math.round(k * f0 / bin), w = Math.max(2, Math.round(0.03 * k * f0 / bin)); let bi = 0, bv = 0; for (let b = Math.max(2, c - w); b <= c + w && b < avg.length - 1; b++) if (avg[b] > bv) { bv = avg[b]; bi = b; }
      if (!bi) continue; const A = Math.log(avg[bi - 1] + 1e-30), C = Math.log(bv + 1e-30), D = Math.log(avg[bi + 1] + 1e-30), d = A - 2 * C + D, f = (bi + (d ? 0.5 * (A - D) / d : 0)) * bin; num += Math.sqrt(bv) * f / k; den += Math.sqrt(bv); } if (den) f0 = num / den; }
  if (!Number.isFinite(f0) || f0 <= 0) return null;
  const Braw = inharmonicity(x.subarray(Math.min(x.length - 4096, on + Math.round(0.03 * sr))), sr, f0, { partials: 12 }), B = Braw === null || !Number.isFinite(Braw) ? 0 : clamp(Braw, 0, 2e-3);
  const K = Math.max(1, Math.min(100, Math.floor(Math.min(8000, 0.45 * sr) / f0))), win = [];
  for (let k = 1; k <= K; k++) { const fk = k * f0 * Math.sqrt(1 + B * k * k), hw = Math.min(Math.max(3 * bin, 0.03 * fk), 0.45 * f0); win.push([Math.max(1, Math.round((fk - hw) / bin)), Math.min(avg.length - 1, Math.round((fk + hw) / bin))]); }
  const tracks = st.frames.map((p) => { const h = new Float32Array(K); win.forEach(([a, b], k) => { let s = 0; for (let i = a; i <= b; i++) s += p[i]; h[k] = s; }); return h; });
  const H = new Float64Array(K); for (let j = bodyA; j < J; j++) for (let k = 0; k < K; k++) H[k] += tracks[j][k] / (J - bodyA);
  if (!(H.reduce((s, v) => s + v, 0) > 1e-16)) return null;   // nothing sounds at the harmonics of this pitch: not a note the features can describe
  const total = H.reduce((s, v) => s + v, 0) || 1e-20, harmDb = Array.from(H, (v) => Math.max(-90, dB(v / total)));
  // noise: what the averaged spectrum holds between the harmonic windows, up to the fortieth harmonic, and by band
  const Kn = Math.min(K, 40), top = Math.min(avg.length - 1, Math.round((Kn + 0.5) * f0 / bin)), inWin = new Uint8Array(avg.length); for (const [a, b] of win) for (let i = a; i <= b; i++) inWin[i] = 1;
  let noise = 0, harm = 0; for (let b = Math.max(1, Math.round(0.5 * f0 / bin)); b <= top; b++) { if (inWin[b]) harm += avg[b]; else noise += avg[b]; }
  const noiseBands = BANDS.slice(0, -1).map((lo, i) => { let s = 0, w = 0; for (let b = Math.ceil(lo / bin); b * bin < BANDS[i + 1] && b < avg.length; b++) { w++; if (!inWin[b]) s += avg[b]; } return w ? dB(s / total) : -90; });
  // level over the note, from the envelope
  const lev = (a, b) => { const i = Math.round((t0 + a) * sr / F), j = Math.min(env.length, Math.round((t0 + b) * sr / F)); let s = 0, c = 0; for (let q = i; q < j; q++) { s += env[q]; c++; } return c ? s / c : 0; };
  let early = 0; for (let i = i10; i < Math.min(env.length, i10 + Math.round(0.06 * sr / F)); i++) early = Math.max(early, env[i]);
  const later = dur >= 0.3 ? lev(0.15, 0.3) : lev(dur * 0.5, dur), ts = [], ls = []; for (let i = Math.round((t0 + Math.min(0.08, dur * 0.3)) * sr / F); i < Math.round((t0 + dur) * sr / F) && i < env.length; i++) { ts.push(i * F / sr); ls.push(20 * Math.log10(Math.max(env[i], 1e-6))); }
  // brightness over time, and how much the harmonic balance moves
  const cent = [], flux = []; for (let j = bodyA; j < J; j++) { let nu = 0, de = 0; for (let k = 0; k < K; k++) { nu += (k + 1) * tracks[j][k]; de += tracks[j][k]; } cent.push(de ? nu / de : 0);
    if (j - 4 >= bodyA) { let ab = 0, aa = 0, bb = 0; for (let k = 0; k < K; k++) { const u = Math.sqrt(tracks[j][k]), v = Math.sqrt(tracks[j - 4][k]); ab += u * v; aa += u * u; bb += v * v; } flux.push(aa && bb ? 1 - ab / Math.sqrt(aa * bb) : 0); } }
  const third = Math.max(1, Math.floor(cent.length / 3)), cA = mean(cent.slice(0, third)), cB = mean(cent.slice(-third));
  // the first 20 ms against the body: how much of the power sits above the eighth harmonic
  const n2 = 1024, a2 = new Float32Array(n2); for (let i = 0; i < n2; i++) a2[i] = x[on + i] || 0; const pa = powerFrames(a2, sr, { n: n2, hop: n2 }).frames[0], fc = clamp(8.5 * f0, 1200, 9000);
  const share = (p, bz) => { let hi = 0, all = 0; for (let b = Math.ceil(60 / bz); b < p.length && b * bz < 12000; b++) { all += p[b]; if (b * bz > fc) hi += p[b]; } return all ? (hi + 1e-9 * all) / all : 1e-9; };
  const cep = melCepstrum(avg, bin), sumTo = (a, b) => { let s = 0; for (let k = a; k <= b && k <= K; k++) s += H[k - 1]; return s; }, odd = [3, 5, 7, 9].reduce((s, k) => s + (H[k - 1] || 0), 0), even = [2, 4, 6, 8].reduce((s, k) => s + (H[k - 1] || 0), 0);
  const values = { hi: Math.max(-90, dB(sumTo(9, K) / total)), oddEven: clamp(dB((odd + 1e-9 * total) / (even + 1e-9 * total)), -40, 40), centroid: Math.log2(H.reduce((s, v, k) => s + (k + 1) * v, 0) / total),
    attack: Math.log10(attackSec), overshoot: clamp(20 * Math.log10((early + 1e-9) / (later + 1e-9)), -40, 40), decay: clamp(slopeOf(ts, ls), -200, 60), noise: clamp(dB((noise + 1e-12 * harm) / (harm || 1e-20)), -90, 20),
    attackNoise: clamp(dB(share(pa, sr / n2)) - dB(share(avg, bin)), -50, 50), tilt: cA && cB && cent.length >= 3 ? Math.log2(cB / cA) : 0, inharmonicity: B * 1e4, flux: Math.log10(mean(flux) + 1e-5) };
  for (let k = 1; k <= 8; k++) values[`h${k}`] = k <= K ? harmDb[k - 1] : -90; cep.c.forEach((v, i) => { values[`c${i + 1}`] = v; });
  return { sr, f0, m: ftom(f0), B, K, onset: t0, dur, attackSec, harmDb, noiseBands, noiseDb: values.noise, tracks, hopSec: st.hopSec, bodyFrame: bodyA, levelDb: 20 * Math.log10(lev(Math.min(0.05, dur / 2), dur) + 1e-9), vibrato: vibrato(x, sr, on, dur, f0, H), values, vector: FEATURES.map((k) => values[k]) };
}

// Vibrato: the pitch of one strong low harmonic, frame by frame; its depth in cents and its rate in Hz (null when under 4 cents).
function vibrato(x, sr, on, dur, f0, H) {
  if (dur < 0.6) return { depthCents: 0, rateHz: null }; let k = 1; for (let q = 2; q <= Math.min(4, H.length); q++) if (H[q - 1] > 0.25 * H[k - 1]) k = q;
  const n = 2048, hop = 256, seg = x.subarray(on + Math.round(0.1 * sr), Math.min(x.length, on + Math.round(dur * sr))); if (seg.length < 2 * n) return { depthCents: 0, rateHz: null };
  const st = powerFrames(seg, sr, { n, hop }), c = Math.round(k * f0 / st.binHz), w = Math.max(2, Math.round(0.05 * k * f0 / st.binHz)), cents = [];
  for (const p of st.frames) { let bi = c, bv = 0; for (let b = Math.max(2, c - w); b <= c + w && b < p.length - 1; b++) if (p[b] > bv) { bv = p[b]; bi = b; } const A = Math.log(p[bi - 1] + 1e-30), C = Math.log(bv + 1e-30), D = Math.log(p[bi + 1] + 1e-30), d = A - 2 * C + D; cents.push(1200 * Math.log2((bi + (d ? 0.5 * (A - D) / d : 0)) * st.binHz / (k * f0))); }
  const fs = sr / hop, W = Math.round(0.25 * fs), y = cents.map((v, i) => v - mean(cents.slice(Math.max(0, i - W), i + W + 1))), depth = Math.SQRT2 * Math.sqrt(mean(y.map((v) => v * v))); if (depth < 4) return { depthCents: depth, rateHz: null };
  let best = 0, at = 0; for (let lag = Math.round(fs / 9); lag <= Math.round(fs / 3) && lag < y.length / 2; lag++) { let s = 0; for (let i = lag; i < y.length; i++) s += y[i] * y[i - lag]; if (s > best) { best = s; at = lag; } }
  return { depthCents: depth, rateHz: at ? fs / at : null };
}

export const features = (x, sr, opts) => { const a = analyse(x, sr, opts); return a ? { vector: a.vector, values: a.values, m: a.m, f0: a.f0, vibrato: a.vibrato, levelDb: a.levelDb } : null; };
