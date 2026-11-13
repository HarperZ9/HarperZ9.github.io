// low.js: the bottom of the mix, below 120 Hz, where a small speaker or a club system sums the channels to one.
//   low mono loss   level change when left and right are summed, read only on the band under 120 Hz. Low notes that are
//                   out of phase between the channels vanish on a single speaker even when the whole mix sums well.
//   low clash       two bass layers (a sub and a bass guitar, say) are compared in two bands, 35 to 70 Hz and 70 to
//                   140 Hz. A frame clashes when both layers sound in the same band within 6 dB of each other. The share
//                   of clashing frames says how often the two fight for the same place.
import { mono, powerFrames } from './spectrum.js';

// Fourth-order low-pass (two RBJ biquads at Q 0.54 and 1.31, a Butterworth pair).
export function lowpass(x, sr, fc = 120) {
  let y = Float64Array.from(x);
  for (const q of [0.5412, 1.3066]) { const w = 2 * Math.PI * fc / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) { const v = b0 * y[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; y[i] = v; } }
  return y;
}

export function lowMono(channels, sr, fc = 120) {
  if (channels.length < 2) return { lowCorrelation: 1, lowMonoLossDb: 0, lowShareDb: 0 };
  const L = lowpass(channels[0], sr, fc), R = lowpass(channels[1], sr, fc); let ll = 0, rr = 0, lr = 0, full = 0;
  for (let i = 0; i < L.length; i++) { ll += L[i] * L[i]; rr += R[i] * R[i]; lr += L[i] * R[i]; full += channels[0][i] ** 2 + channels[1][i] ** 2; }
  const mid = (ll + rr + 2 * lr) / 4, each = (ll + rr) / 2;
  return { lowCorrelation: lr / (Math.sqrt(ll * rr) || 1e-20), lowMonoLossDb: 10 * Math.log10((mid || 1e-20) / (each || 1e-20)), lowShareDb: 10 * Math.log10((ll + rr || 1e-20) / (full || 1e-20)) };
}

const BANDS = [[35, 70], [70, 140]];
export function lowClash(a, b, sr, { withinDb = 6, activeDb = -30 } = {}) {
  const n = 8192, fa = powerFrames(mono(a), sr, { n, hop: n / 2 }), fb = powerFrames(mono(b), sr, { n, hop: n / 2 });
  const band = (p, [lo, hi]) => { let s = 0; for (let k = Math.round(lo / fa.binHz); k < Math.round(hi / fa.binHz); k++) s += p[k]; return s; };
  const A = fa.frames.map((p) => BANDS.map((q) => band(p, q))), B = fb.frames.map((p) => BANDS.map((q) => band(p, q))), top = (M) => Math.max(1e-20, ...M.flat()), ga = top(A) * Math.pow(10, activeDb / 10), gb = top(B) * Math.pow(10, activeDb / 10), k = Math.pow(10, withinDb / 10);
  let both = 0, clash = 0;
  for (let i = 0; i < A.length && i < B.length; i++) { const actA = A[i].some((v) => v > ga), actB = B[i].some((v) => v > gb); if (!actA || !actB) continue; both++;
    if (BANDS.some((_, q) => A[i][q] > ga && B[i][q] > gb && A[i][q] / B[i][q] < k && B[i][q] / A[i][q] < k)) clash++; }
  return { framesBoth: both, clashShare: both ? clash / both : 0 };
}
