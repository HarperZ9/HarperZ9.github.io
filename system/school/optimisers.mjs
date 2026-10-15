// Lesson F5, "Optimisers: momentum, Adam and the learning rate". The ball
// gets mass (momentum), then shoes that adapt to each slope (Adam).
//
// Every optimiser is a pure step function over a parameter vector and its
// gradient: step(theta, g, state, hp) -> { theta, state }. Nothing passed in
// is mutated; the caller keeps the returned state for the next step.
//
//   SGD, steepest descent with a fixed step (Cauchy 1847, as in gradients.mjs):
//     theta_{k+1} = theta_k - lr * g_k
//   Heavy-ball momentum, B. T. Polyak, "Some methods of speeding up the
//   convergence of iteration methods", USSR Computational Mathematics and
//   Mathematical Physics 4(5) (1964), 1-17. The two-step form of the paper:
//     x_{k+1} = x_k - alpha * f'(x_k) + beta * (x_k - x_{k-1})
//   On a quadratic with curvatures k_i it converges exactly when
//   0 < alpha * k_i < 2 (1 + beta) for every i (0 <= beta < 1), so the safe
//   step is (1 + beta) times wider than plain descent's 2 / k_max.
//   momentumStudy() measures that edge on real runs instead of assuming it.
//   Adam, D. P. Kingma and J. Ba, "Adam: A Method for Stochastic
//   Optimization", ICLR 2015, Algorithm 1:
//     m_t = beta1 m_{t-1} + (1 - beta1) g_t
//     v_t = beta2 v_{t-1} + (1 - beta2) g_t^2
//     mhat_t = m_t / (1 - beta1^t),  vhat_t = v_t / (1 - beta2^t)
//     theta_t = theta_{t-1} - alpha mhat_t / (sqrt(vhat_t) + eps)
//   Section 3 of the paper explains the two divisions (bias correction): m
//   and v start at zero, so without them the first steps are scaled by
//   (1 - beta1) / sqrt(1 - beta2), about 3.16 at the defaults.
//   AdamW, I. Loshchilov and F. Hutter, "Decoupled Weight Decay
//   Regularization", ICLR 2019, Algorithm 2. The decoupled update is
//     theta_t = theta_{t-1} - eta_t (alpha mhat_t / (sqrt(vhat_t) + eps) + lambda theta_{t-1})
//   where eta_t is the schedule multiplier. The coupled variant ("Adam with
//   L2", the pink line of the algorithm) instead adds lambda theta_{t-1} to
//   g_t before the moments; adamL2 below is that variant, kept as a control.
//   The attention lab's trainer (tinyformer-train.mjs) writes the decay as
//   lr * (adam + wd * p), which is this form with eta * alpha = lr and
//   lambda = alpha * wd. The tests check the two agree.
//
// The race (on gradients.mjs surfaces), the momentum edge study and the
// learning-rate schedules are below. Training the spiral net and the
// transformer with these steps lives in optimisers-train.mjs. Plain ES
// module, no dependencies, Node and browser.

import { makeBowl, ROSENBROCK, TWO_VALLEYS } from "./gradients.mjs";

export { flatten, unflattenInto, trainNet, trainTransformer, clipScale } from "./optimisers-train.mjs";

const F = Float64Array;

export function sgd(theta, g, state, { lr }) {
  const out = new F(theta.length);
  for (let i = 0; i < theta.length; i++) out[i] = theta[i] - lr * g[i];
  return { theta: out, state: { t: (state?.t ?? 0) + 1 } };
}

// state.prev is x_{k-1}; on the first step there is none and the momentum
// term is zero, so step one is plain descent.
export function heavyBall(theta, g, state, { lr, beta = 0.9 }) {
  const prev = state?.prev ?? theta, out = new F(theta.length);
  for (let i = 0; i < theta.length; i++) out[i] = theta[i] - lr * g[i] + beta * (theta[i] - prev[i]);
  return { theta: out, state: { t: (state?.t ?? 0) + 1, prev: F.from(theta) } };
}

