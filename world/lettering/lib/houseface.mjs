// lib/houseface.mjs: register the house display face from typeface/dist once it is built.
// Contract with the type agent (one file, dist/lettering.json):
//   { "id": "house-display", "family": "<CSS family>", "woff2": "<file in dist>", "weights": "100 900",
//     "skeletons": { "<char>": { "advance": <em>, "strokes": [[x, y, x, y, ...], ...] } } }
// Strokes are centre lines in em units, y up from the baseline (the type-forge skeletons are in x-height units, so
// the exporter scales by xh / unitsPerEm). If any character in a word has no skeleton, that word is thinned instead.
// Not called by the specimen until dist exists: a fetch of a missing file would log a 404 in the console.
import { registerFace, useFace } from './glyph.mjs';

export const DIST = new URL('../../typeface/dist/', import.meta.url).href;

export async function registerHouseFace({ use = true } = {}) {
  const r = await fetch(new URL('lettering.json', DIST));
  if (!r.ok) throw new Error(`lettering: house face not built yet (${r.status} for dist/lettering.json)`);
  const m = await r.json();
  if (!m.family || !m.woff2) throw new Error('lettering: dist/lettering.json needs family and woff2');
  const sk = m.skeletons || {};
  const face = registerFace({ id: m.id || 'house-display', family: m.family, url: new URL(m.woff2, DIST).href, weights: m.weights || '100 900', skeleton: Object.keys(sk).length ? ch => sk[ch] || null : undefined });
  if (use) useFace(face.id);
  return face;
}
