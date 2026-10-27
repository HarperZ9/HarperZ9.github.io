// brush/core.js: colour, randomness and noise shared by the brush engine.
// Everything here is pure and deterministic, so a painting replays the same at any resolution.

// sRGB transfer, exact (IEC 61966-2-1), so blending happens in linear light and soft edges do not darken.
export const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// '#rrggbb' or [r, g, b] in 0..255 sRGB, to linear [r, g, b] in 0..1.
export function linear(color) {
  if (Array.isArray(color)) return color.map((v) => toLinear(v / 255));
  const m = /^#?([0-9a-f]{6})$/i.exec(String(color).trim());
  if (!m) throw new TypeError(`brush: colour must be #rrggbb, got ${color}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
}

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// mulberry32: small, fast, good enough for jitter. Returns floats in [0, 1).
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer lattice hash to [0, 1).
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Value noise on a lattice that wraps every `period` cells (period 0 means no wrap).
export function valueNoise(x, y, seed = 0, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = fade(x - xi), fy = fade(y - yi);
  const w = (v) => (period ? ((v % period) + period) % period : v);
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

// Gradient (Perlin-style) noise in about 0..1, wrapping every `period` cells. Thresholded value noise keeps the
// square lattice visible (blocky speckle at 4K); gradient noise has no flat cells, so its blobs stay round.
export function gradNoise(x, y, seed = 0, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fade(fx), v = fade(fy);
  const w = (q) => (period ? ((q % period) + period) % period : q);
  const g = (ix, iy, dx, dy) => { const a = hash2(w(ix), w(iy), seed) * Math.PI * 2; return Math.cos(a) * dx + Math.sin(a) * dy; };
  const n = lerp(lerp(g(xi, yi, fx, fy), g(xi + 1, yi, fx - 1, fy), u), lerp(g(xi, yi + 1, fx, fy - 1), g(xi + 1, yi + 1, fx - 1, fy - 1), u), v);
  return 0.5 + n * 0.7071;
}

// Fractal sum, normalised to about 0..1.
export function fbm(x, y, seed = 0, octaves = 4, gain = 0.5, period = 0) {
  let s = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    s += amp * valueNoise(x * f, y * f, seed + i * 101, period ? period * f : 0);
    norm += amp; amp *= gain; f *= 2;
  }
  return s / norm;
}

// Curl of a scalar noise potential: a divergence-free flow, so smoke paths curl without bunching up.
export function curl(x, y, seed = 0, eps = 0.01) {
  const n = (u, v) => fbm(u, v, seed, 3, 0.5);
  const dx = (n(x + eps, y) - n(x - eps, y)) / (2 * eps);
  const dy = (n(x, y + eps) - n(x, y - eps)) / (2 * eps);
  return [dy, -dx];
}
