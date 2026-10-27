// adapters/playbook.mjs: the reference-playbook builds (playbook). Each node calls the build's own
// CPU path; nothing is reimplemented here. The builds draw sRGB-encoded floats, so rasters are linearised on the way out.
//   playbook.cadence    a two-clock cut list as events (layout and texture clocks from the measured presets)
//   playbook.mosaic     a recut tile grid; an input raster fills the plate tiles
//   playbook.typepile   words as rigid bodies, dropped into a pile or packed into the numeral of their own count
//   playbook.morphcloud a point cloud at rest on an equation-driven target (plate nodes, phyllotaxis, orbital)
//   playbook.caustic    photons through a height-field lens, wavelength by wavelength, with one spectral flare
//   playbook.dotfield   tone marks on a 15 degree screen, Chladni grains or a phyllotaxis head, as particles
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { clock, PRESETS } from '../../playbook/cadence.js';
import { layout, renderLayout } from '../../playbook/mosaic.js';
import { Pile, bodiesFrom } from '../../playbook/typepile.js';
import { renderCPU as pileCPU } from '../../playbook/typepile.js';
import { MorphCloud, TARGETS } from '../../playbook/morphcloud.js';
import { render as causticCPU, GLASS } from '../../playbook/caustic.js';
import { marks } from '../../playbook/dotfield2.js';

const P = 'playbook';
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
// build raster (sRGB-encoded, premultiplied over an opaque ground) -> superframe raster (linear, straight alpha)
function toLinear(im) {
  const out = new Float32Array(im.w * im.h * 4);
  for (let i = 0; i < im.w * im.h; i++) {
    const a = Math.min(1, Math.max(0, im.data[i * 4 + 3])) || 1;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = lin(Math.min(1, Math.max(0, im.data[i * 4 + c] / a)));
    out[i * 4 + 3] = 1;
  }
  return make.raster(im.w, im.h, out);
}
// superframe raster (linear) -> a sampler (u, v) -> sRGB triple, for mosaic plate tiles
const srgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const sampler = (R) => (u, v) => { const x = Math.min(R.w - 1, Math.max(0, (u * R.w) | 0)), y = Math.min(R.h - 1, Math.max(0, (v * R.h) | 0)), k = (y * R.w + x) * 4; return [srgb(R.data[k]), srgb(R.data[k + 1]), srgb(R.data[k + 2])]; };

