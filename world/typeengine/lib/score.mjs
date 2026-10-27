// lib/score.mjs: scores for generated families, computed in node from the engine's own renders.
//
// legibility(family)  a recognition proxy, labelled as one: each of 31 characters is drawn alone in the family and
//                     matched by normalised correlation against plain-ink templates of a fixed reference face
//                     (Accession Display 700). accuracy = share whose best match is the right character; margin =
//                     mean gap between the right template and the best wrong one. Plus the confusable pairs the
//                     typeface agent measures (I/l, O/0, rn/m, cl/d), as bitmap correlation (lower = more distinct).
//                     It is not OCR and not reading speed; the browser OCR run (tools/legibility.py) is the check.
// contrast(raster)    WCAG contrast ratio between the mean ink and the mean ground luminance.
// descriptor(raster)  a 20-number look descriptor (tone histogram, edges, colourfulness, spectrum bands) for novelty.
import { renderWord } from './render.mjs';
import { FAMILY_SCHEMA } from './program.mjs';

export const CHARS = [...'abcdefghijklmnopqrstuvwxyzIl1O0'];
export const PAIRS = [['I', 'l'], ['O', '0'], ['rn', 'm'], ['cl', 'd'], ['t', 'f'], ['l', 'ſ']];
const N = 24;
const luma = (R, i) => 0.2126 * R.data[i * 4] + 0.7152 * R.data[i * 4 + 1] + 0.0722 * R.data[i * 4 + 2];

// Ink map: what the letter changes. The same frame rendered with no letter is the ground (a ruled backdrop, a dark
// tube, a plain sheet), so light-on-dark, dark-on-light and refraction all read as change.
function inkMap(R, G) {
  const { w, h } = R, out = new Float32Array(w * h);
  let mx = 1e-6; for (let i = 0; i < w * h; i++) { out[i] = Math.abs(luma(R, i) - luma(G, i)); mx = Math.max(mx, out[i]); }
  for (let i = 0; i < w * h; i++) out[i] = out[i] / mx > 0.2 ? out[i] / mx : 0;
  return { w, h, d: out };
}
// Crop to ink and resample to N x N, keeping the aspect inside the square.
function norm(M) {
  let x0 = M.w, x1 = -1, y0 = M.h, y1 = -1;
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.d[y * M.w + x] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const v = new Float32Array(N * N); if (x1 < 0) return v;
  const s = Math.max(x1 - x0 + 1, y1 - y0 + 1) / N, ox = x0 - (s * N - (x1 - x0 + 1)) / 2, oy = y0 - (s * N - (y1 - y0 + 1)) / 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let a = 0, n = 0;
    for (let yy = oy + j * s; yy < oy + (j + 1) * s; yy += Math.max(0.5, s / 3)) for (let xx = ox + i * s; xx < ox + (i + 1) * s; xx += Math.max(0.5, s / 3)) { const X = Math.floor(xx), Y = Math.floor(yy); if (X >= 0 && Y >= 0 && X < M.w && Y < M.h) a += M.d[Y * M.w + X]; n++; }
    v[j * N + i] = n ? a / n : 0;
  }
  return v;
}
function ncc(a, b) { let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length; let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return s / Math.sqrt(sa * sb || 1); }

export function glyphVectors(family, chars = CHARS, { px = 96, size = 56, loc } = {}) {
  const out = {};
  const grounds = {};
  for (const c of chars) {
    const W = px * Math.max(1, c.length), G = (grounds[W] ??= renderWord(family, ' ', W, px, { size, loc }).raster);
    out[c] = norm(inkMap(renderWord(family, c, W, px, { size, loc }).raster, G));
  }
  return out;
}

let templates = null;
const REFERENCE = { schema: FAMILY_SCHEMA, id: 'reference', name: 'Reference', skeleton: { source: 'accession', style: 'display', weight: 700 }, bindings: { fill: { material: 'ink' } } };
export function referenceTemplates() { return (templates ??= glyphVectors(REFERENCE)); }

export function legibility(family, opt = {}) {
  const T = referenceTemplates(), V = glyphVectors(family, CHARS, opt);
  let right = 0, margin = 0; const misses = [];
  for (const c of CHARS) {
    let best = null, bestS = -2, own = ncc(V[c], T[c]), other = -2;
    for (const t of CHARS) { const s = ncc(V[c], T[t]); if (s > bestS) { bestS = s; best = t; } if (t !== c && s > other) other = s; }
    if (best === c || (best !== c && ['Il1', 'O0'].some((g) => g.includes(c) && g.includes(best)) && own >= bestS - 0.01)) right++; else misses.push(`${c}>${best}`);
    margin += own - other;
  }
  const P = glyphVectors(family, ['rn', 'm', 'cl', 'd', 't', 'f', 'l', 'ſ'], opt), pairs = {};
  for (const [a, b] of PAIRS) pairs[`${a}/${b}`] = +ncc((V[a] ?? P[a]), (V[b] ?? P[b])).toFixed(3);
  return { accuracy: +(right / CHARS.length).toFixed(3), margin: +(margin / CHARS.length).toFixed(3), misses, pairs, proxy: 'template correlation against Accession Display 700, 24 x 24; not OCR' };
}

// Contrast as the reader meets it: the pixels the letter changes most (over half the largest change from the bare
// ground render) against the bare ground at the same pixels. WCAG ratio of the two mean luminances.
export function contrast(R, G) {
  let mx = 0; const n = R.w * R.h, d = new Float32Array(n);
  for (let i = 0; i < n; i++) { d[i] = Math.abs(luma(R, i) - luma(G, i)); mx = Math.max(mx, d[i]); }
  let li = 0, lg = 0, k = 0;
  for (let i = 0; i < n; i++) if (d[i] > 0.5 * mx) { li += luma(R, i); lg += luma(G, i); k++; }
  if (!k) return 1;
  const a = li / k, b = lg / k;
  return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
}

export function descriptor(R) {
  const { w, h } = R, hist = new Array(8).fill(0); let edge = 0, col = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, L = Math.min(0.999, Math.max(0, luma(R, i)) ** (1 / 2.2)); hist[Math.floor(L * 8)]++;
    if (x + 1 < w && y + 1 < h) edge += Math.abs(luma(R, i + 1) - luma(R, i)) + Math.abs(luma(R, i + w) - luma(R, i));
    const r = R.data[i * 4], g = R.data[i * 4 + 1], b = R.data[i * 4 + 2]; col += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
  }
  const bands = new Array(10).fill(0); // row and column energy at doubling periods: a cheap spectrum
  for (let k = 0; k < 5; k++) { const p = 2 << k; let a = 0, b = 0; for (let y = 0; y + p < h; y += 2) for (let x = 0; x + p < w; x += 2) { const i = y * w + x; a += Math.abs(luma(R, i + p) - luma(R, i)); b += Math.abs(luma(R, i + p * w) - luma(R, i)); } bands[k] = a / (w * h / 4); bands[k + 5] = b / (w * h / 4); }
  return [...hist.map((v) => v / (w * h)), (edge / (w * h)) * 4, col / (w * h), ...bands.map((v) => v * 4)];
}
export const distance = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
