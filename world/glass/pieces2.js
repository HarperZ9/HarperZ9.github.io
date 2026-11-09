// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// pieces2.js: the second pass. One subject per piece, fewer elements, more depth: soft falloff, spectral rims, a
// single band of light behind each glass, clumped film grain at export. v1 stays in pieces.js for comparison.
//   figure2(w, h)            a glass stele with an aperture head; behind it one band of our signal, misconverged
//   chorus2(w, h, mask)      the word in glass, standing in a calm sea at a low sun; rings only at its feet
//   live2(w, h, page)        a reeded arch over a live page of the site
//   vessel(w, h, series)     a nested glass capsule over a halftone horizon band that carries a data trace
import { renderGlass, figure as figureShape, arch, fromMask, flute, maskFromSdf, sd } from './glass.js';
import { signal, display } from './crt.js';
import { Water, renderShore } from './liquid.js';
import { sky } from './lib/sky.js';
import { raster, sample, clamp, mix, hexLin, smoothstep } from './lib/raster.js';

export const GRAIN = 4; // SD in 8-bit code values at mid-grey (QUALITY-SPEC R4 surface_sd 0.3 to 6)

// One band of signal across the frame: a strip of tube face, faded at both ends and soft at top and bottom, with
// convergence error (R and B land above and below G, more toward the sides), the way a real shadow-mask tube drifts.
export function signalBand(w, h, { y = 0.52, height = 0.15, content = 'bars', t = 1.3, seed = 27, snow = 0.03, converge = 0.006, glow = 1, source = null } = {}) {
  const bh = Math.max(16, Math.round(height * h)), sig = signal({ content, source, t, seed, snow, lines: Math.max(24, Math.round(bh / 2.4)), samples: Math.min(720, w), jitter: 0.0008 });
  const tube = display(sig, w, bh, { curve: 0, vignette: 0, mask: 0.12, pitch: 3, halation: 0.14, spot: 0.33, bloom: 0.7, exposure: glow });
  const R = raster(w, h), y0 = y * h - bh / 2;
  for (let j = 0; j < h; j++) for (let x = 0; x < w; x++) {
    const u = x / w, side = Math.abs(u - 0.5) * 2, fadeX = smoothstep(1, 0.55, side), i = (j * w + x) * 4;
    for (let c = 0; c < 3; c++) {
      const dy = (c - 1) * converge * h * (0.3 + side), ty = j - y0 + dy;
      const fadeY = smoothstep(0, 0.12 * bh, ty) * smoothstep(bh, 0.88 * bh, ty);
      R.data[i + c] = ty < 0 || ty >= bh ? 0 : sample(tube, x + 0.5, ty, c) * fadeX * fadeY;
    }
    R.data[i + 3] = 1;
  }
  return R;
}

// A ground with a soft falloff: one tone at the centre, darker at the frame, never a hard edge.
function ground(w, h, centre, edge, { cx = 0.5, cy = 0.5, r = 0.75 } = {}) {
  const R = raster(w, h), a = hexLin(centre), b = hexLin(edge);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x / w - cx) * w / h, y / h - cy) / r, t = smoothstep(0, 1, d);
    R.data.set([mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t), 1], (y * w + x) * 4);
  }
  return R;
}
const add = (A, B, k = 1) => { for (let i = 0; i < A.data.length; i++) if ((i & 3) !== 3) A.data[i] += k * B.data[i]; return A; };

export const FIGURE2 = Object.freeze({
  ground: ['#16130f', '#050404'], band: { y: 0.6, height: 0.1, content: 'bars7', snow: 0.025, converge: 0.005 },
  shape: { cx: 0.5, top: 0.15, base: 1.06, lean: 0.02 }, bevel: { radius: 0.17, thickness: 0.12, profile: 'round' },
  glass: { glass: 'dense', gap: 0.9, tint: '#eef1ec', density: 0.12, rim: 0.55, film: { minNm: 220, maxNm: 460, amount: 0.25 },
    env: { zenith: '#6a645b', horizon: '#1a1713', ground: '#030303' }, key: { dir: [-0.45, -0.7, 0.55], power: 0.7, shine: 36 },
    caustic: { strength: 0.5, light: [0.0, 0.03], blur: 3 } },
});
export function figure2(w, h, P = FIGURE2) {
  const bg = add(ground(w, h, P.ground[0], P.ground[1], { cy: 0.5, r: 0.8 }), signalBand(w, h, P.band));
  const s = figureShape(w, h, P.shape), body = fromMask(s.mask, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h, profile: P.bevel.profile });
  return renderGlass(bg, body, { ...P.glass, gap: P.glass.gap * h });
}

