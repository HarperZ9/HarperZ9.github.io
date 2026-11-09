// The error-bars lab, drawn at Rerun's tide line: the reader's resamples as beads under the prism
// with the middle 95 percent bracketed, or, in the coverage mode, the intervals from fresh draws
// stacked against the known truth with misses in ember. Pure in state.
import { rect } from "../../media/school/shared/lib.mjs";
import { INK, lab, plate, beach, scene, thePrism, beads, bracket } from "../../media/school/errorbars/scene/tide.mjs";

const BINS = 30;
function hist(stats, lo, hi) {
  const c = new Array(BINS).fill(0);
  for (const v of stats) c[Math.max(0, Math.min(BINS - 1, Math.floor(((v - lo) / (hi - lo)) * BINS)))] += 1;
  return c;
}
export function frame(s, A, t) {
  const items = [...beach(t), ...thePrism(s.mode === "boot" && s.stats.length ? 1 : 0.4)];
  if (s.mode === "boot") {
    const lo = s.range[0], hi = s.range[1], X = (b) => 960 + (b + 0.5) * (840 / BINS), V = (v) => 960 + ((v - lo) / (hi - lo)) * 840;
    items.push(lab(A, `${s.rows} rows, resampling ${s.unit === "row" ? "rows" : "single words"}: score ${s.point.toFixed(4)}`, 24, 120, 300));
    if (s.stats.length) items.push(...beads(hist(s.stats, lo, hi), X, 1, { per: Math.max(1, Math.round(s.stats.length / 400)), maxH: 420 }));
    if (s.interval) items.push(...bracket(A, V, s.interval.lo, s.interval.hi, `middle 95%: ${s.interval.lo.toFixed(4)} to ${s.interval.hi.toFixed(4)}`));
  } else {
    const X = (v) => 760 + ((v - 0.5) / 0.28) * 1050, shown = s.trials.slice(-50);
    items.push(plate(700, 120, 1160, 680, 0.6), { shape: rect(X(s.truth) - 1.5, 140, 3, 640), fill: [0.7, 0.82, 0.95, 1], screen: true }, lab(A, `the truth: ${s.truth.toFixed(4)}`, 22, X(s.truth), 805, [0.7, 0.82, 0.95], "center"));
    shown.forEach((r, i) => { const iv = r[`${s.unit}Pct`]; items.push({ shape: rect(X(iv.lo), 150 + i * 12.5, Math.max(2, X(iv.hi) - X(iv.lo)), 6, 2), fill: iv.hit ? [0.9, 0.86, 0.75, 0.9] : [0.89, 0.58, 0.45, 1], screen: true }); });
    const hits = s.trials.filter((r) => r[`${s.unit}Pct`].hit).length;
    items.push(lab(A, s.trials.length ? `${hits} of ${s.trials.length} held the truth (${((hits / s.trials.length) * 100).toFixed(1)}%)` : "press Draw", 26, 740, 870));
  }
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.15, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
