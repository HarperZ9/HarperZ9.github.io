// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// textfield.mjs: a plane of tiny, dense text, the tile of a code mosaic. After Olivetti's Divisumma 26 sheet (study
// st-rronberishagrit-2114372645416280441): a shape filled with the string "1234567890" at a line pitch of about 1%
// of the sheet, with deliberate misprints ("13345" for "12345") that prove the field is text, not texture.
//   textField(W, H, { text, pitch px, aspect (cell w / h), weight, angle rad, glitch 0..1, seed }) -> Float32Array coverage
// Rows run along `angle`; every cell holds one glyph of `text`, read in order and wrapping, so a face of a solid can
// carry a whole file of source. Pure apart from the glyph atlas, which is cached per (char, cell, weight).
import { setName } from '../name.mjs';

const atlas = new Map();
function glyph(ch, cw, chh, weight) {
  const k = `${ch}/${cw}/${chh}/${weight}`;
  if (!atlas.has(k)) atlas.set(k, ch === ' ' || cw < 2 || chh < 3 ? null : setName(ch, cw, chh, { box: [0.06, 0.1, 0.94, 0.9], style: 'mono', weight, sub: 4, close: 0 }).mask);
  return atlas.get(k);
}
function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export function textField(W, H, { text = '1234567890', pitch = 12, aspect = 0.62, weight = 600, angle = 0, glitch = 0.02, seed = 1, mask = null } = {}) {
  const ch = Math.max(4, Math.round(pitch)), cw = Math.max(3, Math.round(pitch * aspect)), out = new Float32Array(W * H);
  const ca = Math.cos(angle), sa = Math.sin(angle), src = text.length ? text : ' ';
  // the field's own grid, rotated: (u along the row, v across rows)
  const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca]);
  const u0 = Math.min(...corners.map(c => c[0])), v0 = Math.min(...corners.map(c => c[1]));
  const rowsLen = Math.ceil((Math.max(...corners.map(c => c[0])) - u0) / cw) + 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (mask && mask[i] <= 0) continue;
    const u = x * ca + y * sa - u0, v = -x * sa + y * ca - v0, col = Math.floor(u / cw), row = Math.floor(v / ch);
    let c = src[(row * rowsLen + col + seed * 7) % src.length];
    // misprints: a digit repeated where the next was due, the Divisumma fault, at the given rate
    if (glitch > 0 && hash(row * 131 + seed, col) < glitch) c = src[(row * rowsLen + col + seed * 7 - 1 + src.length) % src.length];
    const G = glyph(c, cw, ch, weight); if (!G) continue;
    const gx = Math.min(cw - 1, Math.floor(u - col * cw)), gy = Math.min(ch - 1, Math.floor(v - row * ch));
    out[i] = G[gy * cw + gx] * (mask ? Math.min(1, mask[i]) : 1);
  }
  return out;
}
