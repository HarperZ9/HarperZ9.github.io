// The held-out film, on Pylon's printed chart (PROGRESS.md, step 17): sixteen points and three
// fits, the points kept back, error against flexibility, the leash (ridge), the spirals with too
// few points, the spread of one draw, and the language model's seen and unseen sentences. Every
// curve and number is from facts.json (tools/school/fill_heldout.mjs); curves break where they
// leave the chart instead of running along its edge.
import { rect, circle, polyline, span, ease, lerp, window, words, label, C } from "../../shared/lib.mjs";
import { K, desk, pylon, talking, cone } from "../../vectors/scene/chart.mjs";

const PAPER = { x: 330, y: 110, w: 1260, h: 880 };
const X = (x) => 960 + x * 560, Y = (y) => 560 - y * 300, YMAX = 1.45;
const DEG = { 1: K.ink, 3: "#2d4f7a", 15: K.rust };
const lab = (A, s, size, x, y, fill = K.ink, a = 1, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a });
const guide = (t, A, extra = {}) => pylon(t, 1745, 1015, 0.52, { talk: talking(A.rows, t), ...extra });
function sheet(t, dim = 0) {
  return [...desk(t, dim), { shape: rect(PAPER.x, PAPER.y, PAPER.w, PAPER.h, 6), fill: [0.9, 0.85, 0.71, 1], stroke: "#3a2c1c", width: 4 }];
}
// A curve as runs of points inside the chart; a run ends where the curve leaves it.
function curve(xs, ys, col, { a = 1, w = 4, upto = 1 } = {}) {
  const out = [], n = Math.max(2, Math.ceil(xs.length * upto));
  let run = [];
  const flush = () => { if (run.length >= 4) out.push({ shape: polyline(run), fill: null, stroke: col, width: w, opacity: a }); run = []; };
  for (let i = 0; i < n; i++) { if (Math.abs(ys[i]) > YMAX) { flush(); continue; } run.push(X(xs[i]), Y(ys[i])); }
  flush();
  return out;
}
const points = (p, { held = 0, train = 1 } = {}) => [
  ...p.held.x.map((x, i) => ({ shape: circle(X(x), Y(p.held.y[i]), 4, 8), fill: [0.35, 0.42, 0.55, 0.55 * held] })),
  ...p.train.x.map((x, i) => ({ shape: circle(X(x), Y(p.train.y[i]), 9, 12), fill: [0.11, 0.09, 0.07, train] }))];

