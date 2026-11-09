// lib/skel.mjs: the one skeleton every feed-30 rendering reads.
//
// A skeleton is { text, w, h, size, cov, sdf, strokes, glyphs, half }:
//   cov      Float32Array(w*h) ink coverage 0..1
//   sdf      Float32Array(w*h) signed distance to the letter edge in px, NEGATIVE inside (the type engine's rule)
//   strokes  [{ pts: [[x, y], ...], width (px), glyph (index), ch }] centre lines in reading order
//   glyphs   [{ ch, x0, x1 }] one per placed letter
//   half     the typical half stroke width in px
// Three sources give the same shape: the type engine's glyph context (accession face skeletons, node or browser),
// the lettering library's glyph (browser rendering plus thinning), and a bare mask (superframe glyphs port).
import { face } from '../../../typeengine/lib/faces.mjs';
import { glyphContext } from '../../../typeengine/lib/setline.mjs';
import { convert } from '../../../typeengine/lib/adapters.mjs';
import { make } from '../../../typeengine/lib/props.mjs';
import { buildGlyph } from '../../../lettering/lib/glyph.mjs';
import { components } from '../../../lettering/lib/fields.mjs';

/** Signed distance (negative inside) of a coverage array, through the type engine's adapter. */
export function sdfOf(cov, w, h) { return convert(make.coverage(w, h, Float32Array.from(cov)), 'field.sdf').data; }

/** From a type engine glyph context (lib/setline.mjs glyphContext). */
export function fromContext(g) {
  const strokes = [], glyphs = [];
  let k = 0;
  g.lay.placed.forEach((p, gi) => {
    glyphs.push({ ch: p.ch, x0: p.x, x1: p.x + p.g.advance * p.s });
    for (const s of p.g.skeleton) { if (s.length < 2) continue; const src = g.strokes.strokes[k++]; strokes.push({ pts: src.pts.map((q) => [q[0], q[1]]), width: src.width, glyph: gi, ch: p.ch }); }
  });
  const half = strokes.length ? median(strokes.map((s) => s.width / 2)) : 4;
  const m = g.face.metrics, zones = { baseline: g.baseline, xh: (m.xh / 1000) * g.size, cap: ((m.cap ?? m.xh * 1.4) / 1000) * g.size };
  return { text: g.text, w: g.w, h: g.h, size: g.size, zones, cov: g.coverage.data, sdf: g.sdf.data, strokes, glyphs, half, source: 'typeengine' };
}

/** Set text in the house face (accession) and read its skeleton. */
export function fromText(text, w, h, { style = 'display', weight = 700, fill = 0.84, tracking = 0, size = null } = {}) {
  return fromContext(glyphContext(face({ source: 'accession', style, weight }), text, w, h, { fill, tracking, size }));
}

/**
 * From a lettering-library glyph (lib/glyph.mjs buildGlyph). k scales work pixels to output pixels: the mask is
 * resampled bilinearly and the distance field rebuilt at the new size, so edges stay exact.
 */
export function fromLettering(g, k = 1) {
  const w = Math.round(g.w * k), h = Math.round(g.h * k), cov = k === 1 ? Float32Array.from(g.mask) : resample(g.mask, g.w, g.h, w, h);
  const { label, parts } = components(g.mask, g.w, g.h);
  const order = parts.slice().sort((a, b) => a.x0 - b.x0).map((p) => p.id), rank = new Map(order.map((id, i) => [id, i]));
  const strokes = g.strokes.filter((s) => s.pts.length >= 4).map((s) => {
    const pts = []; for (let i = 0; i < s.pts.length; i += 2) pts.push([s.pts[i] * k, s.pts[i + 1] * k]);
    const mx = Math.round(s.pts[(s.pts.length >> 2) * 2]), my = Math.round(s.pts[(s.pts.length >> 2) * 2 + 1]);
    const id = label[Math.max(0, Math.min(g.h - 1, my)) * g.w + Math.max(0, Math.min(g.w - 1, mx))];
    return { pts, width: 2 * g.half * k, glyph: rank.get(id) ?? 0, ch: '', dot: !!s.dot };
  });
  const glyphs = order.map((id) => { const p = parts[id - 1]; return { ch: '', x0: p.x0 * k, x1: p.x1 * k }; });
  const zones = { baseline: (g.baseline ?? estBaseline(g)) * k, xh: (g.xHeight ?? g.size * 0.5) * k, cap: (g.size ?? 100) * 0.7 * k };
  return { text: g.text ?? '', w, h, size: (g.size ?? 100) * k, zones, cov, sdf: sdfOf(cov, w, h), strokes, glyphs, half: g.half * k, source: 'lettering' };
}

// Baseline from the mask when the source does not give one: the most common bottom row of the letter parts.
function estBaseline(g) { const { parts } = components(g.mask, g.w, g.h); const b = parts.filter((p) => p.n > 20).map((p) => p.y1).sort((a, c) => a - c); return b.length ? b[b.length >> 1] : g.h * 0.75; }

/** From a bare mask (the superframe glyphs port): thinning through the lettering library. */
export function fromMask({ w, h, mask, text = '' }) { return fromLettering(buildGlyph({ w, h, mask, text }), 1); }

/** Replace a skeleton's coverage (after swashes or substitutions) and rebuild its distance field. */
export function withCoverage(sk, cov, extraStrokes = []) { return { ...sk, cov, sdf: sdfOf(cov, sk.w, sk.h), strokes: [...sk.strokes, ...extraStrokes] }; }

export function resample(f, w, h, W, H) {
  const out = new Float32Array(W * H), sx = w / W, sy = h / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = Math.max(0, Math.min(w - 1.001, (x + 0.5) * sx - 0.5)), fy = Math.max(0, Math.min(h - 1.001, (y + 0.5) * sy - 0.5)), x0 = fx | 0, y0 = fy | 0, u = fx - x0, v = fy - y0;
    out[y * W + x] = (f[y0 * w + x0] * (1 - u) + f[y0 * w + x0 + 1] * u) * (1 - v) + (f[(y0 + 1) * w + x0] * (1 - u) + f[(y0 + 1) * w + x0 + 1] * u) * v;
  }
  return out;
}

export const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

/** Arc lengths along a polyline. */
export function arcs(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; }

/** Unit tangent at the end of a polyline, averaged over about `reach` px, pointing outward. end: 0 start, 1 end. */
export function endTangent(pts, end, reach = 8) {
  const P = end ? pts : pts.slice().reverse(), e = P[P.length - 1];
  let k = P.length - 2; while (k > 0 && Math.hypot(e[0] - P[k][0], e[1] - P[k][1]) < reach) k--;
  const dx = e[0] - P[k][0], dy = e[1] - P[k][1], l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}
