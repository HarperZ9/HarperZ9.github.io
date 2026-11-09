// The optimisers film, from above on the contour map (PROGRESS.md, step 17). Walkers are run at
// load with the lesson's own update rules at the steps facts.json chose, and drawn by update count
// on a log clock, so a race of 285 and 16,790 updates both read. Every number on screen is a
// facts.json value or the walker's own state.
import { rect, circle, polyline, span, ease, lerp, window, label, C } from "../../shared/lib.mjs";
import { pylon, talking } from "../../vectors/scene/chart.mjs";
import { INK, view, contours, night, lab } from "../../gradients/scene/terrain.mjs";
import { ROSENBROCK, makeBowl } from "../../../../system/school/gradients.mjs";

export const BOWL = makeBowl();
const COL = { sgd: INK.warm, momentum: INK.line, adam: INK.ember }, NAME = { sgd: "careful steps", momentum: "heavy ball", adam: "Adam" };
const RV = view({ cx: -0.1, cy: 1.05, U: 230, tilt: 0, yaw: 0 }), BV = view({ cx: 1, cy: 0.6, U: 130, tilt: 0, yaw: 0 });
const RL = [0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000], BL = Array.from({ length: 14 }, (_, i) => 0.12 * (i + 1) ** 2);
const rmap = (A) => contours(RV, (x, y) => ROSENBROCK.f(x, y), [[-2, 2], [-1, 3]], RL, { n: 90 });
const bmap = () => contours(BV, (x, y) => BOWL.f(x, y), [[-3, 5], [-3, 4]], BL, { n: 70 });
const guide = (t, A, extra = {}) => pylon(t, 1745, 1015, 0.48, { talk: talking(A.rows, t), ...extra });
export const logClock = (u, max) => (u >= 1 ? max : Math.max(0, Math.floor(10 ** (Math.log10(max + 1) * Math.max(0, u))) - 1));

// A walker's path up to update k, and its lantern.
function walker(V, run, k, col, { a = 1, clip = null } = {}) {
  const upto = Math.min(k, run.path.length - 1), stride = Math.max(1, Math.floor(upto / 500)), pts = [];
  for (let i = 0; i <= upto; i += stride) { const p = run.path[i]; if (clip && (Math.abs(p[0]) > clip || Math.abs(p[1]) > clip)) break; pts.push(...V.P(p[0], p[1], 0)); }
  const [x, y] = run.path[upto], here = V.P(x, y, 0), out = [];
  if (pts.length >= 4) out.push({ shape: polyline(pts), fill: null, stroke: [...col, 0.8 * a], width: 2.5, blend: "add" });
  if (!clip || (Math.abs(x) < clip && Math.abs(y) < clip)) out.push({ shape: circle(...here, 10, 14), fill: [...col, a], blend: "add" });
  return out;
}
const counter = (A, k, rows) => [lab(A, `update ${k.toLocaleString("en")}`, 32, 80, 80), ...rows.map(([s, col], i) => lab(A, s, 26, 80, 128 + i * 38, col))];

