// pixelart.mjs: medium translation, painting to pixel art. After the pair in feed set 28 (a Raja Nandepu landscape
// and Xeleph's pixel study of it): the same scene, carried from one medium into another by rules a pixel artist uses.
//   1. Grid: area-average the painting onto a coarse grid in linear light (cell px per art pixel).
//      With `accent` > 0 a cell whose own contrast is high (luma p90 - p10 above 0.12) takes the mean of its darkest
//      `accent` share instead, so thin dark strokes (reeds, shrubs, a window) survive the shrink as a pixel artist keeps
//      them, where a plain average would wash them into the ground.
//   2. Palette: k-means++ in OKLab, seeded, so distances follow perceived colour; sorted dark to light.
//   3. Quantise: each cell takes its nearest palette colour, or, where it sits between two, an ordered (Bayer 4 x 4)
//      choice between them. `dither` scales how far from the midpoint a cell must be before the pattern appears, so
//      flat zones stay flat and only true ramps get a pattern, as hand pixel art does.
//   4. Cleanup: orphan cells (no same-colour cell among the 8 neighbours) take their neighbours' majority colour.
//      Repeated `cleanup` times. Ordered-dither cells keep diagonal partners, so the pattern survives.
//   5. Selective outline (optional, runs before cleanup so stray outline cells are cleaned too): a cell on a cluster
//      edge facing a much lighter cluster steps one palette entry darker. Every output colour is still a palette colour.
// Input is any linear raster { w, h, px }; ours is painting.mjs, never a third-party image.
import { raster, resize, rng } from './lib/field.mjs';
import { linToOklab, oklabToLin } from './lib/color.mjs';

export const SPEC = {
  id: 'medium.pixelart',
  inputs: { raster: 'linear raster { w, h, px }' },
  params: {
    cell: { min: 2, max: 32, default: 6, unit: 'source px per art pixel' }, colors: { min: 2, max: 48, default: 16, unit: 'palette entries' },
    dither: { min: 0, max: 1, default: 0.35, unit: 'share of a ramp that may dither' }, accent: { min: 0, max: 0.6, default: 0.35, unit: 'darkest share kept in a high-contrast cell (0 = plain average)' }, cleanup: { min: 0, max: 6, default: 2, unit: 'passes' },
    outline: { min: 0, max: 1, default: 0, unit: 'on or off above 0.5; L gap that triggers it is 0.18' }, seed: { default: 'px', unit: 'string' },
  },
  determinism: 'same input, seed and params give the same grid and palette (tests/pixelart.test.mjs)',
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// k-means++ in OKLab. Returns { centres, sse } with centres sorted by lightness. Every iteration's SSE is kept so a test
// can check it never rises (Lloyd's algorithm is monotone).
export function kmeans(points, k, seed = 'km', iters = 14) {
  const r = rng(seed), n = points.length, C = [points[Math.floor(r() * n)]], D = new Float64Array(n), trace = [];
  while (C.length < k) {
    let s = 0; for (let i = 0; i < n; i++) { let m = Infinity; for (const c of C) m = Math.min(m, d2(points[i], c)); D[i] = m; s += m; }
    let t = r() * s, i = 0; while (i < n - 1 && (t -= D[i]) > 0) i++; C.push(points[i]);
  }
  const lab = new Int32Array(n);
  for (let it = 0; it < iters; it++) {
    let sse = 0; const sum = C.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) { let b = 0, m = Infinity; for (let j = 0; j < C.length; j++) { const e = d2(points[i], C[j]); if (e < m) { m = e; b = j; } } lab[i] = b; sse += m; const s = sum[b]; s[0] += points[i][0]; s[1] += points[i][1]; s[2] += points[i][2]; s[3]++; }
    trace.push(sse);
    for (let j = 0; j < C.length; j++) if (sum[j][3]) C[j] = [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]];
  }
  return { centres: C.slice().sort((a, b) => a[0] - b[0]), trace };
}

