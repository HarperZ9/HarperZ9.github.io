// bitmosaic.js: letters made of bit distances (family W2, feed set 24). A word is set as a coverage
// mask; a grid of square tiles covers the frame; each tile's side shrinks with the number of bits in
// which its column (offset by the character code of the letter it sits in) and its row differ. So each
// letter carries its own field, keyed by its code: an 'e' and an 'E' differ by one bit (32) and still
// draw different fields, because adding 32 to a column carries into higher bits. Tile area, not hue, carries the count: one ink on
// one ground. Inside the letters the tiles are ink; outside, the same field runs on as a faint ground.
// Pure: tiles() is data, render() draws into a raster.js surface with exact box coverage.
import { popcount32 } from './hamming.js';
import { cell, hexLin } from './raster.js';

export const DEFAULTS = { pitch: 8, bits: 8, minSide: 0.12, ground: '#efe9de', ink: '#16130f', faint: 0.11, inside: 0.5 };

// spans: [{ x0, x1, code }] in mask pixels, one per character, left to right.
export function codeAt(spans, x) { for (const s of spans) if (x >= s.x0 && x < s.x1) return s.code; return 0; }

// The count for tile (i, j) under character code c: popcount((i + c) xor j), masked to `bits` bits.
export const count = (i, j, c, bits = 8) => popcount32((((i + c) ^ j) & ((1 << bits) - 1)) >>> 0);

// Side as a share of the pitch: area falls linearly with the count, from 1 at 0 bits to minSide^2 at `bits`.
export const side = (h, bits = 8, minSide = 0.12) => Math.sqrt(1 - (1 - minSide * minSide) * h / bits);

export function tiles(W, H, mask, spans, o = {}) {
  const c = { ...DEFAULTS, ...o }, p = c.pitch, out = [];
  for (let j = 0; j * p < H; j++) for (let i = 0; i * p < W; i++) {
    const cx = (i + 0.5) * p, cy = (j + 0.5) * p, mx = Math.min(W - 1, cx | 0), my = Math.min(H - 1, cy | 0);
    const inside = mask ? mask[my * W + mx] >= c.inside : false, code = inside ? codeAt(spans, cx) : 0;
    const h = count(i, j, code, c.bits), s = side(h, c.bits, c.minSide) * p * 0.92;
    out.push({ i, j, x: cx - s / 2, y: cy - s / 2, s, h, code, inside });
  }
  return out;
}

export function render(S, list, o = {}) {
  const c = { ...DEFAULTS, ...o }, ink = hexLin(c.ink);
  for (const t of list) cell(S, t.x, t.y, t.s, ink, t.inside ? 1 : c.faint, 'over');
  return S;
}

// QUALITY-SPEC S1, S2, S4, S6.
export const SPEC = Object.freeze({
  inputs: { W: 'int device px', H: 'int device px', mask: 'Float32Array W*H coverage in [0,1], or null', spans: '[{ x0, x1, code: UTF-16 code unit }] in device px' },
  params: { pitch: 'tile pitch in device px, 4 to 40 (8 to 10 CSS px, QUALITY-SPEC R7)', bits: 'bits compared, 4 to 12', minSide: 'smallest side as a share of pitch, 0 to 0.5',
    ground: 'sRGB hex', ink: 'sRGB hex', faint: 'alpha of tiles outside the letters, 0 to 0.4', inside: 'mask threshold, 0.2 to 0.8' },
  determinism: 'no randomness; integer counts; exact box coverage (bitmosaic.test.mjs)',
  budget: { tiles: '1440 x 1080 device px at pitch 16 under 40 ms (node)' },
  export: '3840 px long side PNG from the page, rendered at that size',
  cadence: 'static',
});
