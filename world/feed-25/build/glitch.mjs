// glitch.mjs: spatial operators. Pixelation, our own block-carry mosh, row streaks, a scanline wave,
// block corruption, displacement by another layer, and Hydra-style line layers. Each replaces L.px.
import { colour, sampler, bilinear } from './px.mjs';

const clampi = (v, a, b) => (v < a ? a : v > b ? b : v);

function blockMean(p, w, h, x0, y0, bw, bh, out) {
  out[0] = out[1] = out[2] = 0; let n = 0;
  for (let y = y0; y < Math.min(h, y0 + bh); y++) for (let x = x0; x < Math.min(w, x0 + bw); x++) { const k = 3 * (y * w + x); out[0] += p[k]; out[1] += p[k + 1]; out[2] += p[k + 2]; n++; }
  if (n) { out[0] /= n; out[1] /= n; out[2] /= n; }
  return n;
}
function fillBlock(p, w, h, x0, y0, bw, bh, c) {
  for (let y = y0; y < Math.min(h, y0 + bh); y++) for (let x = x0; x < Math.min(w, x0 + bw); x++) { const k = 3 * (y * w + x); p[k] = c[0]; p[k + 1] = c[1]; p[k + 2] = c[2]; }
}

// Average over size x sy blocks (block means in linear light, so a block keeps its true brightness).
export function pixelate(L, { size = 8, sy = size } = {}) {
  size = Math.max(1, Math.round(size)); sy = Math.max(1, Math.round(sy)); const c = [0, 0, 0];
  for (let y = 0; y < L.h; y += sy) for (let x = 0; x < L.w; x += size) { blockMean(L.px, L.w, L.h, x, y, size, sy, c); fillBlock(L.px, L.w, L.h, x, y, size, sy, c); }
}

// Block size per region from a field: cells of `max` px; a cell whose field mean is high gets small
// blocks (down to `min`), in powers of two. Gives the many-sizes blocks that feedback builds in image 37.
export function modulatePixelate(L, { by, min = 4, max = 64 } = {}) {
  const f = sampler(by, L.w, L.h), steps = Math.max(0, Math.round(Math.log2(max / min))), c = [0, 0, 0];
  for (let y0 = 0; y0 < L.h; y0 += max) for (let x0 = 0; x0 < L.w; x0 += max) {
    const v = f(Math.min(L.w - 1, x0 + max / 2), Math.min(L.h - 1, y0 + max / 2)), s = Math.max(1, Math.round(max / 2 ** Math.round(clampi(v, 0, 1) * steps)));
    for (let y = y0; y < Math.min(L.h, y0 + max); y += s) for (let x = x0; x < Math.min(L.w, x0 + max); x += s) {
      const bw = Math.min(s, x0 + max - x), bh = Math.min(s, y0 + max - y);
      blockMean(L.px, L.w, L.h, x, y, bw, bh, c); fillBlock(L.px, L.w, L.h, x, y, bw, bh, c);
    }
  }
}

