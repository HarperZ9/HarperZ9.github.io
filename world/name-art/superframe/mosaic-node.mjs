// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// mosaic-node.mjs: lib/mosaic as a superframe node, so any word, and later any reference the author shares, goes
// through the mosaic engine. A new reference becomes a new style in lib/mosaic/index.mjs (palette and materials
// for the field, outline and letter zones, plus an optional ink), and this node offers it at once.
//   Registered through the drop-in hook superframe/adapters/namemosaic.mjs (a one-line re-export).
import { defineNode } from '../../superframe/lib/node.mjs';
import { make } from '../../superframe/lib/types.mjs';
import { mosaic, STYLES } from '../lib/mosaic/index.mjs';

export const NODES = [
  defineNode({
    id: 'nameart.mosaic', title: 'A word laid as mosaic (andamento, code tesserae, gold smalti, echo, two scales)',
    lane: 'type', domains: ['typography', 'craft', 'architecture', 'code'], source: 'name-art/lib/mosaic',
    doc: 'Sets the word in Accession and lays it as tesserae: courses follow each stroke inside the letters (opus vermiculatum), outline courses hug them, and the field is laid in straight rows or in echo courses. Every joint is grout, so the grout is the drawing. The word is spelled as given; the real text is the input text.',
    inputs: { text: { type: 'text', optional: true, doc: 'the word; replaces the text parameter' }, glyphs: { type: 'glyphs', optional: true, doc: 'its real text is used' }, time: { type: 'time', optional: true, doc: 'loop phase = t / duration (moves the light)' } },
    outputs: { raster: 'raster' },
    params: {
      text: { type: 'string', default: 'Zain Dana Harper', doc: 'the word or name, up to 40 characters' },
      style: { type: 'enum', options: Object.keys(STYLES), default: 'echo' },
      tile: { type: 'number', min: 0, max: 0.15, default: 0, unit: 'share of cap height', doc: '0 keeps the style default' },
      halo: { type: 'number', min: -1, max: 4, default: -1, unit: 'courses', doc: 'outline courses; -1 keeps the style default' },
      seed: { type: 'number', min: 1, max: 9999, default: 1 },
      phase: { type: 'number', min: 0, max: 1, default: 0, unit: 'loop share', doc: 'used when no time input arrives' },
    },
    cost: p => (p?.style === 'code' ? 500 : 300),
    render: async ({ inputs, params, w, h }) => {
      const text = (inputs.text?.text ?? inputs.glyphs?.text ?? params.text).trim().slice(0, 40) || 'Zain Dana Harper';
      const t = inputs.time ? ((inputs.time.t / (inputs.time.duration || 1)) % 1 + 1) % 1 : params.phase;
      const { image } = mosaic(w, h, { text, style: params.style, t, seed: params.seed, tile: params.tile > 0 ? params.tile : null, halo: params.halo >= 0 ? params.halo : null });
      const R = make.raster(w, h);
      for (let i = 0; i < w * h; i++) { R.data[i * 4] = image.px[i * 3]; R.data[i * 4 + 1] = image.px[i * 3 + 1]; R.data[i * 4 + 2] = image.px[i * 3 + 2]; R.data[i * 4 + 3] = 1; }
      return { raster: R };
    },
  }),
];
