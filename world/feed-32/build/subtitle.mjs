// subtitle.mjs: the subtitle line as a treatment: when a line shows, where it sits, what ink it takes and how it
// joins the picture. Numbers are measured on the key reference (../CLAIMS.md section 2.4); the lettering is our own
// house type, set by the type forge, never the reference's face.
//
// SPEC
//   cues(shots, lines, opts) -> [{ text, on, off }] seconds. shots: [[start, end], ...]; lines: strings in order.
//     opts.lead 0..2 s (default 0.83: the opening line waits this long; later lines enter on the cut)
//     opts.hold 0.8..4 s (default 2.03), opts.clear 0..1 s (default 0.2: a line ends at least this long before a cut)
//     opts.minShot 0..3 s (default 1.2: shorter shots carry no line). Lines never cross a cut; on and off are hard.
//   layout(w, h, opts) -> { baseline, capPx, xHeightPx, cx } in px. opts.baseline 0.85..0.97 of h (default 0.933),
//     opts.cap 0.015..0.06 of h (default 0.029: ascender to baseline), centred.
//   inkFor(targetHex, gradeParams) -> linear [r,g,b] that the film grade maps onto targetHex (default #ceb144).
//   composite(R, mask, ink, opacity) -> R with the line laid in, before the grade, so grain and halation reach it
//     (KEY: residual SD inside the letters 9.3 vs 10.4 around them, so the texture runs through the type).
//   glyphContrast(G, mask) -> { min, glyphs }: WCAG contrast of each glyph part against its own surround, graded frame.
//   haloAlpha(mask, w, h, { grow px, soft px, strength 0..1 }); compositeLegible(R, mask, ink, halo): a dark halo in
//     linear black (the grade maps it to its black point), then the line.
//   solveLegible(src, mask, { target, minRatio 4.5, gradeParams, seed, frame }) -> { ink, halo, opts, min }: the
//     smallest halo, strength first then width, that brings every glyph to minRatio with a 10% margin.
//   determinism : pure functions.
import { clamp, blur } from '../../feed-29/build/lib/field.mjs';
import { toSrgb, toLin, hexLin } from '../../feed-29/build/lib/color.mjs';
import { curve, grade, DEFAULTS } from './film.mjs';

export const MEASURED = Object.freeze({ lead: 0.83, hold: 2.03, clear: 0.2, minShot: 1.2, baseline: 0.933, cap: 0.029, xHeight: 0.0195, ink: '#ceb144', widthShare: [0.21, 0.46] });

export function cues(shots, lines, { lead = MEASURED.lead, hold = MEASURED.hold, clear = MEASURED.clear, minShot = MEASURED.minShot } = {}) {
  const out = []; let li = 0;
  shots.forEach(([a, b], si) => {
    if (li >= lines.length || b - a < minShot) return;
    const on = si === 0 ? a + lead : a, off = Math.min(on + hold, b - clear);
    if (off - on < 0.8) return;
    out.push({ text: lines[li++], on, off });
  });
  return out;
}

export function layout(w, h, { baseline = MEASURED.baseline, cap = MEASURED.cap } = {}) {
  return { baseline: Math.round(baseline * h), capPx: cap * h, xHeightPx: (cap * h * MEASURED.xHeight) / MEASURED.cap, cx: w / 2 };
}

// Invert the grade's per-channel tone curve by bisection, so the line lands on the target ink after grading.
export function inkFor(targetHex = MEASURED.ink, params = {}) {
  const P = { ...DEFAULTS, ...params }, t = hexLin(targetHex).map(v => toSrgb(v));
  const first = [0, 1, 2].map(c => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; (curve(m, P.black[c] / 255, P.white[c] / 255, P.shoulder, P.toe) < t[c] ? (lo = m) : (hi = m)); }
    return toLin((lo + hi) / 2);
  });
  return refine(first, t, params);
}

// The OKLab trim and saturation in the grade move the ink a little; a few fixed-point steps through the real grade
// remove that (display-space error under 0.5 code values after 6 steps on the defaults).
function refine(ink, t, params) {
  const off = { ...params, grain: { sd: 0 }, flicker: 0, halation: { strength: 0 }, weave: 0 };
  for (let k = 0; k < 6; k++) {
    const g = grade({ w: 1, h: 1, px: Float32Array.from(ink) }, off).px;
    ink = ink.map((v, c) => toLin(clamp(toSrgb(v) + (t[c] - toSrgb(g[c])) * 0.9)));
  }
  return ink;
}