// Block-carry mosh. A motion vector per block runs along the layer's own edges (the luma gradient turned
// a quarter turn) plus a drift; each step, a block takes, with probability `carry`, the pixels its vector
// points back to. Hard block edges, smeared content. With `from`, the carried texture is another
// layer's, moved along this layer's structure: one picture wearing another's motion.
export function mosh(L, { block = 16, steps = 6, carry = 0.7, strength = 1.5, drift = [0, 0], from = null } = {}) {
  const { w, h } = L, r = L.rand(), bw = Math.ceil(w / block), bh = Math.ceil(h / block), M = new Float32Array(bw * bh), c = [0, 0, 0];
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { blockMean(L.px, w, h, i * block, j * block, block, block, c); M[j * bw + i] = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  const at = (i, j) => M[clampi(j, 0, bh - 1) * bw + clampi(i, 0, bw - 1)];
  const vx = new Float32Array(bw * bh), vy = new Float32Array(bw * bh);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const gx = at(i + 1, j) - at(i - 1, j), gy = at(i, j + 1) - at(i, j - 1), g = Math.hypot(gx, gy) || 1;
    vx[j * bw + i] = (gy / g) * strength * block + drift[0] * block; vy[j * bw + i] = (-gx / g) * strength * block + drift[1] * block;
  }
  let cur;
  if (from && (from.w !== w || from.h !== h)) { cur = new Float32Array(w * h * 3); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { bilinear(from.px, from.w, from.h, (x * from.w) / w, (y * from.h) / h, c); cur.set(c, 3 * (y * w + x)); } }
  else cur = (from ? from.px : L.px).slice();
  for (let s = 0; s < steps; s++) {
    const nxt = cur.slice();
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      if (r() >= carry) continue;
      const ox = Math.round(vx[j * bw + i] * (0.5 + r())), oy = Math.round(vy[j * bw + i] * (0.5 + r()));
      for (let y = j * block; y < Math.min(h, (j + 1) * block); y++) for (let x = i * block; x < Math.min(w, (i + 1) * block); x++) {
        const sx = clampi(x - ox, 0, w - 1), sy = clampi(y - oy, 0, h - 1), d = 3 * (y * w + x), k = 3 * (sy * w + sx);
        nxt[d] = cur[k]; nxt[d + 1] = cur[k + 1]; nxt[d + 2] = cur[k + 2];
      }
    }
    cur = nxt;
  }
  L.px = cur; L.meta.mosh = { block, steps, carry, strength };
}

// Row streaks: short runs, `rows` tall, dragged from figure pixels (luma away from the median) in `dir`,
// fading by `decay` per px of length. Chips: small flat rectangles in palette colours among them.
export function streak(L, { count = 600, rows = [1, 4], len = [0.01, 0.08], dir = -1, fade = 0.35, figure = 0.12, chips = 0, palette = ['#2fb3a8', '#e8902a', '#7b49c8'] } = {}) {
  const { w, h } = L, r = L.rand(), p = L.px, Y = L.lumaField(), sorted = Float32Array.from(Y).sort(), med = sorted[sorted.length >> 1];
  const src = p.slice(), P = palette.map(colour);
  for (let n = 0; n < count; n++) {
    let x = 0, y = 0, ok = false;
    for (let t = 0; t < 40 && !ok; t++) { x = (r() * w) | 0; y = (r() * h) | 0; ok = Math.abs(Y[y * w + x] - med) > figure; }
    if (!ok) continue;
    const th = rows[0] + ((r() * (rows[1] - rows[0] + 1)) | 0), ln = Math.round((len[0] + r() * (len[1] - len[0])) * w), k = 3 * (y * w + x);
    for (let j = 0; j < th; j++) for (let i = 0; i < ln; i++) {
      const X = x + dir * i, YY = y + j; if (X < 0 || X >= w || YY >= h) break;
      const a = 1 - (1 - fade) * (i / ln), d = 3 * (YY * w + X);
      for (let c = 0; c < 3; c++) p[d + c] += (src[k + c] - p[d + c]) * a;
    }
  }
  for (let n = 0; n < chips; n++) {
    const x = (r() * w) | 0, y = (r() * h) | 0, cw = Math.round((0.004 + r() * 0.02) * w), ch = 1 + ((r() * 3) | 0);
    if (Math.abs(Y[y * w + x] - med) > figure) fillBlock(p, w, h, x, y, cw, ch, P[(r() * P.length) | 0]);
  }
}

