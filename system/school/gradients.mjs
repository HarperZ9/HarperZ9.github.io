// Lesson F3, "Gradients: which way is downhill". The computation behind the
// film and the lab: two-parameter surfaces with exact gradients, gradient
// descent with a fixed step, a finite-difference gradient to check the exact
// one against, and the step-size story measured on a tilted bowl.
//
// Steepest descent, stepping against the gradient, is Cauchy's method:
//   A.-L. Cauchy, "Methode generale pour la resolution des systemes
//   d'equations simultanees", Comptes Rendus 25 (1847), 536-538.
// The step size and curvature condition used below (on a quadratic, a fixed
// step converges only when it is under 2 / largest curvature) is the one in
//   I. Goodfellow, Y. Bengio, A. Courville, Deep Learning (2016), ch. 4.3,
//   "Gradient-Based Optimization", with the Hessian discussion in 4.3.1.
// This file measures the bound instead of asserting it: stepStudy() finds
// the largest stable step by bisection on real runs and compares it with
// 2 / largest curvature, where the curvature comes from a finite-difference
// Hessian of the surface, not from the numbers the bowl was built with.
//
// The attention-model part of the lesson (a loss-landscape slice, gradient
// norms, a one-parameter descent) lives in gradients-landscape.mjs and is
// re-exported here. Plain ES module, no dependencies, Node and browser.

export { landscapeSlice, filterNormalizedDirection, gradNorm, readoutScale, scaleDescent, SLICE_NOTE } from "./gradients-landscape.mjs";

// A tilted bowl: f(v) = 1/2 (v - c)^T H (v - c), H = R diag(k1, k2) R^T.
// The two curvatures differ by a factor of 8 and the axes are turned by
// 30 degrees, so the steepest direction is not the direction to the bottom.
export function makeBowl({ k1 = 4, k2 = 0.5, angle = Math.PI / 6, cx = 1, cy = 0.5 } = {}) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const a = k1 * c * c + k2 * s * s, b = (k1 - k2) * c * s, d = k1 * s * s + k2 * c * c;
  return {
    id: "bowl", name: "tilted bowl", min: [cx, cy], range: [[-3, 3], [-3, 3]],
    params: { k1, k2, angle, H: [[a, b], [b, d]] },
    f(x, y) { const u = x - cx, v = y - cy; return 0.5 * (a * u * u + 2 * b * u * v + d * v * v); },
    grad(x, y) { const u = x - cx, v = y - cy; return [a * u + b * v, b * u + d * v]; },
  };
}

// Rosenbrock's banana valley, f = (1 - x)^2 + 100 (y - x^2)^2, minimum (1, 1).
// H. H. Rosenbrock, The Computer Journal 3 (1960), 175-184.
export const ROSENBROCK = {
  id: "rosenbrock", name: "Rosenbrock valley", min: [1, 1], range: [[-2, 2], [-1, 3]],
  f(x, y) { return (1 - x) ** 2 + 100 * (y - x * x) ** 2; },
  grad(x, y) { const r = y - x * x; return [-2 * (1 - x) - 400 * x * r, 200 * r]; },
};

// Two valleys: a double well in x, a sloped trough in y, and a small tilt
// that makes the left valley deeper. Where you start decides where you end.
export const TWO_VALLEYS = {
  id: "two-valleys", name: "two valleys", range: [[-2, 2], [-2, 2]],
  f(x, y) { const w = y - 0.4 * x; return (x * x - 1) ** 2 + 1.5 * w * w + 0.2 * x; },
  grad(x, y) { const w = y - 0.4 * x; return [4 * x * (x * x - 1) - 1.2 * w + 0.2, 3 * w]; },
};

export const SURFACES = [makeBowl(), ROSENBROCK, TWO_VALLEYS];

// Central differences: df/dx ~ (f(x + h) - f(x - h)) / 2h. The error is
// O(h^2) from the Taylor remainder plus O(eps / h) from rounding.
export function numericGrad(f, x, y, h = 1e-5) {
  return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
}

// Relative error |a - n| / max(|a| + |n|, floor), the usual gradient-check score.
export function relErr(a, n, floor = 1e-12) {
  const d = Math.hypot(a[0] - n[0], a[1] - n[1]);
  return d / Math.max(Math.hypot(a[0], a[1]) + Math.hypot(n[0], n[1]), floor);
}

// Check a gradient function against finite differences at given points.
// Returns the worst relative error. gradFn defaults to the surface's own.
export function checkGrad(surface, points, gradFn = surface.grad, h = 1e-5) {
  let worst = 0;
  for (const [x, y] of points) worst = Math.max(worst, relErr(gradFn(x, y), numericGrad(surface.f, x, y, h)));
  return worst;
}

// Finite-difference Hessian from the exact gradient, symmetrised, and its
// eigenvalues (the two principal curvatures) with the 2 x 2 closed form.
export function hessian(surface, x, y, h = 1e-4) {
  const gx1 = surface.grad(x + h, y), gx0 = surface.grad(x - h, y);
  const gy1 = surface.grad(x, y + h), gy0 = surface.grad(x, y - h);
  const hxx = (gx1[0] - gx0[0]) / (2 * h), hyy = (gy1[1] - gy0[1]) / (2 * h);
  const hxy = 0.5 * ((gx1[1] - gx0[1]) / (2 * h) + (gy1[0] - gy0[0]) / (2 * h));
  const mean = 0.5 * (hxx + hyy), r = Math.hypot(0.5 * (hxx - hyy), hxy);
  return { H: [[hxx, hxy], [hxy, hyy]], curvatures: [mean + r, mean - r] };
}

