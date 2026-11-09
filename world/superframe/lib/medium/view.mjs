// lib/medium/view.mjs: the medium read, not only seen. Two instruments over the same fields:
//
// 1. Sheets (after Hsia Yu's Pink Noise, and Olivetti's overprinted posters). Every property, additive and law is a
//    translucent sheet printed in one spot ink. Sheets composite like inks (multiply), so overlaps make new colours
//    and stay readable. They can lie down (the stack), fan apart (exploded), be soloed or muted, frost the ones you
//    are not reading (blur grows with depth, the way a diffuser blurs what lies behind it), and be core-sampled.
// 2. The mosaic reading (after the andamento of name-art's tesserae, Divisumma and Elettrosumma). The field is laid as
//    tesserae: tiles split finer where the chosen axis changes fast, and each tile carries its values. Four axes:
//    mediums (which phase), properties (one value as tone, its digits on large tiles), elements (stripes in each
//    additive's ink, by amount) and laws (which process dominates: a pattern per law, laid along the flow).
//
//   medium.view({ mosaic: { axis: 'laws', tileSize: 12 }, layers: ['temperature', 'pigment', 'advection'] })
import { bilerp, clamp } from './grid.mjs';
import { LAWS } from './medium.mjs';
import { make } from '../types.mjs';
import { bitmap } from '../../../feed-25/build/numerals.mjs';
import { composite } from './sheets.mjs';

const hexLin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const sum3 = (a, k) => a[0][k] + a[1][k] + a[2][k];

// Every sheet: what it reads (a 0..1 value per cell) and its spot ink.
export const SHEETS = {
  temperature: { group: 'property', ink: '#d0402a', at: (m, k) => clamp(m.T[k] * 1.5, 0, 1) },
  viscosity: { group: 'property', ink: '#7a4fa0', at: (m, k) => clamp((m.nu[k] - 0.25) / 1.5, 0, 1) },
  density: { group: 'property', ink: '#1f4e9c', at: (m, k) => clamp(0.5 + 0.9 * m.S[k] + 0.6 * m.sugar[k] + 0.25 * (sum3(m.pig, k) + sum3(m.pigT, k)) - 0.9 * m.T[k] - (m.phase[k] ? 0 : 0.5), 0, 1) },
  // the refractive index as a property; 'refraction' is the law sheet (where light bends), a separate reading
  index: { group: 'property', ink: '#2f7d5b', at: (m, k) => clamp((m.ior[k] - 1) / 0.5, 0, 1) },
  speed: { group: 'property', ink: '#1b1b1b', at: (m, k) => clamp(Math.hypot(m.u[k], m.v[k]) / 1.5, 0, 1) },
  opacity: { group: 'property', ink: '#1b1b1b', at: (m, k) => clamp(1 - Math.exp(-(sum3(m.pig, k) + sum3(m.pigT, k) + sum3(m.sed, k))), 0, 1) },
  pigment: { group: 'element', ink: '#1f4e9c', at: (m, k) => clamp(sum3(m.pig, k) + sum3(m.pigT, k), 0, 1) },
  sediment: { group: 'element', ink: '#b0603a', at: (m, k) => clamp(sum3(m.sed, k) * 3, 0, 1) },
  oil: { group: 'element', ink: '#e8b923', at: (m, k) => clamp(m.oil[k] * 2, 0, 1) },
  salt: { group: 'element', ink: '#4a90b8', at: (m, k) => clamp(m.S[k], 0, 1) },
  mist: { group: 'element', ink: '#9aa7b0', at: (m, k) => clamp(m.mist[k], 0, 1) },
  smoke: { group: 'element', ink: '#3a3530', at: (m, k) => clamp(m.smoke[k], 0, 1) },
  // colour temperature (the zine's depth-plane rule: plan warm and cool at macro and micro scale): warm where what
  // is in the water absorbs blue (it looks warm), cool where it absorbs red; signed, printed in two inks
  colourTemperature: { group: 'property', ink: '#d9822b', cool: '#2f6db0', signed: true, at: (m, k) => { const a = [0, 1, 2].map(c => m.pig[c][k] + m.pigT[c][k] + m.sed[c][k]), t = a[0] + a[1] + a[2]; return t < 1e-4 ? 0 : clamp((a[2] - a[0]) / t * Math.min(1, t * 3), -1, 1); } },
  phase: { group: 'medium', ink: '#4a90b8', at: (m, k) => (m.solid[k] ? 0.4 : m.phase[k] ? 0.7 : 0) },
};
// the law sheets join last; a law named like a property would silently replace it (it did once: 'refraction'), so
// a collision is an error at load
for (const [i, l] of LAWS.entries()) {
  if (SHEETS[l]) throw new Error(`view: law "${l}" collides with the ${SHEETS[l].group} sheet of that name`);
  SHEETS[l] = { group: 'law', ink: ['#1f4e9c', '#e07fa8', '#d0402a', '#2f7d5b', '#e8b923', '#b0603a'][i], at: (m, k) => clamp(m.law[i][k] / 1.2, 0, 1) };
}

