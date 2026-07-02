// Refine -- the creation drive. From a starting point, judge against the criteria, reflect on the
// weakest axis, and move the parameter vector to improve COHESION (which folds in novelty) -- bounded
// coordinate descent -- until the artifact is CORRECT on every axis, or budget's spent (honest
// best-effort). The witnessed trajectory IS the reasoning. Ported from studio-engine's refine loop.
import { score, cohesion, tag } from "./criteria.js";
import { organFeatures, clampParams } from "./organ.js";

const round = (x) => Math.round(x * 1e4) / 1e4;

export function evaluate(organ, params, corpus) {
  const features = organFeatures(organ, params);
  const margins = {};
  for (const ax of organ.axes) margins[ax] = score(ax, features, params);
  margins.novelty = corpus ? corpus.novelty(features) : 1;
  return { features, margins, cohesion: cohesion(Object.values(margins)) };
}

function bestMove(organ, params, corpus, frac) {
  const base = evaluate(organ, params, corpus).cohesion;
  let best = params, bestCoh = base;
  for (const p of organ.params) {
    const delta = (p.max - p.min) * frac;
    for (const d of [delta, -delta]) {
      const trial = clampParams(organ, { ...params, [p.k]: params[p.k] + d });
      const coh = evaluate(organ, trial, corpus).cohesion;
      if (coh > bestCoh + 1e-6) { best = trial; bestCoh = coh; }
    }
  }
  return { params: best, improved: bestCoh > base + 1e-6 };
}

export function refine(organ, startParams, opts = {}) {
  const { corpus = null, maxSteps = 24, target = 0.9, floor = 0.6 } = opts;
  let params = clampParams(organ, startParams);
  let frac = 0.34, best = null;
  const trajectory = [];
  for (let k = 0; k < maxSteps; k++) {
    const ev = evaluate(organ, params, corpus);
    const weakest = Object.keys(ev.margins).reduce((a, b) => (ev.margins[b] < ev.margins[a] ? b : a));
    trajectory.push({ index: k, params: { ...params }, margins: ev.margins, cohesion: round(ev.cohesion), weakest });
    if (!best || ev.cohesion > best.cohesion) best = { ...ev, params: { ...params } };
    if (ev.cohesion >= target && Object.values(ev.margins).every((s) => s >= floor)) break;
    const next = bestMove(organ, params, corpus, frac);
    if (!next.improved) { frac *= 0.55; if (frac < 0.02) break; }
    params = next.params;
  }
  const converged = best.cohesion >= target && Object.values(best.margins).every((s) => s >= floor);
  return {
    params: best.params, features: best.features, margins: best.margins, cohesion: round(best.cohesion),
    converged, tag: tag(best.cohesion, target, floor), trajectory,
  };
}
