// lanes/image.mjs: a material as a compositor picture. Plates stack in linear light on the feed set 25
// compositor (Layer.place with blend modes), the word lies in as a mask, registration marks sit on the grid
// module (QUALITY-SPEC C2), and grain plus TPDF dither happen once, at export (R2, R4).
//
//   const L = renderImage(material, { w: 1280, h: 800, seed: 4, mask, drive, time, dpr: 2 });
//   const rgba = toRGBA(L, material, { dpr: 2 })      // Uint8ClampedArray, ready for ImageData or PNG
import { Layer, colour, hud, grainField } from '../../../feed-25/build/compose.mjs';
import { normalize } from '../schema.mjs';
import { fitMask } from '../field.mjs';
import * as S from '../plates-surface.mjs';
import * as P from '../plates-matter.mjs';
import * as O from '../plates-optics.mjs';

export const PLATE_FNS = Object.freeze({
  relief: S.relief, droplets: S.droplets, film: S.film, chladni: S.chladni, hatch: S.hatch, noise: S.noise,
  fibre: P.fibre, strands: P.strands, sunburst: P.sunburst, blocks: P.blocks, brush: P.brush, liquid: P.liquid, codecells: P.codecells,
  glass: O.glass, crt: O.crtPlate, water: O.water,
});
// Plates that draw the word themselves; the others get it laid over as ink.
const USES_MASK = new Set(['relief', 'droplets', 'film', 'chladni', 'hatch', 'fibre', 'strands', 'sunburst', 'blocks', 'brush', 'liquid', 'glass', 'crt', 'water']);

// unitPx: pixels per thousandth of the width. Default w / 1000 (the picture as a whole); a swatch passes a fixed
// unit so it shows a crop of the material at true scale instead of the whole picture shrunk.
export function renderImage(material, { w = 640, h = 400, seed = 1, mask = null, drive = null, time = 1, marks = true, unitPx = null } = {}) {
  const m = normalize(material);
  if (!(w >= 8 && h >= 8)) throw new RangeError(`image: size must be at least 8 x 8, got ${w} x ${h}`);
  const M = fitMask(mask, w, h), ctx = { seed, mask: M, u: unitPx ?? w / 1000, drive, time };
  const sheet = new Layer(w, h, { seed }).fill(m.hints.image.plates[0]?.palette?.ground ?? m.palette.ground);
  // a drive's plates lie over the material's own as overlays (transparent where they leave the sheet bare),
  // unless the material already has that plate, which then takes the drive's input directly
  const own = new Set(m.hints.image.plates.map(p => p.kind));
  const plates = [...m.hints.image.plates, ...(drive?.plates ?? []).filter(p => !own.has(p.kind)).map(p => ({ ...p, overlay: true }))];
  let drewWord = false;
  plates.forEach((pl, k) => {
    const fn = PLATE_FNS[pl.kind]; if (!fn) throw new Error(`image: unknown plate ${pl.kind}`);
    // a blended plate keeps the palette of the material it came from; the core numbers are the blend's
    const L = fn(w, h, pl.palette ? { ...m, palette: pl.palette } : m, { ...ctx, overlay: !!pl.overlay, seed: seed * 1009 + k * 31 + 1 });
    sheet.place(L, 0, 0, { mode: pl.mode, opacity: pl.opacity });
    if (USES_MASK.has(pl.kind) && pl.opacity > 0.5) drewWord = true;
  });
  if (M && !drewWord) sheet.place(new Layer(w, h).fill(m.palette.ink), 0, 0, { mask: M, opacity: 0.92 });
  if (marks) drawMarks(sheet, m, ctx);
  sheet.meta.layers = 1 + plates.length + (M ? 1 : 0) + (marks ? 1 : 0) + (m.core.grainStd > 0 ? 1 : 0);
  return sheet;
}

// Registration marks on the 1/9 module corners, and a short ruler on the baseline: the mono label layer of C2.
function drawMarks(S, m, { u }) {
  const ink = m.palette.ink, mod = S.w / 9, size = Math.max(3, 7 * u * 1.4), lw = Math.max(1, 1.2 * u);
  for (const [gx, gy] of [[1, 1], [8, 1], [1, 0], [8, 0]]) {
    const x = Math.round(gx * mod), y = gy === 1 ? Math.round(mod * 0.6) : Math.round(S.h - mod * 0.6);
    hud.crosshair(S, x, y, size, { w: lw, ink, gap: size * 0.35, alpha: 0.55 });
  }
  hud.ruler(S, Math.round(mod * 1.5), Math.round(S.h - mod * 0.6), Math.round(mod * 1.5), { step: Math.max(4, mod / 10), major: 5, tick: size * 0.5, long: size, w: lw, ink, up: true });
}

// Export to 8-bit sRGB with the material's grain (std in display units, correlation width scaled by dpr) and TPDF dither.
export function toRGBA(L, material, { dpr = 1 } = {}) {
  const c = normalize(material).core;
  return L.out({ grain: c.grainStd > 0 ? { std: c.grainStd, size: c.grainPx * dpr, mono: true } : null, dither: true });
}

// 16-bit sRGB master (QUALITY-SPEC O1: the tool renders in float, so the still keeps 16 bits). Same grain field
// as toRGBA, then a TPDF dither of one 16-bit code value. Uint16Array RGBA, alpha 65535.
export function toRGBA16(L, material, { dpr = 1 } = {}) {
  const c = normalize(material).core, n = L.w * L.h, o = new Uint16Array(n * 4);
  const r = rng16(L.seed ^ 0x9e3779b9), G = c.grainStd > 0 ? grainField(L.w, L.h, c.grainPx * dpr, r) : null;
  for (let i = 0; i < n; i++) {
    const g = G ? G[i] * c.grainStd : 0;
    for (let ch = 0; ch < 3; ch++) {
      const lin = L.px[3 * i + ch], s = lin <= 0.0031308 ? 12.92 * Math.max(0, lin) : 1.055 * Math.pow(Math.min(1, lin), 1 / 2.4) - 0.055;
      const v = (s + g) * 65535 + (r() - r());
      o[4 * i + ch] = v < 0 ? 0 : v > 65535 ? 65535 : Math.round(v);
    }
    o[4 * i + 3] = 65535;
  }
  return o;
}
function rng16(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Mean luma and SD of an RGBA buffer: a cheap read-back for goldens and for the visual-to-audio driver.
export function stats(rgba) {
  let s = 0, s2 = 0; const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) { const y = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255; s += y; s2 += y * y; }
  const mean = s / n; return { mean: +mean.toFixed(4), sd: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(4) };
}
export { colour };
