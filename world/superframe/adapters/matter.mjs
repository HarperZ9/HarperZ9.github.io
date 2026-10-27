// adapters/matter.mjs: physical simulations from feed sets 22 and 24. Chladni plates and sand, the swimmer colony,
// bit-distance fields, golden construction, hydrogen orbitals with probability flow, the construction plate and the
// bit-distance lettering. Every node calls the original module; nothing here reimplements its physics.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { solvePlate, drivenAmplitude, modeAmplitude, membraneAmplitude, Sand } from '../../feed-22/build/chladni.js';
import { World, splat } from '../../feed-22/build/swimmers.js';
import { field as hamField } from '../../feed-24/build/hamming.js';
import { goldenRect, spiralAt } from '../../feed-24/build/golden.js';
import { makeState, sampleGrid, advect, snapshot } from '../../feed-24/build/orbital.js';
import { splatOpaque, VIEW, extentOf } from '../../feed-24/build/orbital-render.js';
import { scene as plateScene, render as plateRender } from '../../feed-24/build/construct.js';
import { tiles as bitTiles, render as bitRender } from '../../feed-24/build/bitmosaic.js';
import { surface, hexLin } from '../../feed-24/build/raster.js';

const F22 = 'feed-22/build', F24 = 'feed-24/build';
const plates = new Map();
const plate = (edge, N) => { const k = `${edge}/${N}`; if (!plates.has(k)) plates.set(k, solvePlate({ N, edge })); return plates.get(k); };
const amp = (A, w, h) => px.resample(make.field(A.R, A.R, A.amp), w, h);
const toPx = (v, size) => (v + 1) * 0.5 * size;

// Orbital states from the feed-24 room (orbital-room.js), the two-group superpositions whose beat makes the flow.
const ORBITALS = {
  '1s2p': [{ n: 1, l: 0, m: 0, c: 1 }, { n: 2, l: 1, m: 0, c: 1, group: 1 }],
  '2s3d': [{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1, group: 1 }],
  '3s4f': [{ n: 3, l: 0, m: 0, c: Math.SQRT2 }, { n: 4, l: 3, m: 2, c: 1, group: 1 }, { n: 4, l: 3, m: -2, c: -1, group: 1 }],
  '4f5g': [{ n: 4, l: 3, m: -3, c: 1 }, { n: 5, l: 4, m: -3, c: 1, group: 1 }],
  '2p3d': [{ n: 2, l: 1, m: 1, c: 1 }, { n: 3, l: 2, m: 1, c: 1, group: 1 }],
};

