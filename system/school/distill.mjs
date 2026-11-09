// Lesson S17, "Distillation: a big teacher, a small student". Pure ES module,
// no DOM and no dependencies, so the lab page, a worker and the Node fill
// script share it.
//
// The teacher is the attention lab's trained model (media/school/attention/
// model.json, 20,864 numbers). A student is the same architecture at a smaller
// size. Every arm trains the student on the same stream of rows for the same
// steps; only the target it is pulled towards changes:
//   hard     the word that came next in the text (ordinary training)
//   argmax   the teacher's single most likely word, used as a hard label
//   soft     the teacher's whole next-word distribution at temperature T
//   oracle   the corpus generator's exact next-word odds (corpus-grammar.mjs)
//            at temperature T: the best soft target there could be
//
// Soft-target loss (Hinton, Vinyals and Dean 2015, "Distilling the knowledge
// in a neural network"), per position, averaged over the N positions:
//   p = softmax(teacher logits / T)          (or the oracle odds P^(1/T), renormalised)
//   q = softmax(student logits / T)
//   L = alpha * T^2 * KL(p || q) + (1 - alpha) * CE(y, softmax(student logits))
//   KL(p || q) = sum_v p_v (log p_v - log q_v)
// Gradient with respect to the student logits z:
//   dL/dz = alpha * T * (q - p) + (1 - alpha) * (softmax(z) - onehot(y))
// (d/dz of KL at temperature T is (q - p) / T; the T^2 factor keeps the size
// of the soft gradient roughly level as T changes, as the paper says.)

import { softmaxXent } from "./tinyformer-ops.mjs";
import { VOCAB, encode } from "./corpus.mjs";
import { createModel, forward, lossAndGrad } from "./tinyformer-model.mjs";
import { createAdamState, adam, evaluate } from "./tinyformer-train.mjs";
import { trueTable, startParse, advance, nextWordProbs } from "./corpus-grammar.mjs";
import { DEFAULTS, lrAt } from "./trainloop.mjs";
import { paramCounts } from "./scaling.mjs";

// Candidate students. Same shape rule as the scaling lesson: feed-forward
// width twice the model width, two heads.
export const STUDENTS = Object.freeze({
  d16x1: Object.freeze({ dModel: 16, nLayers: 1, nHeads: 2, dFF: 32 }),
  d16x2: Object.freeze({ dModel: 16, nLayers: 2, nHeads: 2, dFF: 32 }),
});
export const studentSize = (cfg) => createModel(cfg, 1).nParams;
export { paramCounts };

// Row softmax of logits / T into out (Float64Array [N * V]).
export function softmaxT(out, logits, N, V, T) {
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let mx = -Infinity;
    for (let v = 0; v < V; v++) mx = Math.max(mx, logits[o + v] / T);
    let s = 0;
    for (let v = 0; v < V; v++) { const e = Math.exp(logits[o + v] / T - mx); out[o + v] = e; s += e; }
    for (let v = 0; v < V; v++) out[o + v] /= s;
  }
  return out;
}

// Exact odds P raised to 1/T and renormalised per row: the oracle's softened
// distribution. Words the generator never writes stay at exactly 0.
export function powerT(P, N, V, T) {
  const out = new Float64Array(N * V);
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let s = 0;
    for (let v = 0; v < V; v++) { const e = P[o + v] > 0 ? Math.pow(P[o + v], 1 / T) : 0; out[o + v] = e; s += e; }
    for (let v = 0; v < V; v++) out[o + v] /= s;
  }
  return out;
}

// The soft-target head for lossAndGrad's lossHead option. target is p [N, V]
// (already softened at T). broken drops the 1/T of the softmax temperature
// from the backward pass: a gradient-check control, never used in training.
export function kdHead(target, { T = 1, alpha = 1, broken = false } = {}) {
  const gT = broken ? T * T : T;
  let q = new Float64Array(0);
  return ({ logits, probs, dlogits, y, N, V }) => {
    if (q.length < N * V) q = new Float64Array(N * V);
    softmaxT(q, logits, N, V, T);
    let kl = 0;
    for (let i = 0; i < N * V; i++) if (target[i] > 0) kl += target[i] * (Math.log(target[i]) - Math.log(Math.max(q[i], 1e-300)));
    let loss = alpha * T * T * kl / N;
    for (let i = 0; i < N * V; i++) dlogits[i] = alpha * gT * (q[i] - target[i]) / N;
    if (alpha < 1) {
      const d1 = new Float64Array(N * V);
      loss += (1 - alpha) * softmaxXent(probs, d1, logits, y, N, V);
      for (let i = 0; i < N * V; i++) dlogits[i] += (1 - alpha) * d1[i];
    } else softmaxT(probs, logits, N, V, 1);
    return loss;
  };
}

