// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// ribbons.mjs: poured glass ribbons orbiting the meter figure. Centrelines are arcs of logarithmic spirals around
// the figure's centre, each with a seeded start, span and growth; the sound turns them (swirl), thickens them
// (thickness), widens them (width) and scores their surface (striae). The body is the glass module's sweep SDF and
// the light is its renderGlass (dispersion per channel, Fresnel against a sky, a thin film coat, forward caustics).
//
//   ribbonPaths(w, h, P) -> [[x, y], ...][]   P: { cx, cy, count, inner, outer (shares of height), swirl (rad),
//                                                  squash, span, seed, breathe }
//   ribbons(bg, P) -> raster                   bg is what lies behind (the seabed and the figure)
//   SPEC: 1920 x 1080, 5 ribbons: body about 0.9 s and glass about 1.3 s on one core.
import { ribbons as sweep, renderGlass } from '../../glass/glass.js';
import { random } from '../../glass/lib/raster.js';

export const RIBBONS = Object.freeze({
  cx: 0.585, cy: 0.47, count: 4, inner: 0.34, outer: 0.58, swirl: 0, squash: 0.62, span: [1.3, 2.4], seed: 31, breathe: 0,
  body: { width: 0.036, taper: 0.95, thickness: 0.04, flat: 0.4, profile: 'sheet', striae: 3, striaeDepth: 0.06 },
  glass: { glass: 'flint', gap: 0.08, tint: '#f2f6fb', density: 0.03, rim: 0.12, soften: 1.5, film: { minNm: 220, maxNm: 440, amount: 0.22 },
    env: { zenith: '#e8eef8', horizon: '#6f86b4', ground: '#16284d' }, key: { dir: [-0.35, -0.8, 0.5], power: 2.6, shine: 160 },
    caustic: { strength: 0.5, light: [0.04, 0.08], blur: 2 } },
});

export function ribbonPaths(w, h, P = RIBBONS) {
  const p = { ...RIBBONS, ...P }, r = random(`ribbon-path/${p.seed}`), out = [], aspect = w / h;
  for (let c = 0; c < p.count; c++) {
    const r0 = (p.inner + (p.outer - p.inner) * r()) * h * (1 + 0.06 * p.breathe), k = 0.08 + 0.1 * r(), th0 = r() * 6.283 + p.swirl * (0.8 + 0.4 * (c % 2 ? -1 : 1) * 0.25);
    const span = p.span[0] + (p.span[1] - p.span[0]) * r(), squash = p.squash * (0.9 + 0.2 * r()), pts = [];
    for (let s = 0; s <= 48; s++) { const th = th0 + span * s / 48, rr = r0 * Math.exp(k * (th - th0)); pts.push([p.cx * w + rr * Math.cos(th) * (aspect > 1 ? 1.05 : 1), p.cy * h + rr * Math.sin(th) * squash]); }
    out.push(pts);
  }
  return out;
}

export function ribbons(bg, P = {}) {
  const p = { ...RIBBONS, ...P, body: { ...RIBBONS.body, ...(P.body ?? {}) }, glass: { ...RIBBONS.glass, ...(P.glass ?? {}) } }, { w, h } = bg;
  const body = sweep(w, h, ribbonPaths(w, h, p), { ...p.body, seed: p.seed });
  return renderGlass(bg, body, { ...p.glass, gap: p.glass.gap * h });
}