export function title(t, A, T) {
  const a = window(t, T.say, T.end, 0.6, 0.8);
  return { items: [...night(), ...rmap(A).map((it) => ({ ...it, opacity: 0.4 })), label(A, "Optimisers", 104, 960, 300, C.ink, "center", a, "head"), label(A, "better ways to step", 38, 960, 360, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a), ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// Careful steps crawl along the valley floor.
export function valley(t, A, T, F) {
  const r = A.runs.rosen.sgd, k = logClock(span(t, T.start + 1, T.end - 1), F.races.rosenbrock.entrants.sgd.stepsToThreshold);
  return { items: [...night(), ...rmap(A), ...walker(RV, r, k, COL.sgd), ...counter(A, k, [[`careful steps (step ${F.races.rosenbrock.entrants.sgd.chosenLr}): loss ${r.path[Math.min(k, r.path.length - 1)][2].toPrecision(3)}`, "#ddd6c8"]]), ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

// The heavy ball: its motion arrow (this step's move) rides with it.
export function momentum(t, A, T, F) {
  const r = A.runs.rosen.momentum, k = logClock(span(t, T.heavy, T.end - 1), F.races.rosenbrock.entrants.momentum.stepsToThreshold), items = [...night(), ...rmap(A), ...walker(RV, r, k, COL.momentum)];
  if (k > 0) { const p = r.path[k], q = r.path[k - 1], a = RV.P(q[0], q[1], 0), b = RV.P(p[0], p[1], 0), d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d) || 1, m = Math.min(150, 3 * L) / L; items.push({ shape: polyline([...b, b[0] + d[0] * m, b[1] + d[1] * m]), fill: null, stroke: [...INK.line, 0.9], width: 4 }); }
  items.push(...counter(A, k, [[`heavy ball, ${Math.round(F.races.rosenbrock.settings.momentum.beta * 100)}% of the last move kept`, "#bcd2f2"]]));
  if (t >= T.polyak) items.push(lab(A, "Polyak, 1964", 28, 960, 1000, INK.dim, "center", span(t, T.polyak, T.polyak + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Adam's shoes: at its lantern, an ellipse whose half-widths are its stride in each direction.
export function adam(t, A, T, F) {
  const r = A.runs.rosen.adam, tr = A.adamTrace, k = logClock(span(t, T.start + 1, T.end - 1), F.races.rosenbrock.entrants.adam.stepsToThreshold), items = [...night(), ...rmap(A), ...walker(RV, r, k, COL.adam)];
  const j = Math.min(k, tr.length - 1), [x, y, sx, sy] = tr[j], c = RV.P(x, y, 0), sc = 230 * 40;
  items.push({ shape: polyline(Array.from({ length: 41 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return [c[0] + Math.min(300, sx * sc) * Math.cos(a), c[1] + Math.min(300, sy * sc) * Math.sin(a)]; }).flat(), true), fill: null, stroke: [...INK.ember, 0.7], width: 2 });
  items.push(...counter(A, k, [[`Adam (step ${F.races.rosenbrock.entrants.adam.chosenLr}): last move east ${sx.toExponential(1)}, north ${sy.toExponential(1)}`, "#e29472"]]));
  items.push(lab(A, "the ellipse: Adam's last move in each direction, drawn 40 times larger", 22, 960, 1040, INK.dim, "center", 1));
  if (t >= T.first) items.push(lab(A, `first step: ${F.rules.biasCorrection.withCorrection[1][0].toFixed(4)} in each direction (with correction)`, 24, 80, 1000, INK.night, "left", span(t, T.first, T.first + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The race (after the held question), then the gentle bowl.
export function race(t, A, T, F) {
  const items = [...night()], E = F.races.rosenbrock.entrants;
  if (t < T.bowl) {
    const max = E.adam.stepsToThreshold, k = t < T.reveal ? 0 : logClock(span(t, T.reveal - 0.4, T.bowl - 2), max);
    items.push(...rmap(A));
    for (const n of ["sgd", "momentum", "adam"]) items.push(...walker(RV, A.runs.rosen[n], k, COL[n]));
    items.push(...counter(A, k, ["sgd", "momentum", "adam"].map((n) => [`${NAME[n]}: ${E[n].stepsToThreshold !== null && k >= E[n].stepsToThreshold ? `down to stay at ${E[n].stepsToThreshold.toLocaleString("en")}` : "on its way"}`, { sgd: "#ddd6c8", momentum: "#bcd2f2", adam: "#e29472" }[n]])));
  } else {
    const B = F.races.bowl.entrants, k = logClock(span(t, T.bowl + 0.5, T.end - 1), 160);
    items.push(...bmap());
    for (const n of ["sgd", "momentum", "adam"]) items.push(...walker(BV, A.runs.bowl[n], k, COL[n]));
    items.push(...counter(A, k, ["sgd", "momentum", "adam"].map((n) => [`${NAME[n]} (step ${B[n].chosenLr}): ${k >= B[n].stepsToThreshold ? `down at ${B[n].stepsToThreshold}` : "on its way"}`, { sgd: "#ddd6c8", momentum: "#bcd2f2", adam: "#e29472" }[n]])));
  }
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Past the edge: all three at step 0.6 on the bowl.
export function edge(t, A, T, F) {
  const ae = F.aboveEdge, k = t < T.go ? 0 : logClock(span(t, T.go, T.end - 1), 200), items = [...night(), ...bmap()];
  for (const n of ["sgd", "momentum", "adam"]) items.push(...walker(BV, A.runs.edge[n], k, COL[n], A.runs.edge[n].diverged ? { clip: 3.4 } : {}));
  items.push(...counter(A, k, [[`all three at step ${ae.lr} (careful steps' edge: ${ae.plainBound.predicted})`, "#ddd6c8"], ...["sgd", "momentum", "adam"].map((n) => [`${NAME[n]}: ${ae.runs[n].outcome}`, { sgd: "#ddd6c8", momentum: "#bcd2f2", adam: "#e29472" }[n]])]));
  if (t >= T.heavy) items.push(lab(A, `heavy ball's edge here: ${ae.momentumBound.predicted}`, 26, 80, 300, "#bcd2f2", "left", span(t, T.heavy, T.heavy + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Schedules, and decoupled decay as a column of numbers shrinking.
export function schedule(t, A, T, F) {
  const s = F.schedules, items = [...night()], X = (v) => 300 + (v / s.total) * 900, Y = (m) => 760 - m * 460, g = span(t, T.start, T.start + 2);
  items.push({ shape: polyline([X(0), 760, X(s.total), 760]), fill: null, stroke: [...INK.line, 0.4], width: 2 });
  items.push({ shape: polyline(s.cosine.slice(0, Math.max(2, Math.ceil(s.cosine.length * g))).flatMap(([st, m]) => [X(st), Y(m)])), fill: null, stroke: [...INK.ember, 1], width: 3 });
  items.push(lab(A, `step size over training: warmup for ${s.warmup} steps, then a cosine fall (of ${s.total.toLocaleString("en")})`, 24, 300, 820, INK.dim, "left", g));
  if (t >= T.decay) {
    const d = F.rules.decoupledDecay, u = span(t, T.decay, T.decay + 5), n = Math.min(d.adamw.length - 1, Math.floor(u * d.adamw.length));
    items.push(lab(A, `AdamW decay ${d.lambda}, no slope: keeps ${Math.round((1 - d.lambda) * 100)}% a step`, 24, 1250, 260, INK.night, "left", 1));
    d.adamw.slice(0, n + 1).forEach(([w], i) => items.push({ shape: rect(1250, 300 + i * 52, 340 * w, 32, 4), fill: [...INK.ember, 0.85] }, lab(A, w.toFixed(3), 22, 1260 + 340 * w, 324 + i * 52, INK.dim, "left", 1)));
  }
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// On real networks: spiral accuracy curves and the five-seed ranges; the transformer's first 400 steps.
export function real(t, A, T, F) {
  const items = [...night()], sp = F.spiral, tf = F.transformer;
  if (t < T.lm) {
    const X = (st) => 260 + (st / sp.steps) * 800, Y = (v) => 820 - v * 560, g = span(t, T.start, T.start + 4);
    items.push({ shape: polyline([X(0), Y(sp.target), X(sp.steps), Y(sp.target)]), fill: null, stroke: [...INK.line, 0.3], width: 1 }, lab(A, `${Math.round(sp.target * 100)}% on new points`, 20, X(sp.steps) + 10, Y(sp.target) + 6, INK.dim, "left", 1));
    for (const n of ["sgd", "momentum", "adam"]) { const c = sp.arms[n].curve; items.push({ shape: polyline(c.slice(0, Math.max(2, Math.ceil(c.length * g))).flatMap((p) => [X(p.step), Y(p.heldAccuracy)])), fill: null, stroke: [...COL[n], 1], width: 3 }); }
    ["sgd", "momentum", "adam"].forEach((n, i) => items.push(lab(A, `${NAME[n]}: past ${Math.round(sp.target * 100)}% at ${sp.arms[n].firstHeldAtTarget.toLocaleString("en")}`, 24, 1130, 300 + i * 40, { sgd: "#ddd6c8", momentum: "#bcd2f2", adam: "#e29472" }[n], "left", g)));
    if (t >= T.spread) ["sgd", "momentum", "adam"].forEach((n, i) => { const r = sp.seedSpread.arms[n].finalHeldAccuracy, y = 520 + i * 60, Xr = (v) => 1130 + (v - 0.9) * 6000, a = span(t, T.spread, T.spread + 1); items.push({ shape: rect(Xr(r.min), y, Math.max(4, Xr(r.max) - Xr(r.min)), 22, 4), fill: [...COL[n], 0.9 * a] }, lab(A, `${(r.min * 100).toFixed(1)} to ${(r.max * 100).toFixed(1)}%`, 22, 1130, y - 8, INK.dim, "left", a)); });
    if (t >= T.spread) items.push(lab(A, "final score over five starting networks", 22, 1130, 480, INK.dim, "left", span(t, T.spread, T.spread + 1)));
  } else {
    const X = (st) => 360 + (st / tf.steps) * 1000, Y = (l) => 860 - ((Math.min(l, 4) - 0.6) / 3.4) * 600, g = span(t, T.lm, T.lm + 4);
    for (const n of ["sgd", "momentum", "adamw"]) { const c = tf.arms[n].curve, col = COL[n === "adamw" ? "adam" : n]; items.push({ shape: polyline(c.slice(0, Math.max(2, Math.ceil(c.length * g))).flatMap((p) => [X(p.step), Y(p.heldOut)])), fill: null, stroke: [...col, 1], width: 3 }); }
    if (t >= T.first400) ["adamw", "momentum", "sgd"].forEach((n, i) => items.push(lab(A, `${n === "adamw" ? "AdamW" : NAME[n]}: ${tf.arms[n].finalHeldOut.toFixed(2)}`, 26, 1400, 300 + i * 40, { sgd: "#ddd6c8", momentum: "#bcd2f2", adamw: "#e29472" }[n], "left", span(t, T.first400, T.first400 + 0.6))));
    items.push(lab(A, `the attention model's held-out loss, first ${tf.steps} steps, same start and sentences`, 22, 360, 920, INK.dim, "left", g));
  }
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

export function limits(t, A, T) {
  const items = [...night(), ...rmap(A).map((it) => ({ ...it, opacity: 0.25 }))];
  items.push(lab(A, "each walker: the best of a few steps we tried, on these hills", 30, 960, 420, INK.night, "center", span(t, T.start, T.start + 1)));
  if (t >= T.short) items.push(lab(A, "400 steps: before the model has learned to copy", 30, 960, 480, INK.emberS, "center", span(t, T.short, T.short + 1)));
  return { items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } };
}

export function close(t, A, T, F) {
  const items = [...night(), ...rmap(A)];
  for (const n of ["sgd", "momentum", "adam"]) items.push(...walker(RV, A.runs.rosen[n], A.runs.rosen[n].path.length - 1, COL[n], { a: 0.5 }));
  items.push(...guide(t, A), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.85 * span(t, T.night, T.end)] });
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
