// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 06 code-mosaic: the name drawn by the code that draws it. The cell grid is filled with this file's own
// source, set in Accession Mono, in three brightness tiers: inside the letters, on their edge, and the field.
// Every 0.28 s the stream recuts (the favourites' 7-frame hold), and one token at a time lights in the hot mark.
import { readFileSync } from 'node:fs';
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { img, lin, clamp, smooth, hash2, grain } from '../lib/img.mjs';

export const meta = {
  id: 'code-mosaic', title: 'Code mosaic', loop: { seconds: 5.6, fps: 25, crossfade: 0, holdFrames: 7 },
  marriage: 'glyph-cell mosaic from its own source code x three tiers by letter distance x recut cadence x Accession Display and Mono',
  refs: ['feed-23/frames (6sz1, Hf9W)'],
};

const SRC = readFileSync(new URL(import.meta.url), 'utf8').replace(/\s+/g, ' ');
const atlas = new Map();
function glyph(ch, cw, chh) {
  const k = `${ch}/${cw}/${chh}`;
  if (!atlas.has(k)) atlas.set(k, ch === ' ' ? null : setName(ch, cw, chh, { box: [0.06, 0.16, 0.94, 0.84], style: 'mono', weight: 500, sub: 4 }).mask);
  return atlas.get(k);
}

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H);
  const N = setName(breakLines(text, 2), W, H, { box: [0.06, 0.14, 0.94, 0.86], weight: 900, tracking: 20, leading: 1.2, sdf: true });
  const cw = Math.round(11 * u), chh = Math.round(19 * u), cols = Math.ceil(W / cw), rows = Math.ceil(H / chh);
  const hold = Math.floor(t * 20), offset = (hold * 977) % SRC.length;            // 20 recuts per loop
  const bone = lin('#ebe5d6'), mid = lin('#7d7f86'), dim = lin('#3a3c42'), ground = lin('#202226'), hot = lin('#e5ed37');
  for (let i = 0; i < W * H; i++) I.px.set(ground, i * 3);
  // one token in the hot mark: the run of non-space characters under a caret that walks the letters
  const insideCells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = Math.min(W - 1, Math.round((c + 0.5) * cw)), y = Math.min(H - 1, Math.round((r + 0.5) * chh)); if (N.sdf[y * W + x] < -0.25 * cw) insideCells.push([r, c]); }
  const [hotRow, hotCol] = insideCells[Math.floor(hash2(hold, 3, 11) * insideCells.length)] ?? [-1, -1];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = (offset + r * cols + c) % SRC.length, ch = SRC[k];
    const cx = Math.min(W - 1, Math.round((c + 0.5) * cw)), cy = Math.min(H - 1, Math.round((r + 0.5) * chh)), d = N.sdf[cy * W + cx];
    const inside = smooth(0.25 * cw, -0.25 * cw, d), edge = smooth(2.5 * cw, 0.5 * cw, Math.abs(d));
    const col = dim.map((v, q) => v + (mid[q] - v) * edge);
    const flicker = 0.82 + 0.18 * hash2(r, c, hold);
    const isHot = r === hotRow && c >= hotCol && c < hotCol + 5 && inside > 0.5;
    // inside the letters the cell inverts (the word-highlight of a terminal): a lit cell, the character cut from it
    const cell = (isHot ? hot : bone).map(v => v * (0.86 + 0.14 * flicker)), inv = isHot ? 1 : inside, m = glyph(ch, cw, chh);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      const px = c * cw + x, py = r * chh + y; if (px >= W || py >= H) continue;
      const a = m ? m[y * cw + x] : 0, i = (py * W + px) * 3;
      for (let q = 0; q < 3; q++) {
        const fg = ground[q] + (col[q] - ground[q]) * a * flicker, bg = cell[q] + (ground[q] * 1.6 - cell[q]) * a;
        I.px[i + q] = fg + (bg - fg) * inv;
      }
    }
  }
  return { image: grain(I, { amount: 1.4, seed: `code/${hold}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
