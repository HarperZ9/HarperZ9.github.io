// lib/medium/tesserae.mjs: a mosaic poured into the water, tiles that ride the flow and keep their deformation.
// After Herbert Bayer's Divisumma (1953), where numbered tiles stay tiles while the ribbon they sit on turns, so the
// flow shows as foreshortening; and Piers Cowburn's liquid cities, where geometry is advected and its texture
// stretches rather than resampling. Each tile is four corner points carried by the velocity (midpoint rule) and drawn
// as the quad they now span: the grout, the colour and the printed digit are laid in the tile's own (u, v), found by
// inverting the bilinear map, so a sheared tile prints a sheared digit. Corners stay in the water.
//   m.add('tesserae', { x, y, w, h }, 1, { cols, rows, colors: ['#hex', ...], digits: true, at })
import { bilerp, clamp } from './grid.mjs';
import { setText } from '../../adapters/type.mjs';
import { fillNonzero } from '../fill.mjs';
import { releaseMotes } from './motes.mjs';
import { absorbanceOf } from './spectral.mjs';

const lin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
// tile inks measured in the reference library (palettes.json, 'inks by hue'): Olivetti Elettrosumma 22 (red, straw
// yellow, teal, navy, its paper), Herbert Bayer's Divisumma (slate blue, apricot) and Otto Piene's Red Eye Red (orange)
export const PALETTE = ['#a93b29', '#ddd286', '#416f66', '#263760', '#465791', '#eb8f4a', '#d25c22', '#ded8cb'];
const DARK = lin('#232325'), PAPER = lin('#ded8cb');

// digits in the house face (Accession, from the type forge) as coverage masks, set once per digit
const GW = 96, GH = 128, glyphs = new Map();
const digitMask = ch => { if (!glyphs.has(ch)) { const { polys } = setText(ch, GW, GH, { fill: 0.86, weight: 600 }); glyphs.set(ch, fillNonzero(polys, GW, GH, 4)); } return glyphs.get(ch); };

export const tesserae = {
  where: w => w,
  // lay the tiles on a grid in grid-cell coordinates: once, or (props.every) a fresh set every so many seconds
  apply(m, e, _, dt) {
    if (e.props.every) { e.next ??= e.props.at; if (m.time + 1e-9 < e.next) return; e.next += e.props.every; e.batch = (e.batch ?? -1) + 1; }
    const { y = 0.5, w = 0.2, h = 0.08 } = e.where, x = (e.where.x ?? 0.5) + (e.props.wander ? (m.rng() - 0.5) * e.props.wander : 0), cols = e.props.cols ?? 10, rows = e.props.rows ?? 2, colors = (e.props.colors ?? PALETTE).map(lin);
    const X = i => (x - w + (2 * w * i) / cols) * m.nx - 0.5, Y = j => (y - h + (2 * h * j) / rows) * m.ny - 0.5;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const n = m.tesserae.length;
      const ci = (i * 3 + j * 5 + ((i * 7 + j) % 3) + (e.batch ?? 0) * 5) % colors.length;
      m.tesserae.push({ n, c: [[X(i), Y(j)], [X(i + 1), Y(j)], [X(i + 1), Y(j + 1)], [X(i), Y(j + 1)]], rgb: colors[ci], hex: (e.props.colors ?? PALETTE)[ci], digit: e.props.digits === false ? null : String((n % 9) + 1), opacity: e.amount, born: m.time, b: 1, loosen: e.props.loosen ?? null });
    }
  },
};

// carry every corner by the flow over one step (midpoint rule), held inside the water and the tank
export function moveTesserae(m, dt) {
  if (!m.tesserae.length) return;
  const s = dt * 30;
  for (const t of m.tesserae) if (t.loosen) loosen(m, t, dt);
  m.tesserae = m.tesserae.filter(t => t.b > 0.002 || !t.loosen);
  for (const t of m.tesserae) for (const p of t.c) {
    const u1 = bilerp(m.u, m.nx, m.ny, p[0], p[1]), v1 = bilerp(m.v, m.nx, m.ny, p[0], p[1]);
    const mx = p[0] + 0.5 * s * u1, my = p[1] + 0.5 * s * v1;
    p[0] = clamp(p[0] + s * bilerp(m.u, m.nx, m.ny, mx, my), 0, m.nx - 1);
    const i = clamp(Math.round(p[0]), 0, m.nx - 1), top = m.surfaceY(i) + 0.3, floor = m.ny - m.bed[i] - 1;
    p[1] = clamp(p[1] + s * bilerp(m.v, m.nx, m.ny, mx, my) + (t.loosen?.sink ?? 0) * dt, top, floor);
  }
}

