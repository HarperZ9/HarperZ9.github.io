// Lesson F4, "Backpropagation: blame, passed backwards". A tiny multilayer
// perceptron on two seeded spirals, with a hand-written forward and backward
// pass that records every intermediate value and every local derivative, so
// a view can walk the chain node by node.
//
//   x (2) -> z1 = x W1 + b1 -> a1 = tanh z1 (H1)
//         -> z2 = a1 W2 + b2 -> a2 = tanh z2 (H2)
//         -> z3 = a2 W3 + b3 -> p = softmax z3 (2) -> L = -log p[y]
//
// The backward pass is reverse-mode differentiation: start from dL/dL = 1
// and multiply by one local derivative per node on the way back.
//   S. Linnainmaa, "The representation of the cumulative rounding error of an
//   algorithm as a Taylor expansion of the local rounding errors", MSc
//   thesis, University of Helsinki (1970): reverse accumulation.
//   D. E. Rumelhart, G. E. Hinton, R. J. Williams, "Learning representations
//   by back-propagating errors", Nature 323 (1986), 533-536.
//   A. Griewank, A. Walther, Evaluating Derivatives, 2nd ed., SIAM (2008):
//   the cost of a reverse-mode gradient is bounded by a small constant times
//   the cost of the function, whatever the number of inputs ("cheap
//   gradient principle"). countOps() measures that constant for this net.
//
// Layout: a weight is [K, M] row-major (inputs by outputs), as in
// tinyformer-dense.mjs. Everything is Float64. No dependencies.

import { rng, gauss } from "./tinyformer-ops.mjs";

export { attentionGradCheck } from "./backprop-attention.mjs";

// Two interleaved spirals, 1.5 turns each, with Gaussian jitter. Points are
// in roughly [-1, 1]^2. Labels alternate so any prefix is balanced.
export function twoSpirals(n, seed, { noise = 0.04, turns = 1.5 } = {}) {
  const r = rng(seed), X = [], Y = [];
  for (let i = 0; i < n; i++) {
    const cls = i % 2, t = 0.1 + 0.9 * r(), th = 2 * Math.PI * turns * t + cls * Math.PI;
    X.push([t * Math.cos(th) + noise * gauss(r), t * Math.sin(th) + noise * gauss(r)]);
    Y.push(cls);
  }
  return { X, Y };
}

export const SIZES = Object.freeze([2, 8, 8, 2]);
const NAMES = ["W1", "b1", "W2", "b2", "W3", "b3"];

// Weights drawn N(0, 1 / fan-in), biases zero.
export function createNet(seed = 3, sizes = SIZES) {
  const r = rng(seed), P = {};
  for (let l = 0; l < 3; l++) {
    const K = sizes[l], M = sizes[l + 1], W = new Float64Array(K * M);
    for (let i = 0; i < W.length; i++) W[i] = gauss(r) / Math.sqrt(K);
    P[`W${l + 1}`] = W; P[`b${l + 1}`] = new Float64Array(M);
  }
  return { sizes: sizes.slice(), P, names: NAMES };
}

// out = a W + b for one row, counting one multiply-add per weight used.
function dense(a, W, b, K, M, ops) {
  const out = new Float64Array(M);
  for (let m = 0; m < M; m++) {
    let s = b[m];
    for (let k = 0; k < K; k++) s += a[k] * W[k * M + m];
    out[m] = s;
  }
  if (ops) ops.mac += K * M;
  return out;
}

// Forward pass for one point. Records every value on the way.
export function forward(net, x, y, ops) {
  const [n0, n1, n2, n3] = net.sizes, P = net.P;
  const z1 = dense(x, P.W1, P.b1, n0, n1, ops), a1 = z1.map(Math.tanh);
  const z2 = dense(a1, P.W2, P.b2, n1, n2, ops), a2 = z2.map(Math.tanh);
  const z3 = dense(a2, P.W3, P.b3, n2, n3, ops);
  const mx = Math.max(...z3), e = z3.map((v) => Math.exp(v - mx));
  const s = e.reduce((u, v) => u + v, 0), p = e.map((v) => v / s);
  if (ops) { ops.mac += n3; ops.transcendental += n1 + n2 + n3 + 1; }
  return { x: Float64Array.from(x), y, z1, a1, z2, a2, z3, p, loss: -Math.log(p[y]) };
}

