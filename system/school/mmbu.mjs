// Lesson S20's computation: the MMBU scorers' paired bootstraps, re-run on the published per-row
// scores with numpy's own random stream (mmbu-rng.mjs), so an interval printed in the run records
// can be re-derived to the digit in a browser.
//
// Dev (the scorer score_ft7.py): one index matrix, B rows of n draws from integers(0, n), shared by
// every comparison; each resample's mean of the per-row difference; the 2.5th and 97.5th
// percentiles (numpy's linear rule); the point is the plain mean; 4 decimals.
// Held-out (evaluate3.py): clusters in the scorer's sorted order; B rows of draws from
// integers(0, clusters); each resample is sum(values) / sum(rows) over the drawn clusters; numpy
// quantiles 0.025 and 0.975; 5 decimals.
import { PCG64 } from "./mmbu-rng.mjs";

export const SEED = 20261002, B = 10000;

// numpy.percentile / quantile, method "linear", on a sorted Float64Array.
export function quantile(sorted, q) {
  const pos = q * (sorted.length - 1), lo = Math.floor(pos), hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const round = (v, d) => Number(v.toFixed(d));

// A resumable bootstrap: step(k) draws k more resamples and returns the done count; result() reads
// the interval. The generator is created once, so B resamples in slices equal B in one go.
export function devBootstrap(diff, { b = B, seed = SEED } = {}) {
  const n = diff.length, rng = new PCG64(seed), means = new Float64Array(b);
  let done = 0;
  const point = diff.reduce((s, v) => s + v, 0) / n;
  return {
    n, b, point,
    get done() { return done; },
    means,
    step(k = 250) {
      const to = Math.min(b, done + k);
      for (; done < to; done++) { let s = 0; for (let i = 0; i < n; i++) s += diff[rng.bounded(n)]; means[done] = s / n; }
      return done;
    },
    result(d = 4) {
      const sorted = Float64Array.from(means.subarray(0, done)).sort();
      return { mean: round(point, d), lo: round(quantile(sorted, 0.025), d), hi: round(quantile(sorted, 0.975), d), resamples: done };
    },
  };
}

// Held-out: rows carry a value and a cluster rank (0 .. clusters - 1, the scorer's sorted order).
export function clusterBootstrap(values, rank, { b = B, seed = SEED } = {}) {
  const k = Math.max(...rank) + 1, sum = new Float64Array(k), cnt = new Float64Array(k);
  values.forEach((v, i) => { sum[rank[i]] += v; cnt[rank[i]] += 1; });
  const rng = new PCG64(seed), stats = new Float64Array(b);
  let done = 0;
  const point = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    n: values.length, clusters: k, b, point,
    get done() { return done; },
    means: stats,
    step(m = 250) {
      const to = Math.min(b, done + m);
      for (; done < to; done++) { let s = 0, c = 0; for (let i = 0; i < k; i++) { const g = rng.bounded(k); s += sum[g]; c += cnt[g]; } stats[done] = s / c; }
      return done;
    },
    result(d = 5) {
      const sorted = Float64Array.from(stats.subarray(0, done)).sort();
      return { mean: round(point, d), lo: round(quantile(sorted, 0.025), d), hi: round(quantile(sorted, 0.975), d), resamples: done };
    },
  };
}

// Per-row series for the dev comparisons. adjusted S = m(P) x (0.8 T + 0.2 C), m for the 4B.
export function devSeries(D, arm, measure) {
  const T = D.T_jp1[arm], C = D.C_strict[arm];
  if (measure === "T") return T;
  if (measure === "C") return C;
  if (measure === "adjS") return T.map((t, i) => D.multiplier_4b * (0.8 * t + 0.2 * C[i]));
  throw new Error(`unknown measure ${measure}`);
}
export const difference = (a, b) => a.map((v, i) => v - b[i]);

// The comparisons the lab offers, each with its preregistered bar: "lb>0", or non-inferiority with a margin.
export const DEV = [
  { key: "K1", measure: "T", a: "FT5_4B", b: "FT3A_4B", what: "a second pass over the same rows", bar: { kind: "lb", above: 0 } },
  { key: "M1", measure: "T", a: "FT6_4B", b: "FT5_4B", what: "the answer-vocabulary rows", bar: { kind: "lb", above: 0 } },
  { key: "N1", measure: "C", a: "FT7_4B", b: "FT6_4B", what: "the relabel to the paper's words", bar: { kind: "lb", above: 0 } },
  { key: "N3", measure: "T", a: "FT7_4B", b: "FT6_4B", what: "answers must not get worse by 0.01", bar: { kind: "lb", above: -0.01 } },
  { key: "N4", measure: "adjS", a: "FT7_4B", b: "FT3A_4B", what: "the candidacy bar", bar: { kind: "lb", above: 0 } },
];
export const meets = (bar, r) => r.lo > bar.above;
