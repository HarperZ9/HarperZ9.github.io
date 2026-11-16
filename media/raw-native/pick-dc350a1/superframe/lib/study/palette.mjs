// palette.mjs: the subject's palette by weighted k-means in CIELAB, and each colour's share of the area.
// Pixels are first counted into a 6-bit-per-channel histogram with integer sums, so the result depends on which
// colours occur and how often, never on where they sit or in what order they are read (the shuffle control).
// k-means++ seeding draws from a named seed (xmur3-mulberry32), so the same subject gives the same palette.
import { lin, linToXYZ, xyzToLab, labToRgb8, lch, hex, dE76, hsvHue } from './cmath.mjs';
import { rngFrom } from '../seed.mjs';

const BITS = 6, SHIFT = 8 - BITS, NB = 1 << (3 * BITS);
export const binOf = (r, g, b) => ((r >> SHIFT) << (2 * BITS)) | ((g >> SHIFT) << BITS) | (b >> SHIFT);

// Histogram of opaque pixels (alpha >= 128): count and integer RGB sums per bin.
export function histogram(S) {
  const n = new Uint32Array(NB), sr = new Float64Array(NB), sg = new Float64Array(NB), sb = new Float64Array(NB), d = S.rgba;
  let total = 0;
  for (let i = 0; i < S.w * S.h; i++) {
    const p = 4 * i; if (d[p + 3] < 128) continue;
    const k = binOf(d[p], d[p + 1], d[p + 2]); n[k]++; sr[k] += d[p]; sg[k] += d[p + 1]; sb[k] += d[p + 2]; total++;
  }
  const pts = [];
  for (let k = 0; k < NB; k++) if (n[k]) {
    const rgb = [sr[k] / n[k], sg[k] / n[k], sb[k] / n[k]];
    pts.push({ bin: k, w: n[k], rgb, lab: rgb8ToLabF(rgb) });
  }
  return { pts, total };
}
const rgb8ToLabF = rgb => xyzToLab(linToXYZ(rgb.map(v => lin(v / 255))));   // fractional 8-bit means

function kmeans(pts, k, rng, iters = 60) {
  const C = [], d2 = new Float64Array(pts.length).fill(Infinity), W = pts.reduce((a, p) => a + p.w, 0);
  const pick = weights => { let t = rng() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < weights.length; i++) { t -= weights[i]; if (t <= 0 && weights[i] > 0) return i; } return weights.findLastIndex(v => v > 0); };
  C.push([...pts[pick(pts.map(p => p.w))].lab]);
  while (C.length < k) {
    const c = C[C.length - 1];
    for (let i = 0; i < pts.length; i++) d2[i] = Math.min(d2[i], dE76(pts[i].lab, c) ** 2);
    const wts = pts.map((p, i) => p.w * d2[i]);
    if (wts.every(v => v === 0)) break;               // fewer distinct colours than k
    C.push([...pts[pick(wts)].lab]);
  }
  const lab = new Int32Array(pts.length).fill(-1);
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < pts.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < C.length; j++) { const d = dE76(pts[i].lab, C[j]); if (d < bd) { bd = d; best = j; } }
      if (lab[i] !== best) { lab[i] = best; moved++; }
    }
    const acc = C.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) { const a = acc[lab[i]], p = pts[i]; a[0] += p.w * p.lab[0]; a[1] += p.w * p.lab[1]; a[2] += p.w * p.lab[2]; a[3] += p.w; }
    acc.forEach((a, j) => { if (a[3]) C[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    if (!moved) break;
  }
  return { C, lab, W };
}

// Merge any two centres closer than mergeDE (area-weighted), so k is an upper bound, not a forced count.
function merge(groups, mergeDE) {
  for (;;) {
    let bi = -1, bj = -1, bd = mergeDE;
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) { const d = dE76(groups[i].lab, groups[j].lab); if (d < bd) { bd = d; bi = i; bj = j; } }
    if (bi < 0) return groups;
    const a = groups[bi], b = groups[bj], w = a.w + b.w;
    a.lab = a.lab.map((v, c) => (v * a.w + b.lab[c] * b.w) / w); a.w = w; a.bins.push(...b.bins); groups.splice(bj, 1);
  }
}

export function palette(S, { k = 10, seed = 'study/palette', mergeDE = 4 } = {}) {
  const { pts, total } = histogram(S);
  if (!pts.length) return { swatches: [], total: 0, binToSwatch: new Map() };
  const { C, lab } = kmeans(pts, Math.min(k, pts.length), rngFrom(seed));
  let groups = C.map(c => ({ lab: c, w: 0, bins: [] }));
  pts.forEach((p, i) => { groups[lab[i]].w += p.w; groups[lab[i]].bins.push(p.bin); });
  groups = merge(groups.filter(g => g.w > 0), mergeDE);
  groups.sort((a, b) => b.w - a.w || b.lab[0] - a.lab[0]);
  const binToSwatch = new Map();
  const swatches = groups.map((g, i) => {
    g.bins.forEach(b => binToSwatch.set(b, i));
    const { rgb, clipped } = labToRgb8(g.lab), [L, Cab, h] = lch(g.lab);
    return { i, hex: hex(rgb), rgb, lab: g.lab.map(r4), L: r4(L), C: r4(Cab), h: r4(h), hsv_hue: hsvHue(rgb), share: g.w / total, pixels: g.w, gamut_clipped: clipped };
  });
  return { swatches, total, binToSwatch };
}
const r4 = v => Math.round(v * 1e4) / 1e4;

export const PALETTE_METHOD = {
  method: 'weighted k-means in CIELAB (CIE76 distance) over a 6-bit-per-channel histogram of opaque pixels; k-means++ seeding from a named seed; centres closer than mergeDE are merged by area',
  share: 'pixels assigned to the swatch / opaque pixels',
};
