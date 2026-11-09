// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 23 mosaic-scales: the name at two scales. Each letter tile carries the initials, turned to read along its course; each field tile carries the whole name, which resolves only at 4K, so the picture changes as you come closer.
// Built on lib/mosaic (andamento.mjs lays the tiles, tesserae.mjs lights them, codecells.mjs writes into them).
import { NAME } from '../lib/name.mjs';
import { mosaic } from '../lib/mosaic/index.mjs';

export const meta = {
  id: 'mosaic-scales', title: 'Mosaic at two scales', loop: null, v1: 'code-mosaic',
  marriage: 'the name made of tiles, each letter tile carrying the initials and each field tile the whole name, legible at 4K',
  refs: ['playbook/mosaic.js', 'feed-25 glyph field', 'typeengine sand material', 'feed-30 marquetry'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const { image, text: real } = mosaic(W, H, { text, style: 'scales', t: 0 });
  return { image, text: real };
}
