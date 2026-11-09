// The precision film's segments (lesson K24) in Tallow's lamp room (PROGRESS.md, step 65): three
// measuring jugs (marks for precision, height for range), the number lines near 110 with each format's
// representable values as ticks, the sum that stops, the sums kept in 32 bits, and the whole model.
// Every value drawn is a facts.json value (F); timings from the cue map in film.scene.mjs (T).
import { rect, polyline, span, label, C } from "../../shared/lib.mjs";
import { roomQ, scene, lab, plate } from "../../quant/scene/segs.mjs";

const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472", slate: [0.7, 0.82, 0.95] };
export function jugs(A, F, u = 1, a = 1) {
  const J = F.film.jugs, H = (j) => 120 + (Math.min(j.log2Range, 280) / 280) * 520, out = [];
  J.forEach((j, i) => { const x = 620 + i * 380, y0 = 860, h = H(j), marks = Math.min(48, Math.round(Math.log2(j.marksPerDoubling) * 2));
    out.push({ shape: rect(x, y0 - h, 200, h, 10), fill: [0.6, 0.7, 0.8, 0.15 * a], stroke: [0.9, 0.95, 1, 0.7 * a], width: 3 }, { shape: rect(x, y0 - h * 0.5 * u, 200, h * 0.5 * u, 6), fill: [0.89, 0.58, 0.45, 0.7 * a] });
    for (let m = 1; m < marks; m++) out.push({ shape: rect(x, y0 - (h * m) / marks, 24, 2), fill: [0.9, 0.9, 0.9, 0.8 * a] });
    out.push(lab(A, j.format, 26, x + 100, y0 + 40, INK.night, "center", a)); });
  return out;
}
export function open(t, A, T, F) { return scene(t, A, [...roomQ(t), ...jugs(A, F, span(t, 1, 3.5), span(t, 0.5, 1.5))]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...roomQ(t), ...jugs(A, F, 1, 0.4), label(A, "fp16, bf16 and tensor cores", 80, 960, 120, C.ink, "center", a, "head")]);
}
export function jugsSeg(t, A, T, F) {
  const items = [...roomQ(t), ...jugs(A, F)], R = F.film.jugs.map((j) => F.formats.rows.find((r) => r.name === j.format));
  if (t >= T.bits) R.forEach((r, i) => items.push(lab(A, `${r.p} bits of significand`, 20, 720 + i * 380, 960, INK.dim, "center", span(t, T.bits + i * 0.6, T.bits + i * 0.6 + 0.8))));
  return scene(t, A, items);
}
// Near 110: three number lines; the fp16 ticks wait for the question; a value between marks.
export function near(t, A, T, F) {
  const L = F.film.numberLine, X = (v) => 720 + ((v - L.from) / (L.to - L.from)) * 1060, items = [...roomQ(t), plate(620, 260, 1240, 540, 0.6)];
  const rowsF = [["bf16", L.bf16, 360, T.bf], ["fp16", L.fp16, 520, Math.max(T.fp, T.ask.held)], ["fp32", null, 680, T.start + 1]];
  rowsF.forEach(([n, ticks, y, at]) => { const a = span(t, at, at + 0.8);
    items.push({ shape: rect(720, y, 1060, 2), fill: [0.6, 0.55, 0.45, 1], screen: true }, lab(A, n, 24, 700, y + 8, INK.night, "right"));
    if (a > 0 && ticks) ticks.forEach((v) => items.push({ shape: rect(X(v) - 1, y - 18, 2, 38), fill: [0.89, 0.58, 0.45, a], screen: true }));
    if (a > 0 && !ticks) items.push({ shape: rect(720, y - 18, 1060, 38), fill: [0.89, 0.58, 0.45, 0.35 * a], screen: true }, lab(A, `${L.fp32Count.toLocaleString("en")} marks here`, 20, 1780, y - 26, INK.dim, "right", a)); });
  for (let v = Math.ceil(L.from); v <= L.to; v++) items.push(lab(A, `${v}`, 18, X(v), 760, INK.dim, "center"));
  if (t >= T.worst) items.push(lab(A, `fp16 near 110: off by up to ${F.near110.absolute.fp16WorstMove}`, 24, 720, 300, INK.ember, "left", span(t, T.worst, T.worst + 0.8)));
  return scene(t, A, items);
}
// The sum that stops: adding 1, five thousand times, in fp16, bf16 and fp32.
export function stuck(t, A, T, F) {
  const C1 = F.stagnation.curves.ones, n = C1.fp16.at(-1)[0], X = (k) => 720 + (k / n) * 1060, Y = (v) => 820 - (v / n) * 520, items = [...roomQ(t), plate(620, 240, 1240, 640, 0.6)];
  items.push({ shape: rect(720, 820, 1060, 2), fill: [0.6, 0.55, 0.45, 1], screen: true }, { shape: rect(720, 300, 2, 520), fill: [0.6, 0.55, 0.45, 1], screen: true }, lab(A, `${n.toLocaleString("en")} additions`, 18, 1780, 856, INK.dim, "right"));
  const shown = Math.max(2, Math.floor(span(t, T.start + 1, T.stops) * C1.fp16.length));
  [["fp32", INK.slate], ["fp16", [0.89, 0.58, 0.45, 1]], ["bf16", [0.9, 0.86, 0.75, 1]]].forEach(([k, col]) => items.push({ shape: polyline(C1[k].slice(0, shown).flatMap(([i, v]) => [X(i), Y(v)])), fill: null, stroke: col, width: 4, screen: true }));
  if (t >= T.stops) items.push(lab(A, `fp16 stops at ${F.stagnation.rows[0].stuckAt.toLocaleString("en")}`, 24, 1200, Y(F.stagnation.rows[0].stuckAt) - 16, INK.ember, "left", span(t, T.stops, T.stops + 0.8)));
  if (t >= T.bfStop) items.push(lab(A, `bf16 stops at ${F.stagnation.rows[1].stuckAt}`, 24, 1200, Y(F.stagnation.rows[1].stuckAt) - 16, INK.night, "left", span(t, T.bfStop, T.bfStop + 0.8)));
  items.push(lab(A, "the running total after each addition of 1; slate: fp32", 20, 720, 280, INK.dim));
  return scene(t, A, items);
}
