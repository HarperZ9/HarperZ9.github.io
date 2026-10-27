// plates-optics.mjs: glass, CRT signal and shore water as studio plates (w, h, material, ctx) -> Layer. The physics
// lives in ../../glass/ (glass.js, crt.js, liquid.js); these plates map the material's core onto it.
//   glass: relief -> thickness, line -> reed depth, order -> reed pitch, sheen -> thin-film coat, particles -> dispersion
//   crt:   order -> content (static, card, bars), noise -> snow, tension -> tear and roll, line -> aperture mask
//   water: flow -> ripple strength, particles -> drops, sheen -> sun glitter; the word stands in the water and reflects
import { Layer, colour } from '../../feed-25/build/compose.mjs';
import { renderGlass, fromMask, flute, maskFromSdf, sd } from '../../glass/glass.js';
import { crt, signal, display } from '../../glass/crt.js';
import { Water, renderShore } from '../../glass/liquid.js';
import { raster, mix } from '../../glass/lib/raster.js';

const toLayer = (R, seed) => { const L = new Layer(R.w, R.h, { seed }); for (let i = 0; i < R.w * R.h; i++) for (let c = 0; c < 3; c++) L.px[i * 3 + c] = Math.min(0.985, Math.max(0, R.data[i * 4 + c])); return L; };
const wordOr = (ctx, w, h, f) => ctx.mask ?? maskFromSdf(w, h, f);

// What the glass looks through: the material's ink ruled across its ground at lineDeg, with one accent band.
function ruled(w, h, m) {
  const R = raster(w, h), g = colour(m.palette.ground), ink = colour(m.palette.ink), acc = colour(m.palette.accent);
  const a = (m.core.lineDeg ?? 45) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), pitch = Math.max(4, w / 60);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (x * ca + y * sa) / pitch, f = s - Math.floor(s), on = f < 0.18 ? 1 : 0, band = Math.abs(y / h - 0.62) < 0.06 ? 1 : 0;
    const c = band ? acc : on ? ink : g; R.data.set([c[0], c[1], c[2], 1], (y * w + x) * 4);
  }
  return R;
}

export function glass(w, h, m, ctx) {
  const c = m.core, M = wordOr(ctx, w, h, (x, y) => sd.circle(x, y, w / 2, h / 2, Math.min(w, h) * 0.32));
  let b = fromMask(M, w, h, { radius: (0.01 + 0.04 * c.relief) * h, thickness: (0.02 + 0.08 * c.relief) * h });
  if (c.line > 0) b = flute(b, { pitch: Math.max(2, (0.006 + 0.02 * (1 - c.order)) * w), depth: c.line * 0.004 * h });
  const film = c.sheen > 0 ? { minNm: c.filmMinNm, maxNm: c.filmMaxNm, amount: c.sheen } : null;
  const out = renderGlass(ruled(w, h, m), b, { glass: 'crown', spread: 0.5 + 2 * c.particles, gap: 0.08 * h, film, tint: m.palette.accent, density: 0.15,
    env: { zenith: m.palette.ink, horizon: m.palette.ground, ground: '#050506' }, caustic: { strength: 0.8, light: [0.12, -0.2], blur: 1 } });
  return toLayer(out, ctx.seed);
}

export function crtPlate(w, h, m, ctx) {
  const c = m.core, content = ctx.mask ? 'source' : c.order > 0.66 ? 'bars' : c.order > 0.33 ? 'card' : 'static';
  let source = null;
  if (ctx.mask) { const g = colour(m.palette.ground), ink = colour(m.palette.ink); source = raster(w, h); for (let i = 0; i < w * h; i++) { const a = ctx.mask[i]; source.data.set([mix(g[0], ink[0], a), mix(g[1], ink[1], a), mix(g[2], ink[2], a), 1], i * 4); } }
  const sig = signal({ content, source, lines: Math.max(24, Math.min(240, Math.round(h / 2))), samples: Math.max(64, Math.min(640, w)), snow: 0.02 + 0.3 * c.noise,
    tear: 0.03 * c.tension, roll: 0.2 * c.tension, t: ctx.time ?? 1, seed: ctx.seed });
  return toLayer(display(sig, w, h, { mask: 0.1 + 0.25 * c.line, pitch: Math.max(2, Math.round(3 * (ctx.u ?? 1))), halation: 0.08 + 0.1 * c.brightness }), ctx.seed);
}

export function water(w, h, m, ctx) {
  const c = m.core, g = colour(m.palette.ground), acc = colour(m.palette.accent), ink = colour(m.palette.ink), yh = 0.55;
  const above = raster(w, h);
  for (let y = 0; y < h; y++) { const t = Math.min(1, y / (yh * h)); for (let x = 0; x < w; x++) above.data.set([mix(g[0], acc[0], t ** 2), mix(g[1], acc[1], t ** 2), mix(g[2], acc[2], t ** 2), 1], (y * w + x) * 4); }
  const sea = new Water({ nx: 128, ny: 128, seed: ctx.seed, damping: 0.006 }).rain(Math.round(4 + 30 * c.particles), { amp: [-0.5 * c.flow - 0.05, -0.05] }).step(40);
  const objects = [];
  if (ctx.mask) {
    const layer = raster(w, h); let ymax = 0;
    for (let i = 0; i < w * h; i++) if (ctx.mask[i] > 0.5) ymax = Math.max(ymax, Math.floor(i / w));
    for (let i = 0; i < w * h; i++) { const a = ctx.mask[i]; if (a > 0) layer.data.set([ink[0], ink[1], ink[2], a], i * 4); }
    objects.push({ raster: layer, contact: ymax + 1 });
  }
  const out = renderShore(above, sea, { horizon: yh, ripple: 1 + 5 * c.flow, objects, deep: m.palette.ground, shallow: m.palette.accent,
    sun: { x: 0.3, y: 0.5, power: 40 * c.sheen, shine: 40000, colour: m.palette.ink } });
  return toLayer(out, ctx.seed);
}
export { crt };
