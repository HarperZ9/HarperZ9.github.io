// The bucket chain: the 2, 8, 8, 2 network drawn down the hill (PROGRESS.md, step 15: data-art
// columns stepped down the slope, each node a bucket whose water is the value it holds, rings for
// the blame arriving at it, sized against the largest in its layer). Values and gradients are the
// real trace of one held-out point (facts.json chain). Also the spiral map and its boundary.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";

export const INK = { line: [0.75, 0.82, 0.95], warm: [0.93, 0.9, 0.84], ember: [0.89, 0.58, 0.45], water: [0.45, 0.62, 0.85], night: "#ece5d6", dim: "#958e80", emberS: "#e29472" };
export const layersOf = (c) => [c.input.value, c.hidden1.value, c.hidden2.value, c.output.probs];
export const gradsOf = (c) => [null, c.hidden1.gradOut, c.hidden2.gradOut, c.output.gradLogits];

// Where node i of layer l sits: columns across, each stepped down the hill.
export function at(l, i, n, { x0 = 520, dx = 340, y0 = 420, dy = 85, gap = 84 } = {}) { return [x0 + l * dx, y0 + l * dy + (i - (n - 1) / 2) * gap]; }

// The chain. fwd in 0..4 fills layer by layer; back in 0..3 lights the blame from the bottom up
// (the output as soon as back > 0, layer l once back reaches 3 - l);
// broken (layer index) draws a cracked link there; nudge flickers one weight.
export function chain(A, c, { fwd = 4, back = 0, broken = -1, a = 1, nudge = -1, t = 0 } = {}) {
  const L = layersOf(c), G = gradsOf(c), out = [];
  for (let l = 0; l < 3; l++) for (let i = 0; i < L[l].length; i++) for (let j = 0; j < L[l + 1].length; j++) {
    const p = at(l, i, L[l].length), q = at(l + 1, j, L[l + 1].length), hot = nudge === (l * 100 + i * 10 + j);
    out.push({ shape: polyline([...p, ...q]), fill: null, stroke: hot ? [...INK.ember, 0.9 * a] : [0.6, 0.55, 0.45, 0.12 * a], width: hot ? 3 : 1 });
    const uF = fwd - l, uB = back - (3 - l - 1);
    if (uF > 0 && uF < 1 && (i * 7 + j) % 5 === 0) out.push({ shape: circle(p[0] + (q[0] - p[0]) * uF, p[1] + (q[1] - p[1]) * uF, 4, 8), fill: [1, 0.9, 0.7, a], blend: "add" });
    if (uB > 0 && uB < 1 && (i * 7 + j) % 5 === 0) out.push({ shape: circle(q[0] + (p[0] - q[0]) * uB, q[1] + (p[1] - q[1]) * uB, 5, 8), fill: [...INK.ember, a], blend: "add" });
  }
  L.forEach((vals, l) => {
    const gmax = G[l] ? Math.max(...G[l].map(Math.abs), 1e-9) : 1;
    vals.forEach((v, i) => {
      const [x, y] = at(l, i, vals.length), full = Math.min(1, Math.abs(v)), filled = fwd >= l + (l === 0 ? 0 : 1) - 0.05, blamed = G[l] && back > 0 && back >= 3 - l - 1e-6;
      out.push({ shape: polyline([x - 22, y - 24, x + 22, y - 24, x + 16, y + 24, x - 16, y + 24], true), fill: [0.1, 0.09, 0.08, a], stroke: [0.62, 0.5, 0.32, a], width: 2 });
      if (filled) out.push({ shape: rect(x - 15, y + 22 - 42 * full, 30, 42 * full), fill: [...INK.water, (v >= 0 ? 0.9 : 0.55) * a] }, { shape: words(v.toFixed(2), A.mono, 18, x + 32, y + 6), fill: INK.dim, opacity: a });
      if (blamed) { const g = G[l][i], r = 30 + 26 * Math.abs(g) / gmax; out.push({ shape: circle(x, y, r, 28), fill: null, stroke: [...INK.ember, (0.35 + 0.6 * Math.abs(g) / gmax) * a], width: 3 }); }
      if (broken === l && i === 0) out.push({ shape: polyline([x - 40, y - 60, x - 20, y - 30, x - 36, y - 10, x - 14, y + 20]), fill: null, stroke: [1, 0.35, 0.25, a], width: 4 });
    });
  });
  return out;
}

// The spiral map: training points by class, and optionally the network's boundary (probability of
// class 1 on the facts grid) as a field of cells.
export function spiralMap(F, { x = 140, y = 240, size = 300, boundary = 0, a = 1, held = false } = {}) {
  const out = [{ shape: rect(x, y, size, size, 6), fill: [0.05, 0.05, 0.07, 0.9 * a], stroke: [0.5, 0.5, 0.55, 0.6 * a], width: 1.5 }];
  const B = F.boundary, [[u0, u1], [v0, v1]] = B.range, n = B.n, X = (u) => x + ((u - u0) / (u1 - u0)) * size, Y = (v) => y + size - ((v - v0) / (v1 - v0)) * size;
  if (boundary > 0) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = B.values[j][i], c = size / n;
    out.push({ shape: rect(x + i * c, y + size - (j + 1) * c, c + 0.5, c + 0.5), fill: p > 0.5 ? [...INK.ember, 0.28 * boundary * a * (p - 0.5) * 2] : [...INK.water, 0.28 * boundary * a * (0.5 - p) * 2] });
  }
  const D = held ? F.data.held : F.data.train;
  D.X.forEach(([u, v], k) => out.push({ shape: circle(X(u), Y(v), size / 110, 6), fill: D.Y[k] ? [...INK.ember, 0.9 * a] : [...INK.water, 0.9 * a] }));
  return out;
}
export const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
export const night = () => [{ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.02, 0.025, 0.035, 1] }];
