// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// finish.mjs: the last pass, in linear light. A soft shoulder (highlights roll off instead of clipping, R6), a
// rounded vignette, clumped monochrome film grain, then 8- or 16-bit sRGB with TPDF dither (R2).
//   finish(R, t, P) -> raster (still linear, grain added)       encode(R, bits, seed) -> Uint8Array | Uint16Array
// Grain (QUALITY-SPEC R4): blurred white noise with clumps about `cell` px across, mono, its standard deviation `sd` in 8-bit
// code values at mid-grey and strongest in the mid-tones; it re-seeds on a 24 Hz clock (texture boil), never on the
// display rate. Measured on the output by tools/grain.py: surface_sd and grain_corr_px are in the report.
import { linearToSrgb } from '../../glass/lib/raster.js';

export const FINISH = Object.freeze({ shoulder: 0.82, vignette: 0.32, vignetteRound: 0.65, grain: { sd: 3.2, cell: 2.1, rate: 24 }, lift: 0 });

const shoulder = (v, k) => (v <= k ? v : k + (1 - k) * (1 - Math.exp(-(v - k) / (1 - k))));

// Clumped grain: white Gaussian-ish noise per pixel (seeded per 24 Hz tick), blurred by a separable binomial kernel
// whose width sets the clump size. Isotropic, with no lattice: value noise on a pixel-aligned grid showed a screen
// door in the 200% crops, so it was replaced.
function grainField(w, h, seed, cell) {
  const n = w * h, a = new Float32Array(n), b = new Float32Array(n), r = Math.max(1, Math.round(cell * 0.75));
  let s = (seed * 2654435761) >>> 0 || 1; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) a[i] = rnd() + rnd() + rnd() - 1.5;
  // binomial weights for radius r (rows of Pascal's triangle), normalised
  const K = [1]; for (let k = 0; k < 2 * r; k++) { const nk = [1]; for (let i = 1; i < K.length; i++) nk.push(K[i - 1] + K[i]); nk.push(1); K.splice(0, K.length, ...nk); }
  const ks = K.reduce((x, y) => x + y, 0), kn = K.map(v => v / ks);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -r; k <= r; k++) v += kn[k + r] * a[y * w + Math.min(w - 1, Math.max(0, x + k))]; b[y * w + x] = v; }
  let sd = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -r; k <= r; k++) v += kn[k + r] * b[Math.min(h - 1, Math.max(0, y + k)) * w + x]; a[y * w + x] = v; sd += v * v; }
  sd = Math.sqrt(sd / n) || 1; for (let i = 0; i < n; i++) a[i] /= sd;   // unit standard deviation
  return a;
}

export function finish(R, t, P = {}) {
  const p = { ...FINISH, ...P, grain: { ...FINISH.grain, ...(P.grain ?? {}) } }, { w, h, data } = R, O = { w, h, data: new Float32Array(data.length) };
  const seed = Math.floor(t * p.grain.rate) + 1, cell = p.grain.cell * Math.max(1, w / 1920) ** 0.5, G = p.grain.sd > 0 ? grainField(w, h, seed, cell) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, u = (x + 0.5) / w - 0.5, v = (y + 0.5) / h - 0.5;
    const rr = Math.hypot(u * 1.0, v * 1.2) / 0.62, vig = 1 - p.vignette * Math.max(0, rr) ** (2 + 4 * p.vignetteRound);
    const g = G ? G[y * w + x] : 0;
    for (let c = 0; c < 3; c++) {
      let s = linearToSrgb(Math.max(0, shoulder(data[i + c] * vig + p.lift, p.shoulder)));
      s += g * p.grain.sd / 255 * (0.35 + 2.6 * s * (1 - s));   // grain strongest in the mid-tones, in sRGB code values
      O.data[i + c] = s;
    }
    O.data[i + 3] = 1;
  }
  O.encoded = 'srgb';
  return O;
}

export function encode(R, bits = 8, seed = 1) {
  const { w, h, data } = R, n = w * h, max = bits === 16 ? 65535 : 255, out = bits === 16 ? new Uint16Array(n * 4) : new Uint8Array(n * 4);
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) {
    const v = c === 3 ? 1 : (R.encoded === 'srgb' ? data[i * 4 + c] : linearToSrgb(Math.max(0, data[i * 4 + c])));
    const d = bits === 8 ? rnd() - rnd() : 0;
    out[i * 4 + c] = Math.max(0, Math.min(max, Math.round(v * max + d)));
  }
  return out;
}
