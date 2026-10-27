// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// nameart.mjs: the name-art generator as a superframe node, so any name or word goes through it. The node wraps
// the four finals and the monogram from name-art/concepts (it imports them; it copies nothing).
// The word arrives as a text port, a glyphs port (its real text is used and kept) or the text parameter, and the
// output is a linear-light raster like every other image node. The real text travels with the raster's caller
// through the glyphs it was given, and the node's doc names it.
//   Registered in superframe/lib/registry.mjs as the `nameart` adapter (one import, one entry).
import { defineNode } from '../../superframe/lib/node.mjs';
import { make } from '../../superframe/lib/types.mjs';
import * as glass from '../concepts/01-shallow-glass.mjs';
import * as tubes from '../concepts/14-glass-tubes.mjs';
import * as decoArc from '../concepts/15-deco-arc.mjs';
import * as intaglio from '../concepts/16-intaglio-lines.mjs';
import * as banknote from '../concepts/02-banknote.mjs';
import * as deco from '../concepts/08-deco-sunburst.mjs';
import * as pearls from '../concepts/11-pearls.mjs';
import * as orb from '../concepts/13-monogram-orb.mjs';
import * as decoMotif from '../concepts/37-deco-motif.mjs';
import * as divisumma from '../concepts/25-mosaic-divisumma.mjs';
import { textField } from '../lib/mosaic/textfield.mjs';
import { setName } from '../lib/name.mjs';

export const STYLES = { 'glass-tubes': tubes, 'deco-arc': decoArc, 'intaglio-lines': intaglio, pearls, 'monogram-orb': orb, 'shallow-glass': glass, 'deco-sunburst': deco, banknote, 'deco-motif': decoMotif, 'mosaic-divisumma': divisumma };

export const NODES = [
  defineNode({
    id: 'nameart.word', title: 'A word or name as art (glass at low sun, deco marquee, engraved note, pearls, aperture monogram)',
    lane: 'type', domains: ['typography', 'optics', 'print', 'architecture'], source: 'name-art/concepts',
    doc: 'Sets the word in Accession and builds its letters from one of eight techniques (the first five are the finals; the last three are the v1 versions they replaced). Style glass-tubes is the default; the choices are explained (name-art/DECISIONS.md). The word is spelled as given; the real text is the input text.',
    inputs: { text: { type: 'text', optional: true, doc: 'the word; replaces the text parameter' }, glyphs: { type: 'glyphs', optional: true, doc: 'its real text is used' }, time: { type: 'time', optional: true, doc: 'loop phase = t / duration' } },
    outputs: { raster: 'raster' },
    params: {
      text: { type: 'string', default: 'Zain Dana Harper', doc: 'the word or name, up to 40 characters' },
      style: { type: 'enum', options: Object.keys(STYLES), default: 'glass-tubes' },
      phase: { type: 'number', min: 0, max: 1, default: 0, unit: 'loop share', doc: 'used when no time input arrives' },
    },
    cost: p => ({ 'glass-tubes': 400, 'deco-arc': 160, 'intaglio-lines': 160, 'shallow-glass': 400, 'deco-sunburst': 120, banknote: 160, pearls: 140, 'monogram-orb': 90 })[p?.style] ?? 300,
    render: async ({ inputs, params, w, h }) => {
      const text = (inputs.text?.text ?? inputs.glyphs?.text ?? params.text).trim().slice(0, 40) || 'Zain Dana Harper';
      const t = inputs.time ? ((inputs.time.t / (inputs.time.duration || 1)) % 1 + 1) % 1 : params.phase;
      const { image } = await STYLES[params.style].render(w, h, { t, text });
      const R = make.raster(w, h);
      for (let i = 0; i < w * h; i++) { R.data[i * 4] = image.px[i * 3]; R.data[i * 4 + 1] = image.px[i * 3 + 1]; R.data[i * 4 + 2] = image.px[i * 3 + 2]; R.data[i * 4 + 3] = 1; }
      return { raster: R };
    },
  }),
  // A Divisumma text field: the word's letter shape (or the whole frame) filled with tiny dense text. As a field it
  // pours into the FLOW medium as ink of its shape (lib/medium/ports.mjs), so code can be poured as a material.
  defineNode({
    id: 'nameart.textfield', title: 'A field of tiny dense text (Divisumma digits or any source), shaped by a word',
    lane: 'type', domains: ['typography', 'code', 'print'], source: 'name-art/lib/mosaic/textfield.mjs',
    doc: 'Fills the word (or the frame, when shape is off) with rows of one-character cells read from the fill text, at a line pitch in px, with deliberate misprints at the glitch rate (the Divisumma 26 fault). Coverage 0..1 as a field.',
    inputs: { text: { type: 'text', optional: true, doc: 'the fill text; replaces the fill parameter' } },
    outputs: { field: 'field' },
    params: {
      word: { type: 'string', default: 'Zain Dana Harper', doc: 'the shape; empty fills the frame' },
      fill: { type: 'string', default: '1234567890', doc: 'the text the cells read, in order' },
      pitch: { type: 'number', min: 4, max: 60, default: 12, unit: 'px' },
      angle: { type: 'number', min: -90, max: 90, default: 0, unit: 'deg' },
      glitch: { type: 'number', min: 0, max: 0.2, default: 0.02 },
    },
    cost: () => 120,
    render: async ({ inputs, params, w, h }) => {
      const mask = params.word ? setName(params.word, w, h, { box: [0.04, 0.12, 0.96, 0.88], weight: 900 }).mask : null;
      const data = textField(w, h, { text: inputs.text?.text ?? params.fill, pitch: params.pitch, angle: params.angle * Math.PI / 180, glitch: params.glitch, mask });
      return { field: make.field(w, h, data) };
    },
  }),
];