// Backward pass for one point, from a forward record. Adds into grads (one
// array per parameter, same shapes) and returns the record of every
// upstream gradient and local derivative:
//   dz3 = p - onehot(y)              (softmax and cross-entropy together)
//   da2 = dz3 W3^T,  dz2 = da2 * (1 - a2^2)   (tanh' = 1 - tanh^2)
//   da1 = dz2 W2^T,  dz1 = da1 * (1 - a1^2)
//   dW = (input)^T dz, db = dz
// opts.broken is the control: it uses 1 - a instead of 1 - a^2 for the
// second hidden layer's local derivative, a single wrong link in the chain.
export function backward(net, rec, grads, ops, { broken = false } = {}) {
  const [n0, n1, n2, n3] = net.sizes, P = net.P;
  const dz3 = rec.p.map((v, j) => v - (j === rec.y ? 1 : 0));
  outer(grads.W3, grads.b3, rec.a2, dz3, n2, n3, ops);
  const da2 = backDense(dz3, P.W3, n2, n3, ops);
  const local2 = rec.a2.map((a) => (broken ? 1 - a : 1 - a * a));
  const dz2 = da2.map((g, i) => g * local2[i]);
  outer(grads.W2, grads.b2, rec.a1, dz2, n1, n2, ops);
  const da1 = backDense(dz2, P.W2, n1, n2, ops);
  const local1 = rec.a1.map((a) => 1 - a * a);
  const dz1 = da1.map((g, i) => g * local1[i]);
  outer(grads.W1, grads.b1, rec.x, dz1, n0, n1, ops);
  // No gradient for x itself: nothing upstream of the input learns.
  if (ops) ops.mac += 2 * (n1 + n2); // local derivatives (a * a) and products g * local
  return { dz3, da2, local2, dz2, da1, local1, dz1 };
}

// dW[k, m] += a[k] * dz[m], db[m] += dz[m].
function outer(dW, db, a, dz, K, M, ops) {
  for (let k = 0; k < K; k++) for (let m = 0; m < M; m++) dW[k * M + m] += a[k] * dz[m];
  for (let m = 0; m < M; m++) db[m] += dz[m];
  if (ops) ops.mac += K * M;
}

// da[k] = sum_m dz[m] W[k, m].
function backDense(dz, W, K, M, ops) {
  const da = new Float64Array(K);
  for (let k = 0; k < K; k++) { let s = 0; for (let m = 0; m < M; m++) s += dz[m] * W[k * M + m]; da[k] = s; }
  if (ops) ops.mac += K * M;
  return da;
}

export function zeroGrads(net) {
  return Object.fromEntries(net.names.map((n) => [n, new Float64Array(net.P[n].length)]));
}

// Mean loss and mean gradient over a set of points.
export function lossAndGrad(net, X, Y, opts) {
  const grads = zeroGrads(net);
  let loss = 0;
  for (let i = 0; i < X.length; i++) { const rec = forward(net, X[i], Y[i]); loss += rec.loss; backward(net, rec, grads, null, opts); }
  for (const n of net.names) for (let i = 0; i < grads[n].length; i++) grads[n][i] /= X.length;
  return { loss: loss / X.length, grads };
}

export function lossOnly(net, X, Y) {
  let loss = 0;
  for (let i = 0; i < X.length; i++) loss += forward(net, X[i], Y[i]).loss;
  return loss / X.length;
}

export function accuracy(net, X, Y) {
  let right = 0;
  for (let i = 0; i < X.length; i++) { const p = forward(net, X[i], Y[i]).p; right += (p[1] > p[0] ? 1 : 0) === Y[i] ? 1 : 0; }
  return right / X.length;
}

