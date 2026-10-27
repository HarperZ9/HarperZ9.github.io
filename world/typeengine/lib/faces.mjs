// lib/faces.mjs: skeleton sources. A face gives, per character, the advance, the outline the pen drew and the centre
// lines the pen travelled, all in font units (1000 per em, y up from the baseline).
//
//   accession   the house family's forge (typeface/forge/family): style, weight, an optional skeleton cut
//               (stencil, slab, runic) and `extra`, which overrides any construction number of the style context
//               (n: bowl squareness, ap: aperture, wd: width, xh: x-height, C: contrast, V: stem). Read-only import.
//   zain-mint   the site's first type forge (system/type-forge, the old Studio's Type forge source), with its own
//               parameters (weight, contrast, width, x_height, roundness, aperture, style). Kept so old presets
//               and projects open onto the same face they were saved with.
import { mintMaster } from '../../typeface/forge/family/family.mjs';
import { flatten } from '../../typeface/forge/family/svg.mjs';
import { STYLES } from '../../typeface/forge/family/styles.mjs';
import { mint as zainMint, DEFAULTS as ZAIN_DEFAULTS } from '../../typeface/forge/upstream/type-forge/forge.mjs';
import { build as zainSkeletons } from '../../typeface/forge/upstream/type-forge/skeletons.mjs';

export const FACE_SOURCES = Object.freeze(['accession', 'zain-mint']);
export { ZAIN_DEFAULTS };
const cache = new Map();
const memo = (key, f) => { if (!cache.has(key)) { cache.set(key, f()); if (cache.size > 48) cache.delete(cache.keys().next().value); } return cache.get(key); };

function skeletonOf(glyphs, name, dx = 0, dy = 0, depth = 0) {
  const g = glyphs[name]; if (!g || depth > 4) return [];
  const own = (g.skeleton || []).map((s) => s.map(([x, y]) => [x + dx, y + dy]));
  for (const c of g.components || []) own.push(...skeletonOf(glyphs, c.name, dx + c.dx, dy + c.dy, depth + 1));
  return own;
}

function accession({ style = 'display', weight, cut = null, extra = {} } = {}) {
  const st = STYLES[style]; if (!st) throw new Error(`faces: unknown accession style ${style}`);
  const wt = Math.max(st.axis[0], Math.min(st.axis[1], weight ?? st.default));
  const key = JSON.stringify(['acc', style, Math.round(wt), cut, extra]);
  return memo(key, () => {
    const m = mintMaster(style, wt, { cut: cut || undefined, extra });
    const byChar = new Map();
    for (const [n, g] of Object.entries(m.glyphs)) if (g.unicode && !g.mark) byChar.set(String.fromCodePoint(g.unicode), n);
    const k = m.k;
    return {
      source: 'accession', id: `accession/${style}/${Math.round(wt)}${cut ? '/' + cut : ''}`, upm: 1000,
      metrics: { xh: k.xh, cap: k.cap, asc: k.asc, desc: k.desc, stem: k.V, contrast: k.C },
      chars: [...byChar.keys()], master: m,
      glyph(ch) {
        const n = byChar.get(ch); if (!n) return null;
        const g = m.glyphs[n];
        return { name: n, advance: g.advance, contours: flatten(m.glyphs, n), quad: true, skeleton: skeletonOf(m.glyphs, n), stem: k.V };
      },
      kern(a, b) { const na = byChar.get(a), nb = byChar.get(b); return (na && nb && m.kerning[`${na} ${nb}`]) || m.kerning[`${na}/${nb}`] || 0; },
    };
  });
}

function zain(params = {}) {
  const p = { ...ZAIN_DEFAULTS };
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null && k in ZAIN_DEFAULTS) p[k] = +v;
  if (params.style) p.style = String(params.style);
  const key = JSON.stringify(['zain', p]);
  return memo(key, () => {
    const face = zainMint(p, 58);
    if (face.refused) return { source: 'zain-mint', refused: true, refusals: face.refusals, chars: [], glyph: () => null, kern: () => 0, metrics: { xh: face.metrics.x_height } };
    const xh = face.metrics.x_height, wv = p.weight * 1000, sk = zainSkeletons(p);
    return {
      source: 'zain-mint', id: `zain-mint/${JSON.stringify(params)}`, upm: 1000, refused: false,
      metrics: { xh, cap: xh * 1.4, asc: xh * (p.ascender ?? 1.5), desc: -xh * 0.5, stem: wv, contrast: p.contrast },
      chars: Object.keys(face.glyphs),
      glyph(ch) {
        const g = face.glyphs[ch]; if (!g) return null;
        let inkMin = Infinity; for (const r of g.contours) for (const [x] of r) inkMin = Math.min(inkMin, x);
        const strokes = (sk[ch]?.strokes ?? []).map((s) => s.pts.map(([x, y]) => [x * xh, y * xh * (['bowl', 'dot', 'spine'].includes(s.role) ? 1 + p.overshoot : 1)]));
        let sMin = Infinity; for (const s of strokes) for (const [x] of s) sMin = Math.min(sMin, x);
        const dx = Number.isFinite(sMin) ? inkMin - (sMin - wv / 2) : 0;
        return { name: ch, advance: g.advance, contours: g.contours.map((r) => ({ pts: r, on: r.map(() => true) })), quad: false, skeleton: strokes.map((s) => s.map(([x, y]) => [x + dx, y])), stem: wv };
      },
      kern(a, b) { return face.kerning[a + b] || 0; },
    };
  });
}

/** Resolve a skeleton reference to a face. ref: { source, ...params }. */
export function face(ref = {}) {
  const src = ref.source ?? 'accession';
  if (src === 'accession') return accession(ref);
  if (src === 'zain-mint') return zain(ref.params ?? ref);
  throw new Error(`faces: unknown skeleton source "${src}" (one of ${FACE_SOURCES.join(', ')})`);
}