// Lay the line into a feed-29 raster: mask is coverage 0..1 at the raster size.
export function composite(R, mask, ink, opacity = 1) {
  const n = R.w * R.h;
  if (mask.length !== n) throw new Error(`subtitle mask is ${mask.length}, raster is ${n}`);
  for (let i = 0; i < n; i++) { const a = clamp(mask[i] * opacity); if (a) for (let c = 0; c < 3; c++) R.px[3 * i + c] += (ink[c] - R.px[3 * i + c]) * a; }
  return R;
}

// Place a set line (from any setter that returns a coverage mask in a strip) on a full frame at the layout.
// set(text, sw, sh) -> Float32Array(sw*sh). The strip is sized so the measured ascender height comes out right.
export function lineMask(text, w, h, set, opts = {}) {
  // The strip is height-bound for short lines, so one scale holds for every line: a lowercase l gives the ascender height (what the KEY line measures)
  // and the baseline, and descenders in the line hang below that baseline as they should.
  const L = layout(w, h, opts), sh = Math.max(8, Math.round(L.capPx * 3)), sw = w, strip = set(text, sw, sh), ref = set('l', sw, sh);
  let top = sh, bot = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (ref[y * sw + x] > 0.5) { top = Math.min(top, y); bot = Math.max(bot, y); }
  if (bot < 0) return new Float32Array(w * h);
  const k = L.capPx / Math.max(1, bot - top + 1), out = new Float32Array(w * h);
  // nearest-area resample of the strip by k around its ink box, baseline at L.baseline (descenders hang below)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sy = (y - L.baseline) / k + bot, sx = (x - L.cx) / k + sw / 2;
    if (sy < 0 || sy >= sh - 1 || sx < 0 || sx >= sw - 1) continue;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    out[y * w + x] = (strip[y0 * sw + x0] * (1 - fx) + strip[y0 * sw + x0 + 1] * fx) * (1 - fy) + (strip[(y0 + 1) * sw + x0] * (1 - fx) + strip[(y0 + 1) * sw + x0 + 1] * fx) * fy;
  }
  return out;
}

// ---- Legibility: per-glyph contrast against each glyph's own surround, and a halo in the grade's black ----
// Cinema subtitles stay legible on any plate because each letter carries its own dark surround. The halo is the line
// mask dilated and softened, laid in as linear black before the grade, so after grading it sits at the grade's black
// point and takes the same grain. Contrast is WCAG 2 relative luminance, (lighter + 0.05) / (darker + 0.05), measured
// on the graded frame per connected glyph part: its core (coverage > 0.7) against the uninked pixels (coverage < 0.05)
// within `reach` px whose nearest glyph part is that same part (chamfer distance).

const lumAt = (px, i) => 0.2126 * px[3 * i] + 0.7152 * px[3 * i + 1] + 0.0722 * px[3 * i + 2];

// Glyph parts (8-connected, coverage > 0.5), and for every pixel in the line box grown by reach, the nearest part and
// its distance. Returns { lab: Int32Array (-1 none), dist: Float32Array, n, box: [x0, y0, x1, y1] | null }.
export function glyphParts(mask, w, h, reach) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) if (mask[i] > 0.5) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const lab = new Int32Array(w * h).fill(-1), dist = new Float32Array(w * h).fill(Infinity);
  if (x1 < 0) return { lab, dist, n: 0, box: null };
  const r = Math.ceil(reach) + 1, box = [Math.max(0, x0 - r), Math.max(0, y0 - r), Math.min(w - 1, x1 + r), Math.min(h - 1, y1 + r)];
  let n = 0; const stack = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const s = y * w + x; if (mask[s] <= 0.5 || lab[s] >= 0) continue;
    lab[s] = n; dist[s] = 0; stack.push(s);
    while (stack.length) {
      const i = stack.pop(), cx = i % w, cy = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy, j = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || lab[j] >= 0 || mask[j] <= 0.5) continue;
        lab[j] = n; dist[j] = 0; stack.push(j);
      }
    }
    n++;
  }
  const [bx0, by0, bx1, by1] = box, D = Math.SQRT2;
  const relax = (i, j, c) => { if (dist[j] + c < dist[i]) { dist[i] = dist[j] + c; lab[i] = lab[j]; } };
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const i = y * w + x;
    if (x > bx0) relax(i, i - 1, 1);
    if (y > by0) { relax(i, i - w, 1); if (x > bx0) relax(i, i - w - 1, D); if (x < bx1) relax(i, i - w + 1, D); }
  }
  for (let y = by1; y >= by0; y--) for (let x = bx1; x >= bx0; x--) {
    const i = y * w + x;
    if (x < bx1) relax(i, i + 1, 1);
    if (y < by1) { relax(i, i + w, 1); if (x < bx1) relax(i, i + w + 1, D); if (x > bx0) relax(i, i + w - 1, D); }
  }
  return { lab, dist, n, box };
}

