// The denoiser film's later segments (lesson K25): the arithmetic near 110 with the bound drawn on
// fp16's marks and the small re-creation's readings, the fixes as stones thrown at a post that does not
// move, the post alone, and the close. Every value drawn is a facts.json value (F).
import { rect, circle } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";
import { patch, gauge } from "./segs.mjs";

const EMBER = [0.89, 0.58, 0.45], SLATE = [0.7, 0.82, 0.95];
export function arithmetic(t, A, T, F) {
  const N = F.arithmetic.near110, b = F.recipe.bound, X = (v) => 640 + ((v - 109.8) / 0.4) * 1100, items = [...beach(t), plate(560, 160, 1260, 660, 0.6)];
  const a0 = span(t, T.start, T.start + 1);
  items.push({ shape: rect(640, 330, 1100, 3), fill: [0.6, 0.55, 0.45, a0], screen: true }, lab(A, "fp16 near 110", 22, 640, 230, INK.night, "left", a0));
  for (let v = Math.ceil(109.8 / N.fp16Spacing) * N.fp16Spacing; v <= 110.2; v += N.fp16Spacing) items.push({ shape: rect(X(v) - 1, 312, 2, 40), fill: [...EMBER, span(t, T.marks, T.marks + 0.8)], screen: true });
  const ab = span(t, T.start + 1, T.start + 2);
  items.push({ shape: rect(X(110 - b), 300, X(110 + b) - X(110 - b), 64), fill: [...SLATE, 0.35 * ab], screen: true }, lab(A, `the bound: 110 plus or minus ${b}`, 20, X(110), 290, INK.night, "center", ab));
  [109.8, 110, 110.2].forEach((v) => items.push(lab(A, String(v), 18, X(v), 390, INK.dim, "center", a0)));
  const R = F.recreation.firefly, top = 0.12, as = span(t, T.stand - 0.5, T.stand);
  items.push(lab(A, "our small stand-in, at its glint (synthetic)", 20, 640, 470, INK.dim, "left", as));
  items.push(...gauge(A, 640, 560, 1100, "16-bit inputs and weights", R.WA.maxAbs, span(t, T.stand, T.stand + 1.5), top, b, EMBER, as), ...gauge(A, 640, 690, 1100, "32-bit throughout", R.scalar.maxAbs, span(t, T.stand + 1, T.stand + 2), top, b, INK.paper.slice(0, 3), as));
  if (t >= T.noGlint) items.push(lab(A, `without the glint, every version passes; across ${F.sweep.firefly.WA.n} seeds, 16-bit misses in ${F.sweep.firefly.WA.over}`, 20, 640, 790, INK.night, "left", span(t, T.noGlint, T.noGlint + 0.8)));
  return scene(t, A, items);
}
// The fixes: a post at the bound, each attempt a stone thrown from the left that lands where its worst
// difference is. 32-bit throughout lands short of the post.
export function fixes(t, A, T, F) {
  const P = F.primary, M = P.mixed, b = F.recipe.bound, X = (e) => 640 + (e / 0.12) * 1100, items = [...beach(t), plate(560, 160, 1260, 660, 0.6)];
  items.push({ shape: rect(X(b) - 5, 220, 10, 560), fill: [...SLATE, 1], screen: true }, lab(A, `the bound, ${b}`, 20, X(b), 205, INK.night, "center"));
  const rows = [["all 16-bit (emulation)", P.emulation.WA.max_abs, T.start + 0.5], ["head in 32-bit", M["keep-10"].max_abs, T.head], ["three layers in 32-bit", M["keep-10_1_9"].max_abs, T.three], ["six layers in 32-bit", M["keep-10_1_9_8_0_3"].max_abs, T.six], ["32-bit throughout (the chip)", P.rtx.scalar.max_abs, T.fp32]];
  rows.forEach(([n, v, at], i) => { const u = span(t, at, at + 1), y = 280 + i * 105, a = span(t, at - 0.3, at);
    items.push(lab(A, n, 20, X(b) + 24, y - 16, INK.dim, "left", a), { shape: circle(640 + (X(v) - 640) * u, y + 14, 14, 24), fill: v > b ? [...EMBER, a] : [0.9, 0.86, 0.75, a], screen: true }, lab(A, u >= 1 ? v.toFixed(4) : "", 20, X(v) + 24, y + 22, INK.night, "left", a)); });
  return scene(t, A, items);
}
export function bound(t, A, T, F) {
  const items = [...beach(t), { shape: rect(640, 360, 14, 460), fill: [...SLATE, 1] }, lab(A, `the bound: ${F.recipe.bound}`, 26, 650, 330, INK.night, "center")];
  [["tensor-core path: unchanged this round; parity still fails", T.start + 0.5], ["options: 32-bit throughout, or keep the filter away from glint-sized values", T.options], ["the bound is not loosened", T.kept]].forEach(([s, at], i) => items.push(lab(A, s, 24, 700, 480 + i * 70, i === 2 ? INK.ember : INK.night, "left", span(t, at, at + 0.8))));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...beach(t), ...patch(560, 300, 1 - dim, 1 - 0.5 * dim), { shape: rect(1300, 360, 14, 460), fill: [...SLATE, 1] }]);
}
