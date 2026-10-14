// "Run it again", the demo beside "Re-derive it. Don't take it on trust.": a model of a field
// where studies are published only when they come out significant, and the viewer runs every
// published one again. Seeded and pure; no DOM.
//
// A model, not data. Its settings are named on the page: how many studies are tried, how many
// test a real effect and how big it is, the sample sizes, and the bar for publishing (p < 0.05,
// two-sided, in the expected direction). The page sets its result beside the 2015 project the
// film describes (media/explainers/rederive/evidence.json, osc2015): 35 of 97 positive originals
// came back significant, and the mean effect fell from 0.403 to 0.197. The model is not fitted
// to those numbers; it shows the mechanism that can produce numbers like them.

export const RULES = Object.freeze({
  tried: 160, shareReal: 0.5, realEffect: 0.4, originalN: 25, z: 1.96,
  replicationN: { min: 20, max: 400, value: 80 },
});
export const OSC = Object.freeze({ originals: 97, replicated: 35, originalMean: 0.403, replicationMean: 0.197 });

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// A standard normal draw (Box-Muller).
const normal = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
// The standard error of a standardized mean difference with n per group (large-sample).
export const se = (n) => Math.sqrt(2 / n);

// The field: every study tried, its true effect and its original estimate; published if significant.
export function makeField(seed, rules = RULES) {
  const r = rng(seed), studies = [];
  for (let i = 0; i < rules.tried; i++) {
    const real = r() < rules.shareReal, d = real ? rules.realEffect : 0;
    const est = d + normal(r) * se(rules.originalN);
    studies.push({ id: i, real, d, original: est, published: est / se(rules.originalN) > rules.z });
  }
  return { seed, studies, published: studies.filter((s) => s.published) };
}

// Run every published study again at n per group, with its own seed so a run is repeatable.
export function rerun(field, n, seed, rules = RULES) {
  const r = rng(seed ^ 0x5bd1e995);
  return field.published.map((s) => {
    const est = s.d + normal(r) * se(n);
    return { id: s.id, real: s.real, original: s.original, again: est, back: est / se(n) > rules.z };
  });
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export function summarize(runs) {
  const back = runs.filter((x) => x.back), missed = runs.filter((x) => !x.back);
  return {
    published: runs.length, back: back.length, originalMean: mean(runs.map((x) => x.original)), againMean: mean(runs.map((x) => x.again)),
    missedReal: missed.filter((x) => x.real).length, missed: missed.length, backNull: back.filter((x) => !x.real).length,
    publishedNull: runs.filter((x) => !x.real).length,
  };
}