// Shared moment update for Adam and AdamW. Returns the new m, v, t and the
// direction mhat / (sqrt(vhat) + eps) per coordinate.
function moments(g, state, n, { beta1, beta2, eps, biasCorrection }) {
  const t = (state?.t ?? 0) + 1, m0 = state?.m ?? new F(n), v0 = state?.v ?? new F(n);
  const m = new F(n), v = new F(n), dir = new F(n);
  const bc1 = biasCorrection ? 1 - Math.pow(beta1, t) : 1, bc2 = biasCorrection ? 1 - Math.pow(beta2, t) : 1;
  for (let i = 0; i < n; i++) {
    m[i] = beta1 * m0[i] + (1 - beta1) * g[i];
    v[i] = beta2 * v0[i] + (1 - beta2) * g[i] * g[i];
    dir[i] = (m[i] / bc1) / (Math.sqrt(v[i] / bc2) + eps);
  }
  return { m, v, t, dir };
}

export const ADAM_DEFAULTS = Object.freeze({ lr: 1e-3, beta1: 0.9, beta2: 0.999, eps: 1e-8 });

// biasCorrection: false is the control the paper warns about (section 3).
export function adam(theta, g, state, hp) {
  const o = { ...ADAM_DEFAULTS, biasCorrection: true, ...hp };
  const { m, v, t, dir } = moments(g, state, theta.length, o), out = new F(theta.length);
  for (let i = 0; i < theta.length; i++) out[i] = theta[i] - o.lr * dir[i];
  return { theta: out, state: { t, m, v } };
}

// Decoupled weight decay. lr is alpha, weightDecay is lambda, eta the
// schedule multiplier. decayMask (optional, same length, 1 or 0) says which
// coordinates decay; the transformer never decays gains and biases.
export function adamw(theta, g, state, hp) {
  const o = { ...ADAM_DEFAULTS, biasCorrection: true, weightDecay: 0, eta: 1, decayMask: null, ...hp };
  const { m, v, t, dir } = moments(g, state, theta.length, o), out = new F(theta.length);
  for (let i = 0; i < theta.length; i++) {
    const lam = o.decayMask && !o.decayMask[i] ? 0 : o.weightDecay;
    out[i] = theta[i] - o.eta * (o.lr * dir[i] + lam * theta[i]);
  }
  return { theta: out, state: { t, m, v } };
}

// The coupled control: L2 folded into the gradient, then plain Adam.
export function adamL2(theta, g, state, hp) {
  const lam = hp.weightDecay ?? 0, g2 = new F(theta.length);
  for (let i = 0; i < theta.length; i++) g2[i] = g[i] + lam * theta[i];
  return adam(theta, g2, state, hp);
}

export const OPTIMISERS = Object.freeze({ sgd, momentum: heavyBall, adam, adamw, adamL2 });

// --- learning-rate schedules ------------------------------------------------
// Multipliers in [0, 1] for update number t = 1, 2, ..., total.
// Linear warmup: P. Goyal et al., "Accurate, Large Minibatch SGD: Training
// ImageNet in 1 Hour" (2017), section 2.2 (gradual warmup). Cosine decay: I.
// Loshchilov and F. Hutter, "SGDR: Stochastic Gradient Descent with Warm
// Restarts", ICLR 2017, eq. 5, with a single cycle and no restart:
//   eta_t = eta_min + 1/2 (eta_max - eta_min)(1 + cos(pi T_cur / T_i)).
// tinyformer-train.mjs uses the warmup alone: min(1, t / warmup), then flat.
export function warmupCosine(t, { warmup, total, floor = 0 }) {
  if (t <= warmup) return t / Math.max(1, warmup);
  const p = Math.min(1, (t - warmup) / Math.max(1, total - warmup));
  return floor + 0.5 * (1 - floor) * (1 + Math.cos(Math.PI * p));
}

export function warmupLinear(t, { warmup, total, floor = 0 }) {
  if (t <= warmup) return t / Math.max(1, warmup);
  const p = Math.min(1, (t - warmup) / Math.max(1, total - warmup));
  return 1 - (1 - floor) * p;
}

