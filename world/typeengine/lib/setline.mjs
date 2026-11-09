// lib/setline.mjs: set a line of text from a face into a w x h frame and read the letter's base properties:
// coverage (nonzero fill of the pen's outlines), the signed distance, the centre-line strokes, and per-character
// spans. This is the glyph context every material binding starts from. Pure; runs in node and the browser.
import { fillNonzero, contourToPolyline } from '../../superframe/lib/fill.mjs';
import { make } from './props.mjs';
import { convert } from './adapters.mjs';

/**
 * layout(face, text, { size, x, baseline, tracking }) -> placed glyphs in px, y down.
 * size is px per em; tracking in em. Missing characters advance by 0.3 em and are listed.
 */
export function layout(face, text, { size = 100, x = 0, baseline = 100, tracking = 0 } = {}) {
  const s = size / face.upm, placed = [], missing = [];
  let pen = x, prev = null;
  for (const ch of String(text)) {
    if (ch === ' ') { pen += 0.26 * size; prev = null; continue; }
    const g = face.glyph(ch);
    if (!g) { missing.push(ch); pen += 0.3 * size; prev = null; continue; }
    if (prev) pen += face.kern(prev, ch) * s;
    placed.push({ ch, g, x: pen, s, baseline });
    pen += g.advance * s + tracking * size; prev = ch;
  }
  return { placed, width: pen - x, missing, size };
}

const toPx = (p) => ([cx, cy]) => [p.x + cx * p.s, p.baseline - cy * p.s];

export function outlinesPx(lay, n = 6) {
  const polys = [];
  for (const p of lay.placed) for (const c of p.g.contours) {
    const poly = p.g.quad ? contourToPolyline(c, toPx(p), n) : c.pts.map(toPx(p));
    if (poly.length > 2) polys.push(poly);
  }
  return polys;
}

export function skeletonPx(lay, w, h, widthShare = 1) {
  const strokes = [];
  for (const p of lay.placed) for (const s of p.g.skeleton) {
    if (s.length < 2) continue;
    strokes.push({ pts: s.map(toPx(p)), width: Math.max(0.8, p.g.stem * p.s * widthShare), ch: p.ch });
  }
  return make.strokes(w, h, strokes);
}

/**
 * Fit text into a frame (centred, `fill` share of the width or height, whichever binds) and return the context:
 * { text, w, h, size, baseline, coverage, sdf, strokes, spans, missing, face }.
 */
export function glyphContext(face, text, w, h, { fill = 0.8, size = null, tracking = 0, align = 'center' } = {}) {
  const probe = layout(face, text, { size: 100, tracking });
  const capH = (face.metrics.cap ?? face.metrics.xh * 1.4) / face.upm;
  const sz = size ?? Math.min((w * fill) / Math.max(1, probe.width / 100), (h * fill) / Math.max(0.5, capH + 0.25));
  const width = probe.width * sz / 100, x = align === 'left' ? (w - w * fill) / 2 : (w - width) / 2;
  const baseline = Math.round(h / 2 + (capH * sz) / 2);
  const lay = layout(face, text, { size: sz, x, baseline, tracking });
  const cov = make.coverage(w, h, fillNonzero(outlinesPx(lay), w, h));
  const spans = lay.placed.map((p) => ({ ch: p.ch, x0: p.x, x1: p.x + p.g.advance * p.s }));
  return { text, w, h, size: sz, baseline, x, width, coverage: cov, strokes: skeletonPx(lay, w, h), spans, missing: lay.missing, face, lay,
    get sdf() { return this._sdf ?? (this._sdf = convert(cov, 'field.sdf')); } };
}
