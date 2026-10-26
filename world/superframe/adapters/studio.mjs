// adapters/studio.mjs: the studio's material model (studio, schema studio.material/1) and the dataviz data.
// The material port carries a normalised studio material, so the studio stays the human interface over this
// framework: anything the studio edits is a material, and every lane here can read one. Also the two pinned data
// series from dataviz (US CPI, Gini) and its pitch mapping.
import { readFileSync } from 'node:fs';
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { MATERIALS, byId } from '../../studio/lib/materials.mjs';
import { blend } from '../../studio/lib/blend.mjs';
import { dataBrush } from '../../studio/lib/drivers.mjs';
import { renderImage } from '../../studio/lib/lanes/image.mjs';
import { noteFor } from '../../dataviz/lib/sonify.js';

const ST = 'studio/lib', DV = 'dataviz';
const ids = MATERIALS.map(m => m.id);
const json = p => JSON.parse(readFileSync(new URL(`../../${DV}/data/${p}`, import.meta.url), 'utf8'));
const CPI = json('cpi-annual.json').rows, GINI = json('gini-sample.json').yearly;
const SERIES = {
  'cpi-inflation': { y: CPI.map(r => r.inflation_pct ?? 0), x: CPI.map(r => r.year), label: 'US CPI inflation', unit: '% per year' },
  'cpi-cents-left': { y: CPI.map(r => r.cents_left), x: CPI.map(r => r.year), label: 'What a 1913 dollar buys', unit: 'cents' },
  'gini-mean': { y: GINI.map(r => r.mean), x: GINI.map(r => r.year), label: 'Mean Gini index', unit: 'index' },
};

export const NODES = [
  defineNode({
    id: 'studio.material', title: 'A studio material', lane: 'material', domains: ['material design'], source: `${ST}/materials.mjs`,
    doc: 'One of the studio materials: core physical and perceptual numbers that render in type, image, motion and sound.',
    outputs: { material: 'material' }, params: { id: { type: 'enum', options: ids, default: ids[0] } }, cost: () => 1,
    render: ({ params }) => ({ material: byId(params.id) }),
  }),
  defineNode({
    id: 'studio.blend', title: 'Blend two materials', lane: 'material', domains: ['material design'], source: `${ST}/blend.mjs`,
    inputs: { a: 'material', b: 'material' }, outputs: { material: 'material' }, params: { t: { type: 'number', min: 0, max: 1, default: 0.5, unit: 'share of b' } }, cost: () => 1,
    render: ({ inputs, params }) => ({ material: blend([inputs.a, inputs.b], [1 - params.t, params.t]) }),
  }),
  defineNode({
    id: 'studio.image', title: 'Material picture with a word or a series', lane: 'image', domains: ['material design'], source: `${ST}/lanes/image.mjs, drivers.mjs`,
    doc: 'The studio image lane: the material\'s plates stacked in linear light; a word lies in as the mask, a series drives one brush gesture across the sheet.',
    inputs: { material: 'material', glyphs: { type: 'glyphs', optional: true }, series: { type: 'series', optional: true } }, outputs: { raster: 'raster' },
    cost: () => 160,
    render: ({ inputs, w, h, seedInt }) => {
      const mask = inputs.glyphs ? { w: inputs.glyphs.w, h: inputs.glyphs.h, data: inputs.glyphs.mask } : null;
      const drive = inputs.series ? dataBrush(Array.from(inputs.series.y), inputs.material, { aspect: h / w }).image : null;
      return { raster: px.fromLayer(renderImage(inputs.material, { w, h, seed: seedInt % 100000, mask, drive, marks: false })) };
    },
  }),
  defineNode({
    id: 'data.series', title: 'Pinned data series', lane: 'data', domains: ['economics'], source: `${DV}/data`,
    outputs: { series: 'series' }, params: { name: { type: 'enum', options: Object.keys(SERIES), default: 'cpi-inflation' } }, cost: () => 1,
    render: ({ params }) => { const s = SERIES[params.name]; return { series: make.series(s.y, { x: Float64Array.from(s.x), label: s.label, unit: s.unit }) }; },
  }),
  defineNode({
    id: 'data.sonify', title: 'Series to notes (dataviz key)', lane: 'sound', domains: ['sonification'], source: `${DV}/lib/sonify.js noteFor`,
    inputs: { series: 'series' }, outputs: { events: 'events' },
    params: { step: { type: 'number', min: 0.04, max: 0.4, default: 0.075, unit: 's per value' }, voice: { type: 'enum', options: ['pluck', 'bell'], default: 'pluck' } }, cost: () => 1,
    render: ({ inputs, params }) => { const y = Array.from(inputs.series.y), lo = Math.min(...y), hi = Math.max(...y);
      const ev = y.map((v, i) => ({ t: +(i * params.step).toFixed(4), voice: params.voice, role: 'datum', args: { note: noteFor(v, { lo, hi }), dur: params.voice === 'bell' ? 0.8 : 0.22, vel: 0.32 } }));
      return { events: make.events(ev, y.length * params.step + 0.5) }; },
  }),
];
export { SERIES };
