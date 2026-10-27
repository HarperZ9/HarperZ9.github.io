// adapters/print.mjs: print, plate and paper techniques (techniques/lib), the substrate library's grain,
// halftone and hatch, and the plain field operators that let any two fields meet.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { engrave } from '../../techniques/lib/burin.js';
import { densityInf, reflect } from '../../techniques/lib/develop.js';
import { relief, normalAt, shade } from '../../techniques/lib/raking.js';
import { separate } from '../../techniques/lib/register.js';
import { piece } from '../../techniques/lib/tear.js';
import { profile } from '../../techniques/lib/zoning.js';
import { boxBlur, fbm } from '../../techniques/lib/util.js';
import { grainField } from '../../substrate/lib/raster.mjs';
import { halftone, hatch } from '../../substrate/lib/vector.mjs';

const T = 'techniques/lib', SUB = 'substrate/lib';
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const at = (F, w, h) => px.resample(F, w, h).data;

export const NODES = [
  defineNode({
    id: 'burin.engrave', title: 'Engraving by streamlines', lane: 'vector', domains: ['engraving', 'fluid dynamics'], source: `${T}/burin.js`,
    doc: 'Lines follow the structure tensor of the tone, spaced Jobard-Lefer style, swelling where the tone is dark; a second cross-hatch layer covers the shadows.',
    inputs: { field: 'field' }, outputs: { vector: 'vector' },
    params: { dsep: { type: 'number', min: 2.5, max: 9, default: 4.5, unit: 'px between lines' }, gamma: { type: 'number', min: 0.6, max: 3, default: 1.6 }, baseAngle: { type: 'number', min: -1.6, max: 1.6, default: -0.5, unit: 'rad' }, gain: { type: 'number', min: 0.5, max: 3, default: 1.6 } },
    cost: () => 250,
    render: ({ inputs, params, w, h, seedInt }) => {
      const luma = Float32Array.from(at(inputs.field, w, h), v => 1 - v);
      const { strokes } = engrave(luma, w, h, { ...params, seed: seedInt % 1000 });
      const paths = strokes.map(s => { const pts = [], widths = []; for (let i = 0; i + 2 < s.length; i += 3) { pts.push([s[i], s[i + 1]]); widths.push(s[i + 2]); } return { pts, widths }; }).filter(p => p.pts.length > 1);
      return { vector: make.vector(w, h, paths) };
    },
  }),
  defineNode({
    id: 'develop.print', title: 'Silver print development (H and D curve)', lane: 'field', domains: ['photochemistry'], source: `${T}/develop.js`,
    doc: 'Exposure to density through the Hurter-Driffield characteristic curve, then to paper reflectance.',
    inputs: { field: 'field' }, outputs: { field: 'field' },
    params: { gamma: { type: 'number', min: 1, max: 6, default: 3.2 }, invert: { type: 'bool', default: false } },
    cost: () => 10,
    render: ({ inputs, params }) => { const F = inputs.field, p = { dmin: 0.04, dmax: 2.1, gamma: params.gamma, logE0: -0.9, tau: 1.6 }, lo = reflect(p.dmax), hi = reflect(p.dmin);
      const out = Float32Array.from(F.channels === 2 ? F.data.filter((_, i) => i % 2 === 0) : F.data, e => clamp((reflect(densityInf(params.invert ? 1 - e : e, p)) - lo) / (hi - lo)));
      return { field: make.field(F.w, F.h, out) }; },
  }),
  defineNode({
    id: 'raking.relief', title: 'Pressed relief under a raking lamp', lane: 'field', domains: ['letterpress', 'optics'], source: `${T}/raking.js`,
    inputs: { field: 'field' }, outputs: { field: 'field' },
    params: { lampDeg: { type: 'number', min: 3, max: 60, default: 14, unit: 'deg above the surface' }, azDeg: { type: 'number', min: 0, max: 360, default: 315, unit: 'deg' }, bite: { type: 'number', min: 0.1, max: 1, default: 0.55 }, press: { type: 'number', min: 0.1, max: 1, default: 0.4 } },
    cost: () => 80,
    render: ({ inputs, params, w, h }) => {
      const ink = at(inputs.field, w, h), hf = relief(ink, ink, w, h, { bite: params.bite, press: params.press }), out = new Float32Array(w * h);
      const az = params.azDeg * Math.PI / 180, el = params.lampDeg * Math.PI / 180, flat = Math.sin(el);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = clamp(shade(normalAt(hf, w, h, x, y, 10), az, el) / flat * 0.5);
      return { field: make.field(w, h, out) };
    },
  }),
  defineNode({
    id: 'register.misprint', title: 'Two-plate misregistration', lane: 'field', domains: ['print'], source: `${T}/register.js`,
    doc: 'Splits a picture into a tone plate and an edge plate and measures where the two disagree; the disagreement is the field.',
    inputs: { field: 'field' }, outputs: { field: 'field' },
    params: { plate: { type: 'enum', options: ['dis', 'edge', 'tone'], default: 'dis' }, radius: { type: 'int', min: 2, max: 16, default: 6, unit: 'px' } },
    cost: () => 40,
    render: ({ inputs, params, w, h, seedInt }) => { const s = separate(at(inputs.field, w, h), w, h, { radius: params.radius, seed: seedInt % 100 }); return { field: make.field(w, h, Float32Array.from(s[params.plate])) }; },
  }),
  defineNode({
    id: 'tear.paper', title: 'Torn paper pieces', lane: 'vector', domains: ['collage', 'material'], source: `${T}/tear.js`,
    outputs: { vector: 'vector' },
    params: { pieces: { type: 'int', min: 1, max: 16, default: 5 }, amp: { type: 'number', min: 2, max: 30, default: 10, unit: 'px' }, freq: { type: 'number', min: 0.01, max: 0.08, default: 0.035, unit: 'cycles per px' } },
    cost: () => 10,
    render: ({ params, w, h, rng, seedInt }) => {
      const kinds = ['cut', 'torn', 'pulled'], paths = [];
      for (let i = 0; i < params.pieces; i++) {
        const pw = w * (0.2 + 0.4 * rng()), ph = h * (0.15 + 0.35 * rng()), x = rng() * (w - pw), y = rng() * (h - ph);
        const sides = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(k => [k, kinds[Math.floor(rng() * 3)]]));
        const p = piece([x, y, pw, ph], sides, seedInt % 1000 + i, { amp: params.amp, freq: params.freq });
        paths.push({ pts: p.outer, closed: true, fill: null, width: 1 }, { pts: p.inner, closed: true });
      }
      return { vector: make.vector(w, h, paths) };
    },
  }),
  defineNode({
    id: 'zoning.setback', title: '1916 setback-law skyline', lane: 'vector', domains: ['urban planning', 'law', 'architecture'], source: `${T}/zoning.js`,
    doc: 'Building envelopes drawn from the 1916 New York zoning rule: the wall rises with the street width, then steps back at a fixed ratio up to the tower share.',
    outputs: { vector: 'vector' },
    params: { buildings: { type: 'int', min: 1, max: 14, default: 7 }, street: { type: 'number', min: 0.08, max: 0.6, default: 0.16, unit: 'share of lot' }, ratio: { type: 'number', min: 1.5, max: 5, default: 3 } },
    cost: () => 5,
    render: ({ params, w, h, rng }) => {
      const paths = [], bw = w / params.buildings;
      for (let b = 0; b < params.buildings; b++) {
        const lot = bw * 0.48, o = { lot, street: lot * params.street * 6, ratio: params.ratio, towerShare: 0.12 + 0.2 * rng() }, top = h * (0.4 + 0.5 * rng()), cx = bw * (b + 0.5), base = h * 0.96;
        const pr = profile(o, top), right = pr.map(([z, a]) => [cx + a, base - z]), left = pr.map(([z, a]) => [cx - a, base - z]).reverse();
        paths.push({ pts: [...right, [cx + pr.at(-1)[1], base - top], [cx - pr.at(-1)[1], base - top], ...left], closed: true, fill: null, width: 1.1 });
      }
      return { vector: make.vector(w, h, paths) };
    },
  }),
  defineNode({
    id: 'substrate.grain', title: 'Clumped film grain', lane: 'field', domains: ['photography'], source: `${SUB}/raster.mjs`,
    outputs: { field: 'field' },
    params: { sd: { type: 'number', min: 2, max: 12, default: 8, unit: 'code values' }, clump: { type: 'number', min: 1, max: 8, default: 2.3, unit: 'px' } },
    cost: () => 10,
    render: ({ params, w, h, seedInt }) => { const G = grainField(w, h, { sd: params.sd, clump: params.clump, dither: 0, seed: seedInt % 100000 }); return { field: make.field(w, h, Float32Array.from(G, v => clamp(0.5 + v / 255))) }; },
  }),
  defineNode({
    id: 'substrate.halftone', title: 'Halftone dots', lane: 'particles', domains: ['print'], source: `${SUB}/vector.mjs`,
    inputs: { field: 'field' }, outputs: { particles: 'particles' },
    params: { cell: { type: 'number', min: 3, max: 24, default: 8, unit: 'px' } },
    cost: () => 10,
    render: ({ inputs, params, w, h }) => { const F = px.resample(inputs.field, w, h), gray = Uint8Array.from(F.data, v => Math.round((1 - v) * 255)), d = halftone(gray, w, h, { cell: params.cell });
      return { particles: make.particles(w, h, Float32Array.from(d, o => o.x), Float32Array.from(d, o => o.y), { size: Float32Array.from(d, o => o.r) }) }; },
  }),
  defineNode({
    id: 'substrate.hatch', title: 'Hatch fill of shapes', lane: 'vector', domains: ['drafting'], source: `${SUB}/vector.mjs`,
    inputs: { vector: 'vector' }, outputs: { vector: 'vector' },
    params: { angle: { type: 'number', min: 0, max: 180, default: 45, unit: 'deg' }, spacing: { type: 'number', min: 2, max: 16, default: 4, unit: 'px' }, cross: { type: 'bool', default: false } },
    cost: () => 20,
    render: ({ inputs, params }) => { const V = inputs.vector, paths = [];
      for (const p of V.paths) if (p.closed && p.pts.length > 2) for (const a of params.cross ? [params.angle, params.angle + 90] : [params.angle]) for (const [s, e] of hatch(p.pts, { angle: a, spacing: params.spacing })) paths.push({ pts: [s, e], width: 0.9 });
      return { vector: make.vector(V.w, V.h, paths) }; },
  }),
  defineNode({
    id: 'field.mix', title: 'Combine two fields', lane: 'field', domains: ['mathematics'], source: 'superframe',
    inputs: { a: 'field', b: 'field' }, outputs: { field: 'field' },
    params: { op: { type: 'enum', options: ['multiply', 'screen', 'max', 'min', 'difference', 'interfere'], default: 'multiply' } },
    cost: () => 3,
    render: ({ inputs, params, w, h }) => { const A = at(inputs.a, w, h), B = at(inputs.b, w, h), o = new Float32Array(w * h);
      const f = { multiply: (a, b) => a * b, screen: (a, b) => 1 - (1 - a) * (1 - b), max: Math.max, min: Math.min, difference: (a, b) => Math.abs(a - b), interfere: (a, b) => 0.5 + 0.5 * Math.cos(Math.PI * 6 * (a - b)) }[params.op];
      for (let i = 0; i < o.length; i++) o[i] = f(A[i], B[i]); return { field: make.field(w, h, o) }; },
  }),
  defineNode({
    id: 'field.warp', title: 'Warp a field by another', lane: 'field', domains: ['fluid dynamics'], source: 'superframe',
    doc: 'Domain warp: the gradient of the second field pushes where the first is read, like dye in a flow.',
    inputs: { field: 'field', by: 'field' }, outputs: { field: 'field' },
    params: { amount: { type: 'number', min: 0, max: 60, default: 14, unit: 'px' } },
    cost: () => 5,
    render: ({ inputs, params, w, h }) => { const A = px.resample(inputs.field, w, h), B = at(inputs.by, w, h), o = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, gx = B[y * w + Math.min(w - 1, x + 1)] - B[y * w + Math.max(0, x - 1)], gy = B[Math.min(h - 1, y + 1) * w + x] - B[Math.max(0, y - 1) * w + x];
        const sx = clamp(x - gy * params.amount * 4, 0, w - 1) | 0, sy = clamp(y + gx * params.amount * 4, 0, h - 1) | 0; o[i] = A.data[sy * w + sx]; }
      return { field: make.field(w, h, o) }; },
  }),
  defineNode({
    id: 'field.contour', title: 'Iso-bands of a field', lane: 'field', domains: ['cartography'], source: 'superframe',
    inputs: { field: 'field' }, outputs: { field: 'field' },
    params: { bands: { type: 'int', min: 2, max: 24, default: 9 }, width: { type: 'number', min: 0.02, max: 0.4, default: 0.12, unit: 'share of a band' } },
    cost: () => 3,
    render: ({ inputs, params }) => { const F = inputs.field, o = Float32Array.from(F.channels === 2 ? F.data.filter((_, i) => i % 2 === 0) : F.data, v => { const f = (v * params.bands) % 1; return Math.min(f, 1 - f) < params.width ? 1 : 0; });
      return { field: make.field(F.w, F.h, Float32Array.from(boxBlur(o, F.w, F.h, 1))) }; },
  }),
  defineNode({
    id: 'field.fbm', title: 'Value-noise terrain', lane: 'field', domains: ['procedural', 'geology'], source: `${T}/util.js`,
    outputs: { field: 'field' }, params: { feature: { type: 'number', min: 4, max: 200, default: 48, unit: 'px', log: true }, octaves: { type: 'int', min: 1, max: 7, default: 5 } },
    cost: () => 30,
    render: ({ params, w, h, seedInt }) => { const k = 1 / params.feature; return { field: make.field(w, h, px.normalise(Float32Array.from({ length: w * h }, (_, i) => fbm((i % w) * k, Math.floor(i / w) * k, seedInt % 1000, params.octaves)))) }; },
  }),
];
