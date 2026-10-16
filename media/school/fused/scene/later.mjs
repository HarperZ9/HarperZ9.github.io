// The fused-attention film's later segments (lesson K23): one trip (the bench, then the traffic for
// one head at 4,096 words, d 64 then d 16), the forgotten rescale, why the running largest matters
// for fp16, what the count leaves out, and the close. Every value drawn is a facts.json value (F).
import { rect, span } from "../../shared/lib.mjs";
import { INK, lab, plate, floor, scene } from "../../threads/scene/cannery.mjs";
import { wall, bench, gauges } from "./segs.mjs";

const MiB = (b) => (b / 1048576).toFixed(1).replace(/\.0$/, "");
export function fused(t, A, T, F) {
  const Bd = F.film.bars, items = [...floor(), ...bench(span(t, T.start, T.start + 1))];
  const h = F.film.sweep.heads[1], tr = h.trace[Math.min(h.trace.length - 1, Math.floor(span(t, T.keeps, T.keeps + 6) * h.trace.length))];
  if (t < T.count) items.push(...gauges(A, tr.m, tr.l, { a: span(t, T.keeps, T.keeps + 1) }));
  if (t >= T.count) {
    const W = 1100 / Bd.d64.unfused[6].bytes, bar = (y, b, name, at, hot) => { const a = span(t, at, at + 1); return a <= 0 ? [] : [{ shape: rect(300, y, b * W * a, 40, 4), fill: hot ? [0.89, 0.58, 0.45, 1] : [0.85, 0.8, 0.7, 1], screen: true }, lab(A, `${name}: ${MiB(b)} MiB`, 22, 300, y - 12, INK.night, "left", a)]; };
    items.push(plate(240, 560, 1460, 420, 0.7), ...bar(640, Bd.d64.unfused[6].bytes, "64 per head, plain", T.count, false), ...bar(720, Bd.d64.fused[6].bytes, "64 per head, fused", T.count + 1, true),
      ...bar(820, Bd.d16.unfused[6].bytes, "16 per head, plain", Math.max(T.d16, T.ask.held), false), ...bar(900, Bd.d16.fused[6].bytes, "16 per head, fused", Math.max(T.d16, T.ask.held) + 1, true));
  }
  return scene(t, A, items);
}
// The forgotten rescale: per head, the share of the row's outputs the broken kernel got wrong.
export function rescale(t, A, T, F) {
  const items = [...floor(), plate(240, 220, 1460, 560, 0.6), lab(A, "without the shrink: outputs wrong per head, on our sentence", 22, 300, 280, INK.dim)];
  F.probe.heads.forEach((h, i) => { const a = span(t, T.left + i * 0.5, T.left + i * 0.5 + 0.8), y = 340 + i * 100, w = 900 * (h.brokenMismatches / h.outputs);
    items.push(lab(A, `layer ${h.layer + 1}, head ${h.head + 1}`, 22, 300, y + 26, INK.night, "left", a), { shape: rect(560, y, 900, 34, 4), fill: [0.3, 0.27, 0.24, a], screen: true }, { shape: rect(560, y, w * a, 34, 4), fill: [0.89, 0.58, 0.45, 1], screen: true },
      lab(A, `${h.brokenMismatches} of ${h.outputs}`, 22, 1480, y + 26, INK.night, "left", a)); });
  if (t >= T.caught) items.push(lab(A, "the checker caught it", 24, 300, 760, INK.ember, "left", span(t, T.caught, T.caught + 0.8)));
  return scene(t, A, items);
}
// Why keep the largest: e to the score against fp16's limit, on a log scale.
export function overflow(t, A, T, F) {
  const O = F.overflow, X = (s) => 300 + (s / 25) * 1300, items = [...floor(), plate(240, 280, 1460, 440, 0.6)];
  items.push({ shape: rect(X(O.threshold) - 2, 320, 4, 340), fill: [0.49, 0.61, 0.77, 1], screen: true }, lab(A, `fp16 overflows: score ${O.threshold.toFixed(2)}`, 20, X(O.threshold) + 10, 340, [0.7, 0.82, 0.95]));
  for (let s = 0; s <= 25; s += 5) items.push(lab(A, `${s}`, 18, X(s), 690, INK.dim, "center"));
  items.push(lab(A, "score", 18, 300, 720, INK.dim));
  if (t >= T.probe) items.push({ shape: rect(300, 420, X(O.probeRow.max) - 300, 40, 4), fill: [0.85, 0.8, 0.7, 1], screen: true }, lab(A, `our sentence: ${O.probeRow.max.toFixed(2)}, e to it ${O.probeRow.expOfMax.toLocaleString("en")}`, 22, 300, 410, INK.night, "left", span(t, T.probe, T.probe + 0.8)));
  if (t >= T.held) { const mx = Math.max(...O.heldOut.map((h) => h.max)); items.push({ shape: rect(300, 540, X(mx) - 300, 40, 4), fill: [0.89, 0.58, 0.45, 1], screen: true }, lab(A, `held-out rows: up to ${mx.toFixed(2)}`, 22, 300, 530, INK.ember, "left", span(t, T.held, T.held + 0.8))); }
  return scene(t, A, items);
}
export function limits(t, A, T, F) {
  const L = F.lab, items = [...floor(), plate(240, 280, 1460, 380, 0.6), lab(A, "counts of our kernels' memory requests, not times", 26, 300, 360)];
  if (t >= T.lab) items.push(lab(A, `the lab: ${L.kinds.join(", ")} at ${L.sizes.join(", ")} words`, 22, 300, 460, INK.night, "left", span(t, T.lab, T.lab + 0.8)), lab(A, `timed ${L.reps} times on your own chip, with the count beside it`, 22, 300, 520, INK.dim, "left", span(t, T.lab, T.lab + 0.8)));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...floor(), ...wall(1 - span(t, T.start, T.start + 6), 1 - dim), ...bench(1 - 0.6 * dim)]);
}
