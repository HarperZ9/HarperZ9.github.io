// The quantisation film's later segments (lesson S18): loss against bits on a chart (one scale per
// output, then per table), one table at a time, rounding with care, and the close. Every value
// drawn is a facts.json value (F).
import { rect, circle, polyline, span } from "../../shared/lib.mjs";
import { INK } from "../../lora/scene/planks.mjs";
import { roomQ, scene, lab, plate, hull } from "./segs.mjs";

const BOX = { x: 560, y: 150, w: 1280, h: 640 };
// Loss on a log axis from 0.6 to 8, bits from 8 down to 2.
const X = (b) => BOX.x + 80 + ((8 - b) / 6) * (BOX.w - 160), Y = (v) => BOX.y + BOX.h - 60 - (Math.log(v / 0.6) / Math.log(8 / 0.6)) * (BOX.h - 120);
function curve(A, pts, show, col, name) {
  const out = [], seen = pts.filter((p) => show(p.bits));
  if (seen.length > 1) out.push({ shape: polyline(seen.flatMap((p) => [X(p.bits), Y(p.loss)])), fill: null, stroke: col, width: 4, screen: true });
  seen.forEach((p) => out.push({ shape: circle(X(p.bits), Y(p.loss), 8, 12), fill: col, screen: true }, lab(A, p.loss >= 1 ? p.loss.toFixed(2) : p.loss.toFixed(4), 18, X(p.bits) + 12, Y(p.loss) - 12, INK.night)));
  if (seen.length) out.push(lab(A, name, 20, X(seen.at(-1).bits) - 16, Y(seen.at(-1).loss) + 30, col, "right"));
  return out;
}
export function cost(t, A, T, F) {
  const Cv = F.film.curves, items = [...roomQ(t), plate(BOX.x, BOX.y, BOX.w, BOX.h)];
  items.push({ shape: rect(BOX.x + 80, Y(F.schemes.float.loss.value), BOX.w - 160, 2), fill: [0.7, 0.82, 0.95, 0.8], screen: true }, lab(A, `full model ${F.schemes.float.loss.value.toFixed(4)}`, 18, BOX.x + BOX.w - 90, Y(F.schemes.float.loss.value) - 10, [0.7, 0.82, 0.95], "right"));
  for (const b of [8, 6, 4, 3, 2]) items.push(lab(A, `${b} bits`, 18, X(b), BOX.y + BOX.h - 20, INK.dim, "center"));
  const when = { 8: T.eight, 6: T.six, 4: Math.max(T.four, T.ask.held), 3: T.three, 2: T.two };
  items.push(...curve(A, Cv.rtnChannel, (b) => t >= when[b], [0.89, 0.58, 0.45, 1], "one scale per output"));
  if (t >= T.tensor) items.push(...curve(A, Cv.rtnTensor, () => true, [0.9, 0.86, 0.75, 1], "one scale per table"));
  return scene(t, A, items);
}
// One table at a time, 4 bits, one scale per table: the rise in loss for each.
export function where(t, A, T, F) {
  const rows = F.sensitivity.rows.filter((r) => r.bits === 4), mx = Math.max(...rows.map((r) => r.loss.diff)), items = [...roomQ(t)];
  if (t < T.one) return scene(t, A, [...items, ...hull(A.L, 15, 1), lab(A, "one scale must reach the biggest number: the steps get wide", 22, 560, 640, INK.night, "left", span(t, T.wide, T.wide + 0.8))]);
  items.push(plate(560, 150, 1280, 660), lab(A, "one table at 4 bits, the rest full: rise in loss (nats)", 22, 600, 200, INK.dim));
  rows.forEach((r, i) => { const y = 240 + i * 50, a = span(t, T.one + i * 0.25, T.one + i * 0.25 + 0.6), w = Math.max(2, (Math.max(0, r.loss.diff) / mx) * 700), hot = r.loss.diff === mx;
    items.push(lab(A, r.name, 20, 600, y + 18, hot ? INK.ember : INK.night, "left", a), { shape: rect(800, y, w * a, 26, 3), fill: hot ? [0.89, 0.58, 0.45, 1] : [0.9, 0.86, 0.75, 0.9], screen: true }, lab(A, r.loss.diff.toFixed(4), 18, 800 + w * a + 12, y + 18, INK.night, "left", a)); });
  return scene(t, A, items);
}
// Rounding with care: the rise in loss for plain rounding and GPTQ at 4 bits, with intervals.
export function gptq(t, A, T, F) {
  const r = F.schemes.rows[18], g = F.schemes.rows[19], W = 30000, items = [...roomQ(t), plate(560, 250, 1280, 400), lab(A, "rounding each number alone, or a table's numbers together", 22, 600, 300, INK.dim)];
  const bar = (y, row, name, at, col) => { const a = span(t, at, at + 0.8); if (a <= 0) return [];
    return [lab(A, name, 22, 600, y - 14, INK.night, "left", a), { shape: rect(600, y, row.loss.diff * W * a, 34, 4), fill: col, screen: true }, { shape: rect(600 + row.loss.diffLo * W, y + 44, (row.loss.diffHi - row.loss.diffLo) * W, 5, 2), fill: [0.7, 0.82, 0.95, a], screen: true }, lab(A, `+${row.loss.diff.toFixed(4)}`, 22, 600 + row.loss.diff * W * a + 14, y + 26, INK.night, "left", a)]; };
  items.push(...bar(380, r, "4 bits, one scale per output, plain rounding", T.plain, [0.9, 0.86, 0.75, 1]), ...bar(520, g, "the same, GPTQ", T.careful, [0.89, 0.58, 0.45, 1]));
  if (t >= T.broken) { const a = F.film.curves.rtnTensor.at(-1), b = F.schemes.rows[33]; items.push(lab(A, `2 bits, one scale per table: plain ${a.loss.toFixed(2)}, GPTQ ${b.loss.value.toFixed(2)}`, 22, 600, 620, INK.ember, "left", span(t, T.broken, T.broken + 0.8))); }
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...roomQ(t), ...hull(A.L, 15, 1 - 0.6 * dim)]);
}
