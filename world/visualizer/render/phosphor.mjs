// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// phosphor.mjs: lines drawn as light, the way a vector display draws them: a thin core, a soft halo from the
// phosphor's spread, and an afterglow. The afterglow is a closed form, not a frame-to-frame buffer: the figure is
// redrawn at k earlier instants (k = 1..taps, spaced `step` seconds) with weight exp(-k step / tau), so any frame
// can be rendered alone (parallel workers, seeks) and still carry its trail.
//
//   emit(drawFn, t, w, h, P) -> plane     drawFn(plane, tau, weight) draws the scene as it was at time tau
//   addLight(R, plane, hex, gain, glow)   adds a plane to a raster as light of one colour, with a halo
//   P: { tau (s, phosphor decay), taps, step (s) }. P31-like green-white decays in tens of ms; this uses 0.12 s
//   so a trail is visible at 24 frames per second.
import { plane, blurPlane } from '../lib/draw.mjs';
import { hexLin } from '../../glass/lib/raster.js';

export const PHOSPHOR = Object.freeze({ tau: 0.12, taps: 4, step: 1 / 48 });

export function emit(drawFn, t, w, h, P = PHOSPHOR) {
  const p = { ...PHOSPHOR, ...P }, E = plane(w, h);
  drawFn(E, t, 1);
  for (let k = 1; k <= p.taps; k++) {
    const T = plane(w, h); drawFn(T, t - k * p.step, 1);
    const wk = Math.exp(-k * p.step / p.tau);
    for (let i = 0; i < E.data.length; i++) E.data[i] = Math.max(E.data[i], T.data[i] * wk);
  }
  return E;
}

export function addLight(R, E, hex, gain = 1, glow = { radius: 0, gain: 0 }) {
  const c = hexLin(hex), { data } = R, n = R.w * R.h;
  const G = glow.gain > 0 ? blurPlane(E, glow.radius) : null;
  for (let i = 0; i < n; i++) {
    const e = E.data[i] * gain + (G ? G.data[i] * glow.gain : 0);
    if (e <= 0) continue;
    for (let k = 0; k < 3; k++) data[i * 4 + k] += c[k] * e;
  }
  return R;
}

// Over (not add) for marks that must read as ink on bright ground: a premultiplied mix toward the colour.
export function overInk(R, E, hex, alpha = 1) {
  const c = hexLin(hex), { data } = R;
  for (let i = 0; i < R.w * R.h; i++) { const a = Math.min(1, E.data[i] * alpha); if (a <= 0) continue; for (let k = 0; k < 3; k++) data[i * 4 + k] += (c[k] - data[i * 4 + k]) * a; }
  return R;
}
