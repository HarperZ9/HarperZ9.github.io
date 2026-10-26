// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// layer.mjs: the one data shape every generator makes and every generator reads (BLEED sections 11 to 15).
//
// A layer is one law acting on a grid of ticks:
//   fields.amount   Float32Array(w*h): the primary tick at each cell, a point measurement of value, usually 0..1
//   fields.rgb      optional Float32Array(3*w*h): per-tick linear colour (light for emit, transmission for absorb)
//   fields.vel      optional Float32Array(2*w*h): per-tick velocity in cells per step (motion other layers can ride)
//   fields.height   optional Float32Array(w*h): per-tick thickness or height (glass, drops, relief)
//   law             { shape, params }: how this layer acts when combined (combine.mjs reads it, nothing above it does)
//   weights         the generator's weight parameters, each a number 0..1 or a named strength
//   timing          an optional timing layer (gen/timing.mjs) or null: when change happens, kept apart from what changes
//
// value(layer) is a cache of the ticks, recomputed when the ticks change; it never replaces them, and combine never
// reads it (the metamer test in tests/metamer.test.mjs checks exactly that).
import { rngFrom } from '../../../superframe/lib/seed.mjs';

export const F32 = n => new Float32Array(n);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export { rngFrom };

// sRGB hex to linear rgb
export function hexLin(h) {
  const n = parseInt(h.slice(1), 16);
  return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
}
export const linToSrgb8 = v => { const c = clamp(v, 0, 1); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)); };

export function makeLayer(gen, { w, h, law, weights = {}, timing = null, fields = {}, ink = null, state = {}, name = null }) {
  const n = w * h;
  return {
    gen, name: name ?? gen, w, h, n, law, weights, timing, ink,
    fields: { amount: fields.amount ?? F32(n), ...fields },
    t: 0, steps: 0, state,
    prev: null, history: { change: [], spread: [], mean: [] }, settledAt: null, cache: null,
  };
}

// bilinear sample of a scalar field with clamped edges
export function sample(f, w, h, x, y) {
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
  const i = x | 0, j = y | 0, a = x - i, b = y - j, k = j * w + i;
  return (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + w] * (1 - a) + f[k + w + 1] * a) * b;
}
// bilinear sample of channel c in an interleaved field with C channels
export function sampleC(f, C, c, w, h, x, y) {
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
  const i = x | 0, j = y | 0, a = x - i, b = y - j, k = (j * w + i) * C + c;
  return (f[k] * (1 - a) + f[k + C] * a) * (1 - b) + (f[k + w * C] * (1 - a) + f[k + w * C + C] * a) * b;
}

// three box passes approximate a gaussian of radius r
export function blur(src, w, h, r) {
  const R = Math.max(1, Math.round(r)); let a = Float32Array.from(src); const t = F32(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -R; x <= R; x++) s += a[y * w + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * R + 1); s += a[y * w + clamp(x + R + 1, 0, w - 1)] - a[y * w + clamp(x - R, 0, w - 1)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -R; y <= R; y++) s += t[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * R + 1); s += t[clamp(y + R + 1, 0, h - 1) * w + x] - t[clamp(y - R, 0, h - 1) * w + x]; } }
  }
  return a;
}

// central-difference gradient of a scalar field at a cell
export function grad(f, w, h, i, j) {
  const l = f[j * w + Math.max(0, i - 1)], r = f[j * w + Math.min(w - 1, i + 1)], u = f[Math.max(0, j - 1) * w + i], d = f[Math.min(h - 1, j + 1) * w + i];
  return [(r - l) / 2, (d - u) / 2];
}

// 5-point Laplacian with clamped edges, into out
export function laplace(f, w, h, out) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    out[k] = f[j * w + Math.max(0, i - 1)] + f[j * w + Math.min(w - 1, i + 1)] + f[Math.max(0, j - 1) * w + i] + f[Math.min(h - 1, j + 1) * w + i] - 4 * f[k];
  }
  return out;
}

// the cached value of a layer's ticks: mean, spatial spread, coverage, and a 16-bin spectrum (BLEED section 12)
export function summarise(layer) {
  if (layer.cache && layer.cache.steps === layer.steps) return layer.cache.value;
  const a = layer.fields.amount, n = a.length; let s = 0, s2 = 0, cov = 0; const bins = new Array(16).fill(0);
  for (let k = 0; k < n; k++) { const v = a[k]; s += v; s2 += v * v; if (v > 0.05) cov++; bins[clamp(Math.floor(clamp(v, 0, 1) * 16), 0, 15)]++; }
  const mean = s / n, value = { mean, spread: Math.sqrt(Math.max(0, s2 / n - mean * mean)), coverage: cov / n, spectrum: { edges: Array.from({ length: 17 }, (_, i) => i / 16), counts: bins } };
  layer.cache = { steps: layer.steps, value };
  return value;
}

// a text mask on a grid, without a font engine: a 5x7 bitmap face (our own, drawn here), scaled and softened.
// Used where the living cuts' atlas (data/glyph-atlas.json) is not loaded.
export const FACE = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01111100001000010000100001000001111', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', G: '01111100001000010011100011000101111', H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111', ' ': '00000000000000000000000000000000000', '.': '00000000000000000000000000110001100',
};
export function textMask(text, w, h, { x0 = 0.1, y0 = 0.35, x1 = 0.9, y1 = 0.65, soft = 0.8 } = {}) {
  const chars = [...text.toUpperCase()].map(c => FACE[c] ?? FACE[' ']), cols = chars.length * 6 - 1, m = F32(w * h);
  const bw = (x1 - x0) * w, bh = (y1 - y0) * h, cell = Math.min(bw / cols, bh / 7), ox = x0 * w + (bw - cell * cols) / 2, oy = y0 * h + (bh - cell * 7) / 2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const gx = (i + 0.5 - ox) / cell, gy = (j + 0.5 - oy) / cell; if (gx < 0 || gy < 0 || gy >= 7 || gx >= cols) continue;
    const ci = Math.floor(gx / 6), cx = Math.floor(gx) - ci * 6, cy = Math.floor(gy); if (cx > 4) continue;
    if (chars[ci][cy * 5 + cx] === '1') m[j * w + i] = 1;
  }
  return soft > 0 ? blur(m, w, h, soft) : m;
}