export function title(t, A, T, F) {
  const a = window(t, T.say, T.end, 0.6, 0.8), items = [...sheet(t), ...points(F.poly, { train: 0.25 })];
  items.push(label(A, "The held-out set", 96, 960, 300, K.ink, "center", a, "head"), label(A, "learning, or remembering?", 38, 960, 360, K.dim, "center", span(t, T.sub, T.sub + 0.6) * a));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// Sixteen points; the line, the gentle curve, the wild one through every point.
export function pts(t, A, T, F) {
  const p = F.poly, c = p.curves, items = [...sheet(t), { shape: polyline([X(-1), Y(0), X(1), Y(0)]), fill: null, stroke: [0.35, 0.3, 0.22, 0.3], width: 1.5 }];
  items.push(...points(p, { train: span(t, T.start, T.start + 1.5) }));
  for (const [d, t0] of [[1, T.line], [3, T.gentle], [15, T.wild]]) if (t >= t0) items.push(...curve(c.x, c.byDegree[d], DEG[d], { upto: span(t, t0, t0 + 2.5) }));
  if (t >= T.zero) items.push(lab(A, `degree 15 on its own 16 points: error ${p.degrees[15].trainRmse.toExponential(1)}`, 28, 380, 170, K.rust, span(t, T.zero, T.zero + 0.6)));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// The held-out points appear; the errors; error against flexibility.
export function held(t, A, T, F) {
  const p = F.poly, c = p.curves, items = [...sheet(t)];
  if (t < T.flex) {
    items.push(...points(p, { held: span(t, T.start, T.start + 2) }));
    for (const d of [3, 15]) items.push(...curve(c.x, c.byDegree[d], DEG[d]));
    if (t >= T.errs) items.push(lab(A, `on the ${p.nHeld} held-out points: degree 3 error ${p.degrees[3].heldRmse.toFixed(2)}`, 28, 380, 170, "#2d4f7a"), lab(A, `degree 15 error ${Math.round(p.degrees[15].heldRmse).toLocaleString("en")}`, 28, 380, 210, K.rust, span(t, T.wildErr, T.wildErr + 0.6)));
  } else {
    // Error (log scale) against degree: training error falls, held-out error falls then climbs.
    const D = p.degrees, XD = (d) => 450 + d * 64, YE = (e) => 860 - (Math.log10(Math.max(e, 1e-12)) + 12) * 42, g = span(t, T.flex, T.flex + 4);
    const n = Math.max(2, Math.ceil(D.length * g));
    items.push({ shape: polyline(D.slice(0, n).flatMap((r) => [XD(r.degree), YE(r.trainRmse)])), fill: null, stroke: K.ink, width: 4 }, { shape: polyline(D.slice(0, n).flatMap((r) => [XD(r.degree), YE(r.heldRmse)])), fill: null, stroke: K.rust, width: 4 });
    for (const e of [-12, -8, -4, 0, 3]) items.push(lab(A, `1e${e}`, 20, 400, YE(10 ** e) + 6, K.dim, 1, "right"));
    for (const d of [0, 5, 10, 15]) items.push(lab(A, String(d), 20, XD(d), 900, K.dim, 1, "center"));
    items.push(lab(A, "how flexible the curve is (degree)", 22, 960, 940, K.dim, 1, "center"), lab(A, "error on the training points", 24, 1100, 200, K.ink, g), lab(A, "error on the held-out points", 24, 1100, 236, K.rust, span(t, T.turn, T.turn + 0.6)));
  }
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// The leash: degree 15 under ridge penalties, from none to heavy.
export function leash(t, A, T, F) {
  const p = F.poly, R = p.ridge.rows, c = p.curves, items = [...sheet(t), ...points(p, { held: 1 })];
  const k = t < T.light ? 0 : t < T.hard ? 4 : 6, row = R[k], key = String(row.lambda === 0 ? 0 : row.lambda);
  const ys = c.ridge[key] || c.ridge[String(row.lambda)];
  if (ys) items.push(...curve(c.x, ys, K.rust));
  items.push(lab(A, `degree 15, penalty ${row.lambda}: held-out error ${row.heldRmse < 10 ? row.heldRmse.toFixed(2) : Math.round(row.heldRmse).toLocaleString("en")}`, 28, 380, 170, K.rust));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// The spirals with 40 points: train and held-out loss over updates; the minimum marked.
export function spiral(t, A, T, F) {
  const S = F.spiral, sm = S.small, items = [...sheet(t)], Xs = (st) => 420 + (st / S.steps) * 1080, Yl = (l) => 880 - Math.min(l, 1.6) * 420, g = span(t, T.watch, T.watch + 5);
  const n = Math.max(2, Math.ceil(sm.curve.length * (t < T.watch ? 0.02 : g)));
  items.push({ shape: polyline(sm.curve.slice(0, n).flatMap((p) => [Xs(p.step), Yl(p.loss)])), fill: null, stroke: K.ink, width: 3 }, { shape: polyline(sm.curve.slice(0, n).flatMap((p) => [Xs(p.step), Yl(p.heldLoss)])), fill: null, stroke: K.rust, width: 3 });
  items.push(lab(A, `${sm.nTrain} training points: training loss (ink) and held-out loss (rust), ${S.steps.toLocaleString("en")} updates`, 22, 420, 950, K.dim));
  if (t >= T.right) items.push(lab(A, `held-out accuracy: ${(sm.finalHeldAccuracy * 100).toFixed(1)}% with ${sm.nTrain} points, ${(S.full.finalHeldAccuracy * 100).toFixed(1)}% with ${S.full.nTrain}`, 28, 380, 170, K.ink, span(t, T.right, T.right + 0.6)));
  if (t >= T.lowest) { const m = sm.heldLossMinimum, a = span(t, T.lowest, T.lowest + 0.6); items.push({ shape: circle(Xs(m.step), Yl(m.heldLoss), 10, 14), fill: null, stroke: K.rust, width: 3, opacity: a }, lab(A, `lowest at update ${m.step}`, 24, Xs(m.step) + 16, Yl(m.heldLoss) - 14, K.rust, a)); }
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// One draw is one draw: five 40-point draws, and how often degree 3 won over 200 draws.
export function spread(t, A, T, F) {
  const d = F.spiral.draws.finalHeldAccuracy, items = [...sheet(t)], Xa = (v) => 420 + (v - 0.7) * 3000, a = span(t, T.start, T.start + 1);
  items.push({ shape: rect(Xa(d.min), 300, Xa(d.max) - Xa(d.min), 40, 6), fill: [0.65, 0.27, 0.16, 0.85 * a] }, lab(A, `${(d.min * 100).toFixed(1)}% to ${(d.max * 100).toFixed(1)}% held out, five draws of ${F.spiral.small.nTrain} points`, 26, 420, 280, K.ink, a));
  if (t >= T.best) {
    const counts = F.poly.spread.bestDegreeCounts, b = span(t, T.best, T.best + 1.5);
    Object.entries(counts).forEach(([deg, n], i) => items.push({ shape: rect(420 + i * 120, 860 - n * 3 * b, 80, n * 3 * b), fill: deg === "3" ? [0.18, 0.31, 0.48, 0.9] : [0.35, 0.3, 0.22, 0.5] }, lab(A, deg, 22, 460 + i * 120, 895, K.dim, 1, "center"), lab(A, String(n), 20, 460 + i * 120, 850 - n * 3 * b, K.ink, b, "center")));
    items.push(lab(A, "best degree on held-out points, over 200 draws of 16", 22, 420, 940, K.dim, b));
  }
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// The language model: seen, unseen, its own held-out set, and five fresh draws.
export function model(t, A, T, F) {
  const r = F.attention.rescored, items = [...sheet(t)], XL = (l) => 420 + (l - 0.6) * 9000;
  items.push({ shape: polyline([XL(0.6), 700, XL(0.7), 700]), fill: null, stroke: [0.35, 0.3, 0.22, 0.6], width: 2 });
  for (const v of [0.6, 0.62, 0.64, 0.66, 0.68, 0.7]) items.push(lab(A, v.toFixed(2), 20, XL(v), 735, K.dim, 1, "center"));
  const mark = (v, txt, y, col, t0) => { const a = span(t, t0, t0 + 0.6); return [{ shape: circle(XL(v), 700, 11, 14), fill: col, opacity: a }, lab(A, `${txt}: ${v.toFixed(3)}`, 22, XL(v), y, col, a, "center")]; };
  const rp = F.attention.repeats;
  if (t >= T.fresh) items.push(lab(A, `a fresh batch every step: ${rp.repeats} of ${rp.rows.toLocaleString("en")} training rows repeat an earlier one, none more than ${rp.maxCount} times`, 24, 960, 200, K.ink, span(t, T.fresh, T.fresh + 0.6), "center"));
  items.push(...mark(r.seenLast.loss, "seen", 650, K.ink, T.score), ...mark(r.nextUnseen.loss, "next stretch, not trained on", 600, "#2d4f7a", T.unseen));
  if (t >= T.hard) { items.push(...mark(r.heldOut.loss, "the lab's held-out set", 650, K.rust, T.hard)); r.otherSeeds.rows.forEach((row) => items.push({ shape: circle(XL(row.loss), 700, 7, 10), fill: [0.35, 0.42, 0.55, 0.8 * span(t, T.hard + 1, T.hard + 2)] })); items.push(lab(A, "five fresh draws", 22, XL((r.otherSeeds.loss.min + r.otherSeeds.loss.max) / 2), 780, "#4a5a72", span(t, T.hard + 1, T.hard + 2), "center")); }
  items.push(lab(A, "held-out loss (nats), the attention lesson's model", 22, 960, 830, K.dim, 1, "center"));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

export function rules(t, A, T) {
  const items = [...sheet(t)], a = span(t, T.start, T.start + 1);
  ["training points: fit", "validation points: choose", "test points: look once, at the end"].forEach((s, i) => items.push({ shape: rect(560, 330 + i * 130, 800, 90, 8), fill: [0.95, 0.9, 0.78, a], stroke: K.ink, width: 2 }, lab(A, s, 32, 960, 385 + i * 130, i === 2 ? K.rust : K.ink, span(t, i === 2 ? T.third : T.start, (i === 2 ? T.third : T.start) + 0.6), "center")));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

export function close(t, A, T, F) {
  const items = [...sheet(t, span(t, T.night, T.end)), ...points(F.poly, { held: 0.4 })], c = span(t, T.start + 1, T.start + 2.2, ease.out);
  items.push({ shape: rect(1440, 760, 120, 80, 4), fill: [0.85, 0.78, 0.6, 1], stroke: K.ink, width: 2 }, lab(A, "not for practice", 16, 1500, 805, K.ink, 1, "center"));
  if (c > 0) items.push(...cone(1500, lerp(460, 760, c), 0.3));
  items.push(...guide(t, A, { hat: c <= 0 }), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.85 * span(t, T.night, T.end)] });
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