export const NODES = [
  defineNode({
    id: 'playbook.cadence', title: 'Two-clock cut list', lane: 'motion', domains: ['animation', 'film editing'], source: `${P}/cadence.js`,
    doc: 'State changes of a layout clock and a texture clock over a span, as events (voice "cut" or "boil", args.index). Presets are measured from the favourite clips: recut every 7 frames at 25 fps, 2 and 3 frame holds at 50 fps, twos at 24, a 12 Hz boil, a 7 Hz step.',
    outputs: { events: 'events' },
    params: {
      layout: { type: 'enum', options: Object.keys(PRESETS), default: 'recut-3.6' },
      texture: { type: 'enum', options: Object.keys(PRESETS), default: 'boil-12' },
      seconds: { type: 'number', min: 0.5, max: 30, default: 4, unit: 's' },
    },
    cost: (p) => p.seconds,
    render: ({ params: p, seedInt }) => {
      const ev = [];
      for (const [role, id] of [['cut', p.layout], ['boil', p.texture]]) {
        const ck = clock(id, { seed: seedInt >>> 0 });
        for (let k = 0; ck.startOf(k) < p.seconds; k++) ev.push({ t: ck.startOf(k), voice: role, args: { index: k, dur: ck.startOf(k + 1) - ck.startOf(k), vel: role === 'cut' ? 1 : 0.4 }, role });
      }
      ev.sort((a, b) => a.t - b.t || (a.voice < b.voice ? -1 : 1));
      return { events: make.events(ev, p.seconds) };
    },
  }),
  defineNode({
    id: 'playbook.mosaic', title: 'Recut tile grid', lane: 'image', domains: ['collage', 'layout'], source: `${P}/mosaic.js`,
    doc: 'One layout of the recut grid: recursive splits on a module grid, tiles of plate, two-ink plate, gradient field, dot panel, contour, digits and flat ink, one hot accent tile. The input raster fills the plate tiles.',
    inputs: { raster: { type: 'raster', optional: true } }, outputs: { raster: 'raster' },
    params: {
      k: { type: 'int', min: 0, max: 100000, default: 0, unit: 'layout index' },
      module: { type: 'number', min: 0.05, max: 0.4, default: 0.125, unit: 'share of width' },
    },
    cost: () => 30,
    render: ({ inputs, params: p, w, h, seedInt }) => {
      const L = layout(seedInt >>> 0, p.k, w, h, { module: Math.max(8, p.module * w), sources: { plate: inputs.raster ? 1 : 0, gen: 0 } });
      return { raster: toLinear(renderLayout(L, inputs.raster ? { plate: [sampler(inputs.raster)] } : {})) };
    },
  }),
  defineNode({
    id: 'playbook.typepile', title: 'Words as rigid bodies', lane: 'type', domains: ['physics', 'typography'], source: `${P}/typepile.js`,
    doc: 'Each word is a capsule body. drop: a gravity pile; count: the bodies pack into the numeral of their own count. The real text is carried through on the text side of the graph.',
    outputs: { raster: 'raster' },
    params: { mode: { type: 'enum', options: ['drop', 'count'], default: 'drop' }, words: { type: 'int', min: 4, max: 80, default: 18, unit: 'bodies' }, seconds: { type: 'number', min: 0.5, max: 8, default: 3, unit: 's simulated' } },
    cost: (p) => p.words * p.seconds,
    render: ({ params: p, w, h, seedInt }) => {
      const words = Array.from({ length: p.words }, (_, i) => ['count', 'pile', 'word', 'type', 'matter'][i % 5]);
      const pile = new Pile(bodiesFrom(words, { size: Math.max(6, h / 16) }), { w, h, seed: seedInt >>> 0 });
      if (p.mode === 'drop') pile.releaseAll(); else pile.setMode('count');
      for (let i = 0; i < Math.round(p.seconds * 120); i++) pile.step(1 / 120);
      return { raster: toLinear(pileCPU(pile)) };
    },
  }),
  defineNode({
    id: 'playbook.morphcloud', title: 'Point cloud on an equation', lane: 'particles', domains: ['acoustics', 'botany', 'quantum mechanics'], source: `${P}/morphcloud.js`,
    doc: 'Points at rest on one target: the nodal lines of a free square plate, a phyllotaxis head at 137.508 degrees, or a hydrogen orbital density slice, with a dust halo.',
    outputs: { particles: 'particles' },
    params: { target: { type: 'enum', options: ['plate', 'phyllotaxis', 'orbital'], default: 'plate' }, n: { type: 'int', min: 200, max: 20000, default: 3000, unit: 'points' } },
    cost: (p) => p.n / 100,
    render: ({ params: p, w, h, seedInt }) => {
      const t = { plate: TARGETS.plate(), phyllotaxis: TARGETS.phyllotaxis(), orbital: TARGETS.orbital() }[p.target];
      const c = new MorphCloud({ targets: [t], n: p.n, w, h, seed: seedInt >>> 0, step: null }), pos = c.rest[0];
      const x = new Float32Array(p.n), y = new Float32Array(p.n); for (let i = 0; i < p.n; i++) { x[i] = pos[2 * i]; y[i] = pos[2 * i + 1]; }
      return { particles: make.particles(w, h, x, y) };
    },
  }),
  defineNode({
    id: 'playbook.caustic', title: 'Dispersed caustic', lane: 'image', domains: ['optics'], source: `${P}/caustic.js`,
    doc: 'Photons traced through a height-field lens per wavelength (Cauchy dispersion from n_d and the Abbe number), splatted on a plane, with one spectral flare.',
    outputs: { raster: 'raster' },
    params: { glass: { type: 'enum', options: Object.keys(GLASS), default: 'flint' }, photons: { type: 'int', min: 60, max: 400, default: 160, unit: 'per axis' } },
    cost: (p) => p.photons,
    render: ({ params: p, w, h, seedInt }) => ({ raster: toLinear(causticCPU({ w, h, n: p.photons, seed: (seedInt % 1000) + 1, glass: GLASS[p.glass] })) }),
  }),
  defineNode({
    id: 'playbook.dotfield', title: 'Tone marks on a screen', lane: 'particles', domains: ['printing', 'acoustics', 'botany'], source: `${P}/dotfield2.js`,
    doc: 'The exhibit dot field as particles: a halftone of tone glyphs on a 15 degree screen read from the input field, Chladni grains settled on a plate, or a phyllotaxis head. tone carries the mark weight (dot, dash, cross, solid).',
    inputs: { field: { type: 'field', optional: true } }, outputs: { particles: 'particles' },
    params: { mode: { type: 'enum', options: ['halftone', 'plate', 'phyllotaxis'], default: 'halftone' }, n: { type: 'int', min: 500, max: 40000, default: 4000, unit: 'marks' } },
    cost: (p) => p.n / 200,
    render: ({ inputs, params: p, w, h }) => {
      const F = inputs.field, lum = F ? (u, v) => F.data[Math.min(F.h - 1, (v * F.h) | 0) * F.w + Math.min(F.w - 1, (u * F.w) | 0)] : (u, v) => 0.5 + 0.45 * Math.sin(u * 7) * Math.cos(v * 5);
      const mode = { halftone: 0, plate: 1, phyllotaxis: 3 }[p.mode], xs = [], ys = [], size = [], tone = [];
      marks({ mode, count: p.n, size: 1, dissolve: 0, thresh: 0, invert: 0, height: 0.9, speed: 2, swirl: 0, alpha: 1 }, w, h, mode === 1 ? 4.5 : 0, lum, (m) => { xs.push(m.x * w); ys.push(m.y * h); size.push(m.r); tone.push(m.shape / 3); });
      return { particles: make.particles(w, h, Float32Array.from(xs), Float32Array.from(ys), { size: Float32Array.from(size), tone: Float32Array.from(tone) }) };
    },
  }),
];
