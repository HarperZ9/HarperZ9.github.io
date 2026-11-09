// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 22 mosaic-smalti: Byzantine gold. The letters are gold-leaf tesserae, each pressed in at its own small tilt, so each catches the light differently; one course of red glass outlines them and the field is lapis smalti. Over the loop the light swings and the gold flickers tile by tile, as a wall does when you walk past.
// Built on lib/mosaic (andamento.mjs lays the tiles, tesserae.mjs lights them, codecells.mjs writes into them).
import { NAME } from '../lib/name.mjs';
import { mosaic } from '../lib/mosaic/index.mjs';

export const meta = {
  id: 'mosaic-smalti', title: 'Gold smalti', loop: { seconds: 6, fps: 24, crossfade: 0 }, v1: 'code-mosaic',
  marriage: 'Byzantine gold-leaf tesserae set at varied tilts on a lapis smalti field, red outline course; the light moves and the gold flickers tile by tile',
  refs: ['playbook/mosaic.js', 'feed-25 glyph field', 'typeengine sand material', 'feed-30 marquetry'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const { image, text: real } = mosaic(W, H, { text, style: 'smalti', t });
  return { image, text: real };
}
