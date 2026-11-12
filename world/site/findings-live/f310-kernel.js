// f310-kernel.js: the F310 study units (Titius-Bode forms against gap-order and pooled-gap controls), written to
// give the same doubles as the study's numpy code: same draw order, same summation order, same solver steps.
// It mirrors src/f310.bld and src/f310_controls.bld function for function. The Blagg form is not computed here; its control still takes
// its draws from the generator, so every later control sees the stream the study saw.
import { logdd } from "./fpx.js";
import { lstsq2, polyfit1 } from "./lstsq2.js";
import { genNew, normal, permutation, choice } from "./npgen.js";

const EPS = 2.220446049250313e-16;
const SOLAR = [87.97, 224.7, 365.26, 686.98, 4332.6, 10759, 30687, 60190];
const c1 = new Float64Array(8), c2 = new Float64Array(8), yb = new Float64Array(8), idx = new Float64Array(8);
const num = (a, b) => a - b;

// numpy's mean of a short array: in order below eight values, eight running sums from eight up.
function npMean(a, n) {
  let s = 0;
  if (n < 8) { for (let i = 0; i < n; i++) s += a[i]; return s / n; }
  s = ((a[0] + a[1]) + (a[2] + a[3])) + ((a[4] + a[5]) + (a[6] + a[7]));
  for (let i = 8; i < n; i++) s += a[i];
  return s / n;
}