export const NODES = [
  defineNode({
    id: 'chladni.plate', title: 'Driven free plate (Ritz modes)', lane: 'field', domains: ['acoustics', 'mechanics'], source: `${F22}/chladni.js`,
    doc: 'A square plate solved for its bending modes, driven at a frequency between two modes: the amplitude field whose nodal lines collect sand.',
    outputs: { field: 'field' },
    params: { mode: { type: 'int', min: 1, max: 30, default: 9, unit: 'mode index' }, between: { type: 'number', min: 0, max: 1, default: 0, unit: 'share toward the next mode' }, edge: { type: 'enum', options: ['free', 'clamped'], default: 'free' }, zeta: { type: 'number', min: 0.001, max: 0.05, default: 0.004, unit: 'damping ratio', log: true } },
    cost: () => 400,
    render: ({ params, w, h }) => { const P = plate(params.edge, 12), k = Math.min(P.modes.length - 2, params.mode - 1), L = P.modes[k].lambda * (1 - params.between) + P.modes[k + 1].lambda * params.between;
      return { field: amp(drivenAmplitude(P, L, { R: 128, zeta: params.zeta, modes: 30 }), w, h) }; },
  }),
  defineNode({
    id: 'chladni.membrane', title: 'Membrane nodal pattern', lane: 'field', domains: ['acoustics', 'mathematics'], source: `${F22}/chladni.js`,
    outputs: { field: 'field' },
    params: { n: { type: 'int', min: 1, max: 9, default: 3 }, m: { type: 'int', min: 1, max: 9, default: 5 }, mix: { type: 'number', min: 0, max: 90, default: 45, unit: 'deg' } },
    cost: () => 15,
    render: ({ params, w, h }) => ({ field: amp(membraneAmplitude(params.n, params.m, params.mix, 192), w, h) }),
  }),
  defineNode({
    id: 'chladni.sand', title: 'Sand on a vibrating plate', lane: 'matter', domains: ['acoustics', 'granular physics'], source: `${F22}/chladni.js`,
    doc: 'Grains hop where the field is strong and rest where it is still, so any field sorts sand onto its nodal lines. With glyphs, grains are spelled home into the word after settling.',
    inputs: { field: 'field', glyphs: { type: 'glyphs', optional: true } }, outputs: { particles: 'particles' },
    params: { grains: { type: 'int', min: 1000, max: 40000, default: 9000, unit: 'grains' }, steps: { type: 'int', min: 20, max: 600, default: 180, unit: 'sim steps' }, spell: { type: 'number', min: 0, max: 1, default: 0.6, unit: 'share of steps spent spelling' } },
    cost: p => p.grains * p.steps * 0.0002,
    render: ({ inputs, params, w, h, seedInt }) => {
      const R = 128, F = px.resample(inputs.field, R, R), field = { amp: F.data, R };
      const S = new Sand(params.grains, { seed: seedInt % 100000 });
      const settle = inputs.glyphs ? Math.round(params.steps * (1 - params.spell)) : params.steps;
      for (let i = 0; i < settle; i++) S.step(field);
      if (inputs.glyphs) {
        const g = inputs.glyphs, homes = [];
        for (let y = 0; y < g.h; y += 2) for (let x = 0; x < g.w; x += 2) if (g.mask[y * g.w + x] > 0.5) homes.push([(x / g.w) * 2 - 1, (y / g.h) * 2 - 1]);
        if (homes.length) { S.setHomes(homes); for (let i = settle; i < params.steps; i++) S.spell({ k: 0.08, jitter: 0.003 }); }
      }
      return { particles: make.particles(w, h, Float32Array.from(S.x, v => toPx(v, w)), Float32Array.from(S.y, v => toPx(v, h)), { tone: Float32Array.from(S.tone), size: Float32Array.from(S.size, s => Math.min(1.6, 0.45 * s)) }) };
    },
  }),
  defineNode({
    id: 'swimmers.colony', title: 'Swimmer colony', lane: 'matter', domains: ['biology', 'agent simulation'], source: `${F22}/swimmers.js`,
    doc: 'A mass-conserving ecosystem of swimmers that bud, peck and split around food pellets. Outputs the swimmers with their streamer tails, and the heat of their paths.',
    outputs: { particles: 'particles', field: 'field' },
    params: { swimmers: { type: 'int', min: 10, max: 200, default: 50 }, pellets: { type: 'int', min: 1, max: 20, default: 6 }, steps: { type: 'int', min: 60, max: 3000, default: 600, unit: 'steps of 1/30 s' } },
    cost: p => p.steps * p.swimmers * 0.004,
    render: ({ params, w, h, seedInt }) => {
      const W = new World({ seed: seedInt % 100000, swimmers: params.swimmers, pellets: params.pellets });
      for (let i = 0; i < params.steps; i++) W.step(1 / 30);
      const xs = [], ys = [], ts = [], sx = w / W.o.W, sy = h / W.o.H;
      for (const s of W.swimmers) { xs.push(s.x * sx); ys.push(s.y * sy); ts.push(1); for (const tail of s.tails) for (const p of tail) { xs.push(p.x * sx); ys.push(p.y * sy); ts.push(0.5); } }
      const sp = splat(W, 200), heat = make.field(sp.w, sp.h, px.normalise(sp.heat));
      return { particles: make.particles(w, h, Float32Array.from(xs), Float32Array.from(ys), { tone: Float32Array.from(ts) }), field: px.resample(heat, w, h) };
    },
  }),
  defineNode({
    id: 'bits.hamming', title: 'Bit-distance field', lane: 'field', domains: ['information theory', 'number theory'], source: `${F24}/hamming.js`,
    doc: 'The popcount of x op y at every cell, modulo a ring: Pickover-style integer fields where every value is exact.',
    outputs: { field: 'field' },
    params: { op: { type: 'enum', options: ['xor', 'and', 'or'], default: 'xor' }, mod: { type: 'int', min: 2, max: 32, default: 8 }, scale: { type: 'int', min: 1, max: 16, default: 2, unit: 'px per cell' }, x0: { type: 'int', min: 0, max: 4096, default: 288 }, y0: { type: 'int', min: 0, max: 4096, default: 65 } },
    cost: () => 3,
    render: ({ params, w, h }) => { const v = hamField({ w, h, ...params }); return { field: make.field(w, h, Float32Array.from(v, x => x / (params.mod - 1))) }; },
  }),
  defineNode({
    id: 'golden.construction', title: 'Golden rectangle construction', lane: 'vector', domains: ['geometry', 'architecture'], source: `${F24}/golden.js`,
    outputs: { vector: 'vector' },
    params: { levels: { type: 'int', min: 4, max: 12, default: 9 }, spiral: { type: 'bool', default: true }, width: { type: 'number', min: 0.5, max: 4, default: 1.2, unit: 'px' } },
    cost: () => 2,
    render: ({ params, w, h }) => {
      const gw = Math.min(w * 0.92, h * 0.92 * 1.618), G = goldenRect((w - gw) / 2, (h - gw / 1.618) / 2, gw, params.levels), paths = [];
      for (const s of G.squares) paths.push({ pts: [[s.x, s.y], [s.x + s.s, s.y], [s.x + s.s, s.y + s.s], [s.x, s.y + s.s]], closed: true, width: params.width, fill: null });
      if (params.spiral) { const pts = []; for (let u = 0; u <= params.levels; u += 0.02) { const p = spiralAt(G, u); pts.push([p.x, p.y]); } paths.push({ pts, width: params.width * 1.6 }); }
      return { vector: make.vector(w, h, paths) };
    },
  }),
  defineNode({
    id: 'orbital.flow', title: 'Hydrogen orbital with probability flow', lane: 'matter', domains: ['quantum mechanics'], source: `${F24}/orbital.js, orbital-render.js`,
    doc: 'Exact hydrogen eigenstates in superposition; points sampled from the density and carried along the probability current for a time t, then painted with depth and relief.',
    inputs: { time: { type: 'time', optional: true } }, outputs: { particles: 'particles', raster: 'raster' },
    params: { state: { type: 'enum', options: Object.keys(ORBITALS), default: '2s3d' }, count: { type: 'int', min: 2000, max: 60000, default: 16000, unit: 'points' }, yaw: { type: 'number', min: -3.14, max: 3.14, default: 0.6, unit: 'rad' }, pitch: { type: 'number', min: -1.5, max: 1.5, default: 0.42, unit: 'rad' }, flow: { type: 'number', min: 0, max: 1, default: 0.3, unit: 'share of one beat period' } },
    cost: p => p.count * 0.05,
    render: ({ inputs, params, w, h, rng }) => {
      const S = makeState(ORBITALS[params.state]), P = sampleGrid(S, params.count, rng, { t: 0, g: 40 });
      const t = params.flow * S.period;
      if (t > 0) advect(S, P, 0, t, Math.max(1, Math.round(params.flow * 8)));
      const snap = snapshot(S, P, t, 0.82), ext = extentOf(P);
      const W = Math.max(w, h), rgba = new Uint8ClampedArray(W * W * 4);
      splatOpaque(rgba, W, W, P, snap.w, { ...VIEW, yaw: params.yaw, pitch: params.pitch }, ext * 0.8, W / 600, { vis: snap.vis, dens: snap.d, radius: 1.4, relief: 0.24 });
      const R = px.resampleRaster(px.fromSRGB8(W, W, rgba), w, h);
      const cy = Math.cos(params.yaw), sy = Math.sin(params.yaw), cp = Math.cos(params.pitch), sp = Math.sin(params.pitch), xs = [], ys = [], tone = [], k = Math.min(w, h) / (2 * ext * 0.8);
      for (let i = 0; i < params.count; i++) { if (!snap.vis[i]) continue; const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2], X = x * cy - y * sy, Y = (x * sy + y * cy) * sp + z * cp; xs.push(w / 2 + X * k); ys.push(h / 2 - Y * k); tone.push(snap.w[i]); }
      return { raster: R, particles: make.particles(w, h, Float32Array.from(xs), Float32Array.from(ys), { tone: Float32Array.from(tone) }) };
    },
  }),
  defineNode({
    id: 'construct.plate', title: 'Construction plate', lane: 'image', domains: ['geometry', 'drafting'], source: `${F24}/construct.js`,
    doc: 'A golden construction drawn in cells and dust with a comet on the spiral; an optional field is laid in as the figure the cells fill.',
    inputs: { field: { type: 'field', optional: true }, time: { type: 'time', optional: true } }, outputs: { raster: 'raster' },
    params: { levels: { type: 'int', min: 4, max: 12, default: 9 }, pitch: { type: 'number', min: 0.006, max: 0.02, default: 0.0115, unit: 'share of W' }, fill: { type: 'number', min: 0.5, max: 1, default: 0.82 }, dust: { type: 'number', min: 0, max: 0.3, default: 0.11 } },
    cost: () => 120,
    render: ({ inputs, params, w, h, palette, seedInt, time }) => {
      const figs = inputs.field ? (() => { const c = 48, r = 32, F = px.resample(inputs.field, c, r); return [{ mask: { cols: c, rows: r, v: F.data }, square: 0, scale: 0.78 }]; })() : [];
      const sc = plateScene(w, h, figs, inputs.time?.t ?? time.t, { ...params, seed: seedInt % 100000, ground: palette.ink, ink: palette.ground, accent: palette.accent });
      const S = surface(w, h, hexLin(palette.ink)); plateRender(S, sc);
      return { raster: px.fromRGB3(w, h, S.px) };
    },
  }),
  defineNode({
    id: 'bits.letters', title: 'Letters made of bit distances', lane: 'type', domains: ['information theory', 'typography'], source: `${F24}/bitmosaic.js`,
    doc: 'A tile grid whose tile size falls with the bit distance between its column (offset by the letter\'s character code) and its row, so each letter carries its own field.',
    inputs: { glyphs: 'glyphs' }, outputs: { raster: 'raster' },
    params: { pitch: { type: 'int', min: 3, max: 24, default: 7, unit: 'px' }, bits: { type: 'int', min: 3, max: 10, default: 8 }, minSide: { type: 'number', min: 0.05, max: 0.6, default: 0.12 }, faint: { type: 'number', min: 0, max: 0.4, default: 0.11 } },
    cost: () => 20,
    render: ({ inputs, params, palette }) => {
      const g = inputs.glyphs, spans = g.spans ?? [{ x0: 0, x1: g.w, code: (g.text.codePointAt(0) ?? 65) }];
      const o = { ...params, ground: palette.ground, ink: palette.ink }, S = surface(g.w, g.h, hexLin(palette.ground));
      bitRender(S, bitTiles(g.w, g.h, g.mask, spans, o), o);
      return { raster: px.fromRGB3(g.w, g.h, S.px) };
    },
  }),
];
export { ORBITALS };
