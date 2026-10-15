// The hill in fog: any surface z = f(x, y) drawn by one projection that tilts from a contour map
// seen from above (tilt 0, true slopes) to a line-work relief seen from the side (tilt 1, height is
// the loss), with fog thickening into the distance. The direction is PROGRESS.md, step 14. Paths
// ride the surface; heights can be squashed (log) for surfaces that rise steeply.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";

export const INK = { line: [0.75, 0.82, 0.95], warm: [0.93, 0.9, 0.84], ember: [0.89, 0.58, 0.45], dim: "#958e80", night: "#ece5d6", emberS: "#e29472" };

// A view: centre (cx, cy) of the surface, scale U px per unit, tilt 0..1, yaw (radians), and a
// height map h(z) (identity, or log for steep surfaces) with hz px per unit of h.
export function view({ cx = 0, cy = 0, U = 200, tilt = 1, yaw = -0.5, h = (z) => z, hz = 52, ox = 960, oy = 560, zmax = 9 } = {}) {
  const P = (x, y, z) => {
    const dx = x - cx, dy = y - cy, xr = Math.cos(yaw) * dx - Math.sin(yaw) * dy, yr = Math.sin(yaw) * dx + Math.cos(yaw) * dy;
    const top = [ox + xr * U, oy - yr * U], side = [ox + xr * U, oy + 90 + yr * U * 0.32 - Math.min(h(z), zmax) * hz];
    return [top[0] + (side[0] - top[0]) * tilt, top[1] + (side[1] - top[1]) * tilt];
  };
  return { P, depth: (x, y) => Math.sin(yaw) * (x - cx) + Math.cos(yaw) * (y - cy), tilt };
}

// Relief lines along x at each y row (and fainter along y); fog by depth when tilted.
export function relief(V, f, [[x0, x1], [y0, y1]], { rows = 24, cols = 12, a = 1, colour = INK.line } = {}) {
  const out = [], fog = (d) => 1 - V.tilt * 0.75 * Math.max(0, Math.min(1, (d - (y0 - y1) / 2) / (y1 - y0)));
  for (let i = 0; i <= rows; i++) {
    const y = y0 + ((y1 - y0) * i) / rows, pts = [];
    for (let k = 0; k <= 60; k++) { const x = x0 + ((x1 - x0) * k) / 60; pts.push(...V.P(x, y, f(x, y))); }
    out.push({ shape: polyline(pts), fill: null, stroke: [...colour, 0.34 * a * fog(V.depth((x0 + x1) / 2, y))], width: 1.2, blend: "add" });
  }
  for (let j = 0; j <= cols; j++) {
    const x = x0 + ((x1 - x0) * j) / cols, pts = [];
    for (let k = 0; k <= 60; k++) { const y = y0 + ((y1 - y0) * k) / 60; pts.push(...V.P(x, y, f(x, y))); }
    out.push({ shape: polyline(pts), fill: null, stroke: [...colour, 0.12 * a], width: 1, blend: "add" });
  }
  return out;
}

// Contour lines by marching squares on an n x n sample, at the given levels.
export function contours(V, f, [[x0, x1], [y0, y1]], levels, { n = 64, a = 1, colour = INK.warm } = {}) {
  const out = [], X = (i) => x0 + ((x1 - x0) * i) / n, Y = (j) => y0 + ((y1 - y0) * j) / n, F = [];
  for (let j = 0; j <= n; j++) { F.push([]); for (let i = 0; i <= n; i++) F[j].push(f(X(i), Y(j))); }
  for (const L of levels) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = [[X(i), Y(j), F[j][i]], [X(i + 1), Y(j), F[j][i + 1]], [X(i + 1), Y(j + 1), F[j + 1][i + 1]], [X(i), Y(j + 1), F[j + 1][i]]], pts = [];
    for (let e = 0; e < 4; e++) { const p = c[e], q = c[(e + 1) % 4]; if ((p[2] - L) * (q[2] - L) < 0) { const u = (L - p[2]) / (q[2] - p[2]); pts.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]); } }
    if (pts.length === 2) out.push({ shape: polyline([...V.P(...pts[0], L), ...V.P(...pts[1], L)]), fill: null, stroke: [...colour, 0.45 * a], width: 1.5, blend: "add" });
  }
  return out;
}

// A path of [x, y, z?] points riding the surface, shown up to n points; the last is a lantern.
export function path(V, f, pts, n, colour, { a = 1, w = 3 } = {}) {
  const k = Math.max(1, Math.min(pts.length, Math.floor(n) + 1)), use = pts.slice(0, k), sp = use.flatMap((p) => V.P(p[0], p[1], f(p[0], p[1])));
  const out = [{ shape: polyline(sp), fill: null, stroke: [...colour, 0.9 * a], width: w, blend: "add" }];
  use.forEach((p, i) => out.push({ shape: circle(...V.P(p[0], p[1], f(p[0], p[1])), i === k - 1 ? 9 : 5, 12), fill: [...colour, a], blend: "add" }));
  return out;
}

// Fog in screen space, thicker at the top (the far side of the hill).
export const fogLayer = (a = 1) => [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.55, 0.6, 0.68, 0.1 * a] },
  { shape: rect(0, 0, 1920, 560), screen: true, fill: [0.5, 0.55, 0.62, 0.0], blur: 0 }];
export const night = () => [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.02, 0.025, 0.035, 1] }];
export const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
