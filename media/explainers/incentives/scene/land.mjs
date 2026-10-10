// Film 4's world, "Models do what training pays for": a reward landscape seen from
// above as plotter contour lines on black (BIBLE.md, film 4). Low ground is reward.
// The optimizer is a bright point; a shortcut is a tunnel in drift that reaches the
// reward basin without the long ridge path that solves the task. Thermal false colour
// pools where reward pools, in the art layer only.
import { contour } from "../../../raw-native/web-23ec93f/motion/path.mjs";

export const C = Object.freeze({
  void: [0.008, 0.008, 0.010], ink: "#e8e2d2", ink2: "#aaa496", dim: "#6c675d", faint: "#34312c",
  hot: "#e29472", ok: "#63d4ce",
  thermal: ["#3b1f4a", "#6a2450", "#a8334a", "#d9603b", "#f2a33a", "#f7d774"],   // art layer only
});

// Named places, in design pixels.
export const P = Object.freeze({
  start: [330, 300], tests: [1120, 450], solve: [1620, 820], agree: [640, 790],
});

const g = (x, y, [cx, cy], r) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
const noise = (x, y) => 0.06 * Math.sin(x * 0.011 + 1.3) * Math.cos(y * 0.013 - 0.4) + 0.04 * Math.sin((x + y) * 0.007 + 2.1);
// The ridge: a raised band along the long path from the start to the solution.
function ridge(x, y) {
  const ax = P.start[0], ay = P.start[1], bx = P.solve[0], by = P.solve[1];
  const vx = bx - ax, vy = by - ay, u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  const px = ax + vx * u + Math.sin(u * Math.PI * 2.2) * 140, py = ay + vy * u - Math.sin(u * Math.PI) * 120;
  return Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * 70 * 70));
}
// Three fields: paid for passing tests (the basin off the ridge), paid for agreeing
// (a second basin), and the fix (one basin, at the end of the ridge).
export const fields = {
  tests: (x, y) => 0.35 * (y / 1080) + noise(x, y) + 0.25 * ridge(x, y) - 1.0 * g(x, y, P.tests, 210) - 0.25 * g(x, y, P.solve, 150),
  agree: (x, y) => 0.35 * (y / 1080) + noise(x, y) + 0.25 * ridge(x, y) - 0.55 * g(x, y, P.tests, 210) - 1.05 * g(x, y, P.agree, 200),
  fixed: (x, y) => 0.35 * (y / 1080) + noise(x, y) + 0.25 * ridge(x, y) - 1.05 * g(x, y, P.solve, 240),
};
export const blend = (fa, fb, u) => (x, y) => fa(x, y) * (1 - u) + fb(x, y) * u;

// Marching squares on a grid of cell px, chained into polylines. Returns, per level,
// { lines: [Float32Array], closed: [bool] }.
export function contours(f, levels, cell = 12, W = 1920, H = 1080) {
  const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1, v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = f(i * cell, j * cell);
  return levels.map((L) => {
    const segs = [];
    const lerpPt = (i0, j0, i1, j1) => { const a = v[j0 * nx + i0], b = v[j1 * nx + i1], t = (L - a) / (b - a); return [(i0 + (i1 - i0) * t) * cell, (j0 + (j1 - j0) * t) * cell]; };
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const c = (v[j * nx + i] > L ? 1 : 0) | (v[j * nx + i + 1] > L ? 2 : 0) | (v[(j + 1) * nx + i + 1] > L ? 4 : 0) | (v[(j + 1) * nx + i] > L ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const e = [lerpPt(i, j, i + 1, j), lerpPt(i + 1, j, i + 1, j + 1), lerpPt(i, j + 1, i + 1, j + 1), lerpPt(i, j, i, j + 1)];   // top right bottom left
      const T = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]] }[c];
      for (const [a, b] of T) segs.push([e[a], e[b]]);
    }
    return chain(segs);
  });
}
function chain(segs) {
  const key = (p) => `${Math.round(p[0] * 8)},${Math.round(p[1] * 8)}`, ends = new Map(), used = new Uint8Array(segs.length);
  segs.forEach((s, k) => { for (const p of s) { const q = key(p); if (!ends.has(q)) ends.set(q, []); ends.get(q).push(k); } });
  const lines = [], closed = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const pts = [segs[k][0], segs[k][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? pts[pts.length - 1] : pts[0], next = (ends.get(key(tip)) || []).find((m) => !used[m]);
        if (next === undefined) break;
        used[next] = 1;
        const s = segs[next], far = key(s[0]) === key(tip) ? s[1] : s[0];
        if (dir) pts.push(far); else pts.unshift(far);
      }
    }
    const isClosed = pts.length > 3 && key(pts[0]) === key(pts[pts.length - 1]);
    lines.push(new Float32Array(pts.flat())); closed.push(isClosed);
  }
  return { lines, closed };
}
export const asShape = (lines) => lines.map((p) => contour(p, false));
export const LEVELS = Array.from({ length: 44 }, (_, k) => -0.9 + k * 0.032);
