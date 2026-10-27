// lib/medium/mosaicview.mjs: the medium laid as tesserae, so it can be read. A quadtree splits the tank where the
// chosen axis changes fast (fine tiles mean busy water; big tiles mean calm), and every tile carries its values:
//   mediums     the phase: water, air, the surface band, sediment, glass, each its own stone
//   properties  one property as tone; tiles large enough print its value in digits (after Olivetti's Divisumma)
//   elements    the additives present, as stripes in each one's ink, widths by amount
//   laws        the dominant process, as a pattern: advection lines laid along the flow (the andamento), diffusion
//               dots, buoyancy chevrons pointing the way it pushes, surface waves, refraction rings, settling hatch
// ribbons: tiles laid along streamlines instead of the grid, numbered in order (after Bayer's Divisumma), so the
// reading itself flows.
// Grout lines and a soft bevel follow the tesserae conventions of name-art/lib/mosaic (read, not imported:
// that library partitions around letter shapes, and a field-driven partition is a request to its owner).
import { clamp, bilerp } from './grid.mjs';
import { SHEETS } from './view.mjs';
import { LAWS } from './medium.mjs';
import { make } from '../types.mjs';
import { bitmap } from '../../../feed-25/build/numerals.mjs';

const hexLin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const PAPER = hexLin('#f2eee6'), GROUT = hexLin('#3d3a35');
const PHASES = { air: hexLin('#dfe5e8'), water: hexLin('#7fa9c4'), surface: hexLin('#f4f6f2'), sediment: hexLin('#b0603a'), glass: hexLin('#9fd0c0') };
const ELEMENTS = ['pigment', 'sediment', 'oil', 'salt', 'mist', 'smoke'];

function phaseOf(m, k, j, i) { if (m.solid[k] === 2) return 'glass'; if (m.solid[k]) return 'sediment'; if (Math.abs(j + 0.5 - m.surfaceY(i)) < 1) return 'surface'; return m.phase[k] ? 'water' : 'air'; }
function axisValue(m, axis, k) {
  if (axis === 'laws') { let best = 0, bi = 0; for (let l = 0; l < LAWS.length; l++) if (m.law[l][k] > best) { best = m.law[l][k]; bi = l; } return bi + Math.min(0.99, best); }
  if (axis === 'elements') return ELEMENTS.reduce((s, e, i) => s + SHEETS[e].at(m, k) * (i + 1), 0);
  if (axis === 'mediums') return m.solid[k] * 3 + m.phase[k];
  return SHEETS[axis].at(m, k);
}

// quadtree tiles over the grid: split while the axis varies inside a tile and the tile is above the minimum size
function tiles(m, axis, minCells, maxCells) {
  const out = [], vals = Float32Array.from({ length: m.n }, (_, k) => axisValue(m, axis, k));
  const visit = (x, y, s) => {
    let lo = Infinity, hi = -Infinity;
    for (let j = y; j < Math.min(m.ny, y + s); j++) for (let i = x; i < Math.min(m.nx, x + s); i++) { const v = vals[j * m.nx + i]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (s > minCells && (hi - lo > 0.12 || s > maxCells)) { const h = s / 2; visit(x, y, h); visit(x + h, y, h); visit(x, y + h, h); visit(x + h, y + h, h); return; }
    if (x < m.nx && y < m.ny) out.push({ x, y, s });
  };
  const top = 2 ** Math.ceil(Math.log2(Math.max(m.nx, m.ny)));
  visit(0, 0, top);
  return out;
}

// draw one string of 5 x 7 glyphs into a raster region (digits and capitals from the feed-25 utility face)
function print(R, str, x0, y0, px, ink) {
  let x = x0;
  for (const ch of str) { const b = bitmap(ch); if (b) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (b[r][c] === '#') for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) { const X = Math.round(x + c * px + xx), Y = Math.round(y0 + r * px + yy); if (X >= 0 && Y >= 0 && X < R.w && Y < R.h) R.data.set([ink[0], ink[1], ink[2], 1], 4 * (Y * R.w + X)); } x += 6 * px; }
}