// Scanline wave: rows sampled from y + amp * sin(2 pi x / wavelength + phase + y * twist), in bands of
// `band` rows; odd bands dim by `dim`, and `swap` rotates channels (the blue shift of image 32).
export function scanwave(L, { wavelength = 80, amp = 6, band = 8, phase = 0, twist = 0.02, dim = 0.75, swap = false, region = null } = {}) {
  const { w, h } = L, src = L.px.slice(), p = L.px, c = [0, 0, 0];
  const R = region ? { x: Math.round(region.x * w), y: Math.round(region.y * h), w: Math.round(region.w * w), h: Math.round(region.h * h) } : { x: 0, y: 0, w, h };
  for (let y = R.y; y < Math.min(h, R.y + R.h); y++) {
    const odd = Math.floor((y - R.y) / band) % 2 === 1;
    for (let x = R.x; x < Math.min(w, R.x + R.w); x++) {
      bilinear(src, w, h, x, y + amp * Math.sin((2 * Math.PI * x) / wavelength + phase + y * twist), c);
      const d = 3 * (y * w + x), m = odd ? dim : 1;
      if (swap && odd) { p[d] = c[2] * m; p[d + 1] = c[0] * m; p[d + 2] = c[1] * m; } else { p[d] = c[0] * m; p[d + 1] = c[1] * m; p[d + 2] = c[2] * m; }
    }
  }
}

// Block corruption: rectangles copied from elsewhere (probability `copy`) or filled with a palette colour.
export function blocks(L, { count = 80, bw = [0.004, 0.03], bh = [0.002, 0.012], copy = 0.6, palette = ['#7a2c8c', '#1f8f86', '#000000'] } = {}) {
  const { w, h } = L, r = L.rand(), p = L.px, P = palette.map(colour);
  for (let n = 0; n < count; n++) {
    const W = Math.max(1, Math.round((bw[0] + r() * (bw[1] - bw[0])) * w)), H = Math.max(1, Math.round((bh[0] + r() * (bh[1] - bh[0])) * w));
    const x = (r() * (w - W)) | 0, y = (r() * (h - H)) | 0;
    if (r() < copy) {
      const sx = (r() * (w - W)) | 0, sy = (r() * (h - H)) | 0;
      for (let j = 0; j < H; j++) p.copyWithin(3 * ((y + j) * w + x), 3 * ((sy + j) * w + sx), 3 * ((sy + j) * w + sx + W));
    } else fillBlock(p, w, h, x, y, W, H, P[(r() * P.length) | 0]);
  }
}

// Displace by another layer: x += (R - 0.5) * amount * w, y += (G - 0.5) * amount * h, R and G read encoded.
export function modulate(L, { by, amount = 0.05 } = {}) {
  const { w, h } = L, src = L.px.slice(), c = [0, 0, 0], q = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    bilinear(by.px, by.w, by.h, (x * by.w) / w, (y * by.h) / h, q);
    bilinear(src, w, h, x + (Math.sqrt(q[0]) - 0.5) * amount * w, y + (Math.sqrt(q[1]) - 0.5) * amount * h, c);
    L.px.set(c, 3 * (y * w + x));
  }
}

// Scale about (cx, cy) by 1 + amount * luma(by): bright regions of `by` zoom in.
export function modulateScale(L, { by, amount = 0.5, cx = 0.5, cy = 0.5 } = {}) {
  const { w, h } = L, src = L.px.slice(), f = sampler(by, w, h), c = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = 1 + amount * f(x, y);
    bilinear(src, w, h, cx * w + (x - cx * w) / s, cy * h + (y - cy * h) / s, c); L.px.set(c, 3 * (y * w + x));
  }
}

// Hydra-style line layers: `count` full-length hairlines at seeded positions, added in `ink`.
export function lines(L, { count = 7, width = 1, ink = '#ffffff', alpha = 0.6, dir = 'both' } = {}) {
  const { w, h } = L, r = L.rand(), I = colour(ink), p = L.px;
  for (let n = 0; n < count; n++) {
    const vert = dir === 'v' || (dir === 'both' && r() < 0.5), pos = Math.round(r() * ((vert ? w : h) - width));
    for (let t = 0; t < (vert ? h : w); t++) for (let k = 0; k < width; k++) {
      const d = 3 * (vert ? t * w + pos + k : (pos + k) * w + t);
      for (let c = 0; c < 3; c++) p[d + c] += (I[c] - p[d + c]) * alpha;
    }
  }
}

export const GLITCH = { pixelate, modulatePixelate, mosh, streak, scanwave, blocks, modulate, modulateScale, lines };
