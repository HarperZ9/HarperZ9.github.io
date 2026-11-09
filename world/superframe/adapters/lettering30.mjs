// adapters/lettering30.mjs: the feed set 30 lettering generators (feed-30/build/lib). Each node takes
// glyphs (any upstream lettering keeps its real text), rebuilds the skeleton by thinning, and returns a raster.
// Added as a new adapter file; the registry discovers it, nothing else in the framework changed.
import { defineNode } from '../lib/node.mjs';
import { fromMask } from '../../feed-30/build/lib/skel.mjs';
import { render } from '../../feed-30/build/lib/feed30.mjs';

const SRC = 'feed-30/build/lib';
const glyphsIn = { glyphs: { type: 'glyphs', doc: 'the word; its mask is thinned to centre lines' } };
const out = (R) => ({ raster: { w: R.w, h: R.h, data: R.data } });
const node = (id, title, kind, domains, params, extra = () => ({})) => defineNode({
  id, title, lane: 'type', domains, source: `${SRC}/${kind === 'swash' ? 'swash' : kind === 'vessel' ? 'vessel' : kind === 'marquetry' ? 'marquetry' : kind === 'bubbly' ? 'bubbly' : 'manyfold'}.mjs`,
  inputs: glyphsIn, outputs: { raster: 'raster' }, params, cost: () => 120,
  render: ({ inputs, params: p, palette, seedInt }) => out(render(kind === 'manyfold' ? p.rendering : kind, fromMask(inputs.glyphs), { ...p, seed: `sf/${id}/${seedInt}`, ground: palette?.ground ?? '#ebe5d8', ink: palette?.ink ?? '#15130f', ...extra(p, palette) })),
});

export const NODES = [
  node('lettering30.manyfold', 'One skeleton, many renderings', 'manyfold', ['typography', 'printing', 'optics'], {
    rendering: { type: 'enum', options: ['fill', 'outline', 'halftone', 'scan', 'split'], default: 'halftone' },
    pitch: { type: 'number', min: 3, max: 40, default: 9, unit: 'px' }, thick: { type: 'number', min: 0.6, max: 12, default: 2.4, unit: 'px' },
    spread: { type: 'number', min: 0, max: 40, default: 6, unit: 'px' }, width: { type: 'number', min: 0.6, max: 12, default: 2, unit: 'px' },
  }),
  node('lettering30.swash', 'Swashes and ligatures grown from the skeleton', 'swash', ['typography', 'calligraphy', 'geometry'], {
    amount: { type: 'number', min: 0, max: 1, default: 0.55, unit: 'share of free ends' }, turns: { type: 'number', min: 0.25, max: 1.6, default: 0.75, unit: 'turns' },
    as: { type: 'enum', options: ['fill', 'outline'], default: 'fill' },
  }),
  node('lettering30.vessel', 'Strokes become glass, rope or pipe', 'vessel', ['typography', 'optics', 'materials'], {
    object: { type: 'enum', options: ['glass', 'rope', 'pipe'], default: 'glass' }, fill: { type: 'number', min: 0, max: 1, default: 0.55, unit: 'liquid level share' },
  }, (p, pal) => ({ liquid: pal?.accent ?? '#e6a03c' })),
  node('lettering30.marquetry', 'Marquetry tile warp', 'marquetry', ['woodwork', 'halftone', 'typography'], {
    pitch: { type: 'number', min: 12, max: 120, default: 22, unit: 'px (cell diagonal)' }, base: { type: 'number', min: 0.19, max: 0.68, default: 0.38, unit: 'dark share outside' },
    contrast: { type: 'number', min: 0, max: 0.5, default: 0.28, unit: 'dark share added inside' },
  }),
  node('lettering30.bubbly', 'Inflated bubbly display', 'bubbly', ['typography', 'illustration'], {
    inflate: { type: 'number', min: 1, max: 3, default: 1.8, unit: 'x half stroke' }, glints: { type: 'int', min: 0, max: 40, default: 7, unit: 'count' },
  }, (p, pal) => ({ inks: [pal?.ground === '#0e0f12' ? '#f1ebdd' : '#15130f', pal?.accent ?? '#e6a03c', '#7fd6e8'] })),
];
