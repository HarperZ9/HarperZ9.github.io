// hud.mjs: instrument marks for the survey sheet, drawn on a layer with the feed-24 rasteriser.
// Hairlines, dashed rings, doubled polygons, crosshairs, rulers, hatched boxes, dot grids, filled shapes
// and a plexus. Widths and sizes are in layer pixels; colours are '#rrggbb' or linear triples.
import { line, dashed, ring, disc } from '../../feed-24/build/raster.js';
import { colour } from './px.mjs';

export function rule(S, x0, y0, x1, y1, { w = 1, ink = '#f4f1ea', alpha = 1 } = {}) { line(S, x0, y0, x1, y1, w, colour(ink), alpha); }
export function dashLine(S, x0, y0, x1, y1, { w = 1, ink = '#f4f1ea', dash = 6, gap = 6, alpha = 1 } = {}) { dashed(S, x0, y0, x1, y1, w, colour(ink), dash, gap, alpha); }
export function dashedCircle(S, cx, cy, r, { w = 2, ink = '#f4f1ea', dash = 10, gap = 8, alpha = 1 } = {}) { ring(S, cx, cy, r, w, colour(ink), alpha, dash, gap); }
export function circle(S, cx, cy, r, { w = 2, ink = '#f4f1ea', alpha = 1 } = {}) { ring(S, cx, cy, r, w, colour(ink), alpha); }
export function dot(S, cx, cy, r, { ink = '#f4f1ea', alpha = 1 } = {}) { disc(S, cx, cy, r, colour(ink), alpha); }

// Filled shape by 4 x 4 supersampled coverage of inside(x, y) over a bounding box.
export function fillShape(S, x0, y0, x1, y1, inside, c, alpha = 1) {
  const C = colour(c), xa = Math.max(0, Math.floor(x0)), xb = Math.min(S.w - 1, Math.ceil(x1)), ya = Math.max(0, Math.floor(y0)), yb = Math.min(S.h - 1, Math.ceil(y1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    let n = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (inside(x + (i + 0.5) / 4, y + (j + 0.5) / 4)) n++;
    if (!n) continue; const a = (n / 16) * alpha, k = 3 * (y * S.w + x);
    for (let ch = 0; ch < 3; ch++) S.px[k + ch] += (C[ch] - S.px[k + ch]) * a;
  }
}

export function polyPoints(cx, cy, r, n, rot = -Math.PI / 2) { return Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + (i * 2 * Math.PI) / n), cy + r * Math.sin(rot + (i * 2 * Math.PI) / n)]); }
export function insidePoly(P) {
  return (x, y) => { let s = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
}

// A regular polygon, outlined, optionally filled, optionally drawn twice with an offset (images 33 to 36).
export function polygon(S, cx, cy, r, n, { rot = -Math.PI / 2, w = 2, ink = '#f4f1ea', fill = null, double = 0, alpha = 1 } = {}) {
  if (fill) { const P = polyPoints(cx, cy, r * 0.82, n, rot + 0.12); fillShape(S, cx - r, cy - r, cx + r, cy + r, insidePoly(P), fill); }
  for (const [dx, dr] of double ? [[0, 0], [double, 0.04]] : [[0, 0]]) {
    const P = polyPoints(cx + dx, cy - dx * 0.6, r * (1 + dr), n, rot + dr * 2);
    for (let i = 0; i < n; i++) line(S, ...P[i], ...P[(i + 1) % n], w, colour(ink), alpha);
  }
}

export function halfDisc(S, cx, cy, r, { fill, rot = 0 } = {}) {
  const nx = Math.cos(rot), ny = Math.sin(rot);
  fillShape(S, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx) * nx + (y - cy) * ny >= 0, fill);
}
export function crescent(S, cx, cy, r, { fill, cut = 0.72, dx = 0.38, dy = -0.12 } = {}) {
  fillShape(S, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx - dx * r) ** 2 + (y - cy - dy * r) ** 2 > (cut * r) ** 2, fill);
}

export function crosshair(S, x, y, size, { w = 2, ink = '#f4f1ea', gap = 0, alpha = 1 } = {}) {
  const C = colour(ink);
  line(S, x - size, y, x - gap, y, w, C, alpha); line(S, x + gap, y, x + size, y, w, C, alpha);
  line(S, x, y - size, x, y - gap, w, C, alpha); line(S, x, y + gap, x, y + size, w, C, alpha);
}

// A ruler: a base line with a tick every `step` px, a long tick every `major` ticks.
export function ruler(S, x, y, len, { step = 20, major = 5, tick = 8, long = 18, w = 1.5, ink = '#151314', up = true } = {}) {
  const C = colour(ink), s = up ? -1 : 1; line(S, x, y, x + len, y, w, C);
  for (let i = 0, t = 0; t <= len + 0.01; i++, t = i * step) line(S, x + t, y, x + t, y + s * (i % major === 0 ? long : tick), w, C);
}

// A box filled with parallel hatching at `angle`, lines clipped to the box exactly.
export function hatchBox(S, x, y, bw, bh, { spacing = 10, angle = Math.PI / 4, w = 1.5, ink = '#f4f1ea', frame = true, alpha = 1 } = {}) {
  const C = colour(ink), dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx, diag = Math.hypot(bw, bh), cx = x + bw / 2, cy = y + bh / 2;
  for (let o = -diag / 2; o <= diag / 2; o += spacing) {
    const px = cx + nx * o, py = cy + ny * o; let t0 = -Infinity, t1 = Infinity;
    for (const [p, d, lo, hi] of [[px, dx, x, x + bw], [py, dy, y, y + bh]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 1; t1 = 0; } continue; }
      const a = (lo - p) / d, b = (hi - p) / d; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    }
    if (t1 > t0) line(S, px + dx * t0, py + dy * t0, px + dx * t1, py + dy * t1, w, C, alpha);
  }
  if (frame) { line(S, x, y, x + bw, y, w, C, alpha); line(S, x + bw, y, x + bw, y + bh, w, C, alpha); line(S, x + bw, y + bh, x, y + bh, w, C, alpha); line(S, x, y + bh, x, y, w, C, alpha); }
}

export function dotGrid(S, x, y, cols, rows, step, r, { ink = '#151314', alpha = 1 } = {}) {
  const C = colour(ink); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) disc(S, x + i * step, y + j * step, r, C, alpha);
}

// Plexus: join every pair of points closer than `radius` (a proximity graph), nodes as small discs.
// Returns the number of links, so the sheet can print it.
export function plexus(S, pts, radius, { w = 1.2, ink = '#f4f1ea', alpha = 0.7, node = 2.5 } = {}) {
  const C = colour(ink); let links = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    if (d < radius) { line(S, ...pts[i], ...pts[j], w, C, alpha * (1 - (0.6 * d) / radius)); links++; }
  }
  for (const p of pts) disc(S, p[0], p[1], node, C, 1);
  return links;
}