// Contrast-aware shrink: plain area mean, except in high-contrast cells, which keep the mean of their darkest share.
export function accentResize(R, gw, gh, cell, share) {
  const G = raster(gw, gh), lum = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    lum.length = 0;
    for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) { const X = x * cell + i, Y = y * cell + j; if (X < R.w && Y < R.h) { const k = 3 * (Y * R.w + X); lum.push([0.2126 * R.px[k] + 0.7152 * R.px[k + 1] + 0.0722 * R.px[k + 2], k]); } }
    lum.sort((a, b) => a[0] - b[0]);
    const q = f => Math.cbrt(Math.max(0, lum[Math.min(lum.length - 1, Math.floor(f * lum.length))][0])), high = q(0.9) - q(0.1) > 0.12;
    const take = high ? lum.slice(0, Math.max(1, Math.round(share * lum.length))) : lum, o = 3 * (y * gw + x);
    for (const [, k] of take) for (let c = 0; c < 3; c++) G.px[o + c] += R.px[k + c] / take.length;
  }
  return G;
}

export function orphans(idx, gw, gh) {
  let n = 0;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let same = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < gw && Y < gh && idx[Y * gw + X] === idx[y * gw + x]) same++; }
    if (!same) n++;
  }
  return n;
}

export function pixelate(R, o = {}) {
  const p = { cell: 6, colors: 16, dither: 0.35, cleanup: 2, outline: 0, accent: 0.35, seed: 'px', ...o };
  const gw = Math.max(1, Math.floor(R.w / p.cell)), gh = Math.max(1, Math.floor(R.h / p.cell)), G = p.accent > 0 ? accentResize(R, gw, gh, p.cell, p.accent) : resize(R, gw, gh), n = gw * gh;
  const lab = Array.from({ length: n }, (_, i) => linToOklab([Math.max(0, G.px[3 * i]), Math.max(0, G.px[3 * i + 1]), Math.max(0, G.px[3 * i + 2])]));
  const { centres: pal, trace } = kmeans(lab, Math.min(p.colors, n), p.seed);
  const idx = new Uint8Array(n);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const c = lab[y * gw + x]; let a = 0, b = 1, ea = Infinity, eb = Infinity;
    for (let j = 0; j < pal.length; j++) { const e = d2(c, pal[j]); if (e < ea) { eb = ea; b = a; ea = e; a = j; } else if (e < eb) { eb = e; b = j; } }
    const A = pal[a], B = pal[b], AB = d2(A, B) || 1, t = ((c[0] - A[0]) * (B[0] - A[0]) + (c[1] - A[1]) * (B[1] - A[1]) + (c[2] - A[2]) * (B[2] - A[2])) / AB;
    // t is 0 at the nearest colour and about 0.5 halfway to the second. Dither only inside the middle band.
    const band = 0.5 * p.dither, choose = band > 0 && t > 0.5 - band ? (t - (0.5 - band)) / (2 * band) > BAYER[(y & 3) * 4 + (x & 3)] : false;
    idx[y * gw + x] = choose ? b : a;
  }
  if (p.outline > 0.5) {
    const src = Uint8Array.from(idx);
    for (let y = 0; y < gh - 1; y++) for (let x = 0; x < gw - 1; x++) {
      const me = src[y * gw + x], nb = [src[(y + 1) * gw + x], src[y * gw + x + 1]];
      if (nb.some(v => v !== me && pal[v][0] - pal[me][0] > 0.18) && me > 0) idx[y * gw + x] = me - 1;
    }
  }
  for (let pass = 0; pass < p.cleanup; pass++) {
    const src = Uint8Array.from(idx);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const me = src[y * gw + x], count = new Map(); let same = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const v = src[Y * gw + X]; if (v === me) same++; count.set(v, (count.get(v) || 0) + (i && j ? 1 : 2)); }
      if (!same) { let best = me, m = -1; for (const [v, c] of count) if (c > m || (c === m && d2(pal[v], pal[me]) < d2(pal[best], pal[me]))) { m = c; best = v; } idx[y * gw + x] = best; }
    }
  }
  const palLin = pal.map(oklabToLin), out = raster(gw * p.cell, gh * p.cell);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) { const c = palLin[idx[Math.floor(y / p.cell) * gw + Math.floor(x / p.cell)]]; out.px.set(c, 3 * (y * out.w + x)); }
  return { idx, gw, gh, palette: palLin, paletteLab: pal, trace, R: out, grid: G };
}
