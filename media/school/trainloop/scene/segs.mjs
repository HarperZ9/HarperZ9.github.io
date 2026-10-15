// The training-loop film's segments (lesson L12), on Pylon's dock (PROGRESS.md, step 28): a track
// with four stations (batch, forward and loss, backward, step) and a cart lapping it; the tally
// board on the right draws what the facts record. Every curve and number is a facts.json value (F).
import { rect, circle, polyline, words, span, label, C } from "../../shared/lib.mjs";
import { K, desk, pylon, talking, cone } from "../../vectors/scene/chart.mjs";

const TR = { x: 560, y: 560, r: 300 }, BOARD = { x: 1010, y: 160, w: 780, h: 560 };
const STATIONS = ["batch", "forward + loss", "backward", "step"];
const TAU = Math.PI * 2;
const lab = (A, s, size, x, y, fill = K.ink, a = 1, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a });
const guide = (t, A) => pylon(t, 1780, 1050, 0.45, { talk: talking(A.rows, t) });
const pct = (v) => `${Math.round(v * 100)}%`;

// The track, its stations (hot: index lit), and the cart at lap position u (laps, fractional).
function track(A, u, { hot = -1, a = 1 } = {}) {
  const { x, y, r } = TR, out = [{ shape: circle(x, y, r, 128), fill: null, stroke: "#3a2c1c", width: 20, opacity: a }, { shape: circle(x, y, r, 128), fill: null, stroke: K.paper2, width: 8, opacity: a }];
  STATIONS.forEach((s, i) => { const b = (i / 4) * TAU - Math.PI / 2, sx = x + Math.cos(b) * r, sy = y + Math.sin(b) * r, w = s.length * 15 + 40;
    out.push({ shape: rect(sx - w / 2, sy - 34, w, 68, 8), fill: i === hot ? [0.72, 0.29, 0.18, a] : [0.9, 0.85, 0.71, a], stroke: K.ink, width: 2 }, { shape: words(s, A.sans, 28, sx, sy + 10, "center"), fill: i === hot ? "#f3ead2" : K.ink, opacity: a }); });
  const c = (u % 1) * TAU - Math.PI / 2;
  out.push({ shape: rect(x + Math.cos(c) * (r - 56) - 26, y + Math.sin(c) * (r - 56) - 18, 52, 36, 6), fill: "#8e6c47", stroke: K.ink, width: 3, opacity: a }); // the cart runs on the inner rail, clear of the station signs
  return out;
}
const board = (a = 1) => [{ shape: rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 6), fill: [0.9, 0.85, 0.71, a], stroke: "#3a2c1c", width: 4 }];
// A curve on the board: points [x, y] with x in [0, xmax] and y in [0, ymax]; upto (0..1) draws part.
function plot(pts, xmax, ymax, col, { upto = 1, w = 4, a = 1 } = {}) {
  const n = Math.max(2, Math.ceil(pts.length * upto)), X = (v) => BOARD.x + 40 + (v / xmax) * (BOARD.w - 80), Y = (v) => BOARD.y + BOARD.h - 40 - (Math.min(v, ymax) / ymax) * (BOARD.h - 110);
  return [{ shape: polyline(pts.slice(0, n).flatMap(([px, py]) => [X(px), Y(py)])), fill: null, stroke: col, width: w, opacity: a }];
}
const sheet = (t) => [...desk(t)];
const scene = (t, A, items) => ({ items: [...items, ...guide(t, A)], camera: { x: 960, y: 540, zoom: 1 } });

export function open(t, A, T, F) {
  return { items: [...desk(t, 1 - span(t, 0.3, 3)), ...track(A, 0, { a: span(t, 1, 3) }), ...pylon(t, 1780, 1050, 0.45), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 1 - span(t, 0, 1.5)] }], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...sheet(t), ...track(A, t * 0.25, { a: 0.6 }), label(A, "The training loop", 92, 1400, 420, "#f1e4c8", "center", a, "head"), label(A, "five steps, two thousand times", 34, 1400, 480, "#b29d7e", "center", span(t, T.sub, T.sub + 0.6) * a)]);
}