export function warmupConstant(t, { warmup }) { return Math.min(1, t / Math.max(1, warmup)); }

export function scheduleCurve(fn, opts, points = opts.total) {
  const out = [];
  for (let i = 0; i <= points; i++) { const t = Math.max(1, Math.round(i * opts.total / points)); out.push([t, fn(t, opts)]); }
  return out;
}

// --- the race on two-parameter surfaces --------------------------------------
// One optimiser from one start: path rows [x, y, f]. firstBelow is the
// first update count with f < threshold; stepsToThreshold is the update
// after which f stays under the threshold to the end of the run (a run that
// dips under and climbs back out does not count). null if never. Stops on a
// non-finite or huge value and marks the run diverged.
export function run2d(surface, start, name, hp, { steps = 2000, threshold = 1e-6, keepPath = true } = {}) {
  const step = OPTIMISERS[name];
  let theta = F.from(start), state = null, first = null, diverged = false, best = surface.f(start[0], start[1]);
  const path = keepPath ? [[theta[0], theta[1], best]] : null;
  let settled = best < threshold ? 0 : null;
  if (settled === 0) first = 0;
  let k = 0;
  for (k = 1; k <= steps; k++) {
    ({ theta, state } = step(theta, surface.grad(theta[0], theta[1]), state, hp));
    const fv = surface.f(theta[0], theta[1]);
    if (keepPath) path.push([theta[0], theta[1], fv]);
    if (!Number.isFinite(fv) || fv > 1e12) { diverged = true; settled = null; break; }
    best = Math.min(best, fv);
    if (fv < threshold) { if (first === null) first = k; if (settled === null) settled = k; } else settled = null;
  }
  const last = [theta[0], theta[1], surface.f(theta[0], theta[1])];
  return { name, hp, stepsToThreshold: settled, firstBelow: first, diverged, end: [last[0], last[1]], f: last[2], bestF: best, steps: Math.min(k, steps), path };
}

// Each optimiser at its own best step from a fixed grid: fewest updates to
// the threshold wins; if none reaches it, lowest final loss wins.
export function bestOf(surface, start, name, grid, base, opts) {
  const tried = grid.map((lr) => run2d(surface, start, name, { ...base, lr }, { ...opts, keepPath: false }));
  const rank = (r) => (r.stepsToThreshold !== null ? r.stepsToThreshold : opts.steps + 1 + (Number.isFinite(r.f) ? Math.atan(r.f) : 2));
  const win = tried.reduce((a, b) => (rank(b) < rank(a) ? b : a));
  const full = run2d(surface, start, name, win.hp, opts);
  return { name, grid, chosenLr: win.hp.lr, tried: tried.map((r) => ({ lr: r.hp.lr, stepsToThreshold: r.stepsToThreshold, firstBelow: r.firstBelow, finalLoss: r.f, diverged: r.diverged })), run: full };
}

// The default race settings, stated once so the fill script and the tests
// use the same ones. beta = 0.9 for momentum; Adam at its paper defaults
// except the step.
export const RACES = Object.freeze({
  bowl: { surface: makeBowl(), start: [-2, 2], steps: 2000, threshold: 1e-6,
    grids: { sgd: [0.05, 0.1, 0.2, 0.3, 0.4, 0.45], momentum: [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5], adam: [0.01, 0.03, 0.1, 0.3, 1] } },
  rosenbrock: { surface: ROSENBROCK, start: [-1.2, 1], steps: 20000, threshold: 1e-4,
    grids: { sgd: [2.5e-4, 5e-4, 1e-3, 1.5e-3, 2e-3], momentum: [2e-4, 5e-4, 1e-3, 2e-3, 3e-3, 3.5e-3, 4e-3], adam: [3e-4, 1e-3, 3e-3, 1e-2, 3e-2, 0.1, 0.3] } },
});
export const RACE_BASE = Object.freeze({ sgd: {}, momentum: { beta: 0.9 }, adam: { ...ADAM_DEFAULTS } });

