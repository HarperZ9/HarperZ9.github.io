// lib/glyph.mjs: the glyph skeleton every technique builds from.
// A word is set in Hanken Grotesk by the browser (so the art and the real text node share one layout), read back
// as a coverage mask, and turned into fields: a signed distance, the centre-line strokes in reading order, the
// outline loops, the connected pieces, and an arc field (how far along the word each pixel's nearest stroke is).
// buildGlyph is pure and runs in node; rasterText and rasterElement need a canvas.
import { sdf, maxInside, contours, components } from './fields.mjs';
import { strokes, arcField, resample, length } from './skeleton.mjs';

// The skeleton source is pluggable. A face is { id, family, url, weights, skeleton? }:
//   family    the CSS family name the browser sets the word in (outlines come from the browser's own rendering);
//   url       a woff2 to load if the page has not declared the face;
//   weights   the CSS weight range, e.g. '100 900';
//   skeleton  optional: (char) => { advance, strokes: [[x, y, ...], ...] } in em units, y up from the baseline. When a face
//             ships its own stroke skeletons, they replace thinning (the mask, distance field and outline still come
//             from the rendered outlines, so every technique keeps working with no API change).
// Hanken Grotesk is the default until the house family in typeface lands; registerFace + useFace switch it.
const faces = new Map();
let current = null;
export function registerFace(face) { if (!face?.id || !face.family) throw new Error('lettering: a face needs id and family'); faces.set(face.id, face); if (!current) current = face; return face; }
export function useFace(id) { const f = faces.get(id); if (!f) throw new Error(`lettering: unknown face "${id}"`); current = f; fontReady = null; return f; }
export const currentFace = () => current;
registerFace({ id: 'hanken', family: 'Hanken Grotesk', url: new URL('../fonts/hanken-grotesk.woff2', import.meta.url).href, weights: '100 900' });
const familyCss = () => `"${current.family}", system-ui, sans-serif`;
export const FAMILY = familyCss();

let fontReady = null;
// Make sure the face is loaded before any mask is read; a fallback face would give the art the wrong letters.
export function ensureFont() {
  if (fontReady) return fontReady;
  if (typeof document === 'undefined' || !document.fonts) return (fontReady = Promise.resolve(false));
  const face = current;
  fontReady = (async () => {
    const has = [...document.fonts].some(f => f.family.replace(/"/g, '') === face.family && f.status === 'loaded');
    if (!has && face.url) { try { const f = new FontFace(face.family, `url(${face.url}) format("woff2")`, { weight: face.weights || '400' }); document.fonts.add(await f.load()); } catch (e) { console.error(`lettering: ${face.family} failed to load`, e); } }
    await document.fonts.load(`700 40px ${familyCss()}`); return true;
  })();
  return fontReady;
}

// Stroke skeletons from a face that ships them: lay each run's characters out with the browser's own advances.
// Returns null if any visible character lacks a skeleton, so the caller falls back to thinning the whole word.
function faceStrokes(face, runs) {
  const out = [], probe = mk(4, 4).getContext('2d');
  for (const r of runs) {
    probe.font = r.font; if ('letterSpacing' in probe) probe.letterSpacing = r.spacing;
    let prefix = '';
    for (const ch of r.text) {
      const x0 = r.x + probe.measureText(prefix).width, sk = face.skeleton(ch); prefix += ch;
      if (!sk) { if (ch.trim()) return null; continue; }
      for (const s of sk.strokes) { const pts = []; for (let i = 0; i < s.length; i += 2) pts.push(x0 + s[i] * r.em, r.y - s[i + 1] * r.em); out.push(pts); }
    }
  }
  return out;
}

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
function readMask(c) {
  const g = c.getContext('2d', { willReadFrequently: true }), d = g.getImageData(0, 0, c.width, c.height).data, m = new Float32Array(c.width * c.height);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
  return m;
}

// Set a string on its own. size is the CSS font size; scale is work pixels per CSS pixel.
export function rasterText(text, o = {}) {
  const size = o.size ?? 120, weight = o.weight ?? 700, scale = o.scale ?? 1, track = o.tracking ?? -0.02, pad = (o.pad ?? 0.22) * size;
  const font = `${o.italic ? 'italic ' : ''}${weight} ${size * scale}px ${familyCss()}`;
  const probe = mk(4, 4).getContext('2d'); probe.font = font; if ('letterSpacing' in probe) probe.letterSpacing = `${track * size * scale}px`;
  const m = probe.measureText(text), asc = m.fontBoundingBoxAscent ?? size * scale * 0.95, desc = m.fontBoundingBoxDescent ?? size * scale * 0.25;
  const w = Math.ceil(m.width + 2 * pad * scale), h = Math.ceil(asc + desc + 2 * pad * scale), c = mk(w, h), g = c.getContext('2d');
  g.font = font; if ('letterSpacing' in g) g.letterSpacing = `${track * size * scale}px`; g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
  g.fillText(text, pad * scale, pad * scale + asc);
  const runs = [{ text, x: pad * scale, y: pad * scale + asc, em: size * scale, font, spacing: `${track * size * scale}px` }];
  return { runs, w, h, mask: readMask(c), scale, size, text, baseline: pad * scale + asc, xHeight: size * scale * 0.5, cssWidth: w / scale, cssHeight: h / scale, pad };
}

// Set an element's own words where the browser placed them, so the art sits exactly under the real, selectable text.
// pad (CSS px) is the bleed around the box, for shadows and for chains crawling in from outside.
export function rasterElement(el, o = {}) {
  const box = el.getBoundingClientRect(), cs = getComputedStyle(el), scale = o.scale ?? 1, pad = o.pad ?? Math.round(parseFloat(cs.fontSize) * 0.22);
  const w = Math.ceil((box.width + 2 * pad) * scale), h = Math.ceil((box.height + 2 * pad) * scale), c = mk(w, h), g = c.getContext('2d');
  g.scale(scale, scale);
  g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
  g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
  const met = g.measureText('Hg'), asc = met.fontBoundingBoxAscent, desc = met.fontBoundingBoxDescent;
  // Where layout put the baseline, read from layout itself: a zero-size inline-block probe sits on the baseline.
  // Canvas fontBoundingBox metrics and the CSS content area disagree for some faces (Mint Deco, and the
  // Accession Display masthead in the studio measured the art drawn above its box), so the canvas metric is
  // only a fallback. Fixed 2026-10-23 (quality pass); before and after in 2026-10-23-quality/fixes/lettering/.
  let baseOff = null;
  {
    const first = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(), probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
    probe.setAttribute('aria-hidden', 'true');
    if (first && first.data.trim()) {
      const i = first.data.search(/\S/), r0 = document.createRange(); r0.setStart(first, i); r0.setEnd(first, i + 1);
      const fr = r0.getClientRects()[0];
      const after = first.splitText(i); first.parentNode.insertBefore(probe, after);
      const pr = probe.getBoundingClientRect();
      probe.remove(); first.parentNode.normalize();
      if (fr && Math.abs(pr.top - fr.top) < fr.height * 2) baseOff = pr.top - fr.top;   // baseline below the content-area top
    }
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), runs = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement && n.parentElement.closest('[aria-hidden="true"]')) continue;
    for (const m of n.data.matchAll(/\S+/g)) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const rect = r.getClientRects()[0]; if (!rect) continue;
      const half = (rect.height - (asc + desc)) / 2;
      const x = rect.left - box.left + pad, y = rect.top - box.top + (baseOff ?? half + asc) + pad;
      g.fillText(m[0], x, y);
      runs.push({ text: m[0], x: x * scale, y: y * scale, em: parseFloat(cs.fontSize) * scale, font: `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`, spacing: cs.letterSpacing === 'normal' ? '0px' : `${parseFloat(cs.letterSpacing) * scale}px` });
    }
  }
  const size = parseFloat(cs.fontSize);
  return { runs, w, h, mask: readMask(c), scale, size, text: el.textContent.trim(), xHeight: size * scale * 0.5, cssWidth: box.width + 2 * pad, cssHeight: box.height + 2 * pad, pad };
}

