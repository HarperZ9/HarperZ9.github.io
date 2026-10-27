// gif.js: our own GIF89a encoder, the vendored Daylight decoder, and APNG both ways, for exporting loops.
//   palette  median cut over pixels sampled from every frame (one global table), or one table per frame;
//   dither   'none', 'fs' (Floyd-Steinberg, serpentine) or 'bayer' (8x8 ordered, scaled to the palette spacing);
//   timing   delays in ms are carried as an exact running sum and rounded to centiseconds at each frame edge, so
//            a 41.7 ms (24 fps) loop keeps its total length; nothing goes under 20 ms, because browsers stretch
//            delays of 10 ms or less to 100 ms;
//   size     each frame after the first is cropped to the box of changed palette indices, and unchanged pixels
//            inside it are written as the transparent index, so a held frame costs a few bytes.
// GIF is for reach (every surface plays it); APNG is for fidelity (lossless, full alpha).
import { decodeGif } from './vendor/daylight-gif/media-gif.js';
import { encodeAPNG, decodeAPNG } from './lib/apng.js';

export { decodeGif, encodeAPNG, decodeAPNG };

export const SPEC = Object.freeze({
  params: {
    colors: { range: [2, 255], unit: 'palette entries (one more is kept for transparency)', default: 255 },
    dither: { options: ['none', 'fs', 'bayer'], default: 'fs' },
    strength: { range: [0, 1], unit: 'dither strength', default: 0.8 },
    loop: { range: [0, 65535], unit: 'plays, 0 = forever', default: 0 },
  },
  determinism: 'output bytes are a pure function of the frames and params',
});

// Median cut. pixels: Uint8 RGBA arrays; returns [[r,g,b], ...] with at most n entries.
export function medianCut(pixelArrays, n = 255, maxSamples = 1 << 16) {
  const total = pixelArrays.reduce((a, p) => a + p.length / 4, 0), stride = Math.max(1, Math.floor(total / maxSamples)), pts = [];
  let k = 0; for (const p of pixelArrays) for (let i = 0; i < p.length / 4; i++, k++) if (k % stride === 0) pts.push([p[i * 4], p[i * 4 + 1], p[i * 4 + 2]]);
  const uniq = new Map(); for (const q of pts) uniq.set((q[0] << 16) | (q[1] << 8) | q[2], q);
  if (uniq.size <= n) return [...uniq.values()];
  let boxes = [pts];
  const range = (b) => { const lo = [255, 255, 255], hi = [0, 0, 0]; for (const q of b) for (let c = 0; c < 3; c++) { if (q[c] < lo[c]) lo[c] = q[c]; if (q[c] > hi[c]) hi[c] = q[c]; } return hi.map((v, c) => v - lo[c]); };
  while (boxes.length < n) {
    let bi = -1, bs = -1, bc = 0;
    boxes.forEach((b, i) => { if (b.length < 2) return; const r = range(b), c = r.indexOf(Math.max(...r)), score = r[c] * Math.sqrt(b.length); if (score > bs) { bs = score; bi = i; bc = c; } });
    if (bi < 0 || bs <= 0) break;
    const b = boxes[bi].sort((x, y) => x[bc] - y[bc]), m = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.map((b) => [0, 1, 2].map((c) => Math.round(b.reduce((a, q) => a + q[c], 0) / b.length)));
}

function nearest(pal) {
  const cache = new Map();
  return (r, g, b) => {
    r = r < 0 ? 0 : r > 255 ? 255 : r | 0; g = g < 0 ? 0 : g > 255 ? 255 : g | 0; b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    const key = (r << 16) | (g << 8) | b; let k = cache.get(key);
    if (k === undefined) { let bd = Infinity; for (let i = 0; i < pal.length; i++) { const d = 2 * (pal[i][0] - r) ** 2 + 4 * (pal[i][1] - g) ** 2 + 3 * (pal[i][2] - b) ** 2; if (d < bd) { bd = d; k = i; } } if (cache.size < 1 << 18) cache.set(key, k); }
    return k;
  };
}

const BAYER = (() => { const m = [[0]]; let M = m; for (let s = 1; s < 8; s *= 2) { const N = []; for (let y = 0; y < 2 * s; y++) { N.push([]); for (let x = 0; x < 2 * s; x++) N[y].push(4 * M[y % s][x % s] + [[0, 2], [3, 1]][(y / s) | 0][(x / s) | 0]); } M = N; } return M.map((r) => r.map((v) => (v + 0.5) / 64 - 0.5)); })();

// RGBA to palette indices with the chosen dither.
export function indexFrame(rgba, w, h, pal, { dither = 'fs', strength = 0.8 } = {}) {
  const idx = new Uint8Array(w * h), near = nearest(pal);
  if (dither === 'fs') {
    const err = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      const rev = y & 1;
      for (let xx = 0; xx < w; xx++) {
        const x = rev ? w - 1 - xx : xx, i = y * w + x, c = [0, 1, 2].map((k) => rgba[i * 4 + k] + err[i * 3 + k]), q = near(c[0], c[1], c[2]); idx[i] = q;
        const e = c.map((v, k) => (v - pal[q][k]) * strength), dir = rev ? -1 : 1;
        const push = (dx, dy, f) => { const X = x + dx * dir, Y = y + dy; if (X < 0 || X >= w || Y >= h) return; const j = (Y * w + X) * 3; for (let k = 0; k < 3; k++) err[j + k] += e[k] * f; };
        push(1, 0, 7 / 16); push(-1, 1, 3 / 16); push(0, 1, 5 / 16); push(1, 1, 1 / 16);
      }
    }
  } else {
    // ordered dither amplitude: the palette's own mean nearest-neighbour spacing, per channel
    let nn = 0; if (dither === 'bayer') { for (const a of pal) { let m = Infinity; for (const b of pal) if (a !== b) m = Math.min(m, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); nn += Number.isFinite(m) ? m : 0; } nn /= pal.length * Math.sqrt(3); }
    const amp = dither === 'bayer' ? strength * nn : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, d = amp * BAYER[y & 7][x & 7]; idx[i] = near(rgba[i * 4] + d, rgba[i * 4 + 1] + d, rgba[i * 4 + 2] + d); }
  }
  return idx;
}

