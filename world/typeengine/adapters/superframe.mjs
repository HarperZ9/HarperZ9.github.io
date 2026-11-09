// adapters/superframe.mjs: the type engine as super-framework nodes. One line in superframe lib/registry.mjs adds
// them (the superframe agent owns that file): import { NODES as TYPEENGINE } from '../../typeengine/adapters/superframe.mjs'.
//   typeengine.word   a word set in any engine family: raster, its glyphs (real text kept) and, when it sounds, audio
//   typeengine.family a family minted from a brief (one seeded candidate), as the same outputs
import { defineNode } from '../../superframe/lib/node.mjs';
import { make } from '../../superframe/lib/types.mjs';
import { renderWord } from '../lib/render.mjs';
import { candidate } from '../lib/generate.mjs';
import { MATERIALS } from '../lib/materials.mjs';
import { createLiving, createReveal, STATES } from '../lib/living/index.mjs';

const out = (r) => {
  const res = { raster: make.raster(r.raster.w, r.raster.h, Float32Array.from(r.raster.data)), glyphs: { text: r.text, w: r.raster.w, h: r.raster.h, mask: Float32Array.from(r.glyph.coverage.data) } };
  if (r.pcm) res.audio = make.audio(r.pcm.rate, r.pcm.channels.map((c) => Float32Array.from(c)));
  return res;
};
const FILLS = [...MATERIALS.values()].filter((m) => !['glow', 'offset', 'drift', 'voice'].includes(m.id)).map((m) => m.id);

export const NODES = [
  defineNode({
    id: 'typeengine.word', title: 'A word in any material', lane: 'type', domains: ['typography', 'optics', 'acoustics'], source: 'typeengine/lib/render.mjs',
    doc: 'Sets text on the house skeletons and fills it with a type-engine material; the glyphs output keeps the real text.',
    outputs: { raster: 'raster', glyphs: 'glyphs', audio: 'audio' },
    params: { text: { type: 'string', default: 'Accession' }, fill: { type: 'enum', options: FILLS, default: 'halftone' }, weight: { type: 'int', min: 300, max: 900, default: 800, unit: 'wght' },
      style: { type: 'enum', options: ['display', 'text', 'super'], default: 'display' } },
    cost: () => 400,
    render: ({ params, w, h, seedInt }) => out(renderWord({ schema: 'typeengine.family/1', id: 'sf', name: 'sf', skeleton: { source: 'accession', style: params.style, weight: params.weight },
      bindings: { fill: { material: params.fill }, sound: { material: 'voice' } }, inputs: { 'data.series': { values: [3, 6, 2, 8, 5, 9, 4] }, 'sound.pcm': { source: 'phrase', seconds: 1.5 } } }, params.text, w, h, { seed: seedInt })),
  }),
];

const READING = [...STATES.values()].filter((s) => s.reads !== false).map((s) => s.id);
const rgba = (img, w, h) => { const d = new Float32Array(w * h * 4); for (let k = 0; k < w * h; k++) { d[k * 4] = img[k * 3]; d[k * 4 + 1] = img[k * 3 + 1]; d[k * 4 + 2] = img[k * 3 + 2]; d[k * 4 + 3] = 1; } return make.raster(w, h, d); };
const rgb = (R) => { const o = new Float32Array(R.w * R.h * 3); for (let k = 0; k < R.w * R.h; k++) { o[k * 3] = R.data[k * 4]; o[k * 3 + 1] = R.data[k * 4 + 1]; o[k * 3 + 2] = R.data[k * 4 + 2]; } return o; };

NODES.push(defineNode({
  id: 'typeengine.living', title: 'A word changing medium as it moves', lane: 'type', domains: ['typography', 'fluids', 'printing'], source: 'typeengine/lib/living/index.mjs',
  doc: 'The word in one medium carried across the surface into another by the physics of that medium (bleed, wet, settle, scan, stream, wake); progress 0 is the first medium at rest, 1 the second.',
  outputs: { raster: 'raster', glyphs: 'glyphs' },
  params: { text: { type: 'string', default: 'water' }, from: { type: 'enum', options: READING, default: 'ink' }, to: { type: 'enum', options: READING, default: 'charcoal' },
    progress: { type: 'number', min: 0, max: 1, default: 0.5, unit: 'share of the move' }, t: { type: 'number', min: 0, max: 60, default: 0, unit: 's (drift at rest)' } },
  cost: () => 900,
  render: ({ params: p, w, h, seedInt }) => {
    const L = createLiving({ w, h, seed: seedInt, stops: [{ state: p.from, text: p.text }, { state: p.to }] }), s = p.progress <= 0 ? 0 : L.lead + (1 - L.lead) * p.progress;
    return { raster: rgba(L.at(s, p.t), w, h), glyphs: { text: p.text, w, h, mask: Float32Array.from(L.coverage(p.text)) } };
  },
}));
NODES.push(defineNode({
  id: 'typeengine.reveal', title: 'What lies beneath, washed up', lane: 'type', domains: ['fluids', 'reading'], source: 'typeengine/lib/living/reveal.mjs',
  doc: 'Water poured across the top picture carries it off and uncovers the picture beneath (the reveal living type and Daylight share).',
  inputs: { top: 'raster', under: 'raster' }, outputs: { raster: 'raster' },
  params: { progress: { type: 'number', min: 0, max: 1, default: 0.5, unit: 'share of the wash' } }, cost: () => 700,
  render: ({ inputs, params: p, w, h, seedInt }) => ({ raster: rgba(createReveal({ top: rgb(inputs.top), under: rgb(inputs.under), w: inputs.top.w, h: inputs.top.h, seed: seedInt }).frame(p.progress), inputs.top.w, inputs.top.h) }),
}));

export function familyNode(brief) {
  return defineNode({
    id: `typeengine.${brief.id}`, title: `${brief.name}: a minted family`, lane: 'type', domains: ['typography'], source: 'typeengine/lib/generate.mjs',
    outputs: { raster: 'raster', glyphs: 'glyphs', audio: 'audio' },
    params: { text: { type: 'string', default: 'Accession' }, index: { type: 'int', min: 0, max: 999, default: 0 } }, cost: () => 800,
    render: ({ params, w, h }) => out(renderWord(candidate(brief, params.index), params.text, w, h, {})),
  });
}