// Fields from a mask. Everything heavy is computed once here or lazily on first use.
export function buildGlyph(r, o = {}) {
  const { w, h, mask } = r, d = sdf(mask, w, h), heavy = maxInside(d);
  const face = typeof o.face === 'string' ? faces.get(o.face) : (o.face ?? current);
  const own = face?.skeleton && r.runs && typeof document !== 'undefined' ? faceStrokes(face, r.runs) : null;
  const list = own ? orderStrokes(own) : strokes(mask, d, w, h, { half: heavy * 0.8, ...o.skeleton });
  // typical half stroke: the sdf sampled along the centre lines (joins excluded by the median)
  const samples = []; for (const s of list) for (let i = 0; i < s.pts.length; i += 6) { const x = Math.round(s.pts[i]), y = Math.round(s.pts[i + 1]); if (x >= 0 && y >= 0 && x < w && y < h) samples.push(d[y * w + x]); }
  samples.sort((a, b) => a - b);
  const half = samples.length ? Math.max(1, samples[samples.length >> 1]) : heavy;
  let _arc, _loops, _parts, _bbox;
  const g = {
    ...r, sdf: d, half, heavy, strokes: list,
    get arc() { return _arc || (_arc = arcField(list, w, h)); },
    get loops() { return _loops || (_loops = contours(mask, w, h)); },
    get parts() { return _parts || (_parts = components(mask, w, h)); },
    get bbox() {
      if (_bbox) return _bbox; let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return (_bbox = { x0, y0, x1, y1 });
    },
    get total() { return list.reduce((a, s) => a + s.len, 0); },
  };
  return g;
}

// Face-supplied strokes get the same reading order and arc bookkeeping as thinned ones.
function orderStrokes(polys) {
  const out = polys.filter(p => p.length >= 4).map(pts => ({ pts: resample(pts, 1.5), closed: false }));
  for (const s of out) { let mx = Infinity; for (let i = 0; i < s.pts.length; i += 2) mx = Math.min(mx, s.pts[i]); s.minX = mx; }
  out.sort((a, b) => a.minX - b.minX);
  let acc = 0; for (const s of out) { s.len = length(s.pts); s.start = acc; acc += s.len; }
  return out;
}

// Convenience: a glyph from a string (browser).
export async function glyphFromText(text, o = {}) { await ensureFont(); return buildGlyph(rasterText(text, o), o); }
export async function glyphFromElement(el, o = {}) { await ensureFont(); await document.fonts.ready; return buildGlyph(rasterElement(el, o), o); }
