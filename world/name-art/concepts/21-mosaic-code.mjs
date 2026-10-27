// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 21 mosaic-code: every tessera is one character of the code that lays it (lib/mosaic, the lettering and the glass optics, read at render time). Lines of code run along each stroke's courses, heavy and on bone tiles inside the letters, light and on dark glass in the field rows, so the word is drawn by the weight of its own source.
// Built on lib/mosaic (andamento.mjs lays the tiles, tesserae.mjs lights them, codecells.mjs writes into them).
import { NAME } from '../lib/name.mjs';
import { mosaic } from '../lib/mosaic/index.mjs';

export const meta = {
  id: 'mosaic-code', title: 'Code tesserae', loop: null, v1: 'code-mosaic',
  marriage: 'every tile one character of our own engine source, set upright along the stroke courses; weight and density carry the tone',
  refs: ['playbook/mosaic.js', 'feed-25 glyph field', 'typeengine sand material', 'feed-30 marquetry'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const { image, text: real } = mosaic(W, H, { text, style: 'code', t: 0 });
  return { image, text: real };
}
