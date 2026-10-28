// painting.mjs: our own painted source scene for the medium-translation tool, so no third-party pixel is ever the
// input. A dusk valley: violet sky with clouds lit from below, two far ranges in aerial perspective, a banded sandstone
// mesa with gullies lit from the left, a sage plain with juniper shrubs, a winding river that mirrors the sky, reeds in
// front. Painted in two passes: a base colour field, then a brush pass of oriented dabs that sample and smear the base
// (the layered-brush method of Hertzmann 1998, our own code), with bristle streaks, plus drawn reeds and shrubs.
//
// Not a copy of the reference pair (Nandepu painting, Xeleph pixel study, feed set 28): different subject, palette and
// layout. The reference supplies only the idea that one scene can live in two mediums.
import { raster, clamp, smooth, rng, gauss } from './lib/field.mjs';
import { hexLin, mixLin } from './lib/color.mjs';
import { fbm } from '../../techniques/lib/util.js';

export const SPEC = {
  id: 'painting.valley',
  params: { w: { min: 64, max: 4096, default: 960, unit: 'px' }, h: { min: 64, max: 4096, default: 720, unit: 'px' }, dabs: { min: 0, max: 4, default: 1, unit: 'dab density (1 = about 9500 dabs at 960 x 720)' }, seed: { default: 'valley', unit: 'string' } },
};

const P = { skyTop: '#241d43', skyMid: '#6e4676', skyLow: '#f0a273', cloudLit: '#f3b38a', cloudShade: '#5b4372', range1: '#7b6c95', range2: '#4b4468', mesaLit: '#d0823f', mesaBand: '#9a4a2c', mesaShade: '#58303d', plainFar: '#a5a07a', plain: '#6f8657', plainNear: '#4b6343', shrub: '#2c3a2c', river: '#e0a07c', bank: '#3a3530', reed: '#1c1a1e', reedTip: '#b7643a' };
const C = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, hexLin(v)]));

export function geometry(w, h, seed = 'valley') {
  const s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7), horizon = 0.57 * h;
  return {
    s, horizon,
    ridge1: x => horizon - (0.11 + 0.09 * fbm(x / w * 2.4, 0.5, s + 1, 4)) * h,
    ridge2: x => horizon - (0.04 + 0.06 * fbm(x / w * 4.1, 1.5, s + 11, 4)) * h,
    mesaTop: x => 0.3 * h + 0.018 * h * (fbm(x / w * 14, 1, s + 2, 3) - 0.5),
    // half-width of the mesa at height y: a cap, a cliff, then a talus apron widening to the plain
    mesaSpan: y => { const top = 0.3 * h, cliffEnd = 0.45 * h; if (y < top) return 0; const cx = 0.65 * w, half = 0.17 * w + (y > cliffEnd ? (y - cliffEnd) * 1.6 : (y - top) * 0.12); return [cx - half, cx + half]; },
    river: x => 0.79 * h + 0.055 * h * Math.sin(x / w * 5.2 + 1.3) + 0.018 * h * Math.sin(x / w * 13 + 0.4),
  };
}

// The base field: colour and a stroke direction (radians) per pixel.
export function base(w, h, seed = 'valley') {
  const R = raster(w, h), dir = new Float32Array(w * h), G = geometry(w, h, seed), { s, horizon } = G;
  const cloud = (u, v) => smooth(0.5, 0.7, 0.65 * fbm(u * 3.2 + 0.4 * v, v * 7, s + 4, 5) + 0.35 * fbm(u * 9, v * 16, s + 14, 3)) * smooth(0.04, 0.2, v) * (1 - smooth(0.38, 0.52, v));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, k = 3 * (y * w + x); let c, d = 0;
    const span = G.mesaSpan(y), inMesa = span && x > span[0] + 6 * (fbm(v * 30, 3, s + 5, 2) - 0.5) * 3 && x < span[1] && y > G.mesaTop(x) && y < horizon + 0.012 * h;
    if (y < G.ridge1(x) && !inMesa) {
      const g = v / 0.5; c = g < 0.55 ? mixLin(C.skyTop, C.skyMid, g / 0.55) : mixLin(C.skyMid, C.skyLow, clamp((g - 0.55) / 0.45));
      const cd = cloud(u, v), lit = clamp((cd - cloud(u, v + 0.012)) * 3 + 0.25);
      c = mixLin(c, mixLin(C.cloudShade, C.cloudLit, lit * (0.4 + 0.6 * v / 0.5)), cd * 0.85); d = 0.04 * Math.sin(v * 9 + u * 4);
    } else if (inMesa) {
      const top = G.mesaTop(x), depth = (y - top) / (horizon - top), band = 0.5 + 0.5 * Math.sin(depth * 26 + 2.5 * fbm(u * 6, v * 3, s + 3, 3));
      const gully = 0.72 + 0.28 * Math.sin(x / w * 140 + 6 * fbm(u * 10, v * 6, s + 6, 3)), lit = smooth(0.82, 0.55, u) * gully;
      c = mixLin(mixLin(C.mesaShade, C.mesaLit, lit), C.mesaBand, 0.4 * band * (depth < 0.55 ? 1 : 0.4));
      if (depth > 0.55) c = mixLin(c, C.plainFar, 0.35 * (depth - 0.55)); // talus picks up dust
      d = depth < 0.55 ? Math.PI / 2 + 0.15 * (fbm(u * 20, v, s, 2) - 0.5) : 0.6 * (u < 0.65 ? -1 : 1);
    } else if (y < G.ridge2(x)) { c = mixLin(C.range1, C.skyLow, 0.28 * (1 - (y - G.ridge1(x)) / 40)); d = -0.15 + 0.3 * fbm(u * 6, v * 6, s + 7, 2); }
    else if (y < horizon) { c = mixLin(C.range2, C.range1, 0.25 * fbm(u * 5, v * 9, s + 8, 3)); d = 0.2 * (fbm(u * 6, v * 6, s + 9, 2) - 0.5); }
    else {
      const ry = G.river(x), half = 0.02 * h * (0.6 + 0.9 * v), dy = y - ry;
      if (Math.abs(dy) < half) {
        const mirror = clamp((horizon - (y - horizon) * 0.6) / h / 0.5); c = mixLin(mixLin(C.skyMid, C.skyLow, mirror), C.river, 0.5);
        c = mixLin(c, C.cloudLit, 0.6 * smooth(0.62, 0.8, fbm(u * 40, v * 3, s + 10, 2))); d = 0;
      } else if (dy < 0 && dy > -half - 0.006 * h) { c = C.bank; d = 0; }
      else {
        const far = clamp((y - horizon) / (0.42 * h)); c = far < 0.5 ? mixLin(C.plainFar, C.plain, far * 2) : mixLin(C.plain, C.plainNear, (far - 0.5) * 2);
        c = mixLin(c, C.mesaBand, 0.18 * smooth(0.5, 0.75, fbm(u * 10, v * 14, s + 12, 3))); d = 0.1 * Math.sin(u * 7 + v * 3);
      }
    }
    R.px[k] = c[0]; R.px[k + 1] = c[1]; R.px[k + 2] = c[2]; dir[y * w + x] = d;
  }
  return { R, dir, G };
}