function median(v) {
  const s = Float64Array.from(v).sort(), n = s.length, h = n >> 1;
  return n % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

function meanGap(x) {
  let s = 0;
  for (let i = 0; i + 1 < x.length; i++) s += x[i + 1] - x[i];
  return s / (x.length - 1);
}

// _r_idx: root mean square residual of the straight-line fit of x against the positions in idx.
function rIdx(x, n) {
  for (let i = 0; i < n; i++) { c1[i] = 1; c2[i] = idx[i]; yb[i] = x[i]; }
  const w = lstsq2(c1, c2, yb, n, n * EPS);
  for (let i = 0; i < n; i++) { const r = x[i] - (w[0] + idx[i] * w[1]); yb[i] = r * r; }
  return Math.sqrt(npMean(yb, n));
}

export function rPlain(x) {
  const n = x.length;
  for (let i = 0; i < n; i++) idx[i] = i;
  return rIdx(x, n) / meanGap(x);
}

// positions 0..n-1 with one extra step after place a and one after place b (b below zero: none)
function gapIdx(n, a, b) {
  idx[0] = 0;
  for (let k = 0; k + 1 < n; k++) idx[k + 1] = idx[k] + 1 + (k === a ? 1 : 0) + (k === b ? 1 : 0);
}

export function rGapped(x) {
  const n = x.length;
  let best = Infinity, r;
  for (let a = 0; a < n - 1; a++) for (let b = a; b < n - 1; b++) { gapIdx(n, a, b); r = rIdx(x, n); if (r < best) best = r; }
  for (let a = 0; a < n - 1; a++) { gapIdx(n, a, -1); r = rIdx(x, n); if (r < best) best = r; }
  gapIdx(n, -1, -1); r = rIdx(x, n);
  return (r < best ? r : best) / meanGap(x);
}

const reg = (systems, fn) => -median(systems.map(fn));

// leave one interior planet out: the straight-line fit's miss and the two-neighbour midpoint's miss
function loo(systems) {
  const e1 = [], e2 = [], xs = new Float64Array(8), ys = new Float64Array(8);
  for (const x of systems) for (let i = 1; i < x.length - 1; i++) {
    let m = 0;
    for (let k = 0; k < x.length; k++) if (k !== i) { xs[m] = k; ys[m] = x[k]; m++; }
    const c = polyfit1(xs, ys, m, c1, c2, yb);
    e1.push(Math.abs((c[0] * i + c[1]) - x[i]));
    e2.push(Math.abs((x[i - 1] + x[i + 1]) / 2 - x[i]));
  }
  return [median(e1), median(e2)];
}

// evenly spaced log periods with small normal noise: a system that does follow the rule
function planted(g, x) {
  const n = x.length, d = meanGap(x), p = new Float64Array(n);
  p[0] = x[0];
  for (let i = 1; i < n; i++) p[i] = p[i - 1] + d;
  for (let i = 0; i < n; i++) p[i] += normal(g, 0, 0.05);
  return p.sort();
}

const gaps = (x) => { const d = new Array(x.length - 1); for (let i = 0; i + 1 < x.length; i++) d[i] = x[i + 1] - x[i]; return d; };
function rebuild(x0, d) {
  const out = new Float64Array(d.length + 1);
  let c = 0;
  out[0] = x0;
  for (let i = 0; i < d.length; i++) { c = i === 0 ? d[0] : c + d[i]; out[i + 1] = x0 + c; }
  return out;
}

// Python's math.fsum: the exactly rounded sum (Shewchuk partials).
export function fsum(v) {
  const p = [];
  for (let x of v) {
    let k = 0;
    for (let j = 0; j < p.length; j++) {
      let y = p[j];
      if (Math.abs(x) < Math.abs(y)) { const t = x; x = y; y = t; }
      const hi = x + y, lo = y - (hi - x);
      if (lo !== 0) p[k++] = lo;
      x = hi;
    }
    p.length = k; p.push(x);
  }
  let n = p.length, hi = 0, lo = 0;
  if (n > 0) {
    hi = p[--n];
    while (n > 0) { const x = hi, y = p[--n]; hi = x + y; lo = y - (hi - x); if (lo !== 0) break; }
    if (n > 0 && ((lo < 0 && p[n - 1] < 0) || (lo > 0 && p[n - 1] > 0))) { const y = lo * 2, x = hi + y; if (y === x - hi) hi = x; }
  }
  return hi;
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarise(real, nulls) {
  const n = nulls.length, s = Float64Array.from(nulls).sort();
  let ge = 0;
  for (const v of nulls) if (v >= real) ge++;
  return { n, mean: fsum(nulls) / n, q95: quantile(s, 0.95), q05: quantile(s, 0.05), p_ge: (ge + 1) / (n + 1) };
}

// rows: [[period, ...], ...] in days, one list per star. Returns the sorted log periods per system.
export function prepare(rows) {
  return rows.map((r) => Float64Array.from(r).sort().map(logdd));
}

export function analysis(S, g) {
  const [e1, e2] = loo(S), pl = S.map((x) => planted(g, x)), sol = Float64Array.from(SOLAR).map(logdd);
  return {
    n: S.length, reg_plain: reg(S, rPlain), reg_gapped: reg(S, rGapped), loo_err: e1, loo_neigh: e2, loo_ratio: e1 / e2,
    plant_reg: reg(pl, rPlain), solar_r_plain: rPlain(sol), solar_r_gapped: rGapped(sol),
    n_planets: S.reduce((a, x) => a + x.length, 0),
  };
}

// The four controls in the order the study ran them. fn null: draw and discard (the Blagg control).
export const CONTROLS = [
  { key: "C_order", n: 2000, pool: false, fn: rPlain, compare: "reg_plain" },
  { key: "C_pool", n: 2000, pool: true, fn: rPlain, compare: "reg_plain" },
  { key: "C_order_blagg", n: 200, pool: false, fn: null, compare: "reg_blagg" },
  { key: "C_order_gapped", n: 200, pool: false, fn: rGapped, compare: "reg_gapped" },
];

// one control draw: every system rebuilt from shuffled gaps (or gaps drawn from the pool), then scored
export function controlDraw(S, g, c, pool) {
  const sys = S.map((x) => rebuild(x[0], c.pool ? choice(g, pool, x.length - 1) : permutation(g, gaps(x))));
  return c.fn ? reg(sys, c.fn) : NaN;
}

// The whole run. tick(key, done, total) is called between draws; nulls come back for the tests.
export function run(rows, seed, tick) {
  const S = prepare(rows), g = genNew(seed), an = analysis(S, g), pool = S.flatMap(gaps);
  const controls = {}, nulls = {};
  for (const c of CONTROLS) {
    const v = new Array(c.n);
    for (let i = 0; i < c.n; i++) {
      v[i] = controlDraw(S, g, c, pool);
      if (tick && (i + 1) % 50 === 0) tick(c.key, i + 1, c.n);
    }
    if (c.fn) { nulls[c.key] = v; controls[c.key] = summarise(an[c.compare], v); }
  }
  return { seed, analysis: an, controls, nulls };
}
