// lib/medium/scenes.mjs: ready tanks, each a list of additives (data, so the studio, the room or an agent can edit it).
// The first is the author's prototype (2026-10-25): typed words as ink, a touch of oil, heat from below and wind
// across the top, then let it run.
import { Medium } from './medium.mjs';
import { render } from './render.mjs';

// inks: an indigo that blooms to a pale cornflower halo (after Frankenthaler's Water Shadows blues), and Elettrosumma's
// measured red (#a93b29) for the drop that blooms beside the oil
export function tankAdditives(words = 'flow', { ink = '#251f4a', halo = '#4f86c6', accent = '#a93b29' } = {}) {
  return [
    ['oil', { x: 0.62, y: 0.42, r: 0.05 }, 0.9, { at: 0.2, for: 1.2 }],
    ['text', { x: 0.4, y: 0.4, w: 0.26, h: 0.085 }, 1, { text: words, color: ink, halo, at: 0.6, for: 0.3, hold: 6 }],
    ['ink', { x: 0.66, y: 0.36, r: 0.025 }, 0.7, { color: accent, at: 2.2, for: 0.5, spread: 12 }],
    ['heat', { x: 0.62, y: 0.88, w: 0.07, h: 0.02 }, 3, { at: 0, for: 60 }],
    ['wind', {}, 0.9, { at: 1.5, for: 60, gust: true }],
    // a glass sphere resting in the sediment (a circle on screen: h = w * 16 / 9)
    ['glass', { x: 0.25, y: 0.86, w: 0.06, h: 0.1067 }, 1, {}],
    ['bubbles', { x: 0.84, y: 0.9, r: 0.02 }, 0.8, { at: 3, for: 60 }],
    ['tiles', { x: 0.4, y: 0.34, w: 0.22, h: 0.02 }, 0.35, { color: '#b0603a', at: 4, for: 2 }],
    // a halocline: salt water below 0.8, so the falling words stop on it and spread (the layered medium)
    ['layer', { x: 0.5, y: 0.87, w: 0.5, h: 0.08 }, 1, { salt: 1.5, at: 0 }],
    // a ribbon of numbered tiles across the heat plume, carried and bent by it (Bayer's Divisumma)
    ['tesserae', { x: 0.7, y: 0.6, w: 0.17, h: 0.03 }, 1, { cols: 12, rows: 2, at: 0.4 }],
    // smoke from a wick at the left of the air, drawn out by the wind (the air is a medium too)
    ['smoke', { x: 0.06, y: 0.25, r: 0.03 }, 60, { at: 0, for: 60 }],
    ['turbulence', 'air', 2.5, { at: 0 }],
  ];
}

export function tank(words = 'flow', { seed = 'tank', nx = 192, ny = 108, bedRelief = 0.55, ...opts } = {}) {
  const m = new Medium({ nx, ny, seed: `${seed}/${words}`, bedRelief, spectral: !!opts.spectral });
  for (const a of tankAdditives(words, opts)) m.add(...a);
  return m;
}

// A still at time t, at any size.
export function still(words, t, W, H, opts = {}) { const m = tank(words, opts); m.run(t); return { medium: m, raster: render(m, W, H, opts) }; }

// A loop: run to t0, then render n frames over `seconds`; the last `blend` frames ease into the first so the loop
// closes (the medium itself never repeats; the seam is a dissolve between two moments of the same tank).
export function loop(words, { t0 = 6, seconds = 4, fps = 12, W = 1280, H = 720, blend = 6, ...opts } = {}) {
  const m = tank(words, opts), frames = [], n = Math.round(seconds * fps);
  m.run(t0);
  for (let f = 0; f < n; f++) { frames.push(render(m, W, H, { ...opts, seed: 7 + f }).data); m.run(1 / fps); }
  for (let b = 0; b < blend; b++) { const w = (b + 1) / (blend + 1), A = frames[n - blend + b], B = frames[b]; for (let i = 0; i < A.length; i++) A[i] = A[i] * (1 - w) + B[i] * w; }
  return { medium: m, motion: { w: W, h: H, fps, frames, captions: [{ from: 0, to: n - 1, text: words }] } };
}