// A tile loosens into a drop of its own ink: its binding b falls once it has been in the water `after` seconds,
// faster where the flow shears it (the strain tears the grout first), and what leaves the tile becomes ink at the
// same place, carried by the same flow: a fine drop with its bloom (so the edge stays sharp while it is young) and
// pigment in the carried field (so the colour stays when the drop dissolves). The tile's colour is conserved: it
// fades from the tile exactly as fast as it arrives in the water.
const absorbHex = hex => { const n = parseInt(hex.slice(1), 16); return [16, 8, 0].map(sh => { const c = ((n >> sh) & 255) / 255, l = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; return -Math.log(Math.max(0.02, l)) / 3.9; }); };
function loosen(m, t, dt) {
  const L = t.loosen, age = m.time - t.born; if (age < (L.after ?? 1)) return;
  const [a, b, c, d] = t.c, cx = (a[0] + b[0] + c[0] + d[0]) / 4, cy = (a[1] + b[1] + c[1] + d[1]) / 4;
  const ex = 0.5 * (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - d[0], c[1] - d[1])), ey = 0.5 * (Math.hypot(d[0] - a[0], d[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]));
  const strain = Math.abs(Math.log(Math.max(0.05, (ex * ey) / Math.max(1e-6, t.size0 ?? (t.size0 = ex * ey))))) + Math.abs(Math.log(Math.max(0.05, ex / Math.max(0.05, ey))) - Math.log(t.aspect0 ?? (t.aspect0 = ex / Math.max(0.05, ey))));
  const db = Math.min(t.b, dt * (1 + (L.tear ?? 3) * strain) / (L.over ?? 3));
  if (db <= 0) return;
  t.b -= db;
  // what leaves the tile streams off it as motes of its own ink, from anywhere on the tile, more from its edges
  const A = absorbHex(t.hex), n = Math.max(1, Math.round(db * (L.motes ?? 260))), mass = (L.ink ?? 1) * db * ex * ey / n * 0.05;
  releaseMotes(m, (r1, r2) => { const e = r1 < 0.5 ? 0.04 + 0.92 * r2 : r1, f = r1 < 0.5 ? (r2 * 7 % 1 < 0.5 ? 0.02 : 0.98) : r2, top = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e], bot = [d[0] + (c[0] - d[0]) * e, d[1] + (c[1] - d[1]) * e]; return [top[0] + (bot[0] - top[0]) * f, top[1] + (bot[1] - top[1]) * f]; }, n, A, mass, L.settle ?? 1.2, m.pigS ? (t.aS ??= absorbanceOf(t.hex)) : null);
}

// a tile's measures: area (cells^2) and its width along the top and bottom edges, for the Bayer foreshortening check
export function tileShape(t) {
  const [a, b, c, d] = t.c, cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return { area: 0.5 * Math.abs(cross(a, b, c)) + 0.5 * Math.abs(cross(a, c, d)), width: 0.5 * (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - d[0], c[1] - d[1])) };
}

// inverse bilinear: the (u, v) of point p in quad a b c d (counter-clockwise or clockwise), or null outside
export function invBilinear(px, py, a, b, c, d) {
  const ex = b[0] - a[0], ey = b[1] - a[1], fx = d[0] - a[0], fy = d[1] - a[1], gx = a[0] - b[0] + c[0] - d[0], gy = a[1] - b[1] + c[1] - d[1], hx = px - a[0], hy = py - a[1];
  const k2 = gx * fy - gy * fx, k1 = ex * fy - ey * fx + hx * gy - hy * gx, k0 = hx * ey - hy * ex;
  let v;
  if (Math.abs(k2) < 1e-9) v = -k0 / k1;
  else { const w = k1 * k1 - 4 * k0 * k2; if (w < 0) return null; const sw = Math.sqrt(w), v1 = (-k1 - sw) / (2 * k2), v2 = (-k1 + sw) / (2 * k2); v = v1 >= -0.001 && v1 <= 1.001 ? v1 : v2; }
  const den = ex + gx * v, deny = ey + gy * v, u = Math.abs(den) > Math.abs(deny) ? (hx - fx * v) / den : (hy - fy * v) / deny;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
}