export function race(id) {
  const R = RACES[id], opts = { steps: R.steps, threshold: R.threshold };
  return Object.fromEntries(Object.keys(R.grids).map((n) => [n, bestOf(R.surface, R.start, n, R.grids[n], RACE_BASE[n], opts)]));
}

// Two valleys: from each start, which valley each optimiser ends in, at one
// shared step per optimiser (stated by the caller).
export function valleyRuns(starts, settings, steps = 3000) {
  return starts.map((s) => ({ start: s, runs: Object.fromEntries(Object.entries(settings).map(([n, hp]) => {
    const r = run2d(TWO_VALLEYS, s, n, hp, { steps, threshold: -Infinity });
    return [n, { end: r.end, f: r.f, valley: r.end[0] < 0 ? "left" : "right", path: r.path }];
  })) }));
}

// Distance-to-minimum growth per step (geometric mean over the second half
// of a long run): under 1 closes in, over 1 flies off.
function growth(surface, start, name, hp, steps) {
  const [cx, cy] = surface.min, step = OPTIMISERS[name];
  let theta = F.from(start), state = null;
  const e0 = Math.hypot(start[0] - cx, start[1] - cy), logs = [Math.log(e0)];
  for (let k = 1; k <= steps; k++) {
    ({ theta, state } = step(theta, surface.grad(theta[0], theta[1]), state, hp));
    const e = Math.hypot(theta[0] - cx, theta[1] - cy);
    if (!Number.isFinite(e)) return Infinity;
    logs.push(Math.log(e));
    if (e < 1e-10 * e0 || e > 1e10 * e0) break;
  }
  const last = logs.length - 1, mid = Math.floor(last / 2);
  return Math.exp((logs[last] - logs[mid]) / Math.max(1, last - mid));
}

// Bisection for the largest stable step of an optimiser on the bowl.
export function measuredEdge(surface, start, name, base, hi, steps = 20000) {
  let lo = 0;
  for (let it = 0; it < 40; it++) { const mid = 0.5 * (lo + hi); if (growth(surface, start, name, { ...base, lr: mid }, steps) < 1) lo = mid; else hi = mid; }
  return 0.5 * (lo + hi);
}

// The bowl above plain descent's edge. Plain descent's bound is 2 / k_max;
// heavy ball's predicted bound is 2 (1 + beta) / k_max. Both are measured by
// bisection, and each optimiser runs at `multiple` times plain descent's bound.
export function momentumStudy({ bowl = makeBowl(), start = [-2, 2], beta = 0.9, multiple = 1.2, steps = 400 } = {}) {
  const kMax = bowl.params.k1, plain = 2 / kMax, heavy = 2 * (1 + beta) / kMax;
  const lr = multiple * plain, f0 = bowl.f(start[0], start[1]);
  const runs = { sgd: run2d(bowl, start, "sgd", { lr }, { steps, threshold: 1e-6 }),
    momentum: run2d(bowl, start, "momentum", { lr, beta }, { steps, threshold: 1e-6 }),
    adam: run2d(bowl, start, "adam", { ...ADAM_DEFAULTS, lr }, { steps, threshold: 1e-6 }) };
  const outcome = (r) => (r.diverged || r.f > f0 ? "diverges" : r.f < 1e-6 * f0 ? "converges" : r.f < f0 ? "stays bounded, does not settle" : "diverges");
  return { kMax, beta, multiple, lr, startLoss: f0,
    plainBound: { predicted: plain, measured: measuredEdge(bowl, start, "sgd", {}, 2 * plain) },
    momentumBound: { predicted: heavy, measured: measuredEdge(bowl, start, "momentum", { beta }, 2 * heavy) },
    runs: Object.fromEntries(Object.entries(runs).map(([n, r]) => [n, { outcome: outcome(r), finalLoss: r.f, bestLoss: r.bestF, stepsToThreshold: r.stepsToThreshold, diverged: r.diverged, path: r.path }])) };
}
