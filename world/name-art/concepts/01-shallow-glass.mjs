// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 01 shallow-glass: the name as flint glass standing in shallow sea at a low sun. The sun sits on the horizon
// behind the letters, so every letter refracts it and splits it by wavelength (Cauchy dispersion, flint Abbe).
// Marriage: glass.js optics + liquid.js shore + glass sky, letters from the Accession forge.
import { renderGlass, fromMask, flute } from '../../glass/glass.js';
import { Water, renderShore } from '../../glass/liquid.js';
import { sky } from '../../glass/lib/sky.js';
import { raster, boxBlur } from '../../glass/lib/raster.js';
import { setName, NAME } from '../lib/name.mjs';
import { img, grain, TAU } from '../lib/img.mjs';

export const meta = {
  id: 'shallow-glass', title: 'Glass in shallow sea, low sun', loop: { seconds: 6, fps: 24, crossfade: 0.25 },
  marriage: 'flint glass optics (dispersion, Fresnel, Beer tint) x shore water simulation x Accession Display 800',
  refs: ['2026-10-23-feed-test-27/frames'],
};

const P = {
  horizon: 0.5, contact: 0.6,
  sky: { horizon_y: 0.5, zenith: '#1d2638', mid: '#6f6474', horizon: '#f4b07c', sun: { x: 0.352, y: 0.49, r: 0.015, power: 11, glow: 0.5 }, seed: 11, bands: 0.3 },
  glass: { glass: 'flint', tint: '#e6eee9', density: 0.2, rim: 0.75, soften: 0.0035, gap: 0.05,
    env: { zenith: '#1c2438', horizon: '#ffc994', ground: '#262b33' }, key: { dir: [0.05, -0.1, 0.99], power: 3.6, shine: 140 }, caustic: null },
  water: { nx: 256, ny: 256, courant: 0.5, damping: 0.005, stiffness: 0.002, seed: 21, drops: 18, steps: 64, wind: 0.0024, amp: 0.15 },
  shore: { horizon: 0.5, camHeight: 20, ripple: 3.2, shore: 0.93, swash: 0.008, wet: 0.85, sun: { x: 0.352, y: 0.49, power: 46, shine: 30000, colour: '#ffcf98' } },
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const N = setName(text, W, H, { box: [0.04, 0.38, 0.96, 0.8], weight: 800, tracking: 24 });
  // stand the letters so the baseline sits just under the waterline; descenders show through the shallows
  const base = N.spans[0].base, dy = Math.round(P.contact * H - base + 0.02 * N.capPx);
  const mask = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { const sy = y - dy; if (sy < 0 || sy >= H) continue; mask.set(N.mask.subarray(sy * W, sy * W + W), y * W); }
  const sea = new Water({ ...P.water, edge: 'wrap' }), R = sea.rng;
  for (let k = 0; k < P.water.drops; k++) sea.drop(R() * sea.nx, R() * sea.ny, 2 + R() * 3, -P.water.amp * (1 + R()));
  sea.step(P.water.steps + Math.round(t * 48)); sea.wind(P.water.wind); sea.step(4);
  const above = sky(W, H, P.sky);
  const M = mask;
  let body = fromMask(M, W, H, { radius: 0.045 * H, thickness: 0.05 * H });
  body = flute(body, { pitch: Math.max(2, 0.0055 * W), depth: 0.0009 * H, axis: 'x', phase: TAU * t });
  const scene = renderShore(above, sea, P.shore);
  const gl = renderGlass(scene, body, { ...P.glass, gap: P.glass.gap * H, soften: P.glass.soften * H });
  const layer = raster(W, H);
  for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) layer.data[i * 4 + c] = gl.data[i * 4 + c]; layer.data[i * 4 + 3] = body.mask[i]; }
  // the reflection sees a softened copy (rippled water never mirrors sharp), then the sharp glass goes over it
  const soft = { w: W, h: H, data: boxBlur(layer.data, W, H, Math.max(1, Math.round(0.0016 * W)), { stride: 4, passes: 2 }) };
  const yc = Math.floor(P.contact * H);
  for (let i = yc * W; i < W * H; i++) soft.data[i * 4 + 3] = 0;     // the soft copy only feeds the mirror
  const out = renderShore(above, sea, { ...P.shore, objects: [{ raster: soft, contact: P.contact * H }] });
  for (let i = 0; i < yc * W * 4; i++) out.data[i] = scene.data[i];  // above the waterline: no soft halo
  for (let i = 0; i < W * H; i++) { const a = layer.data[i * 4 + 3]; if (a > 0) for (let c = 0; c < 3; c++) out.data[i * 4 + c] += (layer.data[i * 4 + c] - out.data[i * 4 + c]) * a; }
  const I = img(W, H);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) I.px[i * 3 + c] = out.data[i * 4 + c] * 0.92;
  return { image: grain(I, { amount: 1.3, seed: `glass/${t}`, radius: Math.max(1, Math.round(W / 1600)) }), text: N.text };
}
