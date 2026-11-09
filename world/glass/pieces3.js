// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// pieces3.js: two pieces after feed set 31 (images 47 and 48), synthesised with our own signal and sea.
//   pane(w, h)       a pebbled, frosted pane in one blue; behind it our test card on a tube, rolled low, so all that
//                    survives the frost is the glow of the ring and the slow bars of the scan
//   ribbons(w, h)    thick swept glass ribbons, traced through a curl field, over our dusk sea thrown out of focus;
//                    the sun is the one warm area
import { renderGlass, pane as paneBody, pebble, ribbons as ribbonBody } from './glass.js';
import { vortexPaths } from './lib/surface.js';
import { crt } from './crt.js';
import { Water, renderShore } from './liquid.js';
import { sky } from './lib/sky.js';
import { raster, hexLin, mix, clamp, boxBlur } from './lib/raster.js';

// Map a raster to one hue: luminance through a three-stop ramp (deep, mid, light), so the palette stays monochrome.
export function monotone(R, stops = ['#040817', '#173a86', '#a9c6f0'], gain = 1) {
  const [a, b, c] = stops.map(hexLin), O = raster(R.w, R.h);
  for (let i = 0; i < R.w * R.h; i++) {
    const y = clamp(gain * (0.2126 * R.data[i * 4] + 0.7152 * R.data[i * 4 + 1] + 0.0722 * R.data[i * 4 + 2])), t = Math.sqrt(y);
    for (let k = 0; k < 3; k++) O.data[i * 4 + k] = t < 0.5 ? mix(a[k], b[k], t * 2) : mix(b[k], c[k], (t - 0.5) * 2);
    O.data[i * 4 + 3] = 1;
  }
  return O;
}

// The programme for the pane: the house aperture alone, a ring of light off centre on black, nothing else.
function ringCard(w, h, { cx = 0.4, cy = 0.46, r = 0.3, t = 0.07 } = {}) {
  const R = raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot((x / w - cx) * 4 / 3, y / h - cy), v = clamp(1 - Math.abs(d - r) / t) ** 1.5; R.data.set([v, v, v, 1], (y * w + x) * 4); }
  return R;
}
export const PANE = Object.freeze({
  ring: { cx: 0.4, cy: 0.47, r: 0.27, t: 0.06 },
  signal: { content: 'card', t: 2.1, roll: 0.035, tear: 0.006, snow: 0.04, seed: 31, lines: 180, samples: 480 },
  display: { curve: 0.08, vignette: 0.7, mask: 0.1, halation: 0.35, halationR: 0.05, spot: 0.4, bloom: 0.9, exposure: 1.25 },
  tone: { stops: ['#03060f', '#163676', '#b8d0f4'], gain: 1.1 },
  pebble: { cell: 0.011, depth: 0.0028, seed: 47 }, thickness: 0.02, preblur: 0.02,
  glass: { glass: 'crown', gap: 0.07, tint: '#dfe8f6', density: 0.1, rim: 0, frost: { radius: 0.03, taps: 12 },
    env: { zenith: '#5d7fc4', horizon: '#14244a', ground: '#03060f' }, key: { dir: [-0.2, -0.5, 0.84], power: 0.9, shine: 60 }, caustic: null },
});
export function pane(w, h, P = PANE) {
  const tube = crt(w, h, { ...P.signal, content: 'source', source: ringCard(480, 360, P.ring) }, P.display), soft = { w, h, data: boxBlur(tube.data, w, h, Math.max(1, Math.round(P.preblur * h)), { stride: 4, passes: 3 }) };
  const bg = monotone(soft, P.tone.stops, P.tone.gain);
  const body = pebble(paneBody(w, h, { thickness: P.thickness * h }), { cell: Math.max(3, P.pebble.cell * h), depth: P.pebble.depth * h, seed: P.pebble.seed });
  return renderGlass(bg, body, { ...P.glass, gap: P.glass.gap * h, frost: { radius: P.glass.frost.radius * h, taps: P.glass.frost.taps } });
}

export const RIBBONS = Object.freeze({
  sky: { horizon_y: 0.62, zenith: '#2c3550', mid: '#7f8aa3', horizon: '#cf9f78', sea: '#334452', bands: 0.1, sun: { x: 0.38, y: 0.6, r: 0.016, power: 2.2, glow: 0.32 }, seed: 48 },
  shore: { horizon: 0.62, camHeight: 18, ripple: 2.5, shore: 1.3, swash: 0, wet: 0, deep: '#1d2a36', shallow: '#56646c', sun: { x: 0.38, y: 0.6, power: 10, shine: 40000, colour: '#ffcf8c' } },
  defocus: 0.012, vortex: { cx: 0.54, cy: 0.46, count: 6, seed: 31 },
  body: { width: 0.075, taper: 0.95, thickness: 0.045, flat: 0.4, seed: 48, profile: 'sheet', striae: 3, striaeDepth: 0.06 },
  glass: { glass: 'flint', gap: 0.08, tint: '#f4f6f4', density: 0.05, rim: 0.25, film: { minNm: 200, maxNm: 420, amount: 0.25 },
    env: { zenith: '#dfe3ea', horizon: '#9aa4b4', ground: '#1a1d24' }, key: { dir: [-0.4, -0.75, 0.53], power: 1.6, shine: 140 },
    caustic: { strength: 0.6, light: [0.05, 0.1], blur: 3 } },
});
export function ribbons(w, h, P = RIBBONS) {
  const sea = new Water({ nx: 256, ny: 256, seed: 48, damping: 0.008 }).rain(30, { amp: [-0.2, -0.05] }).step(80);
  const scene = renderShore(sky(w, h, P.sky), sea, P.shore);
  const blurred = { w, h, data: boxBlur(scene.data, w, h, Math.max(1, Math.round(P.defocus * h)), { stride: 4, passes: 3 }) };
  const body = ribbonBody(w, h, vortexPaths(w, h, P.vortex), { ...P.body });
  return renderGlass(blurred, body, { ...P.glass, gap: P.glass.gap * h });
}