// One sheet as ink coverage at w x h (bilinear from the grid).
export function sheetCoverage(m, name, w, h, { normalise = false } = {}) {
  const S = SHEETS[name]; if (!S) throw new Error(`view: no sheet "${name}"`);
  const g = Float32Array.from({ length: m.n }, (_, k) => S.at(m, k)), out = new Float32Array(w * h);
  if (normalise) { const a = Float32Array.from(g, Math.abs).sort(), top = a[Math.floor(a.length * 0.98)] || 1; if (top > 1e-6) for (let k = 0; k < g.length; k++) g[k] = clamp(g[k] / top, -1, 1); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = bilerp(g, m.nx, m.ny, (x + 0.5) / w * m.nx - 0.5, (y + 0.5) / h * m.ny - 0.5);
  return out;
}

const blur = (f, w, h, r) => { if (r < 0.5) return f; let a = Float32Array.from(f); const t = new Float32Array(f.length), R = Math.round(r);
  for (let pass = 0; pass < 3; pass++) { for (let y = 0; y < h; y++) { let s = 0; for (let x = -R; x <= R; x++) s += a[y * w + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * R + 1); s += a[y * w + clamp(x + R + 1, 0, w - 1)] - a[y * w + clamp(x - R, 0, w - 1)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -R; y <= R; y++) s += t[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * R + 1); s += t[clamp(y + R + 1, 0, h - 1) * w + x] - t[clamp(y - R, 0, h - 1) * w + x]; } } }
  return a; };

// The stack: sheets printed in order on a paper ground. Each sheet carries its own law (sheets.mjs: an element's
// ink prints by density_add, a property's tone stacks by weber, a law's pattern filters by multiply); where they meet,
// each applies its own, and `law` lets the artist set one for every sheet. solo: only that sheet sharp, the rest
// frosted (blurred by their distance from it and lifted toward the frost luma 0.84 measured in the Pink Noise study).
export { WEBER, DENSITY_W } from './sheets.mjs';
// the 94.7% coverage trap, superseded for overprint by density_add (DENSITY_W, 2026-10-26); kept as an export because
// the UI's flow stand-in reads TRAP from this module, and a missing export would silently break its shader constant
export const TRAP = 0.947;
const LAW_OF_GROUP = { element: 'density_add', property: 'weber', law: 'multiply', medium: 'multiply' };
export const sheetLaw = name => SHEETS[name].law ?? LAW_OF_GROUP[SHEETS[name].group] ?? 'multiply';
// The same engine for one pixel: sheets = [{ ink: [r, g, b] linear, cover 0..1, law? }] in print order.
export function printSheets(paper, sheets, { law = 'weber' } = {}) {
  const P = typeof paper === 'string' ? hexLin(paper) : paper;
  return composite(P, sheets.map(s => ({ ...s, law: s.law ?? law })));
}
export function stack(m, names, w, h, { solo = null, mute = [], frost = 0.6, paper = '#f2eee6', strength = 1, law = null } = {}) {
  const R = make.raster(w, h), P = hexLin(paper), si = solo ? names.indexOf(solo) : -1, layers = [];
  names.forEach((name, depth) => {
    if (mute.includes(name)) return;
    let cov = sheetCoverage(m, name, w, h, { normalise: true }); const S = SHEETS[name], warm = hexLin(S.ink), cool = S.cool ? hexLin(S.cool) : warm, gap = si >= 0 ? Math.abs(depth - si) : 0;
    if (gap) cov = blur(cov, w, h, frost * gap * w / 200);
    layers.push({ cov, warm, cool, lift: gap ? Math.min(0.7, 0.2 * gap) : 0, law: law ?? sheetLaw(name) });
  });
  const list = layers.map(() => ({ ink: null, cover: 0, law: 'multiply' }));
  for (let i = 0; i < w * h; i++) {
    layers.forEach((L, j) => { const v = L.cov[i]; list[j].ink = v < 0 ? L.cool : L.warm; list[j].cover = Math.abs(v) * (1 - L.lift) * strength; list[j].law = L.law; });
    const c = composite(P, list); R.data[4 * i] = c[0]; R.data[4 * i + 1] = c[1]; R.data[4 * i + 2] = c[2]; R.data[4 * i + 3] = 1;
  }
  return R;
}

