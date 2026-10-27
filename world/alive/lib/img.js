// lib/img.js: the image helpers every alive module shares. Dependency-free; node and browser.
// An image is { w, h, data: Uint8ClampedArray(w*h*4) }, the same shape as the browser's ImageData, so a canvas
// read or write needs no copy. Fields (depth, masks, luma) are { w, h, data: Float32Array(w*h) } in 0..1.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function image(w, h, fill = null) {
  const im = { w: w | 0, h: h | 0, data: new Uint8ClampedArray((w | 0) * (h | 0) * 4) };
  if (fill) for (let i = 0; i < im.w * im.h; i++) im.data.set(fill, i * 4);
  return im;
}
export const field = (w, h, v = 0) => ({ w: w | 0, h: h | 0, data: new Float32Array((w | 0) * (h | 0)).fill(v) });
export const copy = (im) => ({ w: im.w, h: im.h, data: im.data.slice() });

// Stateless integer hash to [0, 1) and a seeded generator (mulberry32).
export function hash01(seed, k = 0) {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(k | 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Smooth value noise in 2D, tileable by period p (integer lattice cells), 0..1.
export function vnoise(x, y, seed = 1, p = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const w = (i, j) => { if (p) { i = ((i % p) + p) % p; j = ((j % p) + p) % p; } return hash01(seed, i * 73856093 ^ j * 19349663); };
  return lerp(lerp(w(xi, yi), w(xi + 1, yi), ux), lerp(w(xi, yi + 1), w(xi + 1, yi + 1), ux), uy);
}

// Rec. 709 luma of encoded values, 0..1.
export function luma(im) {
  const f = field(im.w, im.h), d = im.data;
  for (let i = 0; i < im.w * im.h; i++) f.data[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  return f;
}

// Separable box blur of a field, radius r, repeated n times (n = 3 approximates a Gaussian).
export function blur(f, r, n = 3) {
  if (r < 1) return { w: f.w, h: f.h, data: f.data.slice() };
  let a = f.data.slice(), b = new Float32Array(a.length); const { w, h } = f;
  const pass = (src, dst, len, count, stride, step) => {
    for (let k = 0; k < count; k++) {
      const o = k * stride; let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[o + clampI(i, len) * step];
      for (let i = 0; i < len; i++) {
        dst[o + i * step] = acc / (2 * r + 1);
        acc += src[o + clampI(i + r + 1, len) * step] - src[o + clampI(i - r, len) * step];
      }
    }
  };
  for (let k = 0; k < n; k++) { pass(a, b, w, h, w, 1); pass(b, a, h, w, 1, w); }
  return { w, h, data: a };
}
const clampI = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i);

// Sobel gradient magnitude of a field.
export function gradient(f) {
  const { w, h } = f, g = field(w, h), d = f.data, at = (x, y) => d[clampI(y, h) * w + clampI(x, w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
    const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
    g.data[y * w + x] = Math.hypot(gx, gy) / 4;
  }
  return g;
}

// Signed distance to the boundary of a binary mask (inside > 0), in px, by two-pass chamfer (3-4) distance.
export function sdf(mask, threshold = 0.5) {
  const { w, h } = mask, inside = (i) => mask.data[i] >= threshold;
  const dist = (want) => {
    const D = new Float32Array(w * h).fill(1e9);
    for (let i = 0; i < w * h; i++) if (inside(i) !== want) D[i] = 0;
    const relax = (x, y, dx, dy, c) => { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) { const v = D[Y * w + X] + c; if (v < D[y * w + x]) D[y * w + x] = v; } };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { relax(x, y, -1, 0, 3); relax(x, y, 0, -1, 3); relax(x, y, -1, -1, 4); relax(x, y, 1, -1, 4); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { relax(x, y, 1, 0, 3); relax(x, y, 0, 1, 3); relax(x, y, 1, 1, 4); relax(x, y, -1, 1, 4); }
    return D;
  };
  const dIn = dist(true), dOut = dist(false), out = field(w, h);
  for (let i = 0; i < w * h; i++) out.data[i] = (inside(i) ? dIn[i] : -dOut[i]) / 3;
  return out;
}

// Rasterise a polygon [[x, y], ...] in normalised 0..1 coordinates into a coverage field (4x4 supersampled).
export function polyMask(w, h, poly, value = 1, into = null) {
  const f = into || field(w, h), pts = poly.map(([x, y]) => [x * w, y * h]);
  const inside = (px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
  let x0 = w, y0 = h, x1 = 0, y1 = 0; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, Math.ceil(x1)); x++) {
    let n = 0; for (let s = 0; s < 16; s++) if (inside(x + ((s & 3) + 0.5) / 4, y + ((s >> 2) + 0.5) / 4)) n++;
    if (n) f.data[y * w + x] = Math.max(f.data[y * w + x], (value * n) / 16);
  }
  return f;
}

// Bilinear sample of an RGBA image at (x, y) px, edge-clamped, into out[0..3].
export function sample(im, x, y, out) {
  const { w, h, data } = im;
  x = x < 0 ? 0 : x > w - 1 ? w - 1 : x; y = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
  const x0 = x | 0, y0 = y | 0, x1 = x0 + 1 < w ? x0 + 1 : x0, y1 = y0 + 1 < h ? y0 + 1 : y0, fx = x - x0, fy = y - y0;
  const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, d = (y1 * w + x1) * 4;
  for (let k = 0; k < 4; k++) out[k] = (data[a + k] * (1 - fx) + data[b + k] * fx) * (1 - fy) + (data[c + k] * (1 - fx) + data[d + k] * fx) * fy;
  return out;
}
export function sampleField(f, x, y) {
  const { w, h, data } = f;
  x = x < 0 ? 0 : x > w - 1 ? w - 1 : x; y = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
  const x0 = x | 0, y0 = y | 0, x1 = x0 + 1 < w ? x0 + 1 : x0, y1 = y0 + 1 < h ? y0 + 1 : y0, fx = x - x0, fy = y - y0;
  return (data[y0 * w + x0] * (1 - fx) + data[y0 * w + x1] * fx) * (1 - fy) + (data[y1 * w + x0] * (1 - fx) + data[y1 * w + x1] * fx) * fy;
}

// Area-average resize of an RGBA image (downscale) or bilinear (upscale).
export function resize(im, w, h) {
  const out = image(w, h), sx = im.w / w, sy = im.h / h, px = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (sx <= 1 && sy <= 1) { sample(im, (x + 0.5) * sx - 0.5, (y + 0.5) * sy - 0.5, px); for (let k = 0; k < 4; k++) out.data[o + k] = px[k]; continue; }
    const xa = Math.floor(x * sx), xb = Math.max(xa + 1, Math.floor((x + 1) * sx)), ya = Math.floor(y * sy), yb = Math.max(ya + 1, Math.floor((y + 1) * sy));
    const acc = [0, 0, 0, 0]; let n = 0;
    for (let j = ya; j < yb; j++) for (let i = xa; i < xb; i++) { const s = (j * im.w + i) * 4; for (let k = 0; k < 4; k++) acc[k] += im.data[s + k]; n++; }
    for (let k = 0; k < 4; k++) out.data[o + k] = acc[k] / n;
  }
  return out;
}

// Mean absolute difference of two equal-size RGBA images in 0..255 units (RGB only).
export function mad(a, b) {
  let s = 0; for (let i = 0; i < a.w * a.h; i++) for (let k = 0; k < 3; k++) s += Math.abs(a.data[i * 4 + k] - b.data[i * 4 + k]);
  return s / (a.w * a.h * 3);
}

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Guided filter (He, Sun and Tang 2010): smooths p while its edges follow the guide I. r px, eps on 0..1 values.
export function guided(p, I, r = 6, eps = 1e-3) {
  const n = p.data.length, mul = (a, b) => { const o = field(a.w, a.h); for (let i = 0; i < n; i++) o.data[i] = a.data[i] * b.data[i]; return o; };
  const bx = (f) => blur(f, r, 1), mI = bx(I), mp = bx(p), cIp = bx(mul(I, p)), vI = bx(mul(I, I)), a = field(p.w, p.h), b = field(p.w, p.h);
  for (let i = 0; i < n; i++) { const cov = cIp.data[i] - mI.data[i] * mp.data[i], va = vI.data[i] - mI.data[i] * mI.data[i]; a.data[i] = cov / (va + eps); b.data[i] = mp.data[i] - a.data[i] * mI.data[i]; }
  const ma = bx(a), mb = bx(b), q = field(p.w, p.h);
  for (let i = 0; i < n; i++) q.data[i] = ma.data[i] * I.data[i] + mb.data[i];
  return q;
}
