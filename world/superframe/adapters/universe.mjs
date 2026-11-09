// adapters/universe.mjs: the universe's seams (universe/lib/seam-cores.mjs) as nodes. A seam changes
// the medium on the way from one place to another; here each one is a node that renders its frame at time t, so a
// film, an export or the shell's grounds can use the same transition the site plays.
// Browser-safe: no node:fs, so the shell (organic-gen.js) and the universe page can evaluate these too.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { SEAMS, REGION_MATERIAL, studioCall, toneGrid, brushPlan, strokeAt, bristles, halftonePlan, halftoneAt,
  liquidAt, liquidPixels, clamp } from '../../universe/lib/seam-cores.mjs';
import { transition } from '../../studio/lib/transition.mjs';

const U = 'universe/lib/seam-cores.mjs';
const REGIONS = Object.keys(REGION_MATERIAL);
const STUDIO_SEAMS = Object.entries(SEAMS).filter(([, s]) => s.kind === 'studio').map(([id]) => id);
const progress = (time) => clamp((time?.t ?? 1) / (time?.duration || 1));

// a raster plate as the cores' tone grid (sRGB8, at the cores' own sampling size)
function gridOf(R, rng, w, h) {
  const S = R.w === w && R.h === h ? R : px.resampleRaster(R, w, h);
  return toneGrid(px.toSRGB8(S, rng, { ground: '#e8e3d9' }), w, h);
}
const linear = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };

export const NODES = [
  defineNode({
    id: 'universe.seam-brush', title: 'Seam: data to brushstroke', lane: 'vector', domains: ['information design', 'painting'], source: `${U} brushPlan, bristles`,
    doc: 'Each count is a dot in its column; every dot flies to a patch of the plate and breaks into nine-bristle strokes coloured from the plate and laid across its gradient. Returns the strokes painted by time t.',
    inputs: { plate: 'raster', counts: { type: 'series', optional: true } }, outputs: { vector: 'vector' },
    params: { cell: { type: 'int', min: 8, max: 64, default: 22, unit: 'px between strokes' } },
    cost: () => 25,
    render: ({ inputs, params, w, h, rng, seedInt, time }) => {
      const counts = inputs.counts ? Array.from(inputs.counts.y, (v, i) => [String(i), Math.max(0, Math.round(v))]) : [['a', 8], ['b', 5], ['c', 3]];
      const plan = brushPlan({ counts, grid: gridOf(inputs.plate, rng, Math.ceil(w / params.cell), Math.ceil(h / params.cell)), w, h, seed: seedInt, cell: params.cell });
      const t = progress(time) * plan.duration, paths = [];
      for (const s of plan.strokes) {
        const p = strokeAt(s, t); if (p.phase !== 'paint' && p.phase !== 'done') continue;
        for (const b of bristles(s, p.k)) {
          const [a, c, e] = b.pts, pts = [];
          for (let i = 0; i <= 8; i++) { const u = i / 8, v = 1 - u; pts.push([v * v * a[0] + 2 * v * u * c[0] + u * u * e[0], v * v * a[1] + 2 * v * u * c[1] + u * u * e[1]]); }
          pts.length && paths.push({ pts, width: b.width, stroke: '#' + b.rgb.map((x) => x.toString(16).padStart(2, '0')).join('') });
        }
      }
      return { vector: make.vector(w, h, paths) };
    },
  }),
  defineNode({
    id: 'universe.seam-halftone', title: 'Seam: code to image', lane: 'image', domains: ['typography', 'printing'], source: `${U} halftonePlan, halftoneAt`,
    doc: 'A line of code fills the frame as text cells, takes the plate\'s tones, then each square cell collapses into one halftone dot on the measured glyph cascade. Returns the dots at time t.',
    inputs: { plate: 'raster' }, outputs: { particles: 'particles' },
    params: { text: { type: 'string', default: 'cargo install buildlang' }, cell: { type: 'int', min: 6, max: 40, default: 15, unit: 'px' } },
    cost: () => 10,
    render: ({ inputs, params, w, h, rng, time }) => {
      const plan = halftonePlan({ text: params.text, grid: gridOf(inputs.plate, rng, Math.ceil(w / params.cell), Math.ceil(h / params.cell)), w, h, cell: params.cell });
      const { dots } = halftoneAt(plan, progress(time) * plan.duration);
      return { particles: make.particles(w, h, Float32Array.from(dots, (d) => d.x), Float32Array.from(dots, (d) => d.y), { size: Float32Array.from(dots, (d) => d.r), tone: Float32Array.from(dots, (d) => d.alpha) }) };
    },
  }),
  defineNode({
    id: 'universe.seam-liquid', title: 'Seam: sound to liquid', lane: 'field', domains: ['acoustics', 'fluids'], source: `${U} shepardWave, WaveField, liquidPixels`,
    doc: 'A Shepard stack\'s waveform drops into a damped wave field; the plate is seen through the water, bent by its slope. Returns the surface height and the refracted plate at time t.',
    inputs: { plate: { type: 'raster', optional: true } }, outputs: { field: 'field', raster: 'raster' },
    params: {},
    cost: () => 60,
    render: ({ inputs, w, h, rng, time }) => {
      const W = 240, H = 150, s = liquidAt(progress(time) * SEAMS['sound-liquid'].duration, { W, H });
      const plate = inputs.plate ? gridOf(inputs.plate, rng, W, H).C : null, rgba = liquidPixels(s.field, plate, [232, 227, 217], s.show);
      const F = make.field(W, H, Float32Array.from(s.field.a, (v) => clamp(0.5 + v * 2)));
      const R = make.raster(W, H); for (let i = 0; i < W * H; i++) { R.data[4 * i] = linear(rgba[4 * i]); R.data[4 * i + 1] = linear(rgba[4 * i + 1]); R.data[4 * i + 2] = linear(rgba[4 * i + 2]); R.data[4 * i + 3] = 1; }
      return { field: px.resample(F, w, h), raster: px.resampleRaster(R, w, h) };
    },
  }),
  defineNode({
    id: 'universe.seam-material', title: 'Seam: one material to another', lane: 'image', domains: ['material design'], source: `${U} studioCall; studio/lib/transition.mjs`,
    doc: 'The nine studio seams (halftone to concrete, plate to riso, rope pull, engraving reveal, Chladni sand, signal gather, CRT to glass, code to type, glyph to light): the studio transition between the two regions\' materials, carrying the seam\'s payload, at time t.',
    inputs: { counts: { type: 'series', optional: true } }, outputs: { raster: 'raster' },
    params: {
      seam: { type: 'enum', options: STUDIO_SEAMS, default: 'halftone-concrete' },
      from: { type: 'enum', options: REGIONS, default: 'print' }, to: { type: 'enum', options: REGIONS, default: 'brut' },
      text: { type: 'string', default: 'Four labels' },
    },
    cost: () => 120,
    render: ({ inputs, params, w, h, seedInt, time }) => {
      const counts = inputs.counts ? Array.from(inputs.counts.y, (v, i) => [String(i), Math.max(0, Math.round(v))]) : [['a', 8], ['b', 5], ['c', 3]];
      const call = studioCall(params.seam, { region: params.from, title: params.text, code: params.text }, { region: params.to }, counts);
      const f = transition(call.from, call.to, call.payload, progress(time));
      return { raster: px.fromLayer(f.image({ w, h, seed: seedInt % 100000 })) };
    },
  }),
];
