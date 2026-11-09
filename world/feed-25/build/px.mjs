// px.mjs: the shared pixel helpers of the compositor (colour, transfer tables, seeds). Pure.
import { rng, toLin, toSrgb, hexLin } from '../../feed-24/build/raster.js';

export { rng, toLin, toSrgb, hexLin };

// 16-bit linear to sRGB table, so encoding adds no visible steps even in a 16-bit export.
const ENC = Float32Array.from({ length: 65536 }, (_, i) => toSrgb(i / 65535));
export const enc = (v) => ENC[v <= 0 ? 0 : v >= 1 ? 65535 : (v * 65535 + 0.5) | 0];

// A 32-bit mix of two integers: seeds for sub-generators.
export function hash(a, b = 0) {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return h >>> 0;
}

// '#rrggbb' or a linear [r, g, b] in, linear [r, g, b] out.
export function colour(c) {
  if (Array.isArray(c)) return c;
  if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) return hexLin(c);
  throw new TypeError(`compose: colour must be #rrggbb or a linear [r, g, b], got ${c}`);
}

// Standard normal from a uniform generator (Box-Muller, one value per call).
export function gauss(r) { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * v); }

// Read a scalar field: a Float32Array of the layer's size, a function (u, v) -> 0..1, or a layer (its luma).
export function sampler(f, w, h) {
  if (typeof f === 'function') return (x, y) => f(x / w, y / h);
  if (f instanceof Float32Array) {
    if (f.length !== w * h) throw new RangeError(`compose: field has ${f.length} values, layer has ${w * h}`);
    return (x, y) => f[Math.min(h - 1, Math.max(0, y | 0)) * w + Math.min(w - 1, Math.max(0, x | 0))];
  }
  if (f && f.px && f.w) {
    const F = f.lumaField(), fw = f.w, fh = f.h;
    return (x, y) => F[Math.min(fh - 1, Math.max(0, ((y / h) * fh) | 0)) * fw + Math.min(fw - 1, Math.max(0, ((x / w) * fw) | 0))];
  }
  throw new TypeError('compose: a field must be a Float32Array, a function (u, v) or a layer');
}

// Bilinear read of a linear RGB buffer, clamped at the edges, into out[0..2].
export function bilinear(px, w, h, x, y, out) {
  x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y));
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = x - x0, ty = y - y0;
  const a = 3 * (y0 * w + x0), b = 3 * (y0 * w + x1), c = 3 * (y1 * w + x0), d = 3 * (y1 * w + x1);
  for (let k = 0; k < 3; k++) out[k] = (px[a + k] * (1 - tx) + px[b + k] * tx) * (1 - ty) + (px[c + k] * (1 - tx) + px[d + k] * tx) * ty;
  return out;
}
