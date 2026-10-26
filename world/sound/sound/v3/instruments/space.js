// A dark room in pure DSP: an eight-line feedback delay network (Householder mixing, mutually prime delays), with a one-pole
// low-pass inside each line so the highs die first, gains set from the target RT60, a pre-delay, and two decorrelated output
// taps for width. Our own implementation of the textbook FDN (Jot and Chaigne's design); no impulse response is needed, so it
// runs anywhere the instruments run.
import { clamp } from './core.js';

export const meta = {
  id: 'room', title: 'Dark room (FDN)', kind: 'space',
  params: { rt60: { min: 0.3, max: 4, default: 1.5, unit: 's' }, damp: { min: 1000, max: 12000, default: 3500, unit: 'Hz', doc: 'where the tail darkens' },
    predelay: { min: 0, max: 0.08, default: 0.02, unit: 's' }, size: { min: 0.5, max: 2, default: 1 }, width: { min: 0, max: 1, default: 0.8 } },
  presets: { 'dark-1.5': { rt60: 1.5, damp: 3000, predelay: 0.022, size: 1, width: 0.85 }, 'small-dry': { rt60: 0.6, damp: 6000, predelay: 0.004, size: 0.6, width: 0.4 }, 'wide-return': { rt60: 1.9, damp: 2600, predelay: 0.035, size: 1.4, width: 1 } },
};
const BASE = [1031, 1187, 1361, 1499, 1657, 1811, 1993, 2179];  // samples at 48 kHz, mutually prime

// Wet only: returns { L, R } of the same length as the input plus `tail` seconds.
export function room(inL, inR, p, sr = 48000, tail = 3) {
  const n = inL.length + Math.floor(tail * sr), L = new Float32Array(n), R = new Float32Array(n), N = 8;
  const lens = BASE.map((d) => Math.max(8, Math.round(d * p.size * sr / 48000))), bufs = lens.map((l) => new Float32Array(l)), idx = new Array(N).fill(0);
  const g = lens.map((l) => Math.pow(10, (-3 * l / sr) / p.rt60)), a = Math.exp(-2 * Math.PI * p.damp / sr), lp = new Float32Array(N), pd = Math.floor(p.predelay * sr);
  const out = new Float32Array(N);
  for (let i = 0; i < n; i++) {
    const j = i - pd, xl = j >= 0 && j < inL.length ? inL[j] : 0, xr = j >= 0 && j < inR.length ? inR[j] : 0;
    let sum = 0; for (let k = 0; k < N; k++) { out[k] = bufs[k][idx[k]]; sum += out[k]; }
    const h = (2 / N) * sum;  // Householder: y = x - (2/N) * sum(x)
    for (let k = 0; k < N; k++) {
      let v = (out[k] - h) * g[k]; lp[k] = (1 - a) * v + a * lp[k]; v = lp[k];
      bufs[k][idx[k]] = v + (k % 2 ? xr : xl) * 0.35; idx[k] = (idx[k] + 1) % lens[k];
    }
    const c = (out[0] + out[2] + out[4] + out[6]) * 0.5, d = (out[1] + out[3] + out[5] + out[7]) * 0.5, w = clamp(p.width, 0, 1);
    L[i] = c * (0.5 + 0.5 * w) + d * (0.5 - 0.5 * w); R[i] = d * (0.5 + 0.5 * w) + c * (0.5 - 0.5 * w);
  }
  return { L, R };
}
