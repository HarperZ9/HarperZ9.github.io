// The precision film's later segments (lesson K24): the error of one real table with 32-bit and 16-bit
// sums (log scale), the whole model's held-out loss in each mode with intervals, and the close.
// Every value drawn is a facts.json value (F).
import { rect, span } from "../../shared/lib.mjs";
import { roomQ, scene, lab, plate } from "../../quant/scene/segs.mjs";
import { jugs } from "./segs.mjs";

const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472" };
const NAMES = { fp32: "32-bit throughout", fp16acc32: "fp16 inputs, 32-bit sums", fp16acc16: "fp16 throughout", bf16acc32: "bf16 inputs, 32-bit sums", bf16acc16: "bf16 throughout" };
export function cores(t, A, T, F) {
  const r = F.matmul.rows[1], X = (v) => 1060 + ((Math.log10(v) + 8) / 7) * 640, g = 0.3 * span(t, T.start, T.start + 1), items = [...roomQ(t), plate(620, 220, 1240, 640, 0.6), lab(A, `relative error of the ${r.name} table, ${r.N} rows (log scale)`, 20, 680, 270, INK.dim)];
  r.modes.forEach((m, i) => { const a = span(t, T.bars + i * 0.6, T.bars + i * 0.6 + 0.8), y = 340 + i * 100, v = m.total.relNorm;
    items.push(lab(A, NAMES[m.mode], 20, 680, y + 24, INK.night, "left", Math.max(g, a)), { shape: rect(1060, y, (X(v) - 1060) * a, 34, 4), fill: m.mode.endsWith("acc16") ? [0.89, 0.58, 0.45, 1] : [0.9, 0.86, 0.75, 0.9], screen: true },
      lab(A, v.toExponential(1), 20, X(v) * a + 1060 * (1 - a) + 14, y + 24, INK.night, "left", a)); });
  return scene(t, A, items);
}
export function model(t, A, T, F) {
  const bars = F.film.lossBars, X = (v) => 1060 + ((v - 0.655) / 0.025) * 600, g = 0.3 * span(t, T.start, T.start + 1), items = [...roomQ(t), plate(620, 220, 1240, 660, 0.6), lab(A, `held-out loss on ${F.recipe.heldOutRows.toLocaleString("en")} rows, with intervals`, 20, 680, 270, INK.dim)];
  bars.forEach((b, i) => { const a = span(t, T.loss + i * 0.5, T.loss + i * 0.5 + 0.8), y = 330 + i * 90;
    items.push(lab(A, NAMES[b.mode] || b.mode, 20, 680, y + 20, INK.night, "left", Math.max(g, a)), { shape: rect(X(b.lo), y + 6, X(b.hi) - X(b.lo), 4, 2), fill: [0.7, 0.82, 0.95, a], screen: true }, { shape: rect(X(b.value) - 5, y - 6, 10, 28, 3), fill: [0.89, 0.58, 0.45, a], screen: true },
      lab(A, b.value.toFixed(4), 20, X(b.hi) + 16, y + 20, INK.night, "left", a)); });
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...roomQ(t), ...jugs(A, F, 1, 1 - 0.6 * dim)]);
}