// One lap, station by station; then the time a lap takes, split.
export function loop(t, A, T, F) {
  const at = [T.batch, T.fwd, T.back, T.step], hot = at.reduce((h, s, i) => (t >= s ? i : h), -1), u = hot < 0 ? 0 : hot / 4 + Math.min(0.25, (t - at[hot]) * 0.08);
  const items = [...sheet(t), ...track(A, u, { hot }), ...board()];
  const lines = [`a batch: ${F.recipe.model.batch} rows of training text`, "forward: a share for every next word; the loss", `backward: a slope for all ${F.recipe.model.nParams.toLocaleString("en")} numbers`, "step: every number moves a little downhill"];
  lines.forEach((s, i) => { if (t >= at[i]) items.push(lab(A, s, 24, BOARD.x + 30, BOARD.y + 60 + i * 50, K.ink, span(t, at[i], at[i] + 0.6))); });
  if (t >= T.time) {
    const M = F.speed.anatomy.ms, parts = [["forward", M.forward], ["backward", F.speed.anatomy.backwardOnly], ["update", M.update]], tot = parts.reduce((s, [, v]) => s + v, 0), g = span(t, T.time, T.time + 1);
    let x0 = BOARD.x + 30;
    parts.forEach(([n, v], i) => { const w = (v / tot) * (BOARD.w - 60); items.push({ shape: rect(x0, BOARD.y + 330, Math.max(3, w), 60, 3), fill: i === 1 ? [0.72, 0.29, 0.18, g] : [0.55, 0.45, 0.3, g] }, lab(A, `${n} ${v.toFixed(1)} ms`, 22, BOARD.x + 30, BOARD.y + 430 + i * 34, i === 1 ? K.rust : K.ink, g)); x0 += w; });
  }
  return scene(t, A, items);
}

// Warmup, then the gradient's length per step with the clip line.
export function settings(t, A, T, F) {
  const items = [...sheet(t), ...track(A, t * 0.1), ...board()];
  if (t >= T.warm && t < T.clip) {
    const W = F.recipe.warmupLr, pts = [[0, 0], ...W.map((w) => [w.step, w.lr]), [60, F.recipe.defaults.lr]];
    items.push(...plot(pts, 60, F.recipe.defaults.lr * 1.2, K.rust, { upto: span(t, T.warm, T.warm + 2) }), lab(A, `step size: up to ${F.recipe.defaults.lr} over ${F.recipe.defaults.warmup} laps`, 24, BOARD.x + 30, BOARD.y + 50));
  }
  if (t >= T.clip) {
    const G = F.gradients.perStep, pts = G.map((g, i) => [i, g]).filter((_, i) => i % 4 === 0), ymax = 2.5;
    items.push(...plot(pts, G.length, ymax, [0.35, 0.3, 0.22, 0.9], { w: 2, upto: span(t, T.clip, T.clip + 3) }), ...plot([[0, F.recipe.defaults.clip], [G.length, F.recipe.defaults.clip]], G.length, ymax, K.rust, { w: 3 }),
      lab(A, `length of the whole slope, each lap; clipped above ${F.recipe.defaults.clip}`, 22, BOARD.x + 30, BOARD.y + 50));
    if (t >= T.fired) items.push(lab(A, `clipped on ${F.gradients.stats.clipped} of ${F.gradients.stats.n.toLocaleString("en")} laps; ${F.gradients.byWindow[0].clipped} in the first ${F.gradients.byWindow[0].to}`, 22, BOARD.x + 30, BOARD.y + 90, K.rust, span(t, T.fired, T.fired + 0.6)));
  }
  return scene(t, A, items);
}

// Two thousand laps: the held-out loss, then copy accuracy (after the held question).
export function run(t, A, T, F) {
  const P = F.reproduce.curve, steps = F.recipe.model.steps, M = F.reproduce.milestones;
  // The laps follow the narration: each milestone the voice names is reached as it is named.
  const keys = [[T.go, 0], [T.m100, M[1].step], [T.m500, M[2].step], [T.m750, M[3].step], [T.same, steps]];
  let lap = 0;
  for (let i = 0; i + 1 < keys.length; i++) if (t >= keys[i][0]) lap = keys[i][1] + (keys[i + 1][1] - keys[i][1]) * span(t, keys[i][0], keys[i + 1][0], (u) => u);
  lap = Math.round(lap);
  const items = [...sheet(t), ...track(A, (lap / steps) * 40), ...board()];
  const k = P.filter((p) => p.step <= lap).length;
  items.push(...plot(P.map((p) => [p.step, p.heldOut]), steps, 4, K.rust, { upto: k / P.length }), lab(A, `lap ${Math.min(lap, steps).toLocaleString("en")}: held-out loss ${P[Math.max(0, k - 1)].heldOut.toFixed(2)}`, 24, BOARD.x + 30, BOARD.y + 50));
  if (t >= T.ask.held) items.push(...plot(P.map((p) => [p.step, p.copyAccuracy * 4]), steps, 4, "#2d4f7a", { upto: k / P.length }), lab(A, `copies ${pct(P[Math.max(0, k - 1)].copyAccuracy)}`, 24, BOARD.x + 30, BOARD.y + 90, "#2d4f7a"));
  if (t >= T.same) items.push(lab(A, `rerun from the same seeds: ${F.reproduce.tensorsEqual} of ${F.reproduce.tensorsTotal} tables equal`, 22, BOARD.x + 30, BOARD.y + BOARD.h + 50, "#f1e4c8", span(t, T.same, T.same + 0.6)));
  return scene(t, A, items);
}