export const CHORUS2 = Object.freeze({
  word: 'CHORUS', fill: 0.5, horizon: 0.58, contact: 0.72,
  sky: { horizon_y: 0.58, zenith: '#3a3f52', mid: '#a8958e', horizon: '#f1c8a2', sea: '#57616a', bands: 0.06, sun: { x: 0.2, y: 0.555, r: 0.0085, power: 7, glow: 0.28 }, seed: 5 },
  bevel: { radius: 0.05, thickness: 0.05 },
  glass: { glass: 'flint', gap: 0.05, tint: '#f2f4ef', density: 0.06, rim: 0.3, soften: 0.003, film: null,
    env: { zenith: '#6d7186', horizon: '#f6d6b8', ground: '#3a4148' }, key: { dir: [-0.8, -0.1, 0.6], power: 3.5, shine: 320 }, caustic: null },
  water: { nx: 256, ny: 256, courant: 0.5, damping: 0.01, stiffness: 0.002, seed: 9, drops: 10, steps: 90, wind: 0.0008, amp: 0.12 },
  shore: { horizon: 0.58, camHeight: 20, ripple: 2.2, shore: 1.3, swash: 0, wet: 0, absorb: 0.4, deep: '#2b3a44', shallow: '#7a8584',
    sun: { x: 0.2, y: 0.555, power: 30, shine: 40000, colour: '#ffd9b0' } },
});
export function chorus2(w, h, mask, P = CHORUS2, seaFor) {
  const sea = seaFor(w, h, mask, { ...P, water: P.water, shore: P.shore });
  const above = sky(w, h, P.sky), scene = renderShore(above, sea, P.shore);
  const yc = Math.round(P.contact * h), M = Float32Array.from(mask); for (let i = yc * w; i < M.length; i++) M[i] = 0;
  const body = fromMask(M, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h });
  const g = renderGlass(scene, body, { ...P.glass, gap: P.glass.gap * h, soften: P.glass.soften * h }), layer = raster(w, h);
  for (let i = 0; i < w * h; i++) { const a = body.mask[i]; if (a > 0) layer.data.set([g.data[i * 4], g.data[i * 4 + 1], g.data[i * 4 + 2], a], i * 4); }
  return renderShore(above, sea, { ...P.shore, objects: [{ raster: layer, contact: P.contact * h }] });
}

export const LIVE2 = Object.freeze({
  arch: { cx: 0.62, top: 0.06, base: 1.04, halfW: 0.1, wall: 0 }, bevel: { radius: 0.02, thickness: 0.03 }, reeds: { pitch: 0.016, depth: 0.0028 },
  glass: { glass: 'dense', gap: 0.035, tint: '#f1f3ee', density: 0.08, rim: 0.3, film: { minNm: 300, maxNm: 660, amount: 0.2 },
    env: { zenith: '#3a3c44', horizon: '#141518', ground: '#050506' }, key: { dir: [-0.35, -0.75, 0.56], power: 0.9, shine: 240 },
    caustic: { strength: 0.22, light: [0.08, -0.12], blur: 3 } },
});
export function live2Body(w, h, P = LIVE2) {
  const b = fromMask(arch(w, h, P.arch).mask, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h });
  return flute(b, { pitch: Math.max(2, P.reeds.pitch * w), depth: P.reeds.depth * h, axis: 'x' });
}
export function live2(w, h, page, P = LIVE2) { return renderGlass(page, live2Body(w, h, P), { ...P.glass, gap: P.glass.gap * h }); }