// Gradient descent with a fixed step: v <- v - step * grad f(v).
// path rows are [x, y, f, |grad|]. Stops early on a non-finite value or when
// |grad| falls under tol. gradFn lets a control swap in a wrong gradient.
export function descend(surface, start, { step, steps = 100, tol = 0, gradFn = surface.grad, every = 1 } = {}) {
  let [x, y] = start;
  const path = [];
  let k = 0, g = gradFn(x, y), gn = Math.hypot(g[0], g[1]);
  const push = () => path.push([x, y, surface.f(x, y), gn]);
  push();
  for (k = 1; k <= steps; k++) {
    x -= step * g[0]; y -= step * g[1];
    g = gradFn(x, y); gn = Math.hypot(g[0], g[1]);
    const fv = surface.f(x, y);
    if (!Number.isFinite(fv) || Math.abs(fv) > 1e12) { path.push([x, y, fv, gn]); break; }
    if (k % every === 0 || gn < tol || k === steps) push();
    if (gn < tol) break;
  }
  const last = path[path.length - 1];
  return { path, steps: Math.min(k, steps), end: [last[0], last[1]], f: last[2], gradNorm: last[3] };
}

// The surface sampled on an n x n grid over its range, rows are y, columns x.
export function sampleGrid(surface, n = 31, range = surface.range) {
  const [[x0, x1], [y0, y1]] = range, rows = [];
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < n; j++) {
    const y = y0 + (y1 - y0) * j / (n - 1), row = [];
    for (let i = 0; i < n; i++) {
      const v = surface.f(x0 + (x1 - x0) * i / (n - 1), y);
      row.push(v); lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    rows.push(row);
  }
  return { n, range, values: rows, min: lo, max: hi };
}

// Per-step growth of the distance to the minimum, as a geometric mean over
// the second half of a run: below 1 the run closes in, above 1 it flies off.
// The first half is skipped so the fast-dying directions have gone and the
// reading is the factor of the slowest-dying (or fastest-growing) one. A run
// stops once it is within 1e-10 of its starting distance, because below that
// the iterate sits on rounding error around the minimum and stops shrinking.
function growth(surface, start, step, steps) {
  const [cx, cy] = surface.min;
  let x = start[0], y = start[1];
  const logs = [Math.log(Math.hypot(x - cx, y - cy))];
  for (let k = 1; k <= steps; k++) {
    const g = surface.grad(x, y);
    x -= step * g[0]; y -= step * g[1];
    const e = Math.hypot(x - cx, y - cy);
    if (!Number.isFinite(e)) return Infinity;
    logs.push(Math.log(e));
    if (e < 1e-10 * Math.exp(logs[0]) || e > 1e10 * Math.exp(logs[0])) break;
  }
  const last = logs.length - 1, mid = Math.floor(last / 2);
  return Math.exp((logs[last] - logs[mid]) / Math.max(1, last - mid));
}

// Classify a run by what it did, not by the step it was given. Zigzag is
// read from the path: consecutive steps that point against each other.
function classify(run, f0) {
  const p = run.path;
  let flips = 0;
  for (let i = 2; i < p.length; i++) {
    const ax = p[i - 1][0] - p[i - 2][0], ay = p[i - 1][1] - p[i - 2][1];
    const bx = p[i][0] - p[i - 1][0], by = p[i][1] - p[i - 1][1];
    if (ax * bx + ay * by < 0) flips++;
  }
  const zigzag = flips > (p.length - 2) / 2;
  if (!Number.isFinite(run.f) || run.f > f0) return zigzag ? "diverges, zigzagging" : "diverges";
  if (run.f < 1e-6 * f0) return zigzag ? "converges, zigzagging" : "converges";
  return zigzag ? "converges slowly, zigzagging" : "converges slowly";
}

// The step-size story on the bowl. Curvatures from the finite-difference
// Hessian at the minimum; predicted bound 2 / largest curvature; measured
// bound by bisection on the per-step growth of real runs; four runs at
// 0.5x, 0.99x, 1.01x and 2x of the predicted bound.
export function stepStudy(bowl = makeBowl(), { start = [-2, 2], steps = 60, multiples = [0.5, 0.99, 1.01, 2] } = {}) {
  const { curvatures } = hessian(bowl, bowl.min[0], bowl.min[1]);
  const kMax = Math.max(...curvatures), kMin = Math.min(...curvatures);
  const predicted = 2 / kMax;
  let lo = 0, hi = 2 * predicted;
  for (let it = 0; it < 50; it++) {
    const mid = 0.5 * (lo + hi);
    if (growth(bowl, start, mid, 4000) < 1) lo = mid; else hi = mid;
  }
  const measured = 0.5 * (lo + hi);
  const f0 = bowl.f(start[0], start[1]);
  const runs = multiples.map((m) => {
    const run = descend(bowl, start, { step: m * predicted, steps });
    return { multiple: m, step: m * predicted, outcome: classify(run, f0), finalLoss: run.f, startLoss: f0,
      perStepFactor: growth(bowl, start, m * predicted, steps), path: run.path };
  });
  // On a quadratic each eigen-direction is scaled by (1 - step * k) per step,
  // so the slowest direction sets the pace even when the step is safe.
  return { curvatures: [kMax, kMin], conditionNumber: kMax / kMin, predictedBound: predicted, measuredBound: measured,
    relativeGap: Math.abs(measured - predicted) / predicted, runs };
}
