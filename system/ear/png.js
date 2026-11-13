// png.js: write a PNG from RGB pixels with no dependency. The image data goes into zlib "stored" blocks (no compression),
// which every PNG reader accepts; pass a deflate function (for example node:zlib's deflateSync) to get a smaller file.
// Also a small canvas: pixels, lines, rectangles and a 3x5 pixel font for axis labels.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function adler32(bytes) { let a = 1, b = 0; for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }

function stored(raw) {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535)), out = new Uint8Array(2 + raw.length + blocks * 5 + 4); let o = 0;
  out[o++] = 0x78; out[o++] = 0x01;
  for (let b = 0; b < blocks; b++) { const start = b * 65535, len = Math.min(65535, raw.length - start); out[o++] = b === blocks - 1 ? 1 : 0; out[o++] = len & 255; out[o++] = len >> 8; out[o++] = ~len & 255; out[o++] = (~len >> 8) & 255; out.set(raw.subarray(start, start + len), o); o += len; }
  const ad = adler32(raw); out[o++] = ad >>> 24; out[o++] = (ad >>> 16) & 255; out[o++] = (ad >>> 8) & 255; out[o++] = ad & 255;
  return out;
}
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer); v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i); out.set(data, 8); v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out;
}

// rgb: Uint8Array of width * height * 3. Returns the PNG file as a Uint8Array.
export function encodePng(width, height, rgb, { deflate = null } = {}) {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  const head = new Uint8Array(13), hv = new DataView(head.buffer); hv.setUint32(0, width); hv.setUint32(4, height); head[8] = 8; head[9] = 2;
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflate ? new Uint8Array(deflate(raw)) : stored(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

// 3x5 glyphs, one row per three bits, top row first.
const G = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101011001', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', '-': '000000111000000', '.': '000000000000010', '#': '101111101111101', ':': '000010000010000', '/': '001001010100100', ' ': '000000000000000' };

export class Canvas {
  constructor(width, height, bg = [14, 16, 22]) { this.w = width; this.h = height; this.rgb = new Uint8Array(width * height * 3); for (let i = 0; i < width * height; i++) this.rgb.set(bg, i * 3); }
  px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const o = (y * this.w + x) * 3; this.rgb[o] = c[0]; this.rgb[o + 1] = c[1]; this.rgb[o + 2] = c[2]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  line(x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) this.px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); }
  text(x, y, str, c = [200, 205, 215], scale = 2) { for (const ch of String(str).toUpperCase()) { const g = G[ch] || G[' ']; for (let k = 0; k < 15; k++) if (g[k] === '1') this.rect(x + (k % 3) * scale, y + Math.floor(k / 3) * scale, scale, scale, c); x += 4 * scale; } return x; }
  png(opts) { return encodePng(this.w, this.h, this.rgb, opts); }
}

// A dark-to-bright colour ramp (black, deep blue, magenta, orange, pale yellow) for values 0 to 1.
const STOPS = [[0, 0, 4], [40, 11, 84], [120, 28, 109], [188, 55, 84], [237, 105, 37], [251, 180, 26], [252, 255, 164]];
export function ramp(v) { const u = Math.min(1, Math.max(0, v)) * (STOPS.length - 1), i = Math.min(STOPS.length - 2, Math.floor(u)), f = u - i; return STOPS[i].map((a, k) => Math.round(a + (STOPS[i + 1][k] - a) * f)); }
