// Pylon's desk and her printed chart, seen from above (the direction chosen in PROGRESS.md, step
// 11): a real chart's line-work (coastline, soundings), a square grid so angles on screen are the
// true angles, crates as vectors from the corner, and the small drawing helpers the segments share.
import { rect, circle, polyline, rng, lin, rad, words, pose, GUIDES, clipBeat, span, ease } from "../../shared/lib.mjs";
import { coneParts } from "../../../raw-native/tree-c6b114d/templates/guides/pylon.mjs";

// Ink on the paper; rust is the lesson's one hot mark (the second crate, b); the night inks are
// for the dark (data-art) segments.
export const K = { paper: "#e6d9b6", paper2: "#cbb98f", ink: "#1d1812", dim: "#6e5c42", faint: [0.35, 0.3, 0.22, 0.32],
  rust: "#a5452a", sea: [0.25, 0.32, 0.4], wood: "#2a2018", night: "#ece5d6", nightDim: "#958e80", ember: "#e29472" };
// The chart: origin O on screen, U pixels to one square. Every vector is drawn through P.
export const O = [640, 840], U = 150;
export const P = ([x, y], o = O, u = U) => [o[0] + x * u, o[1] - y * u];
export const PAPER = { x: 330, y: 110, w: 1260, h: 880 };

const sea = (() => {
  const r = rng(5), lines = [], marks = [];
  for (let k = 0; k < 7; k++) { const pts = []; for (let x = PAPER.x + 10; x <= PAPER.x + PAPER.w - 10; x += 18) pts.push(x, 168 + k * 15 + 26 * Math.sin(x / 140 + k) + 9 * Math.sin(x / 37)); lines.push(pts); }
  for (let k = 0; k < 46; k++) marks.push([PAPER.x + 30 + r() * (PAPER.w - 60), 290 + r() * 640, String(2 + Math.floor(r() * 30))]);
  return { lines, marks };
})();

// The desk under the lamp, and the lamp's falloff. dim (0..1) turns the lamp down.
export function desk(t, dim = 0) {
  const a = 1 - 0.85 * dim;
  return [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: rad(960, 520, 1250, [0, [0.17 * a, 0.125 * a, 0.09 * a, 1]], [1, [0.03, 0.022, 0.016, 1]]) },
    ...[0, 1, 2, 3, 4, 5].map((k) => ({ shape: polyline([0, 140 + k * 170, 1920, 120 + k * 172]), fill: null, stroke: [0, 0, 0, 0.25 * a], width: 2, screen: true }))];
}

// The printed chart: paper, coastline, soundings, grid and axes. show (0..1) fades the grid in.
export function paper(A, { grid = 1, axes = 1, alpha = 1 } = {}) {
  const { x, y, w, h } = PAPER, out = [];
  out.push({ shape: rect(x + 10, y + 14, w, h, 6), fill: [0, 0, 0, 0.45 * alpha], blur: 18 });
  out.push({ shape: rect(x, y, w, h, 6), fill: lin(x, y, x + w, y + h, [0, K.paper], [1, K.paper2]), stroke: "#3a2c1c", width: 4, opacity: alpha });
  sea.lines.forEach((pts, k) => out.push({ shape: polyline(pts), fill: null, stroke: [...K.sea, (0.36 - 0.04 * k) * alpha], width: 1.5 }));
  for (const [mx, my, s] of sea.marks) out.push({ shape: words(s, A.mono, 15, mx, my, "center"), fill: [...K.sea, 0.42 * alpha] });
  if (grid > 0) {
    for (let i = -2; i <= 6; i++) { const [gx] = P([i, 0]); out.push({ shape: polyline([gx, y + 22, gx, y + h - 12]), fill: null, stroke: [...K.faint.slice(0, 3), 0.32 * grid * alpha], width: 1.5 }); }
    for (let j = -1; j <= 4; j++) { const [, gy] = P([0, j]); out.push({ shape: polyline([x + 12, gy, x + w - 12, gy]), fill: null, stroke: [...K.faint.slice(0, 3), 0.32 * grid * alpha], width: 1.5 }); }
  }
  if (axes > 0) {
    out.push({ shape: polyline([...P([-2.1, 0]), ...P([6.2, 0])]), fill: null, stroke: K.ink, width: 3, opacity: axes * alpha });
    out.push({ shape: polyline([...P([0, -0.8]), ...P([0, 4.75])]), fill: null, stroke: K.ink, width: 3, opacity: axes * alpha });
    out.push({ shape: words("east", A.mono, 24, ...P([5.75, -0.32]), "center"), fill: K.dim, opacity: axes * alpha });
    out.push({ shape: words("north", A.mono, 24, ...P([-0.42, 4.5]), "center"), fill: K.dim, opacity: axes * alpha });
    out.push({ shape: circle(...P([0, 0]), 7, 16), fill: K.ink, opacity: axes * alpha });
  }
  return out;
}

