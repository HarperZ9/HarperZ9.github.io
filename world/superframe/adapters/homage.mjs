// adapters/homage.mjs: the homage collage's techniques (homage) as superframe nodes.
//   homage.portrait  a sitter's likeness descriptor drawn by the technique that echoes their idea (tree, woodcut,
//                    stream, chance, stamp, system, refute, wave); ink and spot separations as fields
//   homage.emblem    an idea drawn as an emblem, for people shown without a face and for works and movements
//   homage.technique any of the eight portrait techniques applied to an incoming tone field, so a tree of life or
//                    a refutation hatch can draw anything the graph makes
// Fields here are ink coverage, 0 paper .. 1 full ink.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { PORTRAITS, renderPortrait } from '../../homage/src/portraits.mjs';
import { EMBLEMS, renderEmblem } from '../../homage/src/emblems/index.mjs';
import { tree, stream, refute, wave } from '../../homage/src/tech/lines.mjs';
import { woodcut, chance, stamp, system } from '../../homage/src/tech/print.mjs';
import { rng } from '../../homage/src/raster.mjs';

const SRC = 'homage/src';
const TECH = { tree, stream, refute, wave, woodcut, chance, stamp, system };
const fit = (P, w, h) => px.resample(make.field(P.w, P.h, P.c), w, h);

export const NODES = [
  defineNode({
    id: 'homage.portrait', title: 'Homage portrait', lane: 'field', domains: ['portraiture', 'engraving', 'history of ideas'], source: `${SRC}/portraits.mjs`,
    doc: 'A likeness rebuilt from a coarse descriptor (never the photo) and drawn by the technique that echoes the sitter: Darwin as a tree of life, Marx as woodcut and halftone, Popper as refuted hatching, and so on.',
    inputs: {}, outputs: { field: 'field', spot: 'field' },
    params: { sitter: { type: 'enum', options: Object.keys(PORTRAITS), default: 'james' } },
    cost: () => 900,
    render: ({ params, w, h }) => { const r = renderPortrait(params.sitter, Math.max(64, Math.round(Math.min(w, h / 1.25)))); return { field: fit(r.ink, w, h), spot: fit(r.spot, w, h) }; },
  }),
  defineNode({
    id: 'homage.emblem', title: 'Homage emblem', lane: 'field', domains: ['emblem', 'graphic design'], source: `${SRC}/emblems/index.mjs`,
    doc: 'An idea drawn as an emblem: a ripple tank, a ring of checks, a tessellation, a camcorder frame. No faces, logos or trademarks.',
    inputs: {}, outputs: { field: 'field', spot: 'field' },
    params: { emblem: { type: 'enum', options: Object.keys(EMBLEMS), default: 'checks' } },
    cost: () => 60,
    render: ({ params, w, h, seedInt }) => { const S = Math.max(64, Math.min(w, h)), r = renderEmblem(params.emblem, S, seedInt % 100000); return { field: fit(r.ink, w, h), spot: fit(r.spot, w, h) }; },
  }),
  defineNode({
    id: 'homage.technique', title: 'Idea technique on any tone', lane: 'field', domains: ['engraving', 'printmaking', 'generative'], source: `${SRC}/tech`,
    doc: 'One of the eight portrait techniques applied to an incoming field read as darkness (1 = dark).',
    inputs: { field: 'field' }, outputs: { field: 'field', spot: 'field' },
    params: { technique: { type: 'enum', options: Object.keys(TECH), default: 'stream' } },
    cost: (p) => (p.technique === 'tree' ? 4000 : 300),
    render: ({ inputs, params, w, h, seedInt }) => {
      const D = px.resample(inputs.field, w, h).data, n = w * h, tone = new Float32Array(n), tx = new Float32Array(n), ty = new Float32Array(n), mask = new Float32Array(n).fill(1);
      for (let i = 0; i < n; i++) tone[i] = 1 - Math.min(1, Math.max(0, D[i]));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // form direction: along isophotes of the input
        const i = y * w + x, gx = (D[y * w + Math.min(w - 1, x + 1)] - D[y * w + Math.max(0, x - 1)]), gy = (D[Math.min(h - 1, y + 1) * w + x] - D[Math.max(0, y - 1) * w + x]), l = Math.hypot(gx, gy);
        tx[i] = l > 1e-6 ? -gy / l : 1; ty[i] = l > 1e-6 ? gx / l : 0;
      }
      const F = { w, h, tone, tx, ty, coh: mask, mask, marks: { eyeL: [w * 0.4, h * 0.4], mouth: [w * 0.5, h * 0.62] }, eyeW: w * 0.2, head: { cx: w / 2, cy: h / 2, rx: w * 0.4, ry: h * 0.45 }, rand: rng(seedInt % 100000) };
      const r = TECH[params.technique](F, { seed: seedInt % 100000 });
      return { field: make.field(w, h, r.ink.c), spot: make.field(w, h, r.spot.c) };
    },
  }),
];