// GIF LZW for a stream of indices with minimum code size m.
export function lzwEncode(indices, m) {
  const out = [], clear = 1 << m, eoi = clear + 1; let size = m + 1, next = eoi + 1, acc = 0, bits = 0, dict = new Map();
  const emit = (code) => { acc |= code << bits; bits += size; while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; } };
  emit(clear);
  let w = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (w << 8) | k, hit = dict.get(key);
    if (hit !== undefined) { w = hit; continue; }
    emit(w);
    if (next < 4096) { dict.set(key, next++); if (next > 1 << size && size < 12) size++; }
    else { emit(clear); dict = new Map(); size = m + 1; next = eoi + 1; }
    w = k;
  }
  emit(w); emit(eoi); if (bits > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}

// Centisecond delays whose running sum tracks the exact running sum of ms, each at least 2 cs.
export function delaysCs(ms) { const out = []; let cum = 0, prev = 0; for (const d of ms) { cum += Math.max(20, d); const e = Math.round(cum / 10); out.push(Math.max(2, e - prev)); prev += out[out.length - 1]; } return out; }

// frames: [{ data: RGBA, delayMs }] all w x h. Returns GIF bytes.
export function encodeGIF(w, h, frames, { colors = 255, dither = 'fs', strength = 0.8, loop = 0, palette = 'global' } = {}) {
  const bytes = [], u16 = (v) => bytes.push(v & 255, (v >> 8) & 255), str = (s) => { for (const c of s) bytes.push(c.charCodeAt(0)); };
  const glob = palette === 'global' ? medianCut(frames.map((f) => f.data), Math.min(255, colors)) : null;
  const tableBits = (n) => Math.max(1, Math.ceil(Math.log2(Math.max(2, n + 1))));
  const writeTable = (pal, b) => { for (let i = 0; i < 1 << b; i++) { const c = pal[i] || [0, 0, 0]; bytes.push(c[0], c[1], c[2]); } };
  str('GIF89a'); u16(w); u16(h);
  const gb = glob ? tableBits(glob.length) : 0; bytes.push(glob ? 0x80 | ((gb - 1) << 4) | (gb - 1) : 0, 0, 0); if (glob) writeTable(glob, gb);
  if (frames.length > 1) { bytes.push(0x21, 0xff, 11); str('NETSCAPE2.0'); bytes.push(3, 1); u16(loop); bytes.push(0); }
  const cs = delaysCs(frames.map((f) => f.delayMs ?? 100));
  let prevIdx = null, prevPal = null;
  frames.forEach((f, n) => {
    const pal = glob || medianCut([f.data], Math.min(255, colors)), T = pal.length, idx = indexFrame(f.data, w, h, pal, { dither, strength });
    let box = { x: 0, y: 0, w, h };
    if (prevIdx && pal === prevPal) box = idxBox(prevIdx, idx, w, h) || { x: 0, y: 0, w: 1, h: 1 };
    const sub = new Uint8Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) { const i = (box.y + y) * w + box.x + x; sub[y * box.w + x] = prevIdx && pal === prevPal && prevIdx[i] === idx[i] ? T : idx[i]; }
    bytes.push(0x21, 0xf9, 4, (1 << 2) | 1); u16(cs[n]); bytes.push(T, 0);
    bytes.push(0x2c); u16(box.x); u16(box.y); u16(box.w); u16(box.h);
    const lb = tableBits(T); bytes.push(glob ? 0 : 0x80 | (lb - 1)); if (!glob) writeTable(pal, lb);
    const m = Math.max(2, glob ? gb : lb), data = lzwEncode(sub, m); bytes.push(m);
    for (let i = 0; i < data.length; i += 255) { const c = data.subarray(i, i + 255); bytes.push(c.length, ...c); }
    bytes.push(0);
    prevIdx = idx; prevPal = pal;
  });
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}
function idxBox(a, b, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x] !== b[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Export a loop (frames of { w, h, data } images at one fps) as GIF or APNG bytes.
export async function exportLoop(images, fps, { format = 'gif', ...opts } = {}) {
  const { w, h } = images[0], frames = images.map((im) => ({ data: im.data, delayMs: 1000 / fps }));
  return format === 'apng' ? encodeAPNG(w, h, frames, opts) : encodeGIF(w, h, frames, opts);
}
