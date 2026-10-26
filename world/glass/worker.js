// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// worker.js: the CPU side of the page, off the main thread. The page runs two of these: one for slow preparation
// and one for the realtime jobs (the CRT programme, the sea), so a long bake never starves a moving plate. Bodies (distance transform and bevel), caustic maps,
// the sky, the glass word layer, the sea's starting state, the vessel's ground, the live-page displacement map,
// the CRT programme at 10 Hz, and whole CPU frames for the Canvas 2D fallback. Every reply transfers its buffers.
import { figure as figureShape, fromMask, opticsField, causticMap, renderGlass, displacementMap, maskFromSdf, sd } from './glass.js';
import { seaFor } from './pieces.js';
import { FIGURE2, CHORUS2, LIVE2, VESSEL, live2Body, figure2, chorus2, vessel, vesselGround } from './pieces2.js';
import { signal } from './crt.js';
import { pane, ribbons } from './pieces3.js';
import { renderShore } from './liquid.js';
import { sky } from './lib/sky.js';
import { toSRGB8, linearToSrgb } from './lib/raster.js';

const bodyRG = b => { const o = new Float32Array(b.w * b.h * 2); for (let i = 0; i < b.w * b.h; i++) { o[i * 2] = b.height[i]; o[i * 2 + 1] = b.mask[i]; } return o; };

async function maskAt(url, w, h) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = d[i * 4] / 255;
  return m;
}
const capsule = (w, h, { cx, cy, hx, hy }) => { const X = cx * w, Y = cy * h, r = hy * h, L = hx * w - r; return maskFromSdf(w, h, (x, y) => sd.capsule(x, y, X - L, Y, X + L, Y, r)); };

let SEA = null, FEET = []; // the chorus sea lives here, so its steps and slope blurs stay off the main thread
const jobs = {
  // the programme for the figure's band: snow is added per frame in the shader
  signal({ t, seed, lines, samples }) { return { data: signal({ ...FIGURE2.band, content: FIGURE2.band.content, snow: 0, t, seed, lines, samples, jitter: 0.0008 }).data }; },
  figure({ w, h }) {
    const P = FIGURE2, b = fromMask(figureShape(w, h, P.shape).mask, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h, profile: P.bevel.profile });
    const o = { ...P.glass, gap: P.glass.gap * h };
    return { body: bodyRG(b), caustic: causticMap(b, opticsField(b, o), o) };
  },
  async chorus({ w, h, mask: url }) {
    const P = CHORUS2, mask = await maskAt(url, w, h), sea = seaFor(w, h, mask, P), above = sky(w, h, P.sky);
    const calm = renderShore(above, sea, P.shore), yc = Math.round(P.contact * h), M = Float32Array.from(mask);
    for (let i = yc * w; i < M.length; i++) M[i] = 0;
    const b = fromMask(M, w, h, { radius: P.bevel.radius * h, thickness: P.bevel.thickness * h });
    const g = renderGlass(calm, b, { ...P.glass, gap: P.glass.gap * h, soften: P.glass.soften * h }), layer = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const a = b.mask[i]; if (a > 0) layer.set([g.data[i * 4], g.data[i * 4 + 1], g.data[i * 4 + 2], a], i * 4); }
    return { sky: above.data, body: bodyRG(b), layer, grid: [sea.nx, sea.ny], slopes: [0, 1, 3, 8].map(k => sea.slopes(k)) };
  },
  // the realtime worker builds the same sea from the same mask and seed (deterministic), then steps it
  async seaInit({ w, h, mask: url }) {
    const sea = seaFor(w, h, await maskAt(url, w, h), CHORUS2); SEA = sea; FEET = [];
    for (let i = 0; i < sea.solid.length; i++) if (sea.solid[i]) FEET.push(i);
    return { ok: true };
  },
  // advance the sea n fixed steps (30 Hz), with an occasional drop at the letters' feet, and return its slope mips
  seaStep({ n }) {
    const sea = SEA; if (!sea) throw new Error('seaStep before chorus');
    for (let k = 0; k < n; k++) {
      if (FEET.length && sea.rng() < 0.05) { const i = FEET[Math.floor(sea.rng() * FEET.length)]; sea.drop(i % sea.nx + (sea.rng() - 0.5) * 8, Math.floor(i / sea.nx) + 2 + sea.rng() * 6, 2 + sea.rng() * 2, -0.1); }
      sea.step(1);
    }
    return { slopes: [0, 1, 3, 8].map(k => sea.slopes(k)) };
  },
  vessel({ w, h, series }) {
    const P = VESSEL, O = P.outer, I = { ...O, hx: O.hx * P.inner.scale, hy: O.hy * P.inner.scale };
    const inner = fromMask(capsule(w, h, I), w, h, { radius: I.hy * h, thickness: P.inner.thickness * h, profile: 'round' });
    const outer = fromMask(capsule(w, h, O), w, h, { radius: O.hy * h * 0.55, thickness: O.thickness * h, profile: 'round' });
    const oo = { ...P.glass, gap: P.glass.gap * h };
    return { ground: vesselGround(w, h, series).data, inner: bodyRG(inner), outer: bodyRG(outer), caustic: causticMap(outer, opticsField(outer, oo), oo) };
  },
  // a whole still, graded and grained in the worker: the pane and the ribbons are slow lights, not simulations
  still({ piece, w, h }) { const R = piece === 'pane' ? pane(w, h) : ribbons(w, h); return { rgba: toSRGB8(R, 7, { grain: 3.5, grainR: 1 }) }; },
  live({ w, h, scale }) {
    const d = displacementMap(live2Body(w, h, LIVE2), { ...LIVE2.glass, gap: LIVE2.glass.gap * h }, scale), over = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const a = d.overlay.data[i * 4 + 3]; if (a <= 0) continue;
      for (let c = 0; c < 3; c++) over[i * 4 + c] = Math.round(255 * linearToSrgb(Math.min(1, d.overlay.data[i * 4 + c] / Math.max(1e-4, a))));
      over[i * 4 + 3] = Math.round(255 * Math.min(1, a));
    }
    return { map: d.rgba, overlay: over, spread: d.spread };
  },
  async fallback({ piece, w, h, mask: url, series }) {
    if (piece === 'figure') return { rgba: toSRGB8(figure2(w, h), 7, { grain: 3 }) };
    if (piece === 'vessel') return { rgba: toSRGB8(vessel(w, h, series), 7, { grain: 3 }) };
    return { rgba: toSRGB8(chorus2(w, h, await maskAt(url, w, h), CHORUS2, seaFor), 7, { grain: 2.5 }) };
  },
};

self.onmessage = async e => {
  const { id, type, args } = e.data;
  try {
    const r = await jobs[type](args), xfer = [];
    const walk = v => { if (ArrayBuffer.isView(v)) xfer.push(v.buffer); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(r);
    self.postMessage({ id, ok: true, r }, [...new Set(xfer)]);
  } catch (err) {
    console.error(`worker ${type}:`, err);
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
