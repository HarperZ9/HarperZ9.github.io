// The quantisation film's segments (lesson S18) in Tallow's lamp room (PROGRESS.md, step 59): the
// second floor's query, key and value table (real weights, from the LoRA lesson's facts) repainted
// with fewer levels, the histogram of the readout with its levels as ticks, and the costs. The
// rounding drawn is computed here from real weights; every score is a facts.json value (F).
import { rect, circle, polyline, words, span, label, C, darkness } from "../../shared/lib.mjs";
import { host } from "../../embeddings/scene/segs.mjs";
import { night, glazing } from "../../attention/scene/room.mjs";
import { grid, maxAbs, INK } from "../../lora/scene/planks.mjs";

export const roomQ = (t) => [...night(t, { moon: false }), ...glazing()];
export const scene = (t, A, items) => ({ items: [...items, darkness(380, 700, 1900, 0.35), ...host(t, A)], camera: { x: 960, y: 540, zoom: 1 } });
export const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
export const plate = (x, y, w, h, a = 0.6) => ({ shape: rect(x, y, w, h, 10), fill: [0.03, 0.03, 0.04, a], screen: true });
// The real table as rows (32 inputs by 96 outputs), rounded to a symmetric grid of `levels` levels
// with one scale for the whole table (the largest magnitude maps to the top level).
export function table(L, levels = 0) {
  const [K, M] = L.film.shape, rows = Array.from({ length: K }, (_, i) => L.film.base.slice(i * M, (i + 1) * M));
  if (!levels) return rows;
  const s = maxAbs(rows), qmax = (levels - 1) / 2;
  return rows.map((r) => r.map((v) => (Math.round((v / s) * qmax) / qmax) * s));
}
const AT = { x: 560, y: 150 }, CELL = 13;
export const hull = (L, levels, a = 1) => grid(table(L, levels), { at: AT, cell: CELL, scale: maxAbs(table(L)), a });

export function open(t, A, T, F) { return scene(t, A, [...roomQ(t), ...hull(A.L, 0, span(t, 0.8, 2))]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...roomQ(t), ...hull(A.L, 0, 0.45), label(A, "Quantisation", 92, 960, 105, C.ink, "center", a, "head"), label(A, "fewer bits per number", 34, 960, 158, INK.dim, "center", a)]);
}
// The palette: 255, then 15, then 3 levels; then the readout's histogram with its 4-bit levels.
export function palette(t, A, T, F) {
  const lv = t >= T.three ? 3 : t >= T.fifteen ? 15 : 255, items = [...roomQ(t), ...hull(A.L, lv), lab(A, `${lv} levels, one scale for the table`, 26, AT.x, AT.y + 32 * CELL + 50)];
  if (t >= T.hist) {
    const B = F.banding, Lv = B.levels[0], a = span(t, T.hist, T.hist + 1), X = (v) => 560 + ((v + B.maxAbs) / (2 * B.maxAbs)) * 1240, mx = Math.max(...B.histogram);
    items.push(plate(520, 700, 1320, 300, 0.6 * a));
    B.histogram.forEach((c, i) => { const h = (c / mx) * 200; items.push({ shape: rect(560 + i * (1240 / B.histogram.length), 960 - h, 1240 / B.histogram.length - 2, h), fill: [0.9, 0.86, 0.75, a], screen: true }); });
    Lv.values.forEach((v) => items.push({ shape: rect(X(v) - 1, 740, 2, 230), fill: [0.89, 0.58, 0.45, a], screen: true }));
    items.push(lab(A, `the readout's ${B.histogram.reduce((x, y) => x + y, 0).toLocaleString("en")} weights and its ${Lv.values.length} levels at ${Lv.bits} bits`, 22, 560, 730, INK.night, "left", a));
  }
  return scene(t, A, items);
}
// Size: the float model and the 4-bit one as blocks of equal density.
export function size(t, A, T, F) {
  const f = F.schemes.float.bytes, q = F.schemes.rows[18].bytes.total, side = (n) => Math.sqrt(n) * 1.6, a = span(t, T.start, T.start + 1), b = span(t, T.four, T.four + 1), items = [...roomQ(t), ...hull(A.L, 15, 0.3)];
  items.push({ shape: rect(700, 300, side(f), side(f), 6), fill: [0.9, 0.86, 0.75, a], screen: true }, lab(A, `32-bit: ${f.toLocaleString("en")} bytes`, 24, 700, 290, INK.night, "left", a));
  if (b > 0) items.push({ shape: rect(700 + side(f) + 60, 300 + side(f) - side(q), side(q), side(q), 6), fill: [0.89, 0.58, 0.45, b], screen: true }, lab(A, `4-bit: ${q.toLocaleString("en")}`, 24, 700 + side(f) + 60, 300 + side(f) + 40, INK.ember, "left", b));
  return scene(t, A, items);
}