export function mosaicView(m, W, H, { axis = 'laws', tileSize = 1, maxTile = 16, ribbons = false } = {}) {
  const R = make.raster(W, H), cx = W / m.nx, cy = H / m.ny;
  for (let i = 0; i < W * H; i++) R.data.set([GROUT[0], GROUT[1], GROUT[2], 1], 4 * i);
  const list = ribbons ? ribbonTiles(m, tileSize * 2) : tiles(m, axis, tileSize, maxTile);
  for (const t of list) {
    const x0 = t.x * cx, y0 = t.y * cy, sw = Math.min(t.s, m.nx - t.x) * cx, sh = Math.min(t.s, m.ny - t.y) * cy, g = Math.max(1, Math.round(Math.min(sw, sh) * 0.08));
    const ci = clamp(Math.floor(t.x + t.s / 2), 0, m.nx - 1), cj = clamp(Math.floor(t.y + t.s / 2), 0, m.ny - 1), k = cj * m.nx + ci;
    const ang = Math.atan2(m.v[k], m.u[k]), ca = Math.cos(ang), sa = Math.sin(ang);
    let law = 0, lawV = 0; for (let l = 0; l < LAWS.length; l++) if (m.law[l][k] > lawV) { lawV = m.law[l][k]; law = l; }
    const amounts = ELEMENTS.map(e => SHEETS[e].at(m, k)), tot = amounts.reduce((a, b) => a + b, 0);
    for (let y = Math.ceil(y0 + g); y < y0 + sh - g; y++) for (let x = Math.ceil(x0 + g); x < x0 + sw - g; x++) {
      if (x >= W || y >= H) continue;
      const u = (x - x0) / sw, v = (y - y0) / sh, ru = (u - 0.5) * ca + (v - 0.5) * sa, rv = -(u - 0.5) * sa + (v - 0.5) * ca;
      let c;
      if (axis === 'mediums') c = PHASES[phaseOf(m, k, cj, ci)];
      else if (axis === 'elements') { if (tot < 0.02) c = PAPER; else { let acc = 0, e = 0; for (; e < ELEMENTS.length; e++) { acc += amounts[e] / tot; if (u <= acc) break; } c = hexLin(SHEETS[ELEMENTS[Math.min(e, ELEMENTS.length - 1)]].ink).map((q, i) => PAPER[i] + (q - PAPER[i]) * clamp(tot, 0.25, 1)); } }
      else if (axis === 'laws') { const ink = hexLin(SHEETS[LAWS[law]].ink), on = lawPattern(law, ru, rv, u, v, m.v[k], sw); c = on ? ink : PAPER.map((p, i) => p + (ink[i] - p) * 0.12); }
      else { const val = SHEETS[axis].at(m, k), ink = hexLin(SHEETS[axis].ink); c = PAPER.map((p, i) => p + (ink[i] - p) * val); }
      const bevel = 1 + 0.08 * (0.5 - v) - 0.04 * Math.abs(u - 0.5);
      R.data.set([c[0] * bevel, c[1] * bevel, c[2] * bevel, 1], 4 * (y * W + x));
    }
    // large tiles print their value (properties) or their order along a ribbon
    const label = ribbons ? String(t.n % 1000) : axis !== 'laws' && axis !== 'mediums' && axis !== 'elements' ? String(Math.round(SHEETS[axis].at(m, k) * 99)) : null, px = Math.floor(Math.min(sw, sh) / 14);
    if (label && px >= 1 && sw > label.length * 6 * px + 2 * g) print(R, label, x0 + g + 2 * px, y0 + g + 2 * px, px, GROUT);
  }
  return R;
}

// a pattern per law, in tile coordinates rotated along the flow: true where the tile is inked
function lawPattern(law, ru, rv, u, v, vy, size) {
  const f = Math.max(3, Math.round(size / 6));
  switch (LAWS[law]) {
    case 'advection': return Math.abs(Math.sin(rv * Math.PI * f)) > 0.75;                                     // lines along the flow
    case 'diffusion': return Math.hypot(((u * f) % 1) - 0.5, ((v * f) % 1) - 0.5) < 0.22;                     // dots
    case 'buoyancy': return Math.abs(((v * f + Math.abs(u - 0.5) * 2 * (vy < 0 ? 1 : -1)) % 1) - 0.5) < 0.15; // chevrons
    case 'surface': return Math.abs(v - 0.5 - 0.15 * Math.sin(u * Math.PI * 2 * f / 2)) < 0.08;                // a wave
    case 'refraction': return Math.abs(((Math.hypot(u - 0.5, v - 0.5) * f) % 1) - 0.5) < 0.18;               // rings
    default: return Math.abs(((v * f) % 1) - 0.5) < 0.12;                                                       // settling: hatch
  }
}

// tiles along streamlines, seeded on a coarse lattice, numbered as they are laid
function ribbonTiles(m, s) {
  const out = [], taken = new Uint8Array(m.n); let n = 0;
  for (let sy = 2; sy < m.ny; sy += 9) for (let sx = 2; sx < m.nx; sx += 14) {
    let x = sx, y = sy;
    for (let step = 0; step < 40; step++) {
      const i = Math.floor(x), j = Math.floor(y); if (i < 0 || j < 0 || i >= m.nx - s || j >= m.ny - s) break;
      const k = j * m.nx + i; if (taken[k]) break;
      for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) taken[(j + a) * m.nx + i + b] = 1;
      out.push({ x: i, y: j, s, n: n++ });
      const vx = bilerp(m.u, m.nx, m.ny, x, y), vy = bilerp(m.v, m.nx, m.ny, x, y), l = Math.hypot(vx, vy); if (l < 1e-3) break;
      x += (vx / l) * s; y += (vy / l) * s;
    }
  }
  return out;
}