// Central-difference check of every parameter. Per tensor: the L2 relative
// error |num - ana| / (|num| + |ana|) over the whole tensor, and the worst.
export function gradCheck(net, X, Y, { eps = 1e-6, broken = false } = {}) {
  const { grads } = lossAndGrad(net, X, Y, { broken });
  const perTensor = {};
  let worstEntry = 0;
  for (const n of net.names) {
    const p = net.P[n];
    let diff = 0, sum = 0;
    for (let i = 0; i < p.length; i++) {
      const keep = p[i];
      p[i] = keep + eps; const lp = lossOnly(net, X, Y);
      p[i] = keep - eps; const lm = lossOnly(net, X, Y);
      p[i] = keep;
      const num = (lp - lm) / (2 * eps), ana = grads[n][i];
      diff += (num - ana) ** 2; sum += num * num + ana * ana;
      worstEntry = Math.max(worstEntry, Math.abs(num - ana) / Math.max(Math.abs(num) + Math.abs(ana), 1e-9));
    }
    perTensor[n] = Math.sqrt(diff) / Math.max(Math.sqrt(sum), 1e-30);
  }
  const worst = Object.entries(perTensor).sort((a, b) => b[1] - a[1])[0];
  return { perTensor, worstTensor: worst[0], worst: worst[1], worstEntry, nParams: net.names.reduce((s, n) => s + net.P[n].length, 0) };
}

// Plain minibatch gradient descent with a fixed step (no momentum, no Adam:
// those are lesson F5). Records the training curve every `every` steps.
export function train(net, data, held, { steps = 6000, lr = 0.3, batch = 32, seed = 5, every = 100 } = {}) {
  const r = rng(seed), n = data.X.length, curve = [];
  const point = (step) => curve.push({ step, loss: lossOnly(net, data.X, data.Y), heldLoss: lossOnly(net, held.X, held.Y),
    accuracy: accuracy(net, data.X, data.Y), heldAccuracy: accuracy(net, held.X, held.Y) });
  point(0);
  for (let s = 1; s <= steps; s++) {
    const bx = [], by = [];
    for (let i = 0; i < batch; i++) { const j = Math.floor(r() * n); bx.push(data.X[j]); by.push(data.Y[j]); }
    const { grads } = lossAndGrad(net, bx, by);
    for (const name of net.names) { const p = net.P[name], g = grads[name]; for (let i = 0; i < p.length; i++) p[i] -= lr * g[i]; }
    if (s % every === 0) point(s);
  }
  return curve;
}

// The chain for one point, node by node, for a view to draw: each node's
// value, the gradient of the loss arriving at it, and its local derivative.
export function trace(net, x, y) {
  const rec = forward(net, x, y), back = backward(net, rec, zeroGrads(net));
  const arr = (a) => Array.from(a);
  return {
    input: { value: arr(rec.x) },
    hidden1: { pre: arr(rec.z1), value: arr(rec.a1), local: arr(back.local1), gradOut: arr(back.da1), gradPre: arr(back.dz1) },
    hidden2: { pre: arr(rec.z2), value: arr(rec.a2), local: arr(back.local2), gradOut: arr(back.da2), gradPre: arr(back.dz2) },
    output: { logits: arr(rec.z3), probs: arr(rec.p), gradLogits: arr(back.dz3) },
    label: y, loss: rec.loss,
  };
}

// Multiply-adds for one forward and one backward pass of one point, counted
// by the loops themselves as they run. Transcendental calls (tanh, exp,
// log) are counted separately and not folded into the ratio.
export function countOps(net, x = [0.3, -0.2], y = 1) {
  const f = { mac: 0, transcendental: 0 }, b = { mac: 0, transcendental: 0 };
  const rec = forward(net, x, y, f);
  backward(net, rec, zeroGrads(net), b);
  return { forward: f.mac, backward: b.mac, ratio: b.mac / f.mac, forwardTranscendental: f.transcendental, backwardTranscendental: b.transcendental };
}
