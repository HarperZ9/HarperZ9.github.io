// lib/paint.mjs: small shared helpers for the technique modules: seeded randomness, colour, ribbons, SVG, images.
export { rng, fbm, valueNoise, hash2, clamp, lerp, smoothstep } from '../../techniques/lib/util.js';

// FNV-1a over the string: a stable default seed per (technique, text).
export function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function parseColor(c) {
  c = String(c).trim();
  if (c[0] === '#') { const n = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7); return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]; }
  const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
}
export const rgba = (c, a = 1) => { const [r, g, b] = parseColor(c); return `rgba(${r},${g},${b},${a})`; };
export const mix = (a, b, t) => { const A = parseColor(a), B = parseColor(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };

// A variable-width ribbon along a polyline [x,y,...] with half-widths hw[i]. One fill per stroke.
export function ribbon(ctx, pts, hw, k = 1) {
  const n = pts.length / 2; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = pts[2 * b] - pts[2 * a], dy = pts[2 * b + 1] - pts[2 * a + 1], l = Math.hypot(dx, dy) || 1, w = (typeof hw === 'number' ? hw : hw[i]) * k;
    L.push(pts[2 * i] * k - (dy / l) * w, pts[2 * i + 1] * k + (dx / l) * w); R.push(pts[2 * i] * k + (dy / l) * w, pts[2 * i + 1] * k - (dx / l) * w);
  }
  ctx.moveTo(L[0], L[1]); for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
  for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
  ctx.closePath();
}
// The same ribbon as an SVG path d string.
export function ribbonD(pts, hw, p = 1) {
  const n = pts.length / 2; if (n < 2) return '';
  const L = [], R = [], f = v => v.toFixed(p);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = pts[2 * b] - pts[2 * a], dy = pts[2 * b + 1] - pts[2 * a + 1], l = Math.hypot(dx, dy) || 1, w = typeof hw === 'number' ? hw : hw[i];
    L.push(`${f(pts[2 * i] - (dy / l) * w)} ${f(pts[2 * i + 1] + (dx / l) * w)}`); R.push(`${f(pts[2 * i] + (dy / l) * w)} ${f(pts[2 * i + 1] - (dx / l) * w)}`);
  }
  return `M${L.join('L')}L${R.reverse().join('L')}Z`;
}
export const polyD = (pts, close = false, p = 1) => { let s = ''; for (let i = 0; i < pts.length; i += 2) s += (i ? 'L' : 'M') + pts[i].toFixed(p) + ' ' + pts[i + 1].toFixed(p); return close ? s + 'Z' : s; };
export const svgEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function svgDoc(g, body, { title = g.text, ground = null, defs = '' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.w} ${g.h}" role="img"><title>${svgEsc(title)}</title>${defs ? `<defs>${defs}</defs>` : ''}${ground ? `<rect width="${g.w}" height="${g.h}" fill="${ground}"/>` : ''}${body}</svg>`;
}

// Images from the cleared archive in the techniques folder (see CREDITS.md there). Cached per URL.
const imgs = new Map();
export const ASSETS = new URL('../../techniques/assets/', import.meta.url).href;
export function image(name) {
  const url = new URL(name, ASSETS).href;
  if (!imgs.has(url)) imgs.set(url, new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error('lettering: image failed to load: ' + url)); im.src = url; }));
  return imgs.get(url);
}
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

// A cached layer: draw once into an offscreen canvas at device resolution, then a frame is one blit.
export function layer(g, k, paint) { const c = canvas(g.w * k, g.h * k), x = c.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0); paint(x); return c; }
export function blit(ctx, c, g) { ctx.drawImage(c, 0, 0, g.w, g.h); }
