// lib/manyfold.mjs: one skeleton, many renderings (build a).
//
// Every rendering reads the same skeleton (lib/skel.mjs): its coverage, its signed distance and its centre lines.
// So a word can be filled, outlined, screened in triangles, built from scan strokes or split into spectral
// fringes, and every version keeps the same shape. Each function returns coverage (Float32Array w*h, 0..1), except
// `split`, which returns emitted light for a dark panel.
//
// SPEC (QUALITY-SPEC S1, S2):
//   fill(sk)                                       coverage as set
//   outline(sk, { width 0.6..12 px, offset -20..20 px, rings 1..3, gap 1..20 px })
//   halftoneTri(sk, { pitch 3..60 px, tone 0..1 or Float32Array, gain 0.5..1.6, angle 0..60 deg })
//   scan(sk, { pitch 3..40 px, thick 0.6..12 px, overshoot 0..4 x pitch, drop 0..0.5, weight true|false, seed })
//   split(cov, w, h, { spread 0..40 px, angle deg, samples 3..24, glass crown|flint|dense|silica })
// Determinism (S3): pure functions of the skeleton and the seed.
import { triSdf } from './geom.mjs';
import { rngFrom, blur } from './raster.mjs';
import { GLASSES } from '../../../glass/lib/optics.js';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

export const fill = (sk) => Float32Array.from(sk.cov);

/** Rings at offsets from the edge: |sdf - offset| within width/2. rings > 1 adds inlines inside, gap px apart. */
export function outline(sk, { width = 2, offset = 0, rings = 1, gap = 6 } = {}) {
  const out = new Float32Array(sk.w * sk.h), hw = width / 2;
  for (let k = 0; k < rings; k++) {
    const o = offset - k * gap;
    for (let i = 0; i < out.length; i++) { const c = clamp(hw - Math.abs(sk.sdf[i] - o) + 0.5); if (c > out[i]) out[i] = c; }
  }
  return out;
}

/**
 * A screen of equilateral triangles on a triangular tiling (apex up and apex down alternate). Each triangle is
 * scaled so its area share equals the tone under it: tone = (letter coverage averaged over one cell) x `tone`.
 * The lattice is rotated by `angle`.
 */
export function halftoneTri(sk, { pitch = 9, tone = 1, gain = 1, angle = 0 } = {}) {
  const { w, h } = sk, out = new Float32Array(w * h), local = blur(sk.cov, w, h, pitch * 0.35);
  const hgt = (pitch * Math.sqrt(3)) / 2, a = (angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), half = pitch / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x + 0.5, Y = y + 0.5, u = X * ca + Y * sa, v = -X * sa + Y * ca;
    const row = Math.floor(v / hgt), off = (row & 1) * half, base = row * hgt;
    const mu = Math.round((u - off) / pitch), md = Math.floor((u - off) / pitch);
    const ux = off + mu * pitch, uy = base + (2 / 3) * hgt, dx = off + (md + 0.5) * pitch, dy = base + hgt / 3;
    const up = triSdf(u - ux, v - uy, half) <= triSdf(u - dx, -(v - dy), half);
    const cx = up ? ux : dx, cy = up ? uy : dy;
    const gx = Math.round(cx * ca - cy * sa), gy = Math.round(cx * sa + cy * ca);
    const tv = typeof tone === 'number' ? tone : tone[clamp(gy, 0, h - 1) * w + clamp(gx, 0, w - 1)];
    const t = clamp(local[clamp(gy, 0, h - 1) * w + clamp(gx, 0, w - 1)] * tv * gain);
    if (t <= 0.002) continue;
    const r = half * Math.sqrt(t), d = triSdf(u - cx, up ? v - cy : -(v - cy), r);
    out[y * w + x] = clamp(0.5 - d);
  }
  return out;
}

/**
 * Scan strokes: the glyph sampled on horizontal scan lines. Every run where a line crosses ink is drawn as one
 * horizontal stroke, overshooting its ends by a seeded, heavy-tailed amount, so the word reads as a raster
 * signal. weight: each run's thickness follows the stroke depth under it (thin where the letter is thin).
 */