// One dab: an oriented capsule of length L and half-width W at (x, y); colour col; bristles shift its value.
function dab(out, x, y, a, L, W, col, load, phase) {
  const { w, h, px } = out, ca = Math.cos(a), sa = Math.sin(a), ext = Math.ceil(L / 2 + W + 1);
  for (let yy = Math.max(0, Math.floor(y - ext)); yy < Math.min(h, y + ext); yy++) for (let xx = Math.max(0, Math.floor(x - ext)); xx < Math.min(w, x + ext); xx++) {
    const dx = xx + 0.5 - x, dy = yy + 0.5 - y, along = dx * ca + dy * sa, across = -dx * sa + dy * ca;
    const t = Math.max(0, Math.abs(along) - L / 2 + W), dist = Math.hypot(t, across) - W; if (dist > 1) continue;
    const br = Math.sin(across / Math.max(W, 0.5) * 7 + phase + 1.5 * Math.sin(along / L * 3 + phase)), a2 = clamp(0.5 - dist) * load * (0.75 + 0.25 * br) * (1 - 0.6 * smooth(L / 2 - 2 * W, L / 2 + W, Math.abs(along)));
    const q = 3 * (yy * w + xx), val = 1 + 0.09 * br;
    for (let c = 0; c < 3; c++) px[q + c] += (col[c] * val - px[q + c]) * a2;
  }
}

export function paint({ w = 960, h = 720, seed = 'valley', dabs = 1 } = {}) {
  const { R: B, dir, G } = base(w, h, seed), out = raster(w, h), r = rng(seed + ':brush'), S = Math.min(w, h), at = (x, y) => { const k = 3 * (clamp(Math.round(y), 0, h - 1) * w + clamp(Math.round(x), 0, w - 1)); return [B.px[k], B.px[k + 1], B.px[k + 2]]; };
  out.px.set(B.px);
  for (const [len, wid, count] of [[0.08, 0.02, 1100], [0.04, 0.01, 3200], [0.018, 0.005, 5200]]) {
    const L = len * S, W = wid * S, n = Math.round(count * dabs * (w * h) / (960 * 720));
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, a = dir[Math.floor(y) * w + Math.floor(x)] + gauss(r) * 0.07, back = (r() - 0.5) * L * 0.8;
      const src = at(x - Math.cos(a) * back, y - Math.sin(a) * back), j = 1 + gauss(r) * 0.05;
      dab(out, x, y, a, L * (0.7 + 0.6 * r()), W, [src[0] * j, src[1] * j, src[2] * (j + gauss(r) * 0.03)], 0.5 + 0.4 * r(), r() * 100);
    }
  }
  // junipers: clusters of small round dabs on the plain, larger toward the viewer
  for (let i = 0; i < 260 * dabs; i++) {
    const v = 0.6 + 0.3 * r() ** 1.5, y = v * h, x = r() * w, sz = S * (0.004 + 0.016 * (v - 0.58) / 0.32); if (Math.abs(y - G.river(x)) < 0.04 * h) continue;
    for (let q = 0; q < 6; q++) dab(out, x + gauss(r) * sz * 0.8, y - Math.abs(gauss(r)) * sz * 0.6, r() * 3, sz * 1.2, sz * 0.6, mixLin(C.shrub, C.plain, 0.25 * r()), 0.85, r() * 100);
    dab(out, x + sz * 0.3, y - sz * 0.9, 0.3, sz, sz * 0.35, mixLin(C.plainFar, C.cloudLit, 0.3), 0.35, r() * 100); // lit crown
  }
  // reeds: thin tapered blades rising from the bottom edge, a few with a lit tip
  for (let i = 0; i < 520 * dabs; i++) {
    const x0 = r() * w, len = h * (0.06 + 0.11 * r()), bend = (r() - 0.5) * 0.6, steps = Math.ceil(len / 2);
    for (let q = 0; q < steps; q++) { const t = q / steps, x = x0 + bend * len * t * t, y = h + 2 - len * t; dab(out, x, y, -Math.PI / 2 + bend * t, 3, Math.max(0.35, S * 0.0026 * (1 - t)), t > 0.82 && i % 3 === 0 ? C.reedTip : C.reed, 0.9, q); }
  }
  return out;
}
