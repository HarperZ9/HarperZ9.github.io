// The backpropagation film's segments: the chain on the hill at night, the network and its forward
// pass, nudging every number, the walk back (after the held question), the cost, the check and the
// broken link, learning the spirals, the language model's own check, goodnight. Every number drawn
// is a facts.json value or arithmetic on them (stated where it is arithmetic).
import { rect, circle, polyline, span, ease, lerp, window, label, C } from "../../shared/lib.mjs";
import { pylon, talking, cone } from "../../vectors/scene/chart.mjs";
import { INK, chain, spiralMap, lab, night, at } from "./chain.mjs";

const guide = (t, A, extra = {}) => pylon(t, 1745, 1015, 0.52, { talk: talking(A.rows, t), ...extra });
const sci = (v) => v.toExponential(1); // e-notation: the atlas has no "^"

export function open(t, A) {
  const items = night(), drop = span(t, 0.4, 3.6);
  for (let k = 0; k < 6; k++) { const x = 300 + k * 260, y = 260 + k * 110, lit = Math.max(0, 1 - Math.abs(drop * 6 - k)); items.push({ shape: polyline([x, y + 30, x, y + 200]), fill: null, stroke: [0.3, 0.25, 0.2, 1], width: 6 }, { shape: polyline([x - 30, y - 30, x + 30, y - 30, x + 22, y + 30, x - 22, y + 30], true), fill: [0.1, 0.09, 0.08, 1], stroke: [0.62, 0.5, 0.32, 1], width: 3 }, { shape: circle(x, y, 40 * lit + 1, 16), fill: [...INK.water, 0.5 * lit], blend: "add" }); }
  return { items, camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * drop } };
}
export function title(t, A, T, F) {
  const a = window(t, T.say, T.end, 0.6, 0.8), items = [...night(), ...chain(A, F.chain.after, { a: 0.25 })];
  items.push(label(A, "Backpropagation", 96, 960, 300, C.ink, "center", a, "head"), label(A, "blame, passed backwards", 38, 960, 360, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a), ...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The network: the spiral map, then the chain, then the forward pass filling it.
export function network(t, A, T, F) {
  const items = [...night(), ...spiralMap(F, { a: span(t, T.map, T.map + 1) })], appear = span(t, T.numbers, T.numbers + 1.5);
  items.push(...chain(A, F.chain.after, { fwd: t >= T.forward ? span(t, T.forward, T.forward + 6) * 4 : 0, a: appear }));
  if (appear > 0) items.push(lab(A, `${F.net.nParams} numbers: ${F.net.sizes.join(", ")} buckets per layer`, 26, 520, 120, INK.night, "left", appear));
  if (t >= T.fwdName) items.push(lab(A, "forward pass", 34, 520, 170, INK.emberS, "left", span(t, T.fwdName, T.fwdName + 0.6)));
  items.push(lab(A, "the two spirals", 22, 290, 570, INK.dim, "center", span(t, T.map, T.map + 1)), ...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Nudging: one weight at a time, the whole chain run again; the count climbs.
export function nudge(t, A, T, F) {
  const items = [...night()], c = F.chain.after, k = t >= T.slow ? Math.floor(Math.pow(span(t, T.slow, T.every + 3), 2) * F.net.nParams) : 0, w = (k * 37) % 300;
  items.push(...chain(A, c, { fwd: t >= T.slow ? ((t - T.slow) * 3) % 4 + 0.01 : 4, nudge: t >= T.slow ? Math.floor(w / 100) * 100 + ((w % 100) % 8) * 10 + (k % 2) : -1 }));
  items.push(lab(A, `loss at the bottom: ${c.loss.toFixed(2)}`, 28, 1300, 880, INK.emberS, "left", span(t, T.start, T.start + 1)));
  if (t >= T.slow) items.push(lab(A, `extra runs: ${Math.min(k, F.net.nParams)} of ${F.net.nParams}`, 34, 520, 120, INK.night, "left", 1));
  if (t >= T.attn) items.push(lab(A, `the attention model: ${A.attnParams.toLocaleString("en")} runs for every step`, 34, 520, 170, INK.emberS, "left", span(t, T.attn, T.attn + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The walk back: blame lights from the bottom bucket up, one layer at a time (after the hold).
export function back(t, A, T, F) {
  const items = [...night()], b = t < T.last ? 0 : t < T.hands ? span(t, T.last, T.last + 2) : t < T.each ? 1 + span(t, T.hands, T.hands + 3) : 2 + span(t, T.each, T.each + 3);
  items.push(...chain(A, F.chain.after, { back: b }));
  if (t >= T.last) items.push(lab(A, "each ring: the slope of the loss arriving at that bucket", 26, 520, 120, INK.night, "left", span(t, T.last, T.last + 0.6)));
  if (t >= T.rule) items.push(lab(A, "the chain rule, in reverse order", 34, 520, 170, INK.emberS, "left", span(t, T.rule, T.rule + 0.6)));
  if (t >= T.who) items.push(lab(A, "Linnainmaa 1970; Rumelhart, Hinton and Williams 1986", 26, 960, 1010, INK.dim, "center", span(t, T.who, T.who + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The cost: counted multiply-adds for one point, and the nudging way as arithmetic.
export function cost(t, A, T, F) {
  const items = [...night()], c = F.cost, nud = F.net.nParams * c.forward, W = (v) => 1100 * (v / nud), g = span(t, T.count, T.count + 1.5);
  const bar = (y, v, txt, col, a) => [{ shape: rect(420, y, Math.max(3, W(v) * a), 40, 4), fill: [...col, 0.9] }, lab(A, txt, 26, 420, y - 14, INK.night, "left", a)];
  items.push(...chain(A, F.chain.after, { a: 0.18, back: 3 }));
  items.push(...bar(380, c.forward, `forward: ${c.forward} multiply-adds`, INK.warm, g), ...bar(500, c.backward, `backward: ${c.backward} (${c.ratio.toFixed(2)} x forward)`, INK.ember, g));
  if (t >= T.not) items.push(...bar(620, nud, `nudging every number: ${F.net.nParams} x ${c.forward} = ${nud.toLocaleString("en")} (arithmetic)`, INK.line, span(t, T.not, T.not + 1.5)));
  items.push(lab(A, "for one point; tanh, exp and log are counted apart", 22, 420, 720, INK.dim, "left", g), ...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The check: per-layer disagreement on a log scale, then the broken link and where it shows.
export function check(t, A, T, F) {
  const items = [...night()], gc = F.gradientCheck, br = t >= T.breakIt, pt = br ? gc.controlAfter.perTensor : gc.afterTraining.perTensor;
  items.push(...chain(A, F.chain.after, { a: 0.35, broken: br ? 2 : -1, back: 3 }));
  const names = ["W1", "b1", "W2", "b2", "W3", "b3"], X = (v) => 1000 + 70 * (Math.log10(Math.max(v, 1e-12)) + 12), g = span(t, T.after, T.after + 1);
  items.push({ shape: rect(940, 180, 900, 420, 10), fill: [0.03, 0.035, 0.05, 0.85 * Math.max(g, br ? 1 : 0)], screen: true });
  names.forEach((n, i) => { const v = pt[n], y = 230 + i * 56, bad = v > 1e-3; items.push(lab(A, n, 26, 960, y + 10, INK.dim, "left", g), { shape: rect(1000, y - 8, Math.max(2, X(v) - 1000) * g, 26, 3), fill: bad ? [...INK.ember, 0.95] : [...INK.warm, 0.8], screen: true }, lab(A, v < 1e-3 ? sci(v) : v.toFixed(2), 22, X(v) + 12, y + 10, bad ? INK.emberS : INK.dim, "left", g)); });
  items.push(lab(A, "disagreement between nudging and the walk back (log scale)", 22, 960, 580, INK.dim, "left", g));
  if (br) items.push(lab(A, "broken: the second hidden layer's local slope", 28, 520, 120, INK.emberS, "left", span(t, T.breakIt, T.breakIt + 0.6)));
  if (t >= T.where) items.push(lab(A, "fails at the break and above it; passes below", 28, 520, 165, INK.night, "left", span(t, T.where, T.where + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// Learning: the boundary over the held-out spirals and the held-out accuracy curve.
export function learn(t, A, T, F) {
  const tr = F.training, items = [...night(), ...spiralMap(F, { x: 260, y: 240, size: 600, boundary: span(t, T.start + 1, T.start + 4), held: true })];
  const X = (s) => 1000 + (s / tr.steps) * 700, Y = (v) => 820 - v * 520, u = span(t, T.start + 2, T.acc + 4), n = Math.max(2, Math.ceil(u * tr.curve.length));
  items.push({ shape: polyline([X(0), 820, X(tr.steps), 820]), fill: null, stroke: [...INK.line, 0.4], width: 2 }, { shape: polyline([X(0), Y(tr.target), X(tr.steps), Y(tr.target)]), fill: null, stroke: [...INK.line, 0.25], width: 1 });
  items.push({ shape: polyline(tr.curve.slice(0, n).flatMap((p) => [X(p.step), Y(p.heldAccuracy)])), fill: null, stroke: [...INK.ember, 1], width: 3 });
  items.push(lab(A, "held-out accuracy", 24, 1000, 260, INK.dim, "left", 1));
  if (t >= T.acc) items.push(lab(A, `${Math.round(tr.curve[0].heldAccuracy * 100)}% at the start; ${Math.round(tr.target * 100)}% at step ${tr.firstStepAtTarget.toLocaleString("en")}; ${(tr.finalHeldAccuracy * 100).toFixed(1)}% after ${tr.steps.toLocaleString("en")}`, 26, 1000, 900, INK.night, "left", span(t, T.acc, T.acc + 0.6)));
  items.push(lab(A, "the network's two answers over the map, on points it never trained on", 22, 560, 900, INK.dim, "center", 1), ...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

// The language model's own walk back, checked on 36 entries.
export function big(t, A, T, F) {
  const at = F.attention, items = [...night()], g = span(t, T.checked, T.checked + 1.5), X = (v) => 360 + 100 * (Math.log10(Math.max(v, 1e-12)) + 12);
  const tensors = [...new Set(at.float64.map((e) => e.tensor))];
  tensors.forEach((n, i) => items.push(lab(A, n, 22, 340, 230 + i * 60, INK.dim, "right", span(t, T.start, T.start + 1))));
  at.float64.forEach((e, k) => { const i = tensors.indexOf(e.tensor); items.push({ shape: circle(X(e.relErr), 222 + i * 60, 7, 10), fill: [...INK.warm, 0.85 * g], blend: "add" }); });
  for (const p of [-12, -9, -6, -3, 0]) items.push(lab(A, `1e${p}`, 20, X(10 ** p), 820, INK.dim, "center", g));
  if (t >= T.full) items.push(lab(A, `worst of ${at.entries}: ${sci(at.float64Worst.relErr)} (float64)`, 30, 960, 900, INK.emberS, "center", span(t, T.full, T.full + 0.6)));
  items.push(...guide(t, A));
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}

export function close(t, A, T, F) {
  const items = [...night(), ...chain(A, F.chain.after, { back: 3 })], c = span(t, T.start + 1, T.start + 2.2, ease.out), [x, y] = at(0, 0, 2);
  if (c > 0) items.push(...cone(x, lerp(y - 300, y - 26, c), 0.3));
  items.push(...guide(t, A, { hat: c <= 0 }), { shape: rect(0, 0, 1920, 1080), screen: true, fill: [0, 0, 0, 0.85 * span(t, T.night, T.end)] });
  return { items, camera: { x: 960, y: 540, zoom: 1 } };
}