// Exploded: the sheets fanned apart as panes in an oblique view, back to front, each its own print, the living
// render (if given) as the deepest pane. Panes are translucent: what lies behind shows through, frosted by distance.
export function exploded(m, names, W, H, { living = null, ground = '#e6e1d7' } = {}) {
  const R = make.raster(W, H), G = hexLin(ground), n = names.length + (living ? 1 : 0), pw = Math.round(W * 0.5), ph = Math.round(pw * m.ny / m.nx);
  const step = (W - pw - W * 0.12) / Math.max(1, n - 1), rise = (H - ph * 0.82 - H * 0.16) / Math.max(1, n - 1), frost = 0.16, F = 0.84;
  for (let i = 0; i < W * H; i++) R.data.set([G[0], G[1], G[2], 1], 4 * i);
  // a pane is one sheet, or a group of sheets printed together (a depth plane); groups are { name, sheets }
  const panes = [...(living ? [{ img: living }] : []), ...names.map(nm => (typeof nm === 'string'
    ? { name: nm, cov: sheetCoverage(m, nm, pw, ph, { normalise: true }), warm: hexLin(SHEETS[nm].ink), cool: hexLin(SHEETS[nm].cool ?? SHEETS[nm].ink) }
    : { name: nm.name, print: stack(m, nm.sheets, pw, ph, { paper: '#ffffff', strength: 0.55 }) }))];
  panes.forEach((p, d) => {
    const ox = W * 0.06 + d * step, oy = H - H * 0.08 - ph * 0.82 - d * rise;
    // inverse mapping: every output pixel inside the pane finds its source, so the oblique pane has no gaps or seams
    for (let Y = Math.max(0, Math.floor(oy)); Y < Math.min(H, Math.ceil(oy + ph * 0.82)); Y++) for (let X = Math.max(0, Math.floor(ox)); X < Math.min(W, Math.ceil(ox + pw + ph * 0.1)); X++) {
      const y = Math.floor((Y - oy) / 0.82), x = Math.floor(X - ox - (ph - y) * 0.1); if (x < 0 || y < 0 || x >= pw || y >= ph) continue;
      const o = 4 * (Y * W + X), edge = x < 2 || y < 2 || x >= pw - 2 || y >= ph - 2;
      if (p.img) { const s = 4 * (Math.min(p.img.h - 1, Math.floor(y * p.img.h / ph)) * p.img.w + Math.min(p.img.w - 1, Math.floor(x * p.img.w / pw))); for (let k = 0; k < 3; k++) R.data[o + k] = p.img.data[s + k]; continue; }
      if (p.print) { const s4 = 4 * (y * pw + x); for (let k = 0; k < 3; k++) { const v = (R.data[o + k] * (1 - frost) + F * frost) * p.print.data[s4 + k]; R.data[o + k] = edge ? v * 0.6 : v; } continue; }
      // a clear sheet: a faint frost over what is behind, then the sheet's ink printed over it (multiply)
      const c = p.cov[y * pw + x], ink = c < 0 ? p.cool : p.warm, a = Math.abs(c);
      for (let k = 0; k < 3; k++) { let v = R.data[o + k] * (1 - frost) + F * frost; v *= 1 - a * (1 - ink[k]); R.data[o + k] = edge ? v * 0.6 : v; }
    }
    if (p.name) print(R, p.name.toUpperCase().replace(/[^A-Z0-9]/g, ''), ox + 10 + ph * 0.1, oy + 8, Math.max(1, Math.round(W / 640)), hexLin('#3d3a35'));
  });
  return R;
}

