// field.mjs: small helpers shared by the plates. Scalar fields are Float32Array(w * h), row-major.
import { Layer, colour } from '../../feed-25/build/compose.mjs';
import { fbm, boxBlur, rng as trng } from '../../techniques/lib/util.js';

export { fbm, boxBlur };
export const rng = trng;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// A field from f(x, y) in pixels.
export function field(w, h, f) {
  const F = new Float32Array(w * h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) F[i] = f(x, y, i);
  return F;
}

// A layer from a scalar field through colour stops (linear light), t in 0..1 along the stops.
export function ramp(w, h, F, stops, { alpha = null, seed = 1 } = {}) {
  const L = new Layer(w, h, { seed }), C = stops.map(colour), n = C.length - 1, p = L.px;
  for (let i = 0; i < w * h; i++) {
    const t = clamp(F[i]) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k, a = C[k], b = C[k + 1];
    p[3 * i] = a[0] + (b[0] - a[0]) * f; p[3 * i + 1] = a[1] + (b[1] - a[1]) * f; p[3 * i + 2] = a[2] + (b[2] - a[2]) * f;
  }
  if (alpha) L.a = alpha;
  return L;
}

// A flat colour layer whose coverage is the field.
export function inked(w, h, hex, cover, seed = 1) { const L = new Layer(w, h, { seed }).fill(hex); L.a = cover; return L; }

// Fractal noise at a feature size given in pixels (so a 4K export keeps the same look as the preview, only finer).
export function noiseField(w, h, featurePx, seed, octaves = 5) {
  const k = 1 / Math.max(1, featurePx);
  return field(w, h, (x, y) => fbm(x * k, y * k, seed, octaves));
}

// Resample a mask (any size) to w x h, bilinear. Returns null when there is no mask.
export function fitMask(mask, w, h) {
  if (!mask) return null;
  if (mask.w === w && mask.h === h) return mask.data;
  const out = new Float32Array(w * h), sx = mask.w / w, sy = mask.h / h, M = mask.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = Math.min(mask.w - 1.001, Math.max(0, (x + 0.5) * sx - 0.5)), fy = Math.min(mask.h - 1.001, Math.max(0, (y + 0.5) * sy - 0.5));
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, i = y0 * mask.w + x0;
    out[y * w + x] = (M[i] * (1 - ax) + M[i + 1] * ax) * (1 - ay) + (M[i + mask.w] * (1 - ax) + M[i + mask.w + 1] * ax) * ay;
  }
  return out;
}

// Anti-aliased coverage of a band of half-width hw around a signed distance d (px): 1 px ramp (R3, R3b).
export const band = (d, hw) => clamp(hw - Math.abs(d) + 0.5);

// Disc splat into a field with an anti-aliased rim; additive (optical density).
export function disc(F, w, h, cx, cy, r, v) {
  const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(w - 1, Math.ceil(cx + r + 1)), y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r, c = clamp(0.5 - d);
    if (c > 0) F[y * w + x] += v * c * (r < 0.5 ? r * 2 : 1);
  }
}
