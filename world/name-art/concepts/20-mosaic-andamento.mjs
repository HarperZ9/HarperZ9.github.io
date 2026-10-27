// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 20 mosaic-andamento: the name as a Roman floor. Inside each letter the tiles run in courses along its own centre lines (opus vermiculatum), cut to the outline; two courses of black basalt follow the letter outside it; the field is limestone in straight hand-laid rows (opus tessellatum). Every joint is grout, so the drawing is the grout.
// Built on lib/mosaic (andamento.mjs lays the tiles, tesserae.mjs lights them, codecells.mjs writes into them).
import { NAME } from '../lib/name.mjs';
import { mosaic } from '../lib/mosaic/index.mjs';

export const meta = {
  id: 'mosaic-andamento', title: 'Roman stone mosaic', loop: null, v1: 'code-mosaic',
  marriage: 'Roman opus vermiculatum: red courses follow each stroke, two black outline courses, limestone tessellatum field; grout is the drawing',
  refs: ['playbook/mosaic.js', 'feed-25 glyph field', 'typeengine sand material', 'feed-30 marquetry'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const { image, text: real } = mosaic(W, H, { text, style: 'andamento', t: 0 });
  return { image, text: real };
}
