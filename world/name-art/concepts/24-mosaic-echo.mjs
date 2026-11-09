// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 24 mosaic-echo: the name with Ravenna's echo. Every field course runs parallel to the letters' outline and ripples out to the frame edge, banded light and dark; the tiles are the cells of seed points spaced evenly along each course, so the joints turn with the course and never meet on a seam.
// Built on lib/mosaic (andamento.mjs lays the tiles, tesserae.mjs lights them, codecells.mjs writes into them).
import { NAME } from '../lib/name.mjs';
import { mosaic } from '../lib/mosaic/index.mjs';

export const meta = {
  id: 'mosaic-echo', title: 'Echo mosaic', loop: null, v1: 'code-mosaic',
  marriage: 'Ravenna echo andamento: field courses ripple out parallel to the letters, banded in tone; tiles are cells of seeds spaced along each course',
  refs: ['playbook/mosaic.js', 'feed-25 glyph field', 'typeengine sand material', 'feed-30 marquetry'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const { image, text: real } = mosaic(W, H, { text, style: 'echo', t: 0 });
  return { image, text: real };
}
