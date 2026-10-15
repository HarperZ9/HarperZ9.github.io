// The held-out lab, drawn on Pylon's printed chart: the reader's training points, the held-out
// points, the fitted curve (broken where it leaves the chart), the two errors; or the spiral
// network's training and held-out loss for the number of points the reader chose.
import { rect, circle, polyline, words } from "../../media/school/shared/lib.mjs";
import { K, desk, pylon } from "../../media/school/vectors/scene/chart.mjs";

const X = (x) => 960 + x * 560, Y = (y) => 560 - y * 300, YMAX = 1.45;
const T = (A, s, size, x, y, fill = K.ink, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });
const paper = (t) => [...desk(t), { shape: rect(330, 110, 1260, 880, 6), fill: [0.9, 0.85, 0.71, 1], stroke: "#3a2c1c", width: 4 }];

function fit(s, A, t) {
  const items = paper(t), F = s.fit;
  items.push({ shape: polyline([X(-1), Y(0), X(1), Y(0)]), fill: null, stroke: [0.35, 0.3, 0.22, 0.3], width: 1.5 });
  s.held.x.forEach((x, i) => { if (i < 300) items.push({ shape: circle(X(x), Y(s.held.y[i]), 4, 8), fill: [0.35, 0.42, 0.55, 0.5] }); });
  let run = [];
  const flush = () => { if (run.length >= 4) items.push({ shape: polyline(run), fill: null, stroke: K.rust, width: 4 }); run = []; };
  s.curve.forEach(([x, y]) => { if (Math.abs(y) > YMAX) { flush(); return; } run.push(X(x), Y(y)); });
  flush();
  s.train.x.forEach((x, i) => items.push({ shape: circle(X(x), Y(s.train.y[i]), 9, 12), fill: K.ink }));
  items.push(T(A, `degree ${F.degree}${F.lambda ? `, penalty ${F.lambda}` : ""}: error on its ${s.train.x.length} points ${F.trainRmse.toExponential(2)}`, 26, 380, 170), T(A, `error on ${s.held.x.length} held-out points ${F.heldRmse < 1000 ? F.heldRmse.toFixed(3) : F.heldRmse.toExponential(2)}`, 26, 380, 208, K.rust));
  items.push(...pylon(t, 1745, 1015, 0.5));
  return items;
}

function spiral(s, A, t) {
  const items = paper(t), Xs = (st) => 420 + (st / s.steps) * 1080, Yl = (l) => 880 - Math.min(l, 1.6) * 420;
  if (s.curve) {
    items.push({ shape: polyline(s.curve.flatMap((p) => [Xs(p.step), Yl(p.loss)])), fill: null, stroke: K.ink, width: 3 }, { shape: polyline(s.curve.flatMap((p) => [Xs(p.step), Yl(p.heldLoss)])), fill: null, stroke: K.rust, width: 3 });
    const last = s.curve.at(-1), m = s.curve.reduce((a, b) => (b.heldLoss < a.heldLoss ? b : a));
    items.push({ shape: circle(Xs(m.step), Yl(m.heldLoss), 10, 14), fill: null, stroke: K.rust, width: 3 });
    items.push(T(A, `${s.n} training points: training accuracy ${(last.accuracy * 100).toFixed(1)}%, held-out ${(last.heldAccuracy * 100).toFixed(1)}%`, 26, 380, 170), T(A, `held-out loss lowest at update ${m.step}`, 24, 380, 208, K.rust));
  } else items.push(T(A, "choose how many training points, then press Train", 26, 960, 520, K.ink, "center"));
  items.push(T(A, "training loss (ink) and held-out loss (rust) over updates", 22, 420, 950, K.dim), ...pylon(t, 1745, 1015, 0.5));
  return items;
}

export function frame(s, A, t) {
  return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items: s.mode === "spiral" ? spiral(s, A, t) : fit(s, A, t), post: { bloom: 0.1, threshold: 1, vignette: 0.38, grain: 0, passes: [] } };
}
