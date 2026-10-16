// Lesson L16: pairwise judging and the contamination gap. Pure ES module.
//
// Pairwise judging (the MT-Bench setting of Zheng and others 2023, "Judging
// LLM-as-a-judge", arXiv:2306.05685): a judge sees two answers to the same
// prompt and names the better one. The paper measures two biases of LLM
// judges this toy can mimic only by construction:
//   position   the verdict changes when the two answers swap places (their
//              Table 2: GPT-4 gave the same verdict after a swap in 65.0
//              percent of cases, Claude-v1 in 23.8, GPT-3.5 in 46.2);
//   verbosity  a longer answer is preferred though it adds nothing (their
//              Table 3, a "repetitive list" attack: GPT-4 fooled on 8.7
//              percent of 23 answers, Claude-v1 and GPT-3.5 on 91.3).
// The fluent pairwise judge here must name a winner. Its rule: the answer
// that passes the fluent check wins; if both or neither pass, the longer
// answer wins; if they are the same length, the one shown first wins. Both
// biases are written into the rule, so what is measured is how often each
// rule decides a verdict on these models' text, nothing about LLM judges.
// The perfect pairwise judge prefers the answer the grammar accepts and
// calls a tie when both or neither pass.

import { rng } from "./tinyformer-ops.mjs";
import { quantile, scoreOf } from "./errorbars.mjs";

export function perfectPair(a, b) {
  return a.perfect === b.perfect ? "tie" : a.perfect ? "first" : "second";
}

// Returns which position wins and the rule that decided it.
export function fluentPair(first, second) {
  if (first.fluent !== second.fluent) return { win: first.fluent ? "first" : "second", by: "fluency" };
  if (first.len !== second.len) return { win: first.len > second.len ? "first" : "second", by: "length" };
  return { win: "first", by: "position" };
}

// Judge model X's and model Y's answers to the same prompts, in both orders.
// Per item: perfect verdict (x, y or tie), fluent verdict with X shown first
// and with Y shown first, and whether the two orders agree.
export function pairwiseItems(rowsX, rowsY) {
  return rowsX.map((x, i) => {
    const y = rowsY[i], p = perfectPair(x, y), xy = fluentPair(x, y), yx = fluentPair(y, x);
    const winXY = xy.win === "first" ? "x" : "y", winYX = yx.win === "first" ? "y" : "x";
    return { perfect: p === "tie" ? "tie" : p === "first" ? "x" : "y", winXY, winYX, byXY: xy.by, byYX: yx.by, consistent: winXY === winYX, firstBoth: xy.win === "first" && yx.win === "first", same: sameText(x, y), lenX: x.len, lenY: y.len };
  });
}

const sameText = (x, y) => !!x.gen && !!y.gen && x.gen.length === y.gen.length && x.gen.every((w, i) => w === y.gen[i]);

// Shares over all items; the *Differ fields count only pairs whose two texts
// are not word-for-word the same (for identical texts any verdict is fair).
export function pairwiseSummary(items) {
  const n = items.length, share = (f) => items.filter(f).length / n;
  const decided = items.filter((t) => t.perfect !== "tie");
  const shorterWins = decided.filter((t) => (t.perfect === "x" ? t.lenX < t.lenY : t.lenY < t.lenX));
  const by = {};
  for (const t of items) by[t.byXY] = (by[t.byXY] ?? 0) + 1 / n;
  return {
    n, perfectX: share((t) => t.perfect === "x"), perfectY: share((t) => t.perfect === "y"), perfectTie: share((t) => t.perfect === "tie"),
    fluentXwinsXY: share((t) => t.winXY === "x"), fluentXwinsYX: share((t) => t.winYX === "x"),
    consistent: share((t) => t.consistent), firstBoth: share((t) => t.firstBoth), decidedBy: by,
    agreeOnDecided: decided.length ? decided.filter((t) => t.winXY === t.perfect && t.winYX === t.perfect).length / decided.length : NaN, decided: decided.length,
    same: share((t) => t.same), ...differ(items),
    shorterRight: shorterWins.length, longerPicked: shorterWins.length ? shorterWins.filter((t) => t.winXY !== t.perfect).length / shorterWins.length : NaN,
  };
}

function differ(items) {
  const d = items.filter((t) => !t.same), n = Math.max(1, d.length);
  return { differ: d.length, consistentDiffer: d.filter((t) => t.consistent).length / n, firstBothDiffer: d.filter((t) => t.firstBoth).length / n, positionDecidedDiffer: d.filter((t) => t.byXY === "position").length / n };
}

// Row-resampled percentile interval of any statistic of item lists that share
// row indices (lists[k][i] is row i of list k). stat(...lists) -> number.
export function pairedStatInterval(lists, stat, { resamples = 1000, seed = 1 } = {}) {
  const n = lists[0].length, r = rng(seed), out = [];
  for (let s = 0; s < resamples; s++) {
    const idx = Array.from({ length: n }, () => Math.floor(r() * n));
    const v = stat(...lists.map((l) => idx.map((i) => l[i])));
    if (Number.isFinite(v)) out.push(v);
  }
  const sorted = Float64Array.from(out).sort(), point = stat(...lists);
  return { mean: point, lo: quantile(sorted, 0.025), hi: quantile(sorted, 0.975), resamples: out.length };
}

const pick = (u, idx) => { let a = 0, d = 0; for (const i of idx) { a += u.num[i]; d += u.den[i]; } return a / d; };

// The contamination gap as a difference in differences. cA and kA are the
// clean and contaminated model on set A (rows that were mixed into the
// contaminated model's training); cB and kB on fresh set B. Each pair shares
// rows, so A's rows are resampled once for both models, and B's rows on
// their own. gap = (cA - kA) - (cB - kB): how much more the contaminated
// model's score moved on the leaked rows than on fresh rows.
export function contaminationGap(cA, kA, cB, kB, { resamples = 2000, seed = 1 } = {}) {
  const r = rng(seed), nA = cA.num.length, nB = cB.num.length, out = new Float64Array(resamples);
  for (let s = 0; s < resamples; s++) {
    const iA = Array.from({ length: nA }, () => Math.floor(r() * nA)), iB = Array.from({ length: nB }, () => Math.floor(r() * nB));
    out[s] = (pick(cA, iA) - pick(kA, iA)) - (pick(cB, iB) - pick(kB, iB));
  }
  out.sort();
  const onA = scoreOf(cA) - scoreOf(kA), onB = scoreOf(cB) - scoreOf(kB);
  return { onA, onB, gap: onA - onB, lo: quantile(out, 0.025), hi: quantile(out, 0.975) };
}

// "resolved" when a 95 percent interval excludes zero, as lesson E23 says it.
export const resolved = (iv) => iv.lo > 0 || iv.hi < 0;
export const sign = (iv) => (iv.lo > 0 ? 1 : iv.hi < 0 ? -1 : 0);