// draw the tiles into a linear raster: each tile is a glazed body of its ink, lit and fogged where it is in the water
// (shade(albedo, gx, gy), so a tile sinking into the deep turns green-blue like everything else there), set in grout,
// with its digit in Accession laid in the tile's own coordinates; edges antialiased by 4 x 4 subsamples
export function drawTesserae(m, R, grout = lin('#4a463f'), shade = a => a, vp) {
  if (!m.tesserae.length) return;
  const { w: W, h: H } = R, sx = vp.cx, sy = vp.cy, d = R.data, SUB = [0.125, 0.375, 0.625, 0.875];
  for (const t of m.tesserae) {
    // grown by a pixel about its centre, so neighbouring tiles overlap in grout and no light seam shows between them
    const q0 = t.c.map(([x, y]) => vp.p(x, y)), cx = q0.reduce((a, p) => a + p[0], 0) / 4, cy = q0.reduce((a, p) => a + p[1], 0) / 4;
    const size = Math.max(4, Math.sqrt(tileShape(t).area * sx * sy)), grow = 1 + 1.2 / size, q = q0.map(([x, y]) => [cx + (x - cx) * grow, cy + (y - cy) * grow]);
    const x0 = Math.max(0, Math.floor(Math.min(...q.map(p => p[0])))), x1 = Math.min(W - 1, Math.ceil(Math.max(...q.map(p => p[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...q.map(p => p[1])))), y1 = Math.min(H - 1, Math.ceil(Math.max(...q.map(p => p[1]))));
    const mask = t.digit ? digitMask(t.digit) : null, lum = 0.2126 * t.rgb[0] + 0.7152 * t.rgb[1] + 0.0722 * t.rgb[2], inkC = lum > 0.16 ? DARK : PAPER;
    // the light and the water at the tile's centre (a tile is small against the fog's scale)
    const [gcx, gcy] = vp.g(cx - 0.5, cy - 0.5), body = shade(t.rgb, gcx, gcy, t.hex), seamC = shade(grout, gcx, gcy), inkS = shade(inkC, gcx, gcy);
    const sc = 0.3 + 0.7 * t.b, pw = 2 + 14 * t.b ** 3, gj = clamp((t.b - 0.85) / 0.15, 0, 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let cov = 0, joint = 0, ink = 0, lit = 0;
      for (const oy of SUB) for (const ox of SUB) {
        const uv = invBilinear(x + ox, y + oy, ...q); if (!uv) continue;
        const [u, v] = uv;
        // a loosening tile rounds and shrinks toward a drop, and its grout goes first
        if (t.b < 1 && Math.abs((2 * u - 1) / sc) ** pw + Math.abs((2 * v - 1) / sc) ** pw > 1) continue;
        cov += 1 / 16;
        if (gj > 0 && (u < 0.06 * gj || u > 1 - 0.06 * gj || v < 0.08 * gj || v > 1 - 0.08 * gj)) { joint += 1 / 16; continue; }
        lit += (1 + 0.1 * (0.5 - v) - 0.05 * Math.abs(u - 0.5)) / 16;     // a soft glaze: lighter toward the top edge
        if (mask) { const gu = (u - 0.22) / 0.56, gv = (v - 0.14) / 0.72; if (gu >= 0 && gu < 1 && gv >= 0 && gv < 1) ink += t.b * bilerp(mask, GW, GH, gu * GW - 0.5, gv * GH - 0.5) / 16; }
      }
      if (!cov) continue;
      const o = 4 * (y * W + x), a = Math.min(1, t.opacity) * 0.94 * Math.min(1, 1.6 * t.b) ** 0.5;
      for (let k = 0; k < 3; k++) {
        const tile = body[k] * (lit - ink) + inkS[k] * ink + seamC[k] * joint;
        d[o + k] = d[o + k] * (1 - cov * a) + tile * a;
      }
    }
  }
}