// An arrow from p0 to p1 (screen points), grown to fraction g.
export function arrow(p0, p1, colour, w = 6, g = 1, opacity = 1) {
  if (g <= 0) return [];
  const e = [p0[0] + (p1[0] - p0[0]) * g, p0[1] + (p1[1] - p0[1]) * g], dx = e[0] - p0[0], dy = e[1] - p0[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = Math.min(L * 0.5, 12 + 2.2 * w);
  return [{ shape: polyline([p0[0], p0[1], e[0] - ux * h * 0.6, e[1] - uy * h * 0.6]), fill: null, stroke: colour, width: w, opacity },
    { shape: polyline([e[0], e[1], e[0] - ux * h - uy * h * 0.5, e[1] - uy * h + ux * h * 0.5, e[0] - ux * h + uy * h * 0.5, e[1] - uy * h - ux * h * 0.5], true), fill: colour, opacity }];
}
// A chart vector as an arrow from the origin.
export const vec = (v, colour, w = 6, g = 1, opacity = 1, from = [0, 0]) => arrow(P(from), P([from[0] + v[0], from[1] + v[1]]), colour, w, g, opacity);

// The angle between two directions, as an arc of chart radius rr.
export function arc(a0, a1, rr, colour, w = 4, opacity = 1) {
  const pts = [];
  for (let k = 0; k <= 40; k++) { const a = a0 + (a1 - a0) * (k / 40); pts.push(...P([rr * Math.cos(a), rr * Math.sin(a)])); }
  return { shape: polyline(pts), fill: null, stroke: colour, width: w, opacity };
}
// The little square that marks a right angle at the corner, along direction a.
export function rightMark(a, s, colour, opacity = 1) {
  const u = [Math.cos(a) * s, Math.sin(a) * s], v = [-Math.sin(a) * s, Math.cos(a) * s];
  return { shape: polyline([...P(u), ...P([u[0] + v[0], u[1] + v[1]]), ...P(v)]), fill: null, stroke: colour, width: 4, opacity };
}

// A crate seen from above at chart point v: lid, cross-batten and a stencilled label.
export function crate(A, v, { label = null, s = 1, alpha = 1, colour = "#8e6c47", lift = 0 } = {}) {
  const [x, y] = P(v), r = 26 * s, out = [];
  if (lift > 0) out.push({ shape: rect(x - r + 10 * lift, y - r + 14 * lift, 2 * r, 2 * r, 3), fill: [0, 0, 0, 0.3 * alpha], blur: 8 });
  const yy = y - 40 * lift;
  out.push({ shape: rect(x - r, yy - r, 2 * r, 2 * r, 3), fill: colour, stroke: "#2a1f15", width: 3, opacity: alpha },
    { shape: polyline([x - r, yy - r, x + r, yy + r]), fill: null, stroke: "#5c4630", width: 2.5, opacity: alpha },
    { shape: polyline([x - r, yy + r * 0.2, x + r, yy + r * 0.2]), fill: null, stroke: "#5c4630", width: 2, opacity: alpha });
  if (label) out.push({ shape: words(label, A.sans, 34, x + r + 12, yy - r - 4), fill: K.ink, opacity: alpha });
  return out;
}

// A manifest tag: a small paper card with mono text, world space.
export function tag(A, str, x, y, { size = 30, alpha = 1, ink = K.ink, fill = "#f3ead2", anchor = "center" } = {}) {
  const w = str.length * size * 0.62 + 28, h = size + 22, x0 = anchor === "left" ? x : x - w / 2;
  return [{ shape: rect(x0, y - h / 2, w, h, 4), fill, stroke: "#3a2c1c", width: 2, opacity: alpha },
    { shape: words(str, A.mono, size, x0 + w / 2, y + size * 0.36, "center"), fill: ink, opacity: alpha }];
}

// Pylon on the desk's edge: her talk clip while the voice speaks, her idle clip otherwise.
export function pylon(t, x, y, s, { talk = 0, ...extra } = {}) {
  const o = clipBeat("pylon", talk ? "talk" : "idle", { s, o: { look: [-8, -3] } }, t % 2.4).o;
  return pose(GUIDES.pylon.parts({ ...o, ...extra }), { x, y: y + (o.dy || 0) * s, s, shear: GUIDES.pylon.shear || 0 });
}
// A traffic cone standing at (x, y), scale s.
export const cone = (x, y, s = 1, tilt = 0) => pose(coneParts(0, 0, { tilt }), { x, y, s });

// 1 while the voice is speaking at t (from the timing rows), for Pylon's bark.
export const talking = (rows, t) => (rows.some((r) => t >= r.start && t <= r.end) ? 1 : 0);
export { span, ease };
