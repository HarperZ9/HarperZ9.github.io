// lib/apng.js: APNG encode and decode (8-bit RGBA, non-interlaced). Lossless, so it is the export for loops
// whose gradients a 256-colour GIF would band. Each frame after the first is cropped to the box of pixels that
// changed and written with dispose NONE and blend SOURCE, which keeps it exact. Delays are stored in ms (den 1000).
import { deflate, inflate } from './zlib.js';

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const be32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const be16 = (v) => [(v >>> 8) & 255, v & 255];
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), t = [...type].map((c) => c.charCodeAt(0));
  out.set(be32(data.length), 0); out.set(t, 4); out.set(data, 8); out.set(be32(crc32(out.subarray(4, 8 + data.length))), 8 + data.length);
  return out;
}
const cat = (parts) => { const n = parts.reduce((a, p) => a + p.length, 0), o = new Uint8Array(n); let at = 0; for (const p of parts) { o.set(p, at); at += p.length; } return o; };

// Box of pixels that differ between two RGBA buffers of size w x h, or null when they are equal.
export function diffBox(a, b, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2] || a[o + 3] !== b[o + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function rows(rgba, W, box) {
  const raw = new Uint8Array((box.w * 4 + 1) * box.h);
  for (let y = 0; y < box.h; y++) { raw[y * (box.w * 4 + 1)] = 0; raw.set(rgba.subarray(((box.y + y) * W + box.x) * 4, ((box.y + y) * W + box.x + box.w) * 4), y * (box.w * 4 + 1) + 1); }
  return raw;
}

// frames: [{ data: RGBA (w*h*4), delayMs }]. loop 0 = forever.
export async function encodeAPNG(w, h, frames, { loop = 0 } = {}) {
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', new Uint8Array([...be32(w), ...be32(h), 8, 6, 0, 0, 0])), chunk('acTL', new Uint8Array([...be32(frames.length), ...be32(loop)]))];
  let seq = 0, prev = null;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i], box = i === 0 ? { x: 0, y: 0, w, h } : diffBox(prev, f.data, w, h) || { x: 0, y: 0, w: 1, h: 1 };
    const delay = Math.max(1, Math.min(65535, Math.round(f.delayMs)));
    parts.push(chunk('fcTL', new Uint8Array([...be32(seq++), ...be32(box.w), ...be32(box.h), ...be32(box.x), ...be32(box.y), ...be16(delay), ...be16(1000), 0, 0])));
    const z = await deflate(rows(f.data, w, box));
    parts.push(i === 0 ? chunk('IDAT', z) : chunk('fdAT', cat([new Uint8Array(be32(seq++)), z])));
    prev = f.data;
  }
  parts.push(chunk('IEND', new Uint8Array(0)));
  return cat(parts);
}

const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
function unfilter(raw, w, h, bpp) {
  const stride = w * bpp, px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], s = y * (stride + 1) + 1, o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0;
      px[o + x] = (raw[s + x] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0)) & 255;
    }
  }
  if (bpp === 4) return px;
  const out = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { out[i * 4] = px[i * 3]; out[i * 4 + 1] = px[i * 3 + 1]; out[i * 4 + 2] = px[i * 3 + 2]; out[i * 4 + 3] = 255; }
  return out;
}

// Decode a PNG or APNG into composited RGBA frames: { width, height, loop, frames: [{ rgba, delayMs }] }.
export async function decodeAPNG(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), u32 = (p) => dv.getUint32(p);
  let p = 8, W = 0, H = 0, bpp = 4, loop = 0, cur = null; const ctl = [], still = [];
  while (p < bytes.length) {
    const len = u32(p), type = String.fromCharCode(...bytes.subarray(p + 4, p + 8)), d = bytes.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = u32(p + 8); H = u32(p + 12); bpp = d[9] === 6 ? 4 : d[9] === 2 ? 3 : 0; if (!bpp || d[8] !== 8 || d[12]) throw new Error('apng: only 8-bit RGB or RGBA, non-interlaced'); }
    else if (type === 'acTL') loop = u32(p + 12);
    else if (type === 'fcTL') { cur = { w: u32(p + 12), h: u32(p + 16), x: u32(p + 20), y: u32(p + 24), num: dv.getUint16(p + 28), den: dv.getUint16(p + 30) || 100, dispose: d[24], blend: d[25], data: [] }; ctl.push(cur); }
    else if (type === 'IDAT') (cur || (still.push(d), null))?.data.push(d);
    else if (type === 'fdAT') cur.data.push(d.subarray(4));
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!ctl.length) ctl.push({ w: W, h: H, x: 0, y: 0, num: 0, den: 1000, dispose: 0, blend: 0, data: still });
  const canvas = new Uint8ClampedArray(W * H * 4), frames = [];
  for (const f of ctl) {
    const px = unfilter(await inflate(cat(f.data)), f.w, f.h, bpp), saved = f.dispose === 2 ? canvas.slice() : null;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const s = (y * f.w + x) * 4, o = ((f.y + y) * W + f.x + x) * 4, a = px[s + 3] / 255;
      if (f.blend === 0 || a === 1) canvas.set(px.subarray(s, s + 4), o);
      else if (a > 0) { const ba = canvas[o + 3] / 255, oa = a + ba * (1 - a); for (let k = 0; k < 3; k++) canvas[o + k] = (px[s + k] * a + canvas[o + k] * ba * (1 - a)) / oa; canvas[o + 3] = oa * 255; }
    }
    frames.push({ rgba: canvas.slice(), delayMs: (1000 * f.num) / f.den });
    if (f.dispose === 1) for (let y = 0; y < f.h; y++) canvas.fill(0, ((f.y + y) * W + f.x) * 4, ((f.y + y) * W + f.x + f.w) * 4);
    else if (saved) canvas.set(saved);
  }
  return { width: W, height: H, loop, frames };
}
