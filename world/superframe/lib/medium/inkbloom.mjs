// lib/medium/inkbloom.mjs: words as ink that blooms. After Frankenthaler's soak stains and the Ink Bloom study:
// a dense core where the ink landed, a feathered fibrous edge where it wicks outward, and a lighter halo of the
// ink's paler component that spreads further and faster (inks separate as they bloom). The letters stay readable
// while young; as they age the bloom grows, the core softens, and the fine map hands the ink to the carried field.
// All of it lives in the word's own mask space, so it is carried and bent by the same deformation map.
import { bilerp, clamp } from './grid.mjs';

// three box blurs approximate a gaussian of radius r (in mask pixels)
function blur(src, w, h, r) {
  let a = Float32Array.from(src); const t = new Float32Array(a.length), R = Math.max(1, Math.round(r));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -R; x <= R; x++) s += a[y * w + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * R + 1); s += a[y * w + clamp(x + R + 1, 0, w - 1)] - a[y * w + clamp(x - R, 0, w - 1)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -R; y <= R; y++) s += t[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * R + 1); s += t[clamp(y + R + 1, 0, h - 1) * w + x] - t[clamp(y - R, 0, h - 1) * w + x]; } }
  }
  return a;
}

// fibrous noise: ridged value noise over three scales, seeded, in [0, 1] (the paper's fibres the ink wicks along)
function fibres(w, h, seed) {
  const hash = (x, y, s) => { let q = (x * 374761393 + y * 668265263 + s * 974711 + seed * 2654435761) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, y, s) => { const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j, u = a * a * (3 - 2 * a), v = b * b * (3 - 2 * b); return (hash(i, j, s) * (1 - u) + hash(i + 1, j, s) * u) * (1 - v) + (hash(i, j + 1, s) * (1 - u) + hash(i + 1, j + 1, s) * u) * v; };
  const N = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let f = 0, amp = 0.55, sc = 1 / 7;
    for (let o = 0; o < 3; o++) { f += amp * vn(x * sc, y * sc * 1.6, o); amp *= 0.5; sc *= 2.3; }
    N[y * w + x] = (1 - Math.abs(2 * f / 0.9625 - 1)) ** 1.6;
  }
  return N;
}

// precompute a text detail's bloom fields (called once when the words are poured)
export function prepareBloom(d, haloA, seed = 1) {
  const MW = d.gw * d.S, MH = d.gh * d.S;
  // the wide blurs are scaled so they reach full strength along the strokes (thin letters would otherwise give a halo
  // too faint to see)
  const norm = a => { let mx = 0; for (const v of a) mx = Math.max(mx, v); const f = mx > 0 ? 1 / mx : 1; for (let i = 0; i < a.length; i++) a[i] *= f; return a; };
  d.B1 = blur(d.mask, MW, MH, d.S * 0.25); d.B2 = norm(blur(d.mask, MW, MH, d.S * 1.0)); d.B3 = norm(blur(d.mask, MW, MH, d.S * 3.2));
  d.N = fibres(MW, MH, seed); d.halo = haloA;
}

// the ink at a grid point: absorbance per channel from every pour's fine map, and how much the carried field shows
export function inkAt(m, gx, gy) {
  const a = [0, 0, 0], aS = m.pigS ? new Array(16).fill(0) : null; let wmax = 0;
  for (const d of m.details) {
    if (m.time < d.at) continue;
    const age = m.time - d.at, w = d.mode === 'dissolve' ? Math.exp(-age / d.hold) : 1;
    if (d.mode === 'dissolve') wmax = Math.max(wmax, w);
    let px, py;
    if (d.mode === 'rigid') {
      const cx = d.ox + d.gw / 2 + d.pose.x, cy = d.oy + d.gh / 2 + d.pose.y, ca = Math.cos(-d.pose.a), sa = Math.sin(-d.pose.a), dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
      px = d.ox + d.gw / 2 + dx * ca - dy * sa - 0.5; py = d.oy + d.gh / 2 + dx * sa + dy * ca - 0.5;
    } else {
      const mx = clamp((gx + 0.5) * 2 - 0.5, 0, d.mw - 1.001), my = clamp((gy + 0.5) * 2 - 0.5, 0, d.mh - 1.001), i = mx | 0, j = my | 0, u = mx - i, v = my - j;
      const at = c => { const k = 2 * (j * d.mw + i) + c; return (d.P[k] * (1 - u) + d.P[k + 2] * u) * (1 - v) + (d.P[k + 2 * d.mw] * (1 - u) + d.P[k + 2 * d.mw + 2] * u) * v; };
      px = at(0); py = at(1);
    }
    if (d.mask) {
      const sx = (px + 0.5 - d.ox) * d.S - 0.5, sy = (py + 0.5 - d.oy) * d.S - 0.5, MW = d.gw * d.S, MH = d.gh * d.S;
      if (sx < 0 || sy < 0 || sx >= MW - 1 || sy >= MH - 1) continue;
      const core = bilerp(d.mask, MW, MH, sx, sy);
      if (!d.B1) { for (let c = 0; c < 3; c++) a[c] += d.a[c] * core * d.amount * w; if (aS && d.aS) for (let b = 0; b < 16; b++) aS[b] += d.aS[b] * core * d.amount * w; continue; }
      const g = 1 - Math.exp(-age / 1.4), soft = bilerp(d.B1, MW, MH, sx, sy), wide = bilerp(d.B2, MW, MH, sx, sy) * (1 - g) + bilerp(d.B3, MW, MH, sx, sy) * g, fib = bilerp(d.N, MW, MH, sx, sy);
      // the core softens toward its feathered edge as it ages; the fibrous edge and the pale halo grow outward
      // the bloom fades out toward the edges of the word's mask box, so its edge never shows as a straight line
      const win = clamp(Math.min(Math.min(sx, MW - 1 - sx) / (0.1 * MW), Math.min(sy, MH - 1 - sy) / (0.18 * MH)), 0, 1);
      const coreV = core * (1 - 0.45 * g) + soft * 0.45 * g, edge = clamp(soft - core, 0, 1) * (0.4 + 1.4 * fib) * g * win;
      const halo = wide * (0.3 + 1.3 * fib) * g * (1 - 0.8 * core) * win;
      for (let c = 0; c < 3; c++) a[c] += d.amount * w * (d.a[c] * (1.25 * coreV + 0.8 * edge) + d.halo[c] * 1.4 * halo);
      if (aS && d.aS) for (let b = 0; b < 16; b++) aS[b] += d.amount * w * (d.aS[b] * (1.25 * coreV + 0.8 * edge) + (d.haloS ?? d.aS)[b] * 1.4 * halo);
    } else {
      const sx = (px + 0.5 - d.ox) / d.gw * d.iw - 0.5, sy = (py + 0.5 - d.oy) / d.gh * d.ih - 0.5;
      if (sx < 0 || sy < 0 || sx >= d.iw - 1 || sy >= d.ih - 1) continue;
      const i0 = sx | 0, j0 = sy | 0, k = 3 * (j0 * d.iw + i0);
      for (let c = 0; c < 3; c++) a[c] += d.img[k + c] * d.amount * w;
    }
  }
  return { a, aS, coarse: 1 - wmax };
}
