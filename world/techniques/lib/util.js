// lib/util.js: small shared helpers for the technique modules. No dependencies, no DOM at import time.
// Everything here is pure except loadImage and toLuma, which need a browser.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// mulberry32: a small seeded generator, so every plate renders the same way twice.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash to [0,1), used by the value noise.
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm(x, y, seed = 0, octaves = 5, gain = 0.5) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x, y, seed + i * 17);
    norm += amp; x = x * 2.03 + 11.7; y = y * 2.03 + 5.3; amp *= gain;
  }
  return sum / norm;
}

// Box blur of a Float32Array field, separable, radius r, in place via a scratch buffer.
export function boxBlur(src, w, h, r) {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w;
    for (let i = -r; i <= r; i++) acc += src[row + clamp(i, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / k;
      acc += src[row + Math.min(x + r + 1, w - 1)] - src[row + Math.max(x - r, 0)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[clamp(i, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k;
      acc += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x];
    }
  }
  return out;
}

// Sobel gradient of a luma field. Returns { gx, gy }.
export function sobel(l, w, h) {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  const at = (x, y) => l[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1), d = at(x - 1, y), f = at(x + 1, y);
    const g = at(x - 1, y + 1), hh = at(x, y + 1), i = at(x + 1, y + 1);
    gx[y * w + x] = (c + 2 * f + i - a - 2 * d - g) / 8;
    gy[y * w + x] = (g + 2 * hh + i - a - 2 * b - c) / 8;
  }
  return { gx, gy };
}

// Bilinear sample of a scalar field.
export function sample(f, w, h, x, y) {
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001);
  const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * w + xi;
  return lerp(lerp(f[i], f[i + 1], fx), lerp(f[i + w], f[i + w + 1], fx), fy);
}

// Browser helpers.
export const loadImage = src => new Promise((res, rej) => {
  const im = new Image(); im.decoding = 'async';
  im.onload = () => res(im); im.onerror = () => rej(new Error('image failed to load: ' + src)); im.src = src;
});

// grainDither(ctx, w, h, opts): bake film grain and TPDF dither into an sRGB 2D canvas, once per size.
// sd: grain SD in code values (0 to 6; the primary references measure 0.3 to 0.9 after compression);
// clump: grain size in px (noise drawn at 1/clump resolution and smoothed up; 2 gives the measured 2 to 3 px
// correlation); dither: TPDF amplitude in code values (1 removes banding on 8-bit ramps). Deterministic per seed.
export function grainDither(ctx, w, h, { sd = 1.2, clump = 2, dither = 1, seed = 11, bias = 0 } = {}) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, r = rng(seed);
  const gw = Math.ceil(w / clump) + 2, gh = Math.ceil(h / clump) + 2, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) { const u = r() || 1e-9, v = r(); g[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); }
  for (let y = 0; y < h; y++) {
    const fy = y / clump, iy = fy | 0, ty = fy - iy;
    for (let x = 0; x < w; x++) {
      const fx = x / clump, ix = fx | 0, tx = fx - ix, o = iy * gw + ix;
      const n = (g[o] * (1 - tx) + g[o + 1] * tx) * (1 - ty) + (g[o + gw] * (1 - tx) + g[o + gw + 1] * tx) * ty;
      const k = (y * w + x) * 4, add = n * sd * 1.6 + (r() - r()) * dither + bias; // 1.6 restores SD lost to bilinear smoothing
      d[k] += add; d[k + 1] += add; d[k + 2] += add;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// grainTile(opts): a 256 px tile of clumped grain plus TPDF dither as small positive code values, to add over a
// ground with globalCompositeOperation 'lighter' through a pattern. One drawImage per bake instead of a
// per-pixel pass (the per-pixel version cost about 150 ms on a 2880 px plate). The tile's mean (about 1.6
// codes) lifts the ground; darken the ground colour by that much. Deterministic per seed.
export function grainTile({ sd = 1.2, clump = 2, dither = 1, seed = 11, size = 256 } = {}) {
  const c = canvas(size, size), x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, size, size);
  grainDither(x, size, size, { sd, clump, dither, seed, bias: Math.ceil(2.2 * sd) });
  const img = x.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, d[i]) ; d[i] = d[i + 1] = d[i + 2] = v; }
  x.putImageData(img, 0, 0);
  return c;
}

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }

// Draw an image (optionally a crop) into a w x h canvas and return its luma as Float32 in [0,1] plus the RGBA.
export function toLuma(img, w, h, crop) {
  const c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  if (crop) x.drawImage(img, crop[0], crop[1], crop[2], crop[3], 0, 0, w, h); else x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, l = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) l[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  return { luma: l, rgba: d, canvas: c };
}

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
