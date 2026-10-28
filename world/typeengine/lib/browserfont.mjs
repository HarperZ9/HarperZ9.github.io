// lib/browserfont.mjs: a font file written in the browser with no build step, through the site's own TrueType
// writer (system/type-forge/ttf.mjs). Quadratic contours are flattened to on-curve polygons (6 steps per curve),
// kerning goes into a kern table. It holds the outline only: no features, no variation, no colour. The full build
// (features, axes, COLRv1, pattern cuts) is build/emit.py.
import { toTTF } from '../../typeface/forge/upstream/type-forge/ttf.mjs';
import { contourToPolyline } from '../../superframe/lib/fill.mjs';

export function faceToTTF(face, family, chars = face.chars) {
  const glyphs = {}, kerning = {};
  for (const ch of chars) {
    if ([...ch].length !== 1 || ch === ' ') continue;
    const g = face.glyph(ch); if (!g) continue;
    const contours = g.contours.map((c) => { const p = g.quad ? contourToPolyline(c, (q) => q, 6) : c.pts.slice(0, -1); return [...p, p[0]]; }).filter((r) => r.length > 3);
    let x0 = Infinity; for (const r of contours) for (const [x] of r) x0 = Math.min(x0, x);
    glyphs[ch] = { contours, advance: g.advance, lsb: Number.isFinite(x0) ? x0 : 0 };
  }
  const ks = Object.keys(glyphs);
  const kk = ks.filter((c) => /[A-Za-z0-9.,:;'"()-]/.test(c));
  for (const a of kk) for (const b of kk) { const v = face.kern(a, b); if (v) kerning[a + b] = v; }
  return toTTF({ glyphs, kerning, metrics: { x_height: face.metrics.xh } }, family, 'Regular');
}
