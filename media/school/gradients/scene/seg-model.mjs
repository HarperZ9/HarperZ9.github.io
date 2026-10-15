// The second half of the gradients film: the attention model's own hill (gradient lengths before
// and after training, and the Li 2018 slice through the trained point, from facts.json), the one
// dial we choose (its loss curve and two descents, from the model's own backward pass), what the
// fog hides, and goodnight. Every number drawn is a facts.json value.
import { rect, circle, polyline, span, ease, lerp, window, label, C } from "../../shared/lib.mjs";
import { pylon, talking, cone } from "../../vectors/scene/chart.mjs";
import { TWO_VALLEYS, descend } from "../../../../system/school/gradients.mjs";
import { INK, view, relief, path, night, lab } from "./terrain.mjs";

const guide = (t, A, extra = {}) => pylon(t, 1745, 1015, 0.52, { talk: talking(A.rows, t), ...extra });
const f2 = (v) => v.toFixed(2);

// The slice: bilinear over the 21 x 21 grid of held-out loss values, heights on a log scale.
function sliceF(L) {
  const n = L.n, a0 = L.alphas[0], da = L.alphas[1] - L.alphas[0], V = L.values;
  return (x, y) => {
    const fx = Math.max(0, Math.min(n - 1.001, (x - a0) / da)), fy = Math.max(0, Math.min(n - 1.001, (y - a0) / da)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    return (1 - u) * (1 - v) * V[j][i] + u * (1 - v) * V[j][i + 1] + (1 - u) * v * V[j + 1][i] + u * v * V[j + 1][i + 1];
  };
}

export function real(t, A, T, F) {
  const items = [...night()], G = F.gradientNorm, L = F.landscape.trained;
  if (t < T.slice) {
    // 20,864 directions: a star of faint lines; then the two gradient lengths as bars.
    const star = span(t, T.start, T.start + 2);
    for (let k = 0; k < 220; k++) { const a = k * 2.39996, r = 120 + 360 * ((k * 0.618) % 1); items.push({ shape: polyline([960, 470, 960 + Math.cos(a) * r * star, 470 + Math.sin(a) * r * 0.75 * star]), fill: null, stroke: [...INK.line, 0.16], width: 1, blend: "add" }); }
    items.push(lab(A, `${G.nParams.toLocaleString("en")} directions (220 drawn)`, 26, 960, 120, INK.dim, "center", star));
    const bars = span(t, T.before, T.before + 1.2);
    if (bars > 0) {
      const w = (v) => 900 * (v / G.init.rows256.norm);
      items.push({ shape: rect(510, 820, w(G.init.rows256.norm) * bars, 34, 4), fill: [...INK.warm, 0.85] }, lab(A, `before training: ${f2(G.init.rows256.norm)}`, 28, 510, 806, INK.night, "left", bars));
      if (t >= T.after) items.push({ shape: rect(510, 920, w(G.trained.rows256.norm) * span(t, T.after, T.after + 1), 34, 4), fill: [...INK.ember, 0.9] }, lab(A, `after training: ${f2(G.trained.rows256.norm)}`, 28, 510, 906, INK.emberS, "left", 1));
      items.push(lab(A, "length of the gradient (all 20,864 slopes), 256 held-out sentences", 22, 510, 990, INK.dim, "left", bars));
    }
  } else {
    const lg = (z) => 2.6 * Math.log(z / L.min), V = view({ cx: 0, cy: 0, U: 360, tilt: 1, yaw: -0.4 + 0.15 * span(t, T.slice, T.end), h: lg, hz: 60, oy: 640 }), f = sliceF(L);
    items.push(...relief(V, f, [[-1, 1], [-1, 1]], { rows: 20, cols: 20, a: span(t, T.slice, T.slice + 2) }));
    items.push({ shape: circle(...V.P(0, 0, f(0, 0)), 10, 16), fill: [...INK.ember, 1], blend: "add" });
    if (t >= T.values) items.push(lab(A, `middle (the trained model): ${f2(L.center)}`, 28, 80, 80, INK.emberS, "left", 1), lab(A, `highest at the edges: ${f2(L.max)}`, 28, 80, 124, INK.night, "left", 1));
    items.push(lab(A, "held-out loss along two random directions (filter-normalised); height on a log scale", 22, 80, 1040, INK.dim, "left", 1));
    if (t >= T.warn) {
      const w = span(t, T.warn, T.warn + 1);
      items.push({ shape: rect(1120, 160, 700, 300, 10), fill: [0.03, 0.035, 0.05, 0.85 * w], screen: true });
      for (let k = 0; k < 60; k++) { const a = k * 2.39996; items.push({ shape: polyline([1470, 310, 1470 + Math.cos(a) * 120, 310 + Math.sin(a) * 120]), fill: null, stroke: [...INK.line, 0.2 * w], width: 1, screen: true }); }
      items.push({ shape: polyline([1350, 310, 1590, 310]), fill: null, stroke: [...INK.ember, w], width: 3, screen: true }, { shape: polyline([1470, 190, 1470, 430]), fill: null, stroke: [...INK.ember, w], width: 3, screen: true });
      items.push(lab(A, `cosine with the steepest way: under ${Math.max(...L.gradientCosines.map(Math.abs)).toFixed(2)}`, 22, 1470, 470, INK.dim, "center", w));
    }
  }
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// One dial: the loss as the readout matrix is scaled by s; two descents from s = 0.05.
export function one(t, A, T, F) {
  const o = F.oneNumber, items = [...night()], X = (s) => 360 + s * 400, Y = (l) => 900 - (l / 4) * 700;
  const ax = span(t, T.start, T.start + 1.2);
  items.push({ shape: polyline([X(0), 900, X(3), 900]), fill: null, stroke: [...INK.line, 0.5 * ax], width: 2 }, { shape: polyline([X(0), 900, X(0), 200]), fill: null, stroke: [...INK.line, 0.5 * ax], width: 2 });
  items.push({ shape: polyline(o.curve.flatMap(([s, l]) => [X(s), Y(l)]).slice(0, Math.max(4, Math.floor(o.curve.length * 2 * ax)))), fill: null, stroke: [...INK.warm, ax], width: 3 });
  for (const [s, txt] of [[0, "0"], [1, "1 (as trained)"], [2, "2"], [3, "3"]]) items.push(lab(A, txt, 22, X(s), 940, INK.dim, "center", ax));
  items.push(lab(A, "dial s on the last matrix", 24, X(1.5), 985, INK.dim, "center", ax), lab(A, "held-out loss", 24, X(0) - 20, 190, INK.dim, "left", ax));
  if (t >= T.bottom) { const a = span(t, T.bottom, T.bottom + 0.8); items.push({ shape: polyline([X(o.sStar), 900, X(o.sStar), Y(o.lossAtStar)]), fill: null, stroke: [...INK.ember, a], width: 2 }, lab(A, `lowest at ${f2(o.sStar)}`, 26, X(o.sStar) - 10, Y(o.lossAtStar) - 30, INK.emberS, "right", a)); }
  const ride = (d, t0, col) => { const k = Math.min(d.path.length - 1, Math.floor(span(t, t0, t0 + 4.5) * (d.path.length - 1))); const pts = d.path.slice(0, k + 1); return [{ shape: polyline(pts.flatMap(([s, l]) => [X(s), Y(l)])), fill: null, stroke: [...col, 0.6], width: 2 }, { shape: circle(X(pts[k][0]), Y(pts[k][1]), 10, 14), fill: [...col, 1], blend: "add" }]; };
  if (t >= T.small) items.push(...ride(o.descents[1], T.small, INK.line), lab(A, `step ${o.descents[1].step}: forty steps end at ${f2(o.descents[1].end)}`, 26, 1150, 300, INK.night, "left", 1));
  if (t >= T.big) items.push(...ride(o.descents[2], T.big, INK.ember), lab(A, `step ${o.descents[2].step}: overshoots to ${f2(o.descents[2].path[1][0])}, ends at ${f2(o.descents[2].end)}`, 26, 1150, 344, INK.emberS, "left", 1));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// What the fog hides: on a small handful of sentences the slope wobbles round the true one.
export function edge(t, A, T) {
  const items = [...night()], cx = 960, cy = 520, a = span(t, T.start, T.start + 1);
  items.push({ shape: polyline([cx, cy, cx + 360, cy - 140]), fill: null, stroke: [...INK.warm, a], width: 6 });
  for (let k = 0; k < 9; k++) { const j = Math.sin(t * 2.3 + k * 1.7) * 0.35, L = 300 + 80 * Math.sin(t * 1.9 + k); items.push({ shape: polyline([cx, cy, cx + Math.cos(-0.37 + j) * L, cy + Math.sin(-0.37 + j) * L]), fill: null, stroke: [...INK.ember, 0.45 * a * span(t, T.handful, T.handful + 1)], width: 2 }); }
  items.push(lab(A, "the slope on all the sentences (light), and on small handfuls (ember): an illustration", 24, 960, 900, INK.dim, "center", a));
  if (t >= T.chain) items.push(lab(A, "20,864 slopes, all at once: next lesson", 34, 960, 820, INK.emberS, "center", span(t, T.chain, T.chain + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Goodnight: Pylon's cone in the right-hand valley, a bottom but not the lowest, and the fog.
export function close(t, A, T) {
  const V = view({ cx: 0, cy: 0, U: 230, tilt: 1, yaw: -0.25, h: (z) => 1.6 * (z + 0.3), hz: 60 }), f = (x, y) => TWO_VALLEYS.f(x, y), items = [...night(), ...relief(V, f, [[-2, 2], [-2, 2]], { rows: 28 })];
  const end = descend(TWO_VALLEYS, [0.3, 0], { step: 0.02, steps: 400 }).end, [x, y] = V.P(end[0], end[1], f(...end)), c = span(t, T.start + 1, T.start + 2.2, ease.out);
  if (c > 0) items.push(...cone(x, lerp(y - 300, y + 4, c), 0.35));
  items.push(...guide(t, A, { hat: c <= 0 }), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.45, 0.5, 0.58, 0.5 * span(t, T.night, T.end)] }, { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.8 * span(t, T.end - 2, T.end)] });
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
