// src/emblems/ideas.mjs: emblems for science, polity and method. Each draws the idea the work builds on, never a
// face or a mark that imitates the person's own branding. Coordinates are fractions of the side; c = kit canvas.
import { TAU, inCircle, inPoly } from './kit.mjs';

// Sapolsky: behaviour explained by what came before. A neuron, its dendrites branching from the soma.
export function neuron(c) {
  const grow = (x, y, a, len, w, depth) => {
    if (depth === 0 || len < 0.012) return;
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len; c.line(x, y, x1, y1, w);
    const k = 2 + (c.R() < 0.3 ? 1 : 0);
    for (let i = 0; i < k; i++) grow(x1, y1, a + (c.R() - 0.5) * 1.3, len * (0.62 + c.R() * 0.18), w * 0.72, depth - 1);
  };
  for (let i = 0; i < 6; i++) grow(0.5, 0.5, (i / 6) * TAU + c.R() * 0.4, 0.11, 2.6, 6);
  c.fill(inCircle(0.5, 0.5, 0.05)); c.line(0.5, 0.55, 0.52, 0.95, 1.6); // soma and axon
}

// Bill Nye: science for everyone. Two sources in a ripple tank; the interference is the lesson.
export function ripple(c) {
  for (const [sx, sy] of [[0.36, 0.5], [0.64, 0.5]]) for (let r = 0.025; r < 0.3; r += 0.025) c.circle(sx, sy, r, 0.8);
  c.dot(0.36, 0.5, 0.012); c.dot(0.64, 0.5, 0.012);
}

// Rauch: the constitution of knowledge. Claims on a ring, each checked by others across it.
export function checks(c) {
  const n = 13, pts = [...Array(n)].map((_, i) => [0.5 + 0.36 * Math.cos((i / n) * TAU - TAU / 4), 0.5 + 0.36 * Math.sin((i / n) * TAU - TAU / 4)]);
  for (let i = 0; i < n; i++) for (const k of [3, 5]) c.line(...pts[i], ...pts[(i + k) % n], 0.7);
  for (const p of pts) c.dot(p[0], p[1], 0.016);
}

// Rakove: original meanings. Manuscript lines in layers, with an inserted line above a caret.
export function strata(c) {
  for (let i = 0; i < 11; i++) {
    const y = 0.22 + i * 0.052, x1 = 0.78 - (i % 3) * 0.07;
    for (let x = 0.2; x < x1; x += 0.045 + c.R() * 0.03) { const l = 0.02 + c.R() * 0.04; c.line(x, y, Math.min(x1, x + l), y + (c.R() - 0.5) * 0.004, 1.3); }
  }
  c.poly([[0.46, 0.5], [0.49, 0.47], [0.52, 0.5]], 1.2, c.spot); c.line(0.38, 0.445, 0.64, 0.445, 1, c.spot);
}

// Weng: the seven-step synthesis. Seven arcs from wide reading converging on one line of argument.
export function seven(c) {
  for (let i = 0; i < 7; i++) {
    const y0 = 0.16 + i * 0.113, pts = [];
    for (let t = 0; t <= 1; t += 0.02) { const x = 0.12 + t * 0.62; pts.push([x, y0 + (0.5 - y0) * (t * t * (3 - 2 * t))]); }
    c.poly(pts, 1.1);
  }
  c.line(0.74, 0.5, 0.9, 0.5, 2.4);
}

// Berg: interpretability methods. An aperture of blades over a lattice: looking inside, through a chosen opening.
export function aperture(c) {
  const lat = (u, v) => (u - 0.5) ** 2 + (v - 0.5) ** 2 < 0.13;
  c.hatch(lat, 0.0, 0.045, 0.6); c.hatch(lat, Math.PI / 2, 0.045, 0.6);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU, b = a + TAU / 7;
    const p = [[0.5 + 0.43 * Math.cos(a), 0.5 + 0.43 * Math.sin(a)], [0.5 + 0.43 * Math.cos(b), 0.5 + 0.43 * Math.sin(b)], [0.5 + 0.17 * Math.cos(b + 0.6), 0.5 + 0.17 * Math.sin(b + 0.6)]];
    c.hatch(inPoly(p), (i / 7) * TAU, 0.009, 0.6); c.poly(p, 1, c.ink, true);
  }
}

// Mitchell: analogy-making. a is to b as c is to what: two pairs, the second answered by the same change.
export function analogy(c) {
  const sq = (x, y, s) => [[x - s, y - s], [x + s, y - s], [x + s, y + s], [x - s, y + s]];
  c.poly(sq(0.25, 0.32, 0.07), 1.6, c.ink, true); c.poly(sq(0.62, 0.32, 0.07), 1.6, c.ink, true); c.fill(inCircle(0.62, 0.32, 0.03));
  c.circle(0.25, 0.68, 0.075, 1.6); c.circle(0.62, 0.68, 0.075, 1.6); c.fill(inCircle(0.62, 0.68, 0.03), c.spot);
  for (const y of [0.32, 0.68]) c.poly([[0.37, y], [0.48, y], [0.45, y - 0.02], [0.48, y], [0.45, y + 0.02]], 1.1);
  c.line(0.12, 0.5, 0.88, 0.5, 0.6);
}