function print(R, str, x0, y0, px, ink) {
  let x = x0;
  for (const ch of str) { const b = bitmap(ch); if (b) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (b[r][c] === '#') for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) { const X = Math.round(x + c * px + xx), Y = Math.round(y0 + r * px + yy); if (X >= 0 && Y >= 0 && X < R.w && Y < R.h) R.data.set([ink[0], ink[1], ink[2], 1], 4 * (Y * R.w + X)); } x += 6 * px; }
}

// Depth planes (the zine's foreground, middle ground and background, each with a job): the default grouping when no
// layers are named. Background is the air and what hangs in it; the middle ground is the water and its processes;
// the foreground is what has settled, floats or refracts.
export const PLANES = Object.freeze({
  background: ['mist', 'smoke', 'temperature'],
  middle: ['pigment', 'density', 'speed', 'advection', 'buoyancy', 'colourTemperature'],
  foreground: ['oil', 'sediment', 'refraction', 'surface', 'settling'],
});

// The one entry: medium.view(opts). Returns { raster, sheets: [names], data? }.
//   { layers: [...] | 'planes', mode: 'stack' | 'exploded' | 'solo', solo, mute, mosaic: { axis, tileSize, ribbons } }
export function view(m, { W = 960, H = 540, layers = 'planes', mode = 'stack', solo = null, mute = [], mosaic = null, living = null } = {}) {
  if (mosaic) return { raster: mosaicView(m, W, H, mosaic), sheets: [mosaic.axis] };
  if (layers === 'planes') {
    // the depth planes, fanned: background, middle ground and foreground, each printing its own sheets
    const groups = Object.entries(PLANES).map(([name, sheets]) => ({ name, sheets }));
    return { raster: exploded(m, groups, W, H, { living }), sheets: groups.flatMap(g => g.sheets) };
  }
  const names = layers;
  if (mode === 'exploded') return { raster: exploded(m, names, W, H, { living }), sheets: names };
  return { raster: stack(m, names, W, H, { solo: mode === 'solo' ? solo : solo, mute }), sheets: names };
}

// Every sheet as data (Float32 values on the grid) and as an image, so a reading can be saved and studied.
export function exportSheets(m, names = Object.keys(SHEETS)) {
  return names.map(name => ({ name, group: SHEETS[name].group, ink: SHEETS[name].ink, nx: m.nx, ny: m.ny, values: Float32Array.from({ length: m.n }, (_, k) => SHEETS[name].at(m, k)) }));
}

// A core sample: every sheet's value at one point (tank units), plus the raw fields there.
export function core(m, x, y) {
  const i = clamp(Math.floor(x * m.nx), 0, m.nx - 1), j = clamp(Math.floor(y * m.ny), 0, m.ny - 1), k = j * m.nx + i;
  return { x, y, cell: [i, j], phase: m.solid[k] ? (m.solid[k] === 2 ? 'glass' : 'sediment') : m.phase[k] ? 'water' : 'air', sheets: Object.fromEntries(Object.keys(SHEETS).map(s => [s, +SHEETS[s].at(m, k).toFixed(4)])),
    raw: { u: m.u[k], v: m.v[k], T: m.T[k], S: m.S[k], nu: m.nu[k], ior: m.ior[k], pigment: sum3(m.pig, k) + sum3(m.pigT, k), sediment: sum3(m.sed, k), oil: m.oil[k] } };
}

import { mosaicView } from './mosaicview.mjs';
export { mosaicView };