// The teacher's softened distribution for a batch of inputs.
export function teacherTargets(teacher, x, B, ctx, T) {
  const V = teacher.config.vocab, { logits } = forward(teacher, x, B, ctx);
  return softmaxT(new Float64Array(B * ctx * V), logits, B * ctx, V, T);
}

// The teacher's most likely next word at every position (ties: lowest id).
export function teacherArgmax(teacher, x, B, ctx) {
  const V = teacher.config.vocab, { logits } = forward(teacher, x, B, ctx), out = new Int32Array(B * ctx);
  for (let n = 0; n < B * ctx; n++) {
    let best = 0;
    for (let v = 1; v < V; v++) if (logits[n * V + v] > logits[n * V + best]) best = v;
    out[n] = best;
  }
  return out;
}

// The generator's exact odds for a batch whose rows start at an episode
// boundary (every training and held-out row does), softened at T.
export function oracleTargets(x, ctx, V, T) {
  const P = trueTable({ x, ctx }, V);
  return T === 1 ? P : powerT(P, x.length, V, T);
}

// One training step's targets for an arm. arm: { kind, T, alpha }.
// teacher may be any model of the vocabulary (the untrained-teacher control).
export function armStep(student, teacher, arm, x, y, B, ctx) {
  const V = student.config.vocab;
  if (arm.kind === "hard") return lossAndGrad(student, x, y, B, ctx);
  if (arm.kind === "argmax") return lossAndGrad(student, x, teacherArgmax(teacher, x, B, ctx), B, ctx);
  const T = arm.T ?? 1, target = arm.kind === "oracle" ? oracleTargets(x, ctx, V, T) : teacherTargets(teacher, x, B, ctx, T);
  return lossAndGrad(student, x, y, B, ctx, { lossHead: kdHead(target, { T, alpha: arm.alpha ?? 1, broken: !!arm.broken }) });
}

// Step-at-a-time distillation trainer (a page runs a few steps per slice).
// Same optimiser and schedule as the attention lab (trainloop DEFAULTS).
export function createDistiller(student, teacher, arm, source, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, ctx = student.config.ctx, state = createAdamState(student);
  let step = 0;
  return {
    opts: o, arm,
    get stepCount() { return step; },
    step() {
      const t0 = now(), { x, y } = source.next();
      const { loss, grads } = armStep(student, teacher, arm, x, y, o.batch, ctx);
      const gradNorm = adam(student, grads, state, { lr: lrAt(step, o.lr, o.warmup), weightDecay: o.weightDecay, clip: o.clip });
      step += 1;
      return { step, loss, gradNorm, ms: now() - t0 };
    },
  };
}
const now = () => (globalThis.performance ? performance.now() : Date.now());

// What the films quote about a held-out set, computed once per set: the
// generator's floor on it and the teacher's top word at every position.
export function heldReference(teacher, held) {
  const V = teacher.config.vocab, P = trueTable(held, V);
  let floor = 0;
  for (let n = 0; n < held.y.length; n++) floor -= Math.log(P[n * V + held.y[n]]);
  return { held, floor: floor / held.y.length, teacherTop: teacherArgmax(teacher, held.x, held.batch, held.ctx), teacherScore: evaluate(teacher, held) };
}

// A model scored against the reference: held-out loss, loss over the floor,
// look-back accuracy, and the share of positions whose top word matches the
// teacher's top word.
export function scoreStudent(model, ref) {
  const e = evaluate(model, ref.held), { x, batch: B, ctx } = ref.held;
  const top = teacherArgmax(model, x, B, ctx);
  let agree = 0;
  for (let n = 0; n < top.length; n++) agree += top[n] === ref.teacherTop[n] ? 1 : 0;
  return { heldOut: e.loss, excess: e.loss - ref.floor, accuracy: e.accuracy, copyAccuracy: e.copyAccuracy, localAccuracy: e.localAccuracy, agreement: agree / top.length };
}

