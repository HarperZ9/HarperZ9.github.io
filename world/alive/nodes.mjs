// nodes.mjs: the alive modules as superframe nodes (superframe/lib/node.mjs interface). Each node takes
// and gives superframe types (raster is linear float RGBA; field is 0..1), converts at the edge with superframe's own
// pixel helpers, and reads time from the recipe's time.t, so a recipe renders any frame of a living still, a wiggle
// or a mosaic deterministically. Register with: new Map(NODES.map((n) => [n.id, n])).
import { defineNode } from '../superframe/lib/node.mjs';
import { make } from '../superframe/lib/types.mjs';
import * as px from '../superframe/lib/pix.mjs';
import { estimateDepth, renderFrame, region } from './livestill.js';
import { synthViews, sequence, viewAt } from './wiggle.js';
import { layoutAt, renderMosaic, codeSource, seriesSource } from './framemosaic.js';
import { resize } from './lib/img.js';

const SRC = 'alive';
const to8 = (R, rng) => ({ w: R.w, h: R.h, data: new Uint8ClampedArray(px.toSRGB8(R, rng)) });
const toR = (im) => px.fromSRGB8(im.w, im.h, im.data);
const fit = (im, w, h) => (im.w === w && im.h === h ? im : resize(im, w, h));
const depthField = (d) => make.field(d.w, d.h, Float32Array.from(d.data));

const rangeP = (min, max, def, unit) => ({ type: 'number', min, max, default: def, unit });

export const NODES = [
  defineNode({
    id: 'alive.depth', title: 'Depth from cues', lane: 'image', domains: ['perception', 'painting'], source: `${SRC}/livestill.js`,
    doc: 'Our own depth estimate: ground plane, aerial haze, detail and figure against the border, smoothed with a guided filter.',
    inputs: { image: 'raster' }, outputs: { field: 'field' },
    params: { ground: rangeP(0, 1, 0.45, 'weight'), haze: rangeP(0, 1, 0.2, 'weight'), detail: rangeP(0, 1, 0.35, 'weight'), figure: rangeP(0, 1, 0.2, 'weight') },
    cost: () => 60,
    render: async ({ inputs, params, w, h, rng }) => ({ field: depthField(estimateDepth(fit(to8(inputs.image, rng), w, h), params)) }),
  }),
  defineNode({
    id: 'alive.livestill', title: 'Living still', lane: 'image', domains: ['photography', 'optics', 'animation'], source: `${SRC}/livestill.js`,
    doc: 'A still put in motion at time t: 2.5D parallax, breath, wind in the top band, water in the bottom band, a passing light.',
    inputs: { image: 'raster', depth: { type: 'field', optional: true } }, outputs: { raster: 'raster' },
    params: { parallax: rangeP(0, 0.05, 0.012, 'fraction of width'), breathe: rangeP(0, 0.02, 0.004, 'scale'), wind: rangeP(0, 0.02, 0.004, 'fraction of width'), water: rangeP(0, 0.02, 0.003, 'fraction of height'), light: rangeP(0, 0.4, 0.1, 'gain'), windBand: rangeP(0, 1, 0.3, 'fraction from the top'), waterBand: rangeP(0, 1, 0, 'fraction from the bottom') },
    cost: () => 120,
    render: async ({ inputs, params, w, h, rng, time, seedInt }) => {
      const im = fit(to8(inputs.image, rng), w, h), dep = inputs.depth ? { w: inputs.depth.w, h: inputs.depth.h, data: inputs.depth.data } : estimateDepth(im);
      const wind = params.windBand > 0 ? region(w, h, { rects: [[0, 0, 1, params.windBand]] }) : null, water = params.waterBand > 0 ? region(w, h, { rects: [[0, 1 - params.waterBand, 1, 1]] }) : null;
      return { raster: toR(renderFrame(im, dep, time?.t ?? 0, params, { wind, water, seed: (seedInt ?? 7) & 0xffff })) };
    },
  }),
  defineNode({
    id: 'alive.wiggle', title: 'Wigglegram view', lane: 'image', domains: ['stereoscopy', 'photography'], source: `${SRC}/wiggle.js`,
    doc: 'The view of a synthesized wigglegram showing at time t, pivot held still.',
    inputs: { image: 'raster' }, outputs: { raster: 'raster' },
    params: { views: { type: 'int', min: 2, max: 6, default: 3 }, step: rangeP(0.04, 0.5, 0.1, 's'), amp: rangeP(0, 0.05, 0.016, 'fraction of width'), pivotX: rangeP(0, 1, 0.5, 'u'), pivotY: rangeP(0, 1, 0.4, 'v'), order: { type: 'enum', options: ['pingpong', 'cycle'], default: 'pingpong' } },
    cost: () => 150,
    render: async ({ inputs, params, w, h, rng, time }) => {
      const im = fit(to8(inputs.image, rng), w, h), v = synthViews(im, { views: params.views, amp: params.amp, pivot: [params.pivotX, params.pivotY] });
      return { raster: toR(v[viewAt(time?.t ?? 0, sequence(params.views, params.order), params.step)]) };
    },
  }),
  defineNode({
    id: 'alive.mosaic', title: 'Frame, data and code mosaic', lane: 'image', domains: ['collage', 'data', 'software'], source: `${SRC}/framemosaic.js`,
    doc: 'A recut tile mosaic. With a series input the tiles are its cells; without one they are this module\'s own source code as texture.',
    inputs: { series: { type: 'series', optional: true } }, outputs: { raster: 'raster' },
    params: { layout: { type: 'int', min: 0, max: 999, default: 0 }, depth: { type: 'int', min: 1, max: 7, default: 4 }, gap: { type: 'int', min: 0, max: 8, default: 2, unit: 'px' } },
    cost: () => 30, runtime: ['node'],
    render: async ({ inputs, params, w, h, time, seedInt }) => {
      const src = inputs.series ? seriesSource(Array.from(inputs.series.y)) : codeSource(await ownCode());
      const f = renderMosaic(w, h, layoutAt((seedInt ?? 5) & 0xffff, params.layout, { depth: params.depth }), src, time?.t ?? 0, { gap: params.gap });
      return { raster: toR(f.image) };
    },
  }),
];

async function ownCode() { const fs = await import('node:fs'); return fs.readFileSync(new URL('./framemosaic.js', import.meta.url), 'utf8'); }