const reachFor = (w, h) => Math.max(3, 0.3 * layout(w, h).capPx);

// Per-glyph contrast on a graded frame G (linear light). min is the worst glyph part.
export function glyphContrast(G, mask, { reach = null, parts = null } = {}) {
  const { w, h } = G, rc = reach ?? reachFor(w, h), P = parts ?? glyphParts(mask, w, h, rc);
  if (!P.n) return { min: Infinity, glyphs: [] };
  const gs = new Float64Array(P.n), gn = new Float64Array(P.n), ss = new Float64Array(P.n), sn = new Float64Array(P.n);
  const [bx0, by0, bx1, by1] = P.box;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const i = y * w + x, k = P.lab[i]; if (k < 0) continue;
    if (mask[i] > 0.7) { gs[k] += lumAt(G.px, i); gn[k]++; } else if (mask[i] < 0.05 && P.dist[i] <= rc) { ss[k] += lumAt(G.px, i); sn[k]++; }
  }
  const glyphs = [];
  for (let k = 0; k < P.n; k++) if (gn[k] && sn[k]) {
    const lg = gs[k] / gn[k], ls = ss[k] / sn[k];
    glyphs.push({ part: k, lum: lg, surround: ls, ratio: (Math.max(lg, ls) + 0.05) / (Math.min(lg, ls) + 0.05), core: gn[k] });
  }
  return { min: Math.min(...glyphs.map(g => g.ratio)), glyphs };
}

// Halo alpha: the mask dilated by `grow` px (separable max), softened by `soft` px, times strength.
export function haloAlpha(mask, w, h, { grow = 2, soft = 1.5, strength = 0.8 } = {}) {
  const r = Math.max(0, Math.round(grow)), t = new Float32Array(w * h), d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let i = -r; i <= r; i++) { const xx = x + i; if (xx >= 0 && xx < w) m = Math.max(m, mask[y * w + xx]); } t[y * w + x] = m; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let i = -r; i <= r; i++) { const yy = y + i; if (yy >= 0 && yy < h) m = Math.max(m, t[yy * w + x]); } d[y * w + x] = m; }
  const b = blur(d, w, h, soft);
  for (let i = 0; i < w * h; i++) b[i] = clamp(b[i] * 1.15) * strength;
  return b;
}

// Halo (linear black, so the grade puts it at its black point), then the line. Mutates and returns R.
export function compositeLegible(R, mask, ink, halo) {
  for (let i = 0; i < R.w * R.h; i++) { const a = halo[i]; if (a) for (let c = 0; c < 3; c++) R.px[3 * i + c] *= 1 - a; }
  return composite(R, mask, ink);
}

// The smallest halo (strength first, then width) that brings every glyph to minRatio, with a 10% margin for the
// grain and flicker of other frames. The search grades a full-width strip around the line (halation radius depends on
// width only); callers check the answer on the full graded frame with glyphContrast.
export function solveLegible(src, mask, { target = MEASURED.ink, minRatio = 4.5, gradeParams = {}, seed = 'film', frame = 0 } = {}) {
  const { w, h } = src, cap = layout(w, h).capPx, rc = reachFor(w, h), ink = inkFor(target, gradeParams), parts = glyphParts(mask, w, h, rc);
  if (!parts.n) return { ink, halo: new Float32Array(w * h), opts: null, min: Infinity };
  const pad = Math.ceil(cap * 1.2), y0 = Math.max(0, parts.box[1] - pad), y1 = Math.min(h - 1, parts.box[3] + pad), sh = y1 - y0 + 1;
  const crop = A => A.slice(y0 * w, (y1 + 1) * w), cmask = crop(mask);
  const P = { n: parts.n, lab: crop(parts.lab), dist: crop(parts.dist), box: [parts.box[0], parts.box[1] - y0, parts.box[2], parts.box[3] - y0] };
  let best = null;
  for (const grow of [0.08, 0.12, 0.18, 0.26]) for (const strength of [0.55, 0.7, 0.85, 1]) {
    const opts = { grow: grow * cap, soft: 0.06 * cap + 0.6, strength }, halo = haloAlpha(mask, w, h, opts);
    const S = { w, h: sh, px: src.px.slice(3 * y0 * w, 3 * (y1 + 1) * w) };
    const G = grade(compositeLegible(S, cmask, ink, crop(halo)), gradeParams, { seed, frame });
    best = { ink, halo, opts, min: glyphContrast(G, cmask, { reach: rc, parts: P }).min };
    if (best.min >= minRatio * 1.1) return best;
  }
  return best;
}
