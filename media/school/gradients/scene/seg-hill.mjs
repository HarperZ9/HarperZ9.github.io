// The first half of the gradients film, on the hill in fog: the cold open, the title, feeling the
// slope on the contour map (true slopes), the map lifting into the relief, the step size on the
// bowl (with the held question), the long narrow valley, and the two valleys (held question).
// Paths are computed here by gradient descent on the same surfaces facts.json was made from.
import { rect, circle, polyline, span, ease, lerp, window, label, C } from "../../shared/lib.mjs";
import { pylon, talking, arrow } from "../../vectors/scene/chart.mjs";
import { makeBowl, ROSENBROCK, TWO_VALLEYS, descend } from "../../../../system/school/gradients.mjs";
import { INK, view, relief, contours, path, night, lab } from "./terrain.mjs";

export const BOWL = makeBowl();
const bf = (x, y) => BOWL.f(x, y), BR = [[-2.6, 4.6], [-2.8, 3.8]], START = [-2, 2];
const sq = (z) => 2.1 * Math.sqrt(Math.max(0, z));
export const bowlView = (tilt, t = 0) => view({ cx: 1, cy: 0.5, U: 150, tilt, yaw: -0.45 + 0.08 * Math.sin(t * 0.3), h: sq, hz: 48 });
// Drawn paths stop where they leave a margin around the hill (the labels give the measured loss).
const inside = (run, [[x0, x1], [y0, y1]], m = 1.5) => { const out = []; for (const p of run) { if (p[0] < x0 - m || p[0] > x1 + m || p[1] < y0 - m || p[1] > y1 + m) { out.push(p); break; } out.push(p); } return out; };
const guide = (t, A) => pylon(t, 1745, 1015, 0.52, { talk: talking(A.rows, t) });
const plate = (x, y, w, h, a = 1) => ({ shape: rect(x, y, w, h, 10), fill: [0.03, 0.035, 0.05, 0.82 * a], screen: true });

// Cold open: the harbour lights below, fog rising, Pylon's lantern climbing.
export function open(t, A) {
  const items = night(), fog = span(t, 0.5, 3.6);
  for (let i = 0; i < 24; i++) { const x = 200 + i * 66, y = 900 + 30 * Math.sin(i * 1.7); items.push({ shape: circle(x, y, 4, 8), fill: [1, 0.75, 0.4, 0.8 * (1 - fog)], blend: "add" }); }
  const ridge = []; for (let x = 0; x <= 1920; x += 20) ridge.push(x, 700 - 260 * Math.exp(-(((x - 900) / 520) ** 2)) - 30 * Math.sin(x / 150));
  items.push({ shape: polyline([...ridge, 1920, 1080, 0, 1080], true), fill: [0.05, 0.06, 0.08, 1] });
  const lx = lerp(1200, 900, span(t, 0.3, 4)), ly = lerp(820, 470, span(t, 0.3, 4));
  items.push({ shape: circle(lx, ly, 60, 24), fill: [1, 0.75, 0.4, 0.12], blend: "add" }, { shape: circle(lx, ly, 7, 12), fill: [1, 0.85, 0.55, 1], blend: "add" });
  items.push({ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.45, 0.5, 0.58, 0.45 * fog] });
  return { items, camera: { x: 960, y: 540, zoom: 1 + 0.05 * t } };
}