// Train a fresh student on one arm and score it at the marked steps.
export function distillRun({ config, seed, teacher, arm, source, ref, steps, at = [], ...opts }) {
  const student = createModel(config, seed), d = createDistiller(student, teacher, arm, source, opts);
  const marks = new Set(at);
  marks.add(steps);
  const curve = [{ step: 0, ...scoreStudent(student, ref) }];
  let ms = 0;
  for (let s = 1; s <= steps; s++) {
    ms += d.step().ms;
    if (marks.has(s)) curve.push({ step: s, ...scoreStudent(student, ref) });
  }
  return { student, curve, end: curve.at(-1), msPerStep: ms / steps };
}

// Rows where the generator's own odds are split between words: the "dark
// knowledge" a soft target carries and a hard label throws away. Returns the
// positions of `set` whose largest exact probability is below `maxTop`, with
// the context words, the generator's odds and the teacher's odds.
export function tornContexts(teacher, set, decodeFn, { maxTop = 0.75, limit = 8, minP = 0.05 } = {}) {
  const V = teacher.config.vocab, P = trueTable(set, V), N = set.y.length;
  const Q = teacherTargets(teacher, set.x, set.batch, set.ctx, 1), out = [];
  for (let n = 0; n < N && out.length < limit; n++) {
    let top = 0;
    for (let v = 0; v < V; v++) top = Math.max(top, P[n * V + v]);
    if (top >= maxTop) continue;
    const t = n % set.ctx, b = (n - t) / set.ctx, ctxWords = decodeFn(set.x.subarray(b * set.ctx, n + 1)).slice(-4);
    const words = [];
    for (let v = 0; v < V; v++) if (P[n * V + v] >= minP) words.push({ word: decodeFn([v])[0], generator: P[n * V + v], teacher: Q[n * V + v] });
    words.sort((a, c) => c.generator - a.generator);
    out.push({ context: ctxWords, words });
  }
  return out;
}

// Share of positions in a set where the generator's top word holds at most
// `maxTop` of its probability, and the mean entropy of its odds (nats).
export function tornShare(set, V, maxTop = 0.75) {
  const P = trueTable(set, V), N = set.y.length;
  let torn = 0, h = 0;
  for (let n = 0; n < N; n++) {
    let top = 0;
    for (let v = 0; v < V; v++) { const p = P[n * V + v]; top = Math.max(top, p); if (p > 0) h -= p * Math.log(p); }
    torn += top <= maxTop ? 1 : 0;
  }
  return { positions: N, torn: torn / N, entropy: h / N };
}

// The generator's odds and the teacher's odds for the word after `words`
// (a prompt that starts at an episode boundary), for the words either model
// gives at least minP. The film's "torn context" probes.
export function oddsAfter(teacher, words, { minP = 0.02 } = {}) {
  const ids = encode(words), V = teacher.config.vocab;
  let parse = startParse();
  for (const id of ids) parse = advance(parse, id);
  const P = nextWordProbs(parse, V), { logits } = forward(teacher, ids, 1, ids.length);
  const Q = softmaxT(new Float64Array(V), logits.subarray((ids.length - 1) * V, ids.length * V), 1, V, 1);
  const out = [];
  for (let v = 0; v < V; v++) if (P[v] >= minP || Q[v] >= minP) out.push({ word: VOCAB[v], generator: P[v], teacher: Q[v] });
  return out.sort((a, b) => b.generator - a.generator || b.teacher - a.teacher);
}

// Finite-difference check of the soft-target gradient: central differences
// for every entry of every tensor of a (float64) model against the analytic
// gradient, as the tensor-level relative error |num - ana| / (|num| + |ana|)
// over L2 norms. Returns { tensor: error }.
export function kdGradCheck(model, head, x, y, B, T, eps = 1e-5) {
  const N = B * T, V = model.config.vocab, { grads } = lossAndGrad(model, x, y, B, T, { lossHead: head });
  const ana = Object.fromEntries(model.names.map((n) => [n, Float64Array.from(grads[n])]));
  const lossAt = () => { const { logits } = forward(model, x, B, T); return head({ logits, probs: new Float64Array(N * V), dlogits: new Float64Array(N * V), y, N, V }); };
  const errors = {};
  for (const name of model.names) {
    const p = model.params[name];
    let diff = 0, sum = 0;
    for (let i = 0; i < p.length; i++) {
      const keep = p[i];
      p[i] = keep + eps; const lp = lossAt();
      p[i] = keep - eps; const lm = lossAt();
      p[i] = keep;
      const num = (lp - lm) / (2 * eps);
      diff += (num - ana[name][i]) ** 2; sum += num * num + ana[name][i] ** 2;
    }
    errors[name] = Math.sqrt(diff) / Math.max(Math.sqrt(sum), 1e-30);
  }
  return errors;
}
