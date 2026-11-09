// hamming.js: the Hamming-distance field, exact. A material, not a piece: bitmosaic.js builds letters
// from it, and the exact reproduction of the reference lives only in fixtures/pickover.js for tests. Pixel (x, y) takes the number of bits in which
// the binary forms of its two coordinates differ: h = popcount(X xor Y), then h mod m picks one of
// m colours. Everything here is integer arithmetic, so the field is exact at any size.
// Feed set 24, item 1.9. Pure; runs in node and the browser.

export function popcount32(v) {
  v = v >>> 0;
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
}

export const hamming = (a, b) => popcount32((a ^ b) >>> 0);

const OPS = { xor: (a, b) => a ^ b, and: (a, b) => a & b, or: (a, b) => a | b };

// Window over coordinate space. Pixel (i, j) reads X = x0 + sx * i, Y = y0 + sy * j (sx, sy = +1 or -1),
// so a negative step mirrors the window.
export function field({ w, h, x0 = 0, y0 = 0, sx = 1, sy = 1, mod = 16, op = 'xor', scale = 1 } = {}) {
  if (!(w > 0 && h > 0)) throw new Error(`hamming.field: bad size ${w}x${h}`);
  const f = OPS[op]; if (!f) throw new Error(`hamming.field: unknown op "${op}"`);
  const out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const Y = (y0 + sy * Math.floor(j / scale)) >>> 0;
    for (let i = 0; i < w; i++) out[j * w + i] = popcount32(f((x0 + sx * Math.floor(i / scale)) >>> 0, Y) >>> 0) % mod;
  }
  return out;
}

// Our own ramp: ink on a calm ground, value carried by lightness only (a sequential key you can read back).
export function inkRamp(n = 11, ground = [244, 241, 234], ink = [17, 19, 24]) {
  return Array.from({ length: n }, (_, k) => { const t = n > 1 ? k / (n - 1) : 0; return ground.map((g, c) => Math.round(g + (ink[c] - g) * t)); });
}

export function toRGBA(vals, palette) {
  const out = new Uint8ClampedArray(vals.length * 4);
  for (let i = 0; i < vals.length; i++) {
    const c = palette[vals[i] % palette.length];
    out[4 * i] = c[0]; out[4 * i + 1] = c[1]; out[4 * i + 2] = c[2]; out[4 * i + 3] = 255;
  }
  return out;
}

// Language as bits: the distance matrix between the characters of two strings (UTF-16 code units).
// Rows are the letters of a, columns the letters of b. Words that share bit patterns read as pale cells.
export function wordMatrix(a, b) {
  const m = []; for (const ca of a) m.push([...b].map(cb => hamming(ca.charCodeAt(0), cb.charCodeAt(0))));
  return m;
}

// Count of each value over the full 2^k by 2^k block: C(k, h) * 2^k (each X pairs with every Y).
export function blockHistogram(k) {
  const out = []; let c = 1;
  for (let h = 0; h <= k; h++) { out.push(c * 2 ** k); c = c * (k - h) / (h + 1); }
  return out;
}

// QUALITY-SPEC S1, S2, S4, S6.
export const SPEC = Object.freeze({
  inputs: { w: 'int px, 1 to 8192', h: 'int px, 1 to 8192' },
  params: { x0: 'int, 0 to 2^31', y0: 'int, 0 to 2^31', sx: '+1 | -1', sy: '+1 | -1', scale: 'device px per coordinate, 1 to 64', mod: 'colours, 1 to 64', op: "'xor' | 'and' | 'or'" },
  determinism: 'pure integer arithmetic; every pixel is checked against its palette entry (hamming.test.mjs)',
  budget: { field: '1440 x 1080, about 10 ms (node; test bound 150 ms)' },
  export: 'none of its own; bitmosaic.js exports',
  cadence: 'static',
});
