// lib/fourier/shape.mjs: letters and words as sets of Fourier contours, laid out, cut and paired for morphing.
//   glyphSeries(font, ch)                 the descriptors of one glyph in em units, y down (cached per font and char)
//   wordSeries(font, text, at)            a word's contours placed in pixels: at = { x, y (baseline), em, tracking }
//   loopSeries(loops)                     contours from any outline loops in pixels (the mask fallback for any face)
//   compact(s, scale, tolPx)              keep only the terms that show at scale (device px per unit), j order kept
//   pairUp(A, B)                          match two words' contours (holes with holes), aligned for interpolation
//   mix(p, t)                             the matched pair's descriptors at t in [0, 1]
import { resample, dft, truncate, align, reorder, freqOf } from './kernel.mjs';
import { fft } from './fft.mjs';

export const N = 512, K = 255;

export function describe(pts, hole = null) {
  const r = resample(pts, N), c = dft(r, K);
  let area = 0; for (let i = 0; i < N; i++) { const j = (i + 1) % N; area += r[2 * i] * r[2 * j + 1] - r[2 * j] * r[2 * i + 1]; }
  area /= 2;
  return { r, c, area, hole: hole ?? area < 0, cx: c.re[0], cy: c.im[0] };
}

const cache = new WeakMap();
export function glyphSeries(font, ch) {
  let m = cache.get(font); if (!m) cache.set(font, (m = new Map()));
  if (m.has(ch)) return m.get(ch);
  const g = font.glyph(ch), out = { advance: g.advance, contours: [] };
  for (const ct of g.contours) {
    const p = Float64Array.from(ct.pts); for (let i = 1; i < p.length; i += 2) p[i] = -p[i]; // y down, like the screen
    out.contours.push(describe(p, ct.hole));
  }
  m.set(ch, out); return out;
}

// Place em-unit series at (x, y) with size em: c0 moves and scales, every other term scales.
function place(s, x, y, em) {
  const c = s.c, re = Float64Array.from(c.re, (v) => v * em), im = Float64Array.from(c.im, (v) => v * em);
  re[0] += x; im[0] += y;
  const r = Float64Array.from(s.r, (v, i) => v * em + (i % 2 ? y : x));
  return { r, c: { ...c, re, im }, area: s.area * em * em, hole: s.hole, cx: re[0], cy: im[0] };
}

// advances(prefix) may be given by the page (canvas measureText, so the art sits under the real text); else the font's.
export function wordSeries(font, text, { x = 0, y = 0, em = 100, tracking = 0, advanceOf = null } = {}) {
  const out = []; let pen = 0, i = 0;
  for (const ch of text) {
    const gx = advanceOf ? advanceOf(i) : x + pen;
    if (ch.trim() && font.has(ch)) for (const s of glyphSeries(font, ch).contours) out.push({ ...place(s, gx, y, em), ch, at: i });
    pen += (font.has(ch) ? glyphSeries(font, ch).advance : 0.3) * em + tracking; i++;
  }
  return out;
}

export function loopSeries(loops) { return loops.map((l) => ({ ...describe(Float64Array.from(l.pts), l.hole), ch: '', at: 0 })); }

export function compact(s, scale, tolPx = 0.25) {
  const t = truncate(s.c, scale, tolPx), k = [], re = [], im = [];
  for (let j = 0; j < t.keep.length; j++) if (t.keep[j]) { k.push(s.c.k[j]); re.push(s.c.re[j]); im.push(s.c.im[j]); }
  return { k: Int32Array.from(k), re: Float64Array.from(re), im: Float64Array.from(im), bound: t.bound };
}

// A contour shrunk to a point: the start or end of a contour that has no partner.
const dot = (s) => { const re = new Float64Array(s.c.re.length), im = new Float64Array(s.c.im.length); re[0] = s.cx; im[0] = s.cy; return { ...s, c: { ...s.c, re, im } }; };

export function pairUp(A, B) {
  const used = new Set(), pairs = [];
  // positions are compared across the words' widths, so the third letter of a short word meets the middle of a long one
  const span = (S) => { let lo = Infinity, hi = -Infinity; for (const s of S) { lo = Math.min(lo, s.cx); hi = Math.max(hi, s.cx); } return [lo, Math.max(1e-9, hi - lo)]; };
  const [la, wa] = span(A), [lb, wb] = span(B), wm = (wa + wb) / 2;
  const cost = (a, b) => (((a.cx - la) / wa - (b.cx - lb) / wb) * wm) ** 2 + (a.cy - b.cy) ** 2 + 0.5 * (Math.sqrt(Math.abs(a.area)) - Math.sqrt(Math.abs(b.area))) ** 2;
  const order = A.map((a, i) => i).sort((p, q) => Math.abs(A[q].area) - Math.abs(A[p].area));
  for (const i of order) {
    const a = A[i]; let best = -1, bc = Infinity;
    B.forEach((b, j) => { if (used.has(j) || b.hole !== a.hole) return; const c = cost(a, b); if (c < bc) { bc = c; best = j; } });
    if (best < 0) { pairs.push({ a: a.c, b: dot(a).c }); continue; }
    used.add(best);
    // the search runs on every fourth point (a shift error of at most 2 of 512 samples), then one fast transform
    const b = B[best], al = align(every4(a.r), every4(b.r)), full = { shift: al.shift * 4, rev: al.rev }, rb = reorder(b.r, full);
    pairs.push({ a: a.c, b: fastDft(rb, K), align: full });
  }
  B.forEach((b, j) => { if (!used.has(j)) pairs.push({ a: dot(b).c, b: b.c }); });
  return pairs;
}

const every4 = (r) => { const o = new Float64Array(r.length / 4); for (let i = 0; i < o.length; i += 2) { o[i] = r[4 * i]; o[i + 1] = r[4 * i + 1]; } return o; };

// The same descriptors as dft() by radix-2 FFT, for morph targets made while the page runs (dft() is the kernel's
// exact twin and stays the reference; the two agree to about 1e-16 of the size, checked in tests/fourier.test.mjs).
export function fastDft(z, Kk) {
  const n = z.length / 2, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { re[i] = z[2 * i]; im[i] = z[2 * i + 1]; }
  fft(re, im);
  const T = 2 * Kk + 1, k = new Int32Array(T), ore = new Float64Array(T), oim = new Float64Array(T);
  for (let j = 0; j < T; j++) { const f = freqOf(j), b = ((f % n) + n) % n; k[j] = f; ore[j] = re[b] / n; oim[j] = im[b] / n; }
  return { N: n, K: Kk, k, re: ore, im: oim };
}

// The harmonic count through a morph: the letters soften to about twenty terms midway and sharpen again, so the
// in-between shapes read as one form becoming another instead of two outlines fighting.
export const morphTerms = (t) => Math.pow(2, 11 * (1 - 0.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))));

export function mix(p, t, out = null) {
  const T = p.a.re.length, re = out?.re ?? new Float64Array(T), im = out?.im ?? new Float64Array(T);
  for (let j = 0; j < T; j++) { re[j] = p.a.re[j] + (p.b.re[j] - p.a.re[j]) * t; im[j] = p.a.im[j] + (p.b.im[j] - p.a.im[j]) * t; }
  return { k: p.a.k, re, im };
}
