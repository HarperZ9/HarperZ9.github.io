// lettering24.js: display lettering built from this set's own techniques, for the shell's slots.
//   construct: the words as square cells on a pitch grid, cell brightness from glyph coverage,
//              with stray cells thrown off the edges (the dot-matrix figure of the construction plate).
//   hamming:   the words filled with the exact Hamming field, one bit-distance per block, value as
//              lightness of the slot's own ink (letters made of bits).
// The real text stays in the DOM; this draws the same words where the browser placed them.
import { rasterElement } from '../../lettering/lib/glyph.mjs';
import { popcount32 } from './hamming.js';
import { rng } from './raster.js';

const find = (text, technique) => [...document.querySelectorAll(`[data-display="${technique}"]`)].find(el => el.textContent.trim() === text);
const parse = c => { const m = c.match(/\d+(\.\d+)?/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };

export async function letter(text, technique, opts) {
  if (technique !== 'construct' && technique !== 'hamming') throw new Error(`lettering24: no technique "${technique}"`);
  const el = find(text, technique); if (!el) throw new Error(`lettering24: slot "${text}" not found`);
  await document.fonts.ready;
  const dpr = Math.min(3, window.devicePixelRatio || 1), r = rasterElement(el, { scale: dpr, pad: 0 });
  const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
  c.style.width = `${r.cssWidth}px`; c.style.height = `${r.cssHeight}px`;
  const space = 'display-p3';   // QUALITY-SPEC R5: a p3 store holds sRGB pixels exactly; the ImageData below is tagged srgb
  const g = c.getContext('2d', { colorSpace: space }), img = new ImageData(r.w, r.h, { colorSpace: 'srgb' }), d = img.data, [ir, ig, ib] = parse(opts.ink || 'rgb(20,20,20)');
  const set = (x, y, a) => { if (x < 0 || y < 0 || x >= r.w || y >= r.h) return; const o = 4 * (y * r.w + x); d[o] = ir; d[o + 1] = ig; d[o + 2] = ib; d[o + 3] = Math.max(d[o + 3], Math.round(255 * a)); };
  if (technique === 'hamming') {
    const b = Math.max(2, Math.round(r.size * dpr / 34));                     // block side in device px
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const m = r.mask[y * r.w + x]; if (m <= 0) continue;
      const h = popcount32(((x / b) | 0) ^ ((y / b) | 0)) % 9;            // 0..8 over a title's span
      set(x, y, m * (0.28 + 0.72 * (1 - h / 8)));
    }
  } else {
    // cells sit on a fractional pitch and are filled by exact box coverage, so their edges are antialiased
    const p = Math.max(3, r.size * dpr / 15), s = p * 0.8, R = rng(r.text.length * 131 + 7);
    const cell = (x0, y0, a) => {
      for (let y = Math.floor(y0); y < Math.ceil(y0 + s); y++) { const cy = Math.min(y + 1, y0 + s) - Math.max(y, y0); if (cy <= 0) continue;
        for (let x = Math.floor(x0); x < Math.ceil(x0 + s); x++) { const cx = Math.min(x + 1, x0 + s) - Math.max(x, x0); if (cx > 0) set(x, y, a * cx * cy); } }
    };
    for (let gy = 0; gy * p < r.h; gy++) for (let gx = 0; gx * p < r.w; gx++) {
      const cx = gx * p, cy = gy * p; let cov = 0, n = 0;
      for (let y = Math.floor(cy); y < Math.min(r.h, Math.floor(cy + p)); y++) for (let x = Math.floor(cx); x < Math.min(r.w, Math.floor(cx + p)); x++) { cov += r.mask[y * r.w + x]; n++; }
      cov /= n || 1;
      const edge = cov > 0.08 && cov < 0.6, on = cov >= 0.45 - 0.2 * (R() - 0.5);
      if (!on && !(edge && R() < 0.18)) continue;
      const a = on ? 0.55 + 0.45 * Math.min(1, cov) * (0.75 + 0.25 * R()) : 0.35, dx = on ? 0 : Math.round((R() - 0.5) * 2) * p, dy = on ? 0 : Math.round((R() - 0.5) * 2) * p;
      cell(cx + dx + (p - s) / 2, cy + dy + (p - s) / 2, a);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
