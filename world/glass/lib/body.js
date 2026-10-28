// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// body.js: glass bodies as height fields. A body is { w, h, mask: Float32Array coverage 0..1, height:
// Float32Array thickness in px }. Sources: a coverage mask (a word, any silhouette) through an exact Euclidean
// distance transform and a bevel profile, or a 2D signed distance function. Fluting and ribbing add convex reeds
// across the body, after the fluted arch in the author's stills.
import { clamp, boxBlur } from './raster.js';

const INF = 1e20;
// Felzenszwalb and Huttenlocher (2004) 1D squared distance transform, in place on f (length n).
function dt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
}
// Exact Euclidean distance from each pixel to the nearest pixel where `inside` is false. 0 outside.
export function edt(inside, w, h) {
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = inside[i] ? INF : 0;
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; dt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; dt1(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = d[x]; }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(g[i]);
  return out;
}

// Height from a mask: a rounded bevel of `radius` px rising to `thickness` px. profile 'round' is a quarter circle
// (a pressed, fire-polished edge); 'chamfer' is a straight 45-degree cut; 'pillow' keeps rising toward the middle.
export function fromMask(mask, w, h, { radius = 24, thickness = 40, profile = 'round', soften = 1 } = {}) {
  const inside = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inside[i] = mask[i] >= 0.5 ? 1 : 0;
  const D = edt(inside, w, h), H = new Float32Array(w * h);
  let dmax = 0; for (let i = 0; i < w * h; i++) dmax = Math.max(dmax, D[i]);
  for (let i = 0; i < w * h; i++) {
    const d = D[i] - 0.5 + mask[i] * 0.5; if (d <= 0) continue;
    const u = clamp(d / radius);
    const p = profile === 'chamfer' ? u : profile === 'pillow' ? Math.sqrt(clamp(D[i] / Math.max(1, dmax))) : Math.sqrt(1 - (1 - u) * (1 - u));
    H[i] = thickness * p;
  }
  const S = soften > 0 ? boxBlur(H, w, h, soften, { passes: 2 }) : H;
  return { w, h, mask: Float32Array.from(mask), height: S };
}

// Convex reeds across the body. axis 'x' runs reeds vertically (pitch measured along x), 'y' horizontally.
// depth is in px of extra thickness at each reed's crown; reeds follow the body (zero outside the mask).
export function flute(body, { pitch = 18, depth = 6, axis = 'x', phase = 0, from = 0, to = Infinity, feather = 0 } = {}) {
  if (!(pitch >= 2) || depth === 0) return body;
  const { w, h, mask } = body, H = Float32Array.from(body.height);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (mask[i] <= 0 || y < from || y > to) continue;
    const fade = feather > 0 ? clamp((y - from) / feather) : 1;
    // half-sine reeds: round crowns that meet in a cusp with a finite slope (depth x pi / pitch at the cusp)
    const s = ((axis === 'x' ? x : y) + phase) / pitch, f = s - Math.floor(s);
    H[i] += depth * fade * Math.sin(Math.PI * f) * mask[i];
  }
  return { ...body, height: H };
}

// Surface normal of the front face from the height field (central differences), unit length.
export function normalAt(body, x, y) {
  const { w, h, height: H } = body, xi = clamp(x | 0, 1, w - 2), yi = clamp(y | 0, 1, h - 2), i = yi * w + xi;
  const gx = 0.5 * (H[i + 1] - H[i - 1]), gy = 0.5 * (H[i + w] - H[i - w]), l = Math.hypot(gx, gy, 1);
  return [-gx / l, -gy / l, 1 / l];
}

// ---- signed distance shapes (px, negative inside), for bodies drawn from geometry rather than a mask ----
export const sd = {
  circle: (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r,
  ellipse: (x, y, cx, cy, rx, ry) => { const k = Math.hypot((x - cx) / rx, (y - cy) / ry); return (k - 1) * Math.min(rx, ry); },
  box: (x, y, cx, cy, hx, hy, r = 0) => { const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; },
  capsule: (x, y, ax, ay, bx, by, r) => { const px = x - ax, py = y - ay, ex = bx - ax, ey = by - ay, t = clamp((px * ex + py * ey) / (ex * ex + ey * ey)); return Math.hypot(px - ex * t, py - ey * t) - r; },
};
export const smin = (a, b, k) => { const hh = clamp(0.5 + 0.5 * (b - a) / k); return b + (a - b) * hh - k * hh * (1 - hh); };
export const sub = (a, b) => Math.max(a, -b);

// Rasterise an SDF to an anti-aliased coverage mask.
export function maskFromSdf(w, h, f) {
  const M = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) M[y * w + x] = clamp(0.5 - f(x + 0.5, y + 0.5));
  return M;
}

// Our figure (house design, not any reference's bust): a standing stele with a raised shoulder line and a head
// that is an aperture, a ring with an open centre. Normalised to the frame: cx, base and height are shares.
export function figure(w, h, { cx = 0.62, top = 0.12, base = 1.04, lean = 0.04 } = {}) {
  const H = (base - top) * h, X = cx * w, T = top * h, u = H / 10;
  const headR = 1.25 * u, headY = T + headR, ring = 0.52 * headR;
  const f = (x, y) => {
    const k = (y - T) / H, xx = x - lean * u * 10 * (1 - k) * 0.3;
    const head = sub(sd.circle(xx, y, X, headY, headR), sd.circle(xx, y, X + 0.06 * u, headY + 0.04 * u, ring));
    const neck = sd.box(xx, y, X, headY + headR + 0.45 * u, 0.42 * u, 0.6 * u, 0.3 * u);
    const shoulders = sd.box(xx, y, X, T + 3.55 * u, 2.25 * u, 0.62 * u, 0.6 * u);
    const torso = sd.box(xx, y, X + 0.05 * u * (k - 0.5), T + 6.6 * u, 1.75 * u - 0.15 * u * k, 3.3 * u, 0.9 * u);
    return Math.min(smin(smin(neck, shoulders, 0.55 * u), torso, 0.8 * u), head);
  };
  return { mask: maskFromSdf(w, h, f), unit: u };
}

// The arch: a slab with a round-headed opening, as a parameterised body for fluting.
export function arch(w, h, { cx = 0.5, top = 0.18, base = 0.92, halfW = 0.18, wall = 0.055 } = {}) {
  const X = cx * w, T = top * h, B = base * h, hw = halfW * w, ow = hw - wall * w, sp = T + hw;
  const outer = (x, y) => Math.min(sd.circle(x, y, X, sp, hw), sd.box(x, y, X, (sp + B) / 2, hw, (B - sp) / 2));
  if (!(wall > 0)) return { mask: maskFromSdf(w, h, outer) };
  const inner = (x, y) => Math.min(sd.circle(x, y, X, sp + wall * w, ow), sd.box(x, y, X, (sp + B) / 2 + wall * w, ow, (B - sp) / 2));
  return { mask: maskFromSdf(w, h, (x, y) => sub(outer(x, y), inner(x, y))) };
}