// One change at a time: the final held-out loss of each run, with the noise band.
export function change(t, A, T, F) {
  const V = F.variants, R = (n) => V.runs.find((r) => r.name === n), rows = [
    ["original", V.reference.summary, T.start], ["other rows A", V.noise[0].summary, T.noise], ["other rows B", V.noise[1].summary, T.noise],
    ["step size / 10", R("lrLow").summary, T.low], ["step size x 10", R("lrHigh").summary, T.high], ["no weight decay", R("noDecay").summary, T.decay],
    ["batch 4, same laps", R("batch4Steps").summary, T.batch], ["batch 4, same text", R("batch4Tokens").summary, T.batch2]];
  const items = [...sheet(t), ...track(A, t * 0.1, { a: 0.5 }), ...board()], X0 = BOARD.x + 300, Wd = BOARD.w - 340, xv = (v) => X0 + ((v - 0.6) / 0.4) * Wd;
  const lo = Math.min(V.reference.summary.heldOut, ...V.noise.map((n) => n.summary.heldOut)), hi = Math.max(V.reference.summary.heldOut, ...V.noise.map((n) => n.summary.heldOut));
  items.push({ shape: rect(xv(lo) - 2, BOARD.y + 40, xv(hi) - xv(lo) + 4, BOARD.h - 80), fill: [0.18, 0.31, 0.48, 0.25] });
  rows.forEach(([n, s, at], i) => { if (t < at) return; const a = span(t, at, at + 0.6), y = BOARD.y + 70 + i * 60;
    items.push(lab(A, n, 22, BOARD.x + 30, y + 8, K.ink, a), { shape: circle(xv(s.heldOut), y, 9, 16), fill: i < 3 ? "#2d4f7a" : K.rust, opacity: a }, lab(A, `${s.heldOut.toFixed(2)}, copies ${pct(s.copyAccuracy)}`, 20, Math.min(xv(s.heldOut) + 16, BOARD.x + BOARD.w - 200), y - 14, K.dim, a)); });
  items.push(lab(A, `held-out loss after ${V.reference.steps.toLocaleString("en")} laps; band: the luck of the rows`, 20, BOARD.x + 30, BOARD.y + BOARD.h - 14, K.dim));
  return scene(t, A, items);
}

// Two broken loops: step size zero (flat) and every slope reversed (uphill).
export function broken(t, A, T, F) {
  const [z, up] = F.controls.runs, items = [...sheet(t), ...track(A, 0, { a: 0.5 }), ...board()], ymax = 70;
  if (t >= T.zero) items.push(...plot(z.curve.map((p) => [p.step, p.heldOut]), z.steps, ymax, "#2d4f7a", { upto: span(t, T.zero, T.zero + 2) }), lab(A, `step size zero: stays at ${z.summary.heldOut.toFixed(2)}`, 22, BOARD.x + 30, BOARD.y + 50, "#2d4f7a"));
  if (t >= T.up) items.push(...plot(up.curve.map((p) => [p.step, p.heldOut]), up.steps, ymax, K.rust, { upto: span(t, T.up, T.up + 2) }), lab(A, `every slope reversed: climbs to ${up.summary.heldOut.toFixed(1)}`, 22, BOARD.x + 30, BOARD.y + 90, K.rust));
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const P = F.reproduce.curve, slow = Math.max(0, 1 - span(t, T.start, T.night)), items = [...sheet(t), ...track(A, 3 + slow * 0.6), ...board(), ...plot(P.map((p) => [p.step, p.heldOut]), F.recipe.model.steps, 4, K.rust)];
  items.push(lab(A, `lap ${F.recipe.model.steps.toLocaleString("en")}: held-out loss ${P.at(-1).heldOut.toFixed(2)}, copies ${pct(P.at(-1).copyAccuracy)}`, 24, BOARD.x + 30, BOARD.y + 50));
  if (t >= T.night) items.push(...cone(TR.x, TR.y - TR.r - 30, 0.5));
  return scene(t, A, items);
}