export function scan(sk, { pitch = 7, thick = 2.2, overshoot = 0.8, drop = 0.06, weight = true, seed = 'scan' } = {}) {
  const { w, h } = sk, out = new Float32Array(w * h), r = rngFrom(seed), runs = scanRuns(sk, pitch);
  for (const run of runs) {
    if (r() < drop) continue;
    const tail = () => overshoot * pitch * (r() < 0.12 ? 3 + 6 * r() : r() * r());
    const x0 = Math.max(0, run.x0 - tail()), x1 = Math.min(w - 1, run.x1 + tail());
    const depth = weight ? clamp(run.depth / Math.max(1, sk.half), 0.35, 1.25) : 1, hw = (thick * depth) / 2;
    for (let y = Math.max(0, Math.floor(run.y - hw - 1)); y <= Math.min(h - 1, Math.ceil(run.y + hw + 1)); y++) {
      const cy = clamp(hw - Math.abs(y + 0.5 - run.y) + 0.5);
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const cx = clamp(Math.min(x + 1 - x0, x1 - x)), c = cy * cx, j = y * w + x; if (c > out[j]) out[j] = c;
      }
    }
  }
  return out;
}

/** Runs of ink along scan lines at a pitch: [{ y, x0, x1, depth }], depth = deepest sdf inside the run (px). */
export function scanRuns(sk, pitch) {
  const { w, h } = sk, runs = [];
  for (let y = pitch / 2; y < h; y += pitch) {
    const row = Math.floor(y) * w; let x0 = -1, depth = 0;
    for (let x = 0; x <= w; x++) {
      const ink = x < w && sk.cov[row + x] >= 0.5;
      if (ink) { if (x0 < 0) { x0 = x; depth = 0; } depth = Math.max(depth, -sk.sdf[row + x]); }
      else if (x0 >= 0) { runs.push({ y, x0, x1: x, depth }); x0 = -1; }
    }
  }
  return runs;
}

// Wyman, Sloan and Shirley (2013): a multi-lobe Gaussian fit to the CIE 1931 colour matching functions.
const g = (x, m, s1, s2) => { const t = (x - m) * (x < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
export function cie(l) {
  const X = 1.056 * g(l, 599.8, 0.0264, 0.0323) + 0.362 * g(l, 442.0, 0.0624, 0.0374) - 0.065 * g(l, 501.1, 0.049, 0.0382);
  const Y = 0.821 * g(l, 568.8, 0.0213, 0.0247) + 0.286 * g(l, 530.9, 0.0613, 0.0322);
  const Z = 1.217 * g(l, 437.0, 0.0845, 0.0278) + 0.681 * g(l, 459.0, 0.0385, 0.0725);
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
}

/** Spectral weights for n samples over 420..680 nm, scaled so they sum to white (1, 1, 1). */
export function spectralWeights(n) {
  const W = []; const sum = [0, 0, 0];
  for (let k = 0; k < n; k++) { const c = cie(420 + (260 * k) / Math.max(1, n - 1)).map((v) => Math.max(0, v)); W.push(c); for (let i = 0; i < 3; i++) sum[i] += c[i]; }
  return W.map((c) => c.map((v, i) => v / (sum[i] || 1)));
}

/**
 * Spectral split: the coverage drawn once per wavelength sample, each copy shifted along `angle` in proportion to
 * the glass's dispersion (1 / Abbe number), and summed as light. The core stays white; the edges fringe from violet
 * to red. Returns emitted light, Float32Array(w*h*3).
 */
export function split(cov, w, h, { spread = 8, angle = 0, samples = 9, glass = 'flint' } = {}) {
  const out = new Float32Array(w * h * 3), W = spectralWeights(samples), vd = GLASSES[glass]?.vd ?? 36.37, s = spread * (36.37 / vd);
  const a = (angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  for (let k = 0; k < samples; k++) {
    const o = s * ((k / Math.max(1, samples - 1)) * 2 - 1), dx = o * ux, dy = o * uy, c = W[k];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = sample(cov, w, h, x - dx, y - dy); if (v <= 0) continue; const j = (y * w + x) * 3;
      out[j] += c[0] * v; out[j + 1] += c[1] * v; out[j + 2] += c[2] * v;
    }
  }
  return out;
}
function sample(f, w, h, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), u = x - x0, v = y - y0;
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : f[yy * w + xx]);
  return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v;
}

export const RENDERINGS = Object.freeze(['fill', 'outline', 'halftone', 'scan', 'split']);
