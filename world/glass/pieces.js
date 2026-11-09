// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// pieces.js: the three crossover pieces as deterministic CPU renders (goldens, the similarity gate, the Canvas 2D
// fallback). The page runs the same parameters through the WebGL2 shaders. Sizes are shares of the frame, so a
// piece renders the same picture at any resolution.
//   figure(w, h)                 a glass stele with an aperture head, in front of our own test-card signal
//   chorus(w, h, mask)           the word in glass, standing in shallow water at a low sun, with its reflection
//   live(w, h, page)             a reeded glass arch standing over a live page of the site
import { renderGlass, figure as figureShape, arch, fromMask, flute } from './glass.js';
import { crt } from './crt.js';
import { Water, renderShore } from './liquid.js';
import { sky } from './lib/sky.js';
import { raster } from './lib/raster.js';

export const FIGURE = Object.freeze({
  signal: { content: 'card', t: 1.3, roll: 0.06, tear: 0.01, snow: 0.05, seed: 27, lines: 240, samples: 640 },
  display: { curve: 0.04, vignette: 0.55, mask: 0.18, pitch: 3, halation: 0.1, spot: 0.34, bloom: 0.6, exposure: 0.62 },
  shape: { cx: 0.64, top: 0.12, base: 1.04, lean: 0.04 },
  bevel: { radius: 0.03, thickness: 0.06 }, reeds: { pitch: 0.014, depth: 0.0026, from: 0.56, feather: 0.16 },
  glass: { glass: 'dense', gap: 0.11, tint: '#e6ece8', density: 0.22, rim: 0.5,
    env: { zenith: '#25282e', horizon: '#3d4047', ground: '#050506' }, key: { dir: [-0.5, -0.6, 0.62], power: 1.6, shine: 140 },
    caustic: { strength: 0.85, light: [0.12, -0.2], blur: 1 } },
});

export function figure(w, h, P = FIGURE) {
  const bg = crt(w, h, P.signal, P.display);
  const s = figureShape(w, h, P.shape);
  let body = fromMask(s.mask, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h });
  body = flute(body, { pitch: Math.max(2, P.reeds.pitch * w), depth: P.reeds.depth * h, axis: 'x', from: P.reeds.from * h, feather: P.reeds.feather * h });
  return renderGlass(bg, body, { ...P.glass, gap: P.glass.gap * h });
}

export const CHORUS = Object.freeze({
  word: 'CHORUS', horizon: 0.56, contact: 0.735,
  sky: { horizon_y: 0.56, sun: { x: 0.13, y: 0.538, r: 0.010 }, seed: 5 }, fill: 0.62,
  bevel: { radius: 0.05, thickness: 0.05 }, reeds: { pitch: 0.0065, depth: 0 },
  glass: { glass: 'flint', gap: 0.05, tint: '#e3ece8', density: 0.22, rim: 0.45, soften: 0.004,
    env: { zenith: '#3a4560', horizon: '#f2c39a', ground: '#273038' }, key: { dir: [-0.7, -0.12, 0.7], power: 3.2, shine: 120 },
    caustic: null },
  water: { nx: 256, ny: 256, courant: 0.5, damping: 0.006, stiffness: 0.002, seed: 9, drops: 14, steps: 70, wind: 0.002, amp: 0.16 },
  shore: { horizon: 0.56, camHeight: 20, ripple: 3, shore: 0.9, swash: 0.01, wet: 0.8, sun: { x: 0.13, y: 0.538, power: 40, shine: 40000, colour: '#ffd2a0' } },
});

// World footprint of the letters on the water grid, so ripples bend round their feet.
export function seaFor(w, h, mask, P = CHORUS) {
  const sea = new Water({ ...P.water, edge: 'wrap' }), yh = P.horizon * h, yc = P.contact * h, f = h;
  const zc = P.shore.camHeight * f / (yc - yh), feet = [];
  for (let x = 0; x < w; x += 2) { let on = false; for (let y = Math.round(yc) - 4; y < yc; y++) if (mask[y * w + x] > 0.5) on = true; if (on) feet.push((x + 0.5 - w / 2) * zc / f); }
  const nx = sea.nx, ny = sea.ny, zcell = ((zc % ny) + ny) % ny;
  sea.block((gx, gy) => Math.abs(gy - zcell) < 1.2 && feet.some(fx => Math.abs((((fx % nx) + nx) % nx) - gx) < 1.2));
  const R = sea.rng;
  for (let k = 0; k < P.water.drops; k++) { const fx = feet[Math.floor(R() * feet.length)] ?? 0; sea.drop(fx + (R() - 0.5) * 30, zcell + (R() - 0.3) * 24, 2 + R() * 2.5, -(P.water.amp ?? 0.3) * (1 + R())); }
  sea.step(P.water.steps); sea.wind(P.water.wind); sea.step(6);
  return sea;
}

export function chorusBody(w, h, mask, P = CHORUS) {
  const yc = Math.round(P.contact * h), M = Float32Array.from(mask);
  for (let i = yc * w; i < M.length; i++) M[i] = 0;
  const b = fromMask(M, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h });
  return flute(b, { pitch: Math.max(2, P.reeds.pitch * w), depth: P.reeds.depth * h, axis: 'x' });
}

export function chorus(w, h, mask, P = CHORUS, sea = seaFor(w, h, mask, P)) {
  const above = sky(w, h, P.sky), shore = { ...P.shore };
  const scene = renderShore(above, sea, shore);
  const body = chorusBody(w, h, mask, P);
  const glass = renderGlass(scene, body, { ...P.glass, gap: P.glass.gap * h, soften: (P.glass.soften ?? 0) * h });
  const layer = raster(w, h);
  for (let i = 0; i < w * h; i++) { const a = body.mask[i]; if (a <= 0) continue; for (let c = 0; c < 3; c++) layer.data[i * 4 + c] = glass.data[i * 4 + c]; layer.data[i * 4 + 3] = a; }
  return renderShore(above, sea, { ...shore, objects: [{ raster: layer, contact: P.contact * h }] });
}

export const LIVE = Object.freeze({
  arch: { cx: 0.215, top: 0.13, base: 1.02, halfW: 0.105, wall: 0 }, bevel: { radius: 0.012, thickness: 0.03 },
  reeds: { pitch: 0.0125, depth: 0.0032 },
  glass: { glass: 'flint', gap: 0.045, tint: '#f1f4f0', density: 0.1, rim: 0.25,
    env: { zenith: '#2e3038', horizon: '#17181c', ground: '#060607' }, key: { dir: [-0.4, -0.7, 0.6], power: 1.4, shine: 160 },
    caustic: { strength: 0.6, light: [0.1, -0.15], blur: 1 } },
});

export function liveBody(w, h, P = LIVE) {
  const a = arch(w, h, P.arch);
  const b = fromMask(a.mask, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h });
  return flute(b, { pitch: Math.max(2, P.reeds.pitch * w), depth: P.reeds.depth * h, axis: 'x' });
}
export function live(w, h, page, P = LIVE) {
  return renderGlass(page, liveBody(w, h, P), { ...P.glass, gap: P.glass.gap * h });
}
