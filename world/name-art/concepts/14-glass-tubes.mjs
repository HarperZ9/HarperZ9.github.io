// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 14 glass-tubes (v2 of 01): the letters are not a font cut from glass. Each letter is a solid rod of flint glass
// swept along the forge's own centre lines, round in section (height = thickness x sqrt(1 - t^2)), so it has real
// thickness everywhere and refracts the low sun as a lens would. The rods stand in shallow sea; the second line is
// at the waterline and the sun sits on the horizon behind it. Two lines, so the name fills the frame.
import { renderGlass } from '../../glass/glass.js';
import { Water, renderShore } from '../../glass/liquid.js';
import { sky } from '../../glass/lib/sky.js';
import { raster, boxBlur } from '../../glass/lib/raster.js';
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { strokesOf, snapJoins, fusedRods } from '../lib/strokes.mjs';
import { img, grain, TAU } from '../lib/img.mjs';

export const meta = {
  id: 'glass-tubes', title: 'Glass rods at low sun', loop: { seconds: 6, fps: 24, crossfade: 0.25 },
  marriage: 'centre lines swept as round glass rods x flint optics (dispersion, Fresnel, Beer tint) x shore water',
  refs: ['2026-10-23-feed-test-27/frames', 'feed-30 vessel (stroke-to-object substitution)'],
  v1: 'shallow-glass',
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const N = setName(breakLines(text, 2), W, H, { box: [0.045, 0.09, 0.955, 0.83], weight: 500, tracking: 70, leading: 1.24 });
  const L2 = N.spans.filter(s => s.line === 1), base = L2[0].base, cap = N.capPx;
  const hz = (L2[0].xh + base) / 2 / H, contact = (base + 0.03 * cap) / H;
  const sunCh = L2.find(s => s.ch === 'p') ?? L2[0], sunX = ((sunCh.x0 + sunCh.x1) / 2 + 0.06 * cap) / W;
  // the rods: every centre line swept at one radius, round in section; joins take the nearer rod
  // joins snapped axis to axis (no knob where the D's stem overshoots its bowl); heights fused by a smooth max of
  // width a third of the radius, so rods flow together like hot-worked glass instead of meeting in a mitred wedge
  const rT = 0.094 * cap, S = snapJoins(strokesOf(N, Math.max(1, cap / 120)), 1.25 * rT), { mask, height } = fusedRods(W, H, S, rT, 1.8 * rT, rT / 3);
  const body = { w: W, h: H, mask, height: boxBlur(height, W, H, 1, { passes: 1 }) };
  const sea = new Water({ nx: 256, ny: 256, courant: 0.5, damping: 0.005, stiffness: 0.002, seed: 21, edge: 'wrap' }), R = sea.rng;
  for (let k = 0; k < 18; k++) sea.drop(R() * sea.nx, R() * sea.ny, 2 + R() * 3, -0.15 * (1 + R()));
  sea.step(64 + Math.round(t * 48)); sea.wind(0.0024); sea.step(4);
  const sun = { x: sunX, y: hz - 0.008, r: 0.017, power: 11, glow: 0.55 };
  const above = sky(W, H, { horizon_y: hz, zenith: '#1a2236', mid: '#6c6273', horizon: '#f6b47e', sun, seed: 11, bands: 0.3 });
  const shore = { horizon: hz, camHeight: 20, ripple: 3.2, shore: 0.97, swash: 0.008, wet: 0.85, sun: { x: sunX, y: hz - 0.008, power: 46, shine: 30000, colour: '#ffcf98' } };
  const scene = renderShore(above, sea, shore);
  const gl = renderGlass(scene, body, { glass: 'flint', tint: '#cfe3dc', density: 0.7, rim: 0.95, soften: 0.003 * H, gap: 0.05 * H,
    env: { zenith: '#1c2438', horizon: '#ffc994', ground: '#262b33' }, key: { dir: [0.05, -0.1, 0.99], power: 4, shine: 160 }, caustic: null });
  const layer = raster(W, H);
  for (let i = 0; i < W * H; i++) { for (let c = 0; c < 3; c++) layer.data[i * 4 + c] = gl.data[i * 4 + c]; layer.data[i * 4 + 3] = mask[i]; }
  const soft = { w: W, h: H, data: boxBlur(layer.data, W, H, Math.max(1, Math.round(0.0016 * W)), { stride: 4, passes: 2 }) };
  const yc = Math.floor(contact * H);
  for (let i = yc * W; i < W * H; i++) soft.data[i * 4 + 3] = 0;
  const out = renderShore(above, sea, { ...shore, objects: [{ raster: soft, contact: contact * H }] });
  for (let i = 0; i < yc * W * 4; i++) out.data[i] = scene.data[i];
  for (let i = 0; i < W * H; i++) { const a = mask[i]; if (a > 0) for (let c = 0; c < 3; c++) out.data[i * 4 + c] += (layer.data[i * 4 + c] - out.data[i * 4 + c]) * a; }
  const I = img(W, H);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) I.px[i * 3 + c] = out.data[i * 4 + c] * 0.92;
  return { image: grain(I, { amount: 1.3, seed: `tubes/${t}`, radius: Math.max(1, Math.round(W / 1600)) }), text: N.text };
}