export function title(t, A, T) {
  const V = bowlView(1, t), a = window(t, T.say, T.end, 0.6, 0.8), items = [...night(), ...relief(V, bf, BR, { a: 0.6 })];
  items.push({ shape: rect(0, 0, 1920, 1080), screen: true, fill: [0.45, 0.5, 0.58, 0.25] });
  items.push(label(A, "Gradients", 104, 960, 300, C.ink, "center", a, "head"), label(A, "which way is downhill", 38, 960, 360, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Feel the slope: on the contour map, a nudge east and a nudge north, the gradient, the step the
// other way; then descent, and the map lifts into the relief.
export function slope(t, A, T) {
  // From above the map is centred on the start with no turn; as it lifts it turns into the relief view.
  const lift = span(t, T.feel, T.feel + 3, ease.inOut), items = [...night()];
  const V = view({ cx: lerp(-0.2, 1, lift), cy: lerp(1.1, 0.5, lift), U: lerp(135, 150, lift), tilt: lift, yaw: lerp(0, -0.45, lift), h: sq, hz: 48 });
  const levels = Array.from({ length: 14 }, (_, i) => 0.12 * (i + 1) ** 2);
  items.push(...contours(V, bf, BR, levels, { a: 1 - 0.5 * lift }), ...relief(V, bf, BR, { a: lift }));
  const g = BOWL.grad(...START), p0 = V.P(...START, bf(...START)), sc = 0.12;
  const east = span(t, T.east, T.east + 1), north = span(t, T.north, T.north + 1), up = span(t, T.up, T.up + 1), down = span(t, T.down, T.down + 1);
  items.push({ shape: circle(...p0, 10, 16), fill: [1, 0.85, 0.55, 1], blend: "add" });
  if (lift < 0.5) {
    if (east > 0) items.push(...arrow(p0, [p0[0] + 120 * east, p0[1]], INK.night, 4), lab(A, `slope east: ${g[0].toFixed(2)}`, 26, 1240, 160, INK.night, "left", east));
    if (north > 0) items.push(...arrow(p0, [p0[0], p0[1] - 120 * north], INK.night, 4), lab(A, `slope north: ${g[1].toFixed(2)}`, 26, 1240, 200, INK.night, "left", north));
    if (t >= T.list) items.push(lab(A, `gradient = (${g[0].toFixed(2)}, ${g[1].toFixed(2)})`, 30, 1240, 250, INK.emberS, "left", span(t, T.list, T.list + 0.6)));
    if (up > 0) items.push(...arrow(p0, V.P(START[0] + g[0] * sc, START[1] + g[1] * sc, 0), INK.night, 6, up));
    if (down > 0) items.push(...arrow(p0, V.P(START[0] - g[0] * sc, START[1] - g[1] * sc, 0), INK.emberS, 6, down));
  }
  if (t >= T.feel) { const run = descend(BOWL, START, { step: 0.25, steps: 14 }).path; items.push(...path(V, bf, run, span(t, T.feel, T.feel + 8) * 14, INK.warm)); }
  if (t >= T.cauchy) items.push(lab(A, "Cauchy, 1847", 30, 960, 1000, INK.dim, "center", span(t, T.cauchy, T.cauchy + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The step size: a safe step, then a doubled one that climbs the far wall; the edge 2 / 4; the
// four measured runs from facts.json, each drawn by descent here.
export function step(t, A, T, F) {
  const V = bowlView(1, t), items = [...night(), ...relief(V, bf, BR)], b = F.bowl;
  if (t < T.half) {
    const r06 = b.runs.find((r) => r.multiple === 0.6), r12 = b.runs.find((r) => r.multiple === 1.2);
    const safe = descend(BOWL, START, { step: r06.step, steps: 14 }).path, wild = inside(descend(BOWL, START, { step: r12.step, steps: 6 }).path, BR, 0.6);
    items.push(...path(V, bf, safe, span(t, T.bowl + 2, T.bowl + 8) * 14, INK.warm));
    if (t >= T.reveal) items.push(...path(V, bf, wild, span(t, T.reveal - 0.3, T.reveal + 3) * (wild.length - 1), INK.ember));
    items.push(lab(A, `step ${r06.step}`, 28, 80, 80, INK.night, "left", span(t, T.bowl, T.bowl + 0.5)));
    if (t >= T.reveal) items.push(lab(A, `step ${r12.step}: over the edge`, 28, 80, 120, INK.emberS, "left", span(t, T.reveal, T.reveal + 0.5)));
    if (t >= T.edge) items.push(plate(560, 900, 800, 70), label(A, `edge = 2 / ${b.curvatures[0]} = ${b.predictedBound}`, 38, 960, 948, INK.emberS, "center", span(t, T.edge, T.edge + 0.6), "mono"));
  } else {
    const cuts = [T.half, T.under, T.over, T.twice, T.end], cols = [INK.warm, INK.line, INK.ember, INK.ember];
    b.runs.slice(0, 4).forEach((r, i) => {
      if (t < cuts[i]) return;
      const run = inside(descend(BOWL, START, { step: r.step, steps: 60 }).path, BR, 0.6), live = t < cuts[i + 1];
      items.push(...path(V, bf, run, span(t, cuts[i], cuts[i] + 2.5) * (run.length - 1), cols[i], { a: live ? 1 : 0.25 }));
      if (live) items.push(lab(A, `step ${r.step} (${r.multiple} x the edge): after ${r.steps} steps the loss is ${r.finalLoss < 1e6 ? r.finalLoss.toPrecision(3) : r.finalLoss.toExponential(2)}`, 28, 80, 80, INK.night, "left", 1));
    });
  }
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The long narrow valley: Rosenbrock, heights on a log scale; the run from facts.json (every 100 steps).
export function valley(t, A, T, F) {
  const r = F.rosenbrock, lg = (z) => 2.3 * Math.log10(1 + Math.max(0, z)), V = view({ cx: 0, cy: 1, U: 220, tilt: 1, yaw: -0.3, h: lg, hz: 60 });
  const f = (x, y) => ROSENBROCK.f(x, y), items = [...night(), ...relief(V, f, [[-2, 2], [-1, 3]], { rows: 30 })];
  const u = span(t, T.creep - 2, T.end - 0.5, ease.linear), n = u * (r.path.length - 1), i = Math.floor(n), p = r.path[Math.min(i, r.path.length - 1)];
  if (t >= T.creep - 2) {
    items.push(...path(V, f, r.path, n, INK.ember), lab(A, `loss ${p[2].toPrecision(3)}`, 28, 80, 80, INK.night, "left", 1));
    // The measured milestones (from the full run, not the 200 drawn samples) appear as the path passes them.
    [["1e-2", "a hundredth"], ["1e-6", "a millionth"]].forEach(([k, w], j) => { if (p[2] < +k) items.push(lab(A, `under ${w} at step ${r.firstStepBelow[k].toLocaleString("en")}`, 26, 80, 168 + 40 * j, INK.emberS, "left", 1)); });
  }
  if (t >= T.ratio) items.push(lab(A, `curvature across / along at the bottom: about ${r.conditionNumberAtMinimum.toLocaleString("en")}`, 26, 80, 124, INK.dim, "left", span(t, T.ratio, T.ratio + 0.6)));
  items.push(lab(A, "height drawn on a log scale", 22, 80, 1040, INK.dim, "left", 1));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Two valleys: two starts either side of the ridge; they wait through the held question.
export function valleys(t, A, T, F) {
  const V = view({ cx: 0, cy: 0, U: 230, tilt: 1, yaw: -0.25, h: (z) => 1.6 * (z + 0.3), hz: 60 }), f = (x, y) => TWO_VALLEYS.f(x, y);
  const items = [...night(), ...relief(V, f, [[-2, 2], [-2, 2]], { rows: 28 })], tv = F.twoValleys;
  const starts = [[-0.3, 0], [0.3, 0]], cols = [INK.warm, INK.ember];
  starts.forEach((s, k) => {
    if (t < T.starts) return;
    const run = descend(TWO_VALLEYS, s, { step: 0.02, steps: 400 }).path;
    items.push(...path(V, f, run, t < T.reveal ? 0 : span(t, T.reveal - 0.2, T.reveal + 4) * 400, cols[k]));
  });
  if (t >= T.lower) {
    const L = tv.runs.find((r) => r.start[0] === -0.3), R = tv.runs.find((r) => r.start[0] === 0.3);
    items.push(lab(A, `left start ends at loss ${L.f.toFixed(2)}`, 28, 80, 80, INK.night, "left", 1), lab(A, `right start ends at loss ${R.f.toFixed(2)}`, 28, 80, 124, INK.emberS, "left", 1));
  }
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