// ---- vessel: a capsule inside a capsule over one horizon band of halftone light that carries a data trace ----
export const VESSEL = Object.freeze({
  ground: ['#9a948c', '#5f5a55'], band: { y: 0.53, sigma: 0.055, pitch: 0.011, colours: ['#e7a978', '#d98f96', '#8c95cf'] },
  trace: { y: 0.53, height: 0.14, glow: 1.5 },
  outer: { cx: 0.5, cy: 0.53, hx: 0.27, hy: 0.14, thickness: 0.07 }, inner: { scale: 0.62, thickness: 0.035 },
  glass: { glass: 'dense', tint: '#f3f1ec', density: 0.06, rim: 0.2, gap: 0.07, film: { minNm: 200, maxNm: 440, amount: 0.2 },
    env: { zenith: '#d8d2c8', horizon: '#8b857d', ground: '#3d3935' }, key: { dir: [-0.5, -0.7, 0.5], power: 0.8, shine: 120 },
    caustic: { strength: 0.35, light: [0.0, 0.12], blur: 4 } },
});

// The band as halftone: a dot per cell whose area follows the band's Gaussian profile, coloured along x through
// three stops, laid over the ground with soft dot edges (anti-aliased by coverage).
function halftoneBand(R, P) {
  const { w, h } = R, pitch = Math.max(4, P.pitch * w), cols = P.colours.map(hexLin);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = Math.floor(x / pitch), gy = Math.floor(y / pitch), cxp = (gx + 0.5 + (gy & 1) * 0.5) * pitch, cyp = (gy + 0.5) * pitch;
    const v = Math.exp(-0.5 * ((cyp / h - P.y) / P.sigma) ** 2), rad = 0.5 * pitch * Math.sqrt(v) * 0.95;
    const d = Math.hypot(x + 0.5 - cxp, y + 0.5 - cyp), cov = clamp(rad - d + 0.5);
    if (cov <= 0) continue;
    const u = x / w, k = u < 0.5 ? u * 2 : (u - 0.5) * 2, a = u < 0.5 ? cols[0] : cols[1], b = u < 0.5 ? cols[1] : cols[2], i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) R.data[i + c] = mix(R.data[i + c], mix(a[c], b[c], k) * 1.05, cov * 0.92);
  }
  return R;
}
// The series drawn as a beam: plotted as a line, scanned through the CRT signal path, and screened onto the band.
function dataTrace(w, h, series, P) {
  const bh = Math.round(P.height * h), src = raster(w, bh), lo = Math.min(...series), hi = Math.max(...series), n = series.length;
  for (let x = 0; x < w; x++) {
    const f = x / (w - 1) * (n - 1), k = Math.min(n - 2, Math.floor(f)), v = mix(series[k], series[k + 1], f - k);
    const yy = (1 - (v - lo) / (hi - lo)) * bh * 0.7 + bh * 0.15;
    for (let y = 0; y < bh; y++) { const a = clamp(1.6 - Math.abs(y - yy)); if (a > 0) src.data.set([a, a, a, 1], (y * w + x) * 4); }
  }
  return signalBand(w, h, { y: P.y, height: P.height, content: 'source', source: src, snow: 0.015, converge: 0.003, glow: P.glow });
}
function capsule(w, h, { cx, cy, hx, hy }) { const X = cx * w, Y = cy * h, r = hy * h, L = hx * w - r; return maskFromSdf(w, h, (x, y) => sd.capsule(x, y, X - L, Y, X + L, Y, r)); }

// The vessel's ground: warm grey with falloff, the halftone band, and the data trace screened onto it.
export function vesselGround(w, h, series, P = VESSEL) {
  const bg = halftoneBand(ground(w, h, P.ground[0], P.ground[1], { cy: 0.45, r: 0.95 }), P.band);
  const tr = dataTrace(w, h, series, P.trace); for (let i = 0; i < bg.data.length; i++) if ((i & 3) !== 3) bg.data[i] = 1 - (1 - bg.data[i]) * (1 - Math.min(1, tr.data[i] * 0.85));
  return bg;
}
export function vessel(w, h, series, P = VESSEL) {
  let bg = vesselGround(w, h, series, P);
  const O = P.outer, I = { ...O, hx: O.hx * P.inner.scale, hy: O.hy * P.inner.scale };
  const inner = fromMask(capsule(w, h, I), w, h, { radius: I.hy * h, thickness: P.inner.thickness * h, profile: 'round' });
  bg = renderGlass(bg, inner, { ...P.glass, glass: 'crown', gap: 0.05 * h, film: null, caustic: null, rim: 0.15 });
  const outer = fromMask(capsule(w, h, O), w, h, { radius: O.hy * h * 0.55, thickness: O.thickness * h, profile: 'round' });
  return renderGlass(bg, outer, { ...P.glass, gap: P.glass.gap * h });
}
