// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// codecells.mjs: tesserae that are characters of our own source code. Each tile of a course carries one glyph,
// set upright on the course, so lines of code run along the strokes of a letter the way tiles run in an andamento,
// and straight across the field in plain rows. Tone comes from the code itself: letter courses are set in a heavy
// mono weight (dense ink), the field in a light one, so the word emerges from weight and density, not from paint.
// The source is the engine that draws the piece (this library, the lettering and the glass optics), read at render
// time, so the text in the tiles is honest.
// Node only (reads files); the layout and shading stay pure.
import { readFileSync } from 'node:fs';
import { setName } from '../name.mjs';
import { ZONE } from './andamento.mjs';

const FILES = ['./andamento.mjs', './tesserae.mjs', './codecells.mjs', './index.mjs', '../name.mjs', '../strokes.mjs', '../../../glass/lib/optics.js', '../../../glass/lib/body.js'];

/** Our own source, whitespace folded, comments kept (they are part of the engine's text). */
export function engineSource(files = FILES) {
  return files.map(f => { try { return readFileSync(new URL(f, import.meta.url), 'utf8'); } catch { return ''; } }).join(' ').replace(/\s+/g, ' ').trim();
}

const atlas = new Map();

// Per tile: should its glyph turn half a revolution to read? A course that runs right to left, or down a stem,
// would show its text upside down; a setter would turn those tiles. Decided once per tile from the course direction.
export function readingFlip(W, H, layout) {
  const { key, frame } = layout, n = layout.tiles.length, tx = new Float32Array(n), ty = new Float32Array(n);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (!frame.flow[i]) continue; const k = key[i];
    if (key[i + 1] === k && key[i - 1] === k) tx[k] += frame.s[i + 1] - frame.s[i - 1];
    if (key[i + W] === k && key[i - W] === k) ty[k] += frame.s[i + W] - frame.s[i - W];
  }
  const flip = new Uint8Array(n);
  for (let k = 0; k < n; k++) { const l = Math.hypot(tx[k], ty[k]) || 1, a = tx[k] / l, b = ty[k] / l; flip[k] = a < -0.35 || (Math.abs(a) <= 0.35 && b > 0) ? 1 : 0; }
  return flip;
}
function glyph(ch, cw, chh, weight) {
  const k = `${ch}/${cw}/${chh}/${weight}`;
  if (!atlas.has(k)) atlas.set(k, ch === ' ' || cw < 2 || chh < 2 ? null : setName(ch, cw, chh, { box: [0.08, 0.14, 0.92, 0.86], style: 'mono', weight, sub: 4, close: 0 }).mask);
  return atlas.get(k);
}

/**
 * codeInk(W, H, layout, { src, cellRatio (glyph width / course width, 0.6), weights: [field, halo, letter],
 *          offset (start index into the source) })
 * -> Float32Array ink coverage per pixel (0..1). The layout must have been laid with ratio = cellRatio, so every
 *    tile is exactly one character cell.
 */
export function codeInk(W, H, layout, { src = engineSource(), cellRatio = 0.6, weights = [300, 500, 800], offset = 0 } = {}) {
  const { zone, frame, tile: T, key } = layout, ink = new Float32Array(W * H), flip = readingFlip(W, H, layout);
  const cw = Math.max(2, Math.round(T * cellRatio)), ch = Math.max(2, Math.round(T)), fT = layout.fieldTile ?? T;
  const fcw = Math.max(2, Math.round(fT * cellRatio)), fch = Math.max(2, Math.round(fT));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, z = zone[i];
    let u, v, idx, gw, gh;
    if (!frame.flow[i]) {
      // plain rows across the field, one character per tessellatum tile
      u = frame.fu[i]; v = 1 - frame.o[i]; idx = offset + (layout.tiles[key[i]].seq ?? key[i]); gw = fcw; gh = fch;   // echo tiles carry a reading order; plain rows run in scan order
    } else {
      const s = frame.s[i], c = frame.course[i], o = frame.o[i], along = Math.floor((s + (c & 1) * T * cellRatio * 0.5) / (T * cellRatio));
      u = ((s + (c & 1) * T * cellRatio * 0.5) / (T * cellRatio)) - along; v = 1 - ((o / T + 0.5) - c);   // gy grows toward +o, so the glyph is never mirrored (it may turn, as tiles do)
      idx = offset + frame.stroke[i] * 4099 + c * 613 + along; gw = cw; gh = ch;
      if (flip[key[i]]) { u = 1 - u; v = 1 - v; }
    }
    const m = glyph(src[((idx % src.length) + src.length) % src.length], gw, gh, weights[z]);
    if (!m) continue;
    const gx = Math.min(gw - 1, Math.max(0, Math.floor(u * gw))), gy = Math.min(gh - 1, Math.max(0, Math.floor((1 - v) * gh)));
    ink[i] = m[gy * gw + gx];
  }
  return ink;
}

/**
 * imageInk(W, H, layout, mask, mw, mh): every tile carries the same small picture (mask mw x mh, 0..1), fitted to
 * the tile in its own course frame, so the tiles of a letter all repeat it upright along the stroke. Used for the
 * mosaic at two scales: the name made of tiles, each tile a tiny rendering of the name.
 */
export function imageInk(W, H, layout, mask, mw, mh, { ratio = 1.25 } = {}) {
  const { frame, tile: T, key } = layout, ink = new Float32Array(W * H), flip = readingFlip(W, H, layout);
  for (let i = 0; i < W * H; i++) {
    let u, v;
    if (!frame.flow[i]) { u = frame.fu[i]; v = frame.o[i]; }
    else { const c = frame.course[i], q = (frame.s[i] + (c & 1) * T * ratio * 0.5) / (T * ratio); u = q - Math.floor(q); v = (frame.o[i] / T + 0.5) - c; if (flip[key[i]]) { u = 1 - u; v = 1 - v; } }   // gy grows toward +o: turned, never mirrored
    const gx = Math.min(mw - 1, Math.max(0, Math.floor(u * mw))), gy = Math.min(mh - 1, Math.max(0, Math.floor(v * mh)));
    ink[i] = mask[gy * mw + gx];
  }
  return ink;
}
