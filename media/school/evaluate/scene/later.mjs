// The evaluation film's later segments (lesson L16): the 39 checkpoint pairs and where the scores
// disagree, the cheap judge's order test, the leak runs, and the close. Every value drawn is a
// facts.json value (F).
import { rect, circle } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, thePrism, span } from "../../errorbars/scene/tide.mjs";
import { bands, at } from "./segs.mjs";

const KEYS = ["loss", "exact", "perfect", "fluent"], NAMES = ["loss", "exact", "perfect judge", "cheap judge"];
// One row per checkpoint pair, one cell per score: up (resolved better), down (resolved worse), open.
export function disagree(t, A, T, F) {
  const P = F.disagreements.pairs, items = [...beach(t), ...thePrism(0.4), plate(560, 120, 1320, 780, 0.6)], n = Math.ceil(span(t, T.start, T.start + 4) * P.length);
  const opp = (p) => KEYS.some((k) => p.signs[k] > 0) && KEYS.some((k) => p.signs[k] < 0);
  const lossOnly = (p) => p.signs.loss > 0 && p.signs.exact === 0;
  NAMES.forEach((nm, j) => items.push(lab(A, nm, 18, 760 + j * 140, 160, INK.dim, "center")));
  P.slice(0, n).forEach((p, i) => {
    const col = i < 20 ? 0 : 1, y = 190 + (i % 20) * 34, x0 = 600 + col * 640, hot = (t >= T.opposite && opp(p)) || (t >= T.lossOnly && t < T.opposite && lossOnly(p));
    items.push(lab(A, `${p.seed}: ${p.from}-${p.to}`, 16, x0, y + 6, hot ? INK.ember : INK.dim));
    KEYS.forEach((k, j) => { const s = p.signs[k], x = x0 + 140 + j * 120 * (col ? 0.85 : 1);
      items.push({ shape: circle(x, y, 9, 12), fill: s > 0 ? [0.9, 0.86, 0.75, 1] : s < 0 ? [0.89, 0.58, 0.45, 1] : [0.3, 0.27, 0.24, 1], screen: true }); });
  });
  items.push(lab(A, "light: resolved better; ember: resolved worse; dark: cannot tell", 18, 600, 880, INK.dim));
  if (t >= T.lossOnly) items.push(lab(A, `loss better, exact match cannot tell: ${F.disagreements.counts.lossOnly} of ${F.disagreements.counts.pairs}`, 22, 600, 940, INK.night, "left", span(t, T.lossOnly, T.lossOnly + 0.8)));
  return scene(t, A, items);
}

// Order test: an early and a late answer, shown both ways; how often the verdict survives the swap.
export function order(t, A, T, F) {
  const Pw = F.pairwise.pairs["1.200"], ex = F.film.fooled[0], swap = Math.floor((t - T.start) / 2.5) % 2 === 1, items = [...beach(t), ...thePrism(0.4), plate(560, 160, 1320, 640, 0.6)];
  const first = swap ? ex.late.words : ex.early.words, second = swap ? ex.early.words : ex.late.words;
  items.push(lab(A, `"${ex.prompt.join(" ")} ..."`, 22, 600, 220, INK.dim), lab(A, `first shown: ${first.join(" ")}`, 24, 600, 300, INK.ember), lab(A, `second: ${second.join(" ")}`, 24, 600, 350, INK.night),
    lab(A, "the cheap judge picks: the first shown", 22, 600, 420, INK.ember, "left", span(t, T.start + 1, T.start + 2)));
  if (t >= T.keeps) { const a = span(t, T.keeps, T.keeps + 1);
    items.push({ shape: rect(600, 500, 1000 * Pw.consistentDiffer * a, 34, 3), fill: [0.89, 0.58, 0.45, 1], screen: true }, lab(A, `same verdict after the swap: ${Math.round(Pw.consistentDiffer * 100)}% of ${Pw.differ} differing pairs (first run)`, 22, 600, 580, INK.night, "left", a)); }
  if (t >= T.zheng) items.push(lab(A, "Zheng and colleagues, 2023: GPT-4, 65% the same after a swap", 22, 600, 680, INK.dim, "left", span(t, T.zheng, T.zheng + 0.8)));
  return scene(t, A, items);
}

// Leaks: for each run, how much more the leaked rows' loss fell than fresh rows', per seed.
export function leak(t, A, T, F) {
  const arms = [["2000.256x1", T.once], ["2000.256x16", T.sixteen], ["2000.32x100", T.many], ["2000.32x250", T.many + 1.5]], X0 = 1100, S = 2000;
  const items = [...beach(t), ...thePrism(0.4), plate(560, 160, 1320, 640, 0.6), { shape: rect(X0 - 1, 200, 2, 520), fill: [0.7, 0.82, 0.95, 0.8], screen: true }, lab(A, "no gap", 18, X0, 190, [0.7, 0.82, 0.95], "center")];
  arms.forEach(([k, at], i) => {
    const r = F.contamination.arms[k], y = 250 + i * 120, a = span(t, at, at + 0.8);
    items.push(lab(A, `${r.rows} rows, ${r.repeats} time${r.repeats > 1 ? "s" : ""}`, 22, 600, y + 20, INK.night, "left", a));
    r.gap.loss.values.forEach((v, s) => items.push({ shape: circle(X0 + Math.max(-0.05, Math.min(0.4, v)) * S, y + 10 + s * 14, 7, 12), fill: [0.89, 0.58, 0.45, a], screen: true }));
    items.push(lab(A, `mean gap ${r.gap.loss.mean.toFixed(4)} nats`, 20, 1340, y + 20, INK.dim, "left", a));
  });
  if (t >= T.chance) items.push(lab(A, `${F.sets.overlap["1"].A.seenInTraining} of ${F.sets.A.rows} test rows already in a clean run's training text`, 22, 600, 760, INK.night, "left", span(t, T.chance, T.chance + 0.8)));
  return scene(t, A, items);
}

export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end), c = at(F, 2000);
  return scene(t, A, [...beach(t), ...thePrism(1 - dim), ...bands(A, c, 1 - 0.7 * dim)], { knock: T.end - 2 });
}
