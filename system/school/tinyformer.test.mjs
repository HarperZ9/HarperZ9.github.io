// Tests for the tiny transformer behind the attention lab.
// Run: node --test system/school/tinyformer.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createModel, forward, lossAndGrad, lossOnly, createTrainer, evaluate, attentionOn, toJSON, fromJSON, rng, FLOPS } from "./tinyformer.mjs";
import { gauss } from "./tinyformer-ops.mjs";
import { VOCAB, PROBES, encode, decode, makeBatch, heldOut, unigramCrossEntropy } from "./corpus.mjs";

const TINY = { dModel: 8, nHeads: 2, nLayers: 2, dFF: 16, ctx: 6 };

// Re-draw every parameter at a larger scale. At the training init (std 0.02)
// attention is nearly uniform and query/key gradients are tiny, which would
// let a wrong softmax backward hide under the value-path gradient.
function scrambled(config, seed) {
  const m = createModel(config, seed);
  const r = rng(seed + 1000);
  for (const name of m.names) {
    const p = m.params[name], isGain = /_g$/.test(name);
    for (let i = 0; i < p.length; i++) p[i] = (isGain ? 1 : 0) + 0.4 * gauss(r);
  }
  return m;
}

// Central finite differences for every entry of every tensor, compared with
// the analytic gradient by tensor-level relative error
// |num - ana| / (|num| + |ana|), L2 norms over the whole tensor.
function gradCheck(model, eps, opts = {}) {
  const B = 2, T = model.config.ctx;
  const { x, y } = makeBatch(rng(5), B, T);
  const { grads } = lossAndGrad(model, x, y, B, T, opts);
  const ana = Object.fromEntries(model.names.map((n) => [n, Float64Array.from(grads[n])]));
  const errors = {};
  for (const name of model.names) {
    const p = model.params[name];
    let diff = 0, sum = 0;
    for (let i = 0; i < p.length; i++) {
      const keep = p[i];
      p[i] = keep + eps; const lp = lossOnly(model, x, y, B, T);
      p[i] = keep - eps; const lm = lossOnly(model, x, y, B, T);
      p[i] = keep;
      const num = (lp - lm) / (2 * eps);
      diff += (num - ana[name][i]) ** 2;
      sum += num * num + ana[name][i] ** 2;
    }
    errors[name] = Math.sqrt(diff) / Math.max(Math.sqrt(sum), 1e-30);
  }
  return errors;
}

const worst = (errors) => Object.entries(errors).sort((a, b) => b[1] - a[1])[0];

test("corpus: vocab, encode/decode, labelled look-back targets", () => {
  assert.ok(VOCAB.length <= 64, "vocab stays small");
  assert.equal(VOCAB[0], ".");
  assert.equal(new Set(VOCAB).size, VOCAB.length, "no duplicate words");
  const words = ["pylon", "checked", "the", "crate", "."];
  assert.deepEqual(decode(encode(words)), words);
  const b = makeBatch(rng(1), 64, 24);
  let copies = 0;
  for (let n = 0; n < b.y.length; n++) {
    if (!b.kind[n]) continue;
    copies++;
    const row = Math.floor(n / 24) * 24;
    assert.ok(b.src[n] >= 0 && b.src[n] <= n % 24, "source is at or before the query");
    assert.equal(b.x[row + b.src[n]], b.y[n], "copy target equals the word at its source");
  }
  assert.ok(copies > 64, "batches contain look-back targets");
  for (const p of PROBES) {
    encode(p.words);
    assert.ok(p.answerFrom <= p.query && p.query < p.words.length);
    if (p.kind === "copy") assert.equal(p.words[p.answerFrom], p.answer);
  }
});

test("gradient check, float64: every tensor matches finite differences", () => {
  const errors = gradCheck(scrambled({ ...TINY, float64: true }, 3), 1e-5);
  for (const [name, e] of Object.entries(errors)) assert.ok(e < 1e-6, `${name} relative error ${e}`);
});

test("gradient check, float32: every tensor within 1e-2", () => {
  // float32 roundoff in the loss is about 1e-7, so eps 1e-2 keeps the
  // difference quotient well above noise; tolerance is the brief's 1e-2.
  const errors = gradCheck(scrambled({ ...TINY, nLayers: 1 }, 4), 1e-2);
  for (const [name, e] of Object.entries(errors)) assert.ok(e < 1e-2, `${name} relative error ${e}`);
});

test("gradient check control: a backward without the softmax Jacobian term fails", () => {
  const errors = gradCheck(scrambled({ ...TINY, float64: true }, 3), 1e-5, { brokenSoftmax: true });
  // The wrong term enters at the attention scores, so the query/key weights
  // and everything upstream of them fail, while tensors downstream of the
  // last attention (readout, final norm) still pass: the check localises.
  const [name, e] = worst(errors);
  assert.ok(e > 1e-2, `broken backward must fail the check, worst was ${name} ${e}`);
  for (const l of [0, 1]) assert.ok(errors[`l${l}.wqkv`] > 1e-2, `l${l}.wqkv error ${errors[`l${l}.wqkv`]}`);
  for (const n of ["wout", "lnf_g", "lnf_b", "l1.w2"]) assert.ok(errors[n] < 1e-6, `${n} should be unaffected, got ${errors[n]}`);
});

test("causality: a later token never changes earlier logits", () => {
  const m = createModel({}, 9), T = 24, V = m.config.vocab;
  const x = makeBatch(rng(2), 1, T).x;
  const a = Float32Array.from(forward(m, x, 1, T).logits);
  const k = 15;
  x[k] = (x[k] + 7) % V;
  const b = forward(m, x, 1, T).logits;
  for (let i = 0; i < k * V; i++) assert.equal(b[i], a[i], "logit before position " + k + " changed");
  let changed = false;
  for (let i = k * V; i < (k + 1) * V; i++) if (b[i] !== a[i]) changed = true;
  assert.ok(changed, "the edited position itself does change (the test can see a change)");
});

test("attention rows sum to 1 and are zero above the diagonal", () => {
  const m = scrambled({}, 6), B = 3, T = 24, H = m.config.nHeads;
  const { attention } = forward(m, makeBatch(rng(3), B, T).x, B, T, { keep: true });
  for (const att of attention) {
    for (let r = 0; r < B * H * T; r++) {
      const i = r % T;
      let s = 0;
      for (let j = 0; j < T; j++) {
        const a = att[r * T + j];
        if (j > i) assert.equal(a, 0, "future position has weight");
        s += a;
      }
      assert.ok(Math.abs(s - 1) < 1e-5, "row sum " + s);
    }
  }
});

test("determinism: same seeds give byte-identical weights after 20 steps", () => {
  const run = () => {
    const m = createModel({}, 21);
    const t = createTrainer(m, { seed: 4 });
    for (let s = 0; s < 20; s++) t.step();
    return JSON.stringify(toJSON(m));
  };
  const a = run();
  assert.equal(run(), a);
  const m = createModel({}, 22);
  assert.notEqual(JSON.stringify(toJSON(m)), JSON.stringify(toJSON(createModel({}, 21))), "a different seed differs");
});

test("toJSON / fromJSON round trip is exact", () => {
  const m = scrambled({}, 8);
  const back = fromJSON(JSON.parse(JSON.stringify(toJSON(m))));
  for (const name of m.names) assert.deepEqual(back.params[name], m.params[name], name);
  const x = encode(PROBES[0].words);
  const a = Float32Array.from(forward(m, x, 1, x.length).logits);
  assert.deepEqual(forward(back, x, 1, x.length).logits, a);
});

test("FLOPS counts dense and attention arithmetic", () => {
  const f = FLOPS({}, 16, 24);
  assert.equal(f.step, 3 * f.forward);
  assert.ok(f.forward > 2 * 16 * 24 * 17000 && f.forward < 2 * 16 * 24 * 25000, "about 2 x tokens x params");
});

// Learning, with its control. Measured 2026-10-14 (Node 25.2.1 on Windows,
// BelowNormal priority, CPU shared with another job; 900 steps, batch 16,
// lr 1e-2, model seed 7, data seed 11, 256 held-out rows):
//   unigram baseline 3.272 nats; held-out loss 0.705 with attention,
//   1.136 with attention set to "self";
//   copy accuracy 0.992 with attention, 0.182 with "self";
//   majority-word chance on copy targets 0.101.
//   Local accuracy 0.700 vs 0.602: local targets are partly random by design
//   (which sentence comes next), so about 0.70 is their ceiling.
// Whole file: 10 tests pass in about 50 s, the two training runs are 48 s.
// Gradient check errors seen the same day: float64 worst 1.3e-9; float32
// worst 1.2e-4; broken softmax backward 0.95 on l0.wqkv, 0.83 on l1.wqkv.
const STEPS = 900;
function trainAndEval(attnMode) {
  const m = createModel({ attnMode }, 7);
  const t = createTrainer(m, { seed: 11 });
  for (let s = 0; s < STEPS; s++) t.step();
  return evaluate(m, heldOut(256));
}

function copyChance(held) {
  const counts = new Map();
  let n = 0;
  for (let i = 0; i < held.y.length; i++) if (held.kind[i]) { counts.set(held.y[i], (counts.get(held.y[i]) ?? 0) + 1); n++; }
  return Math.max(...counts.values()) / n;
}

test("learning: attention learns look-back; attention-to-self cannot", () => {
  const held = heldOut(256);
  const unigram = unigramCrossEntropy(makeBatch(rng(99), 2000, 24), held);
  const chance = copyChance(held);
  const on = trainAndEval("normal");
  const off = trainAndEval("self");
  console.log(JSON.stringify({ unigram, chance, on: { loss: on.loss, copy: on.copyAccuracy, local: on.localAccuracy },
    off: { loss: off.loss, copy: off.copyAccuracy, local: off.localAccuracy } }));
  assert.ok(on.loss < 0.4 * unigram, `held-out loss ${on.loss} vs unigram ${unigram}`);
  assert.ok(on.copyAccuracy > 0.9, `copy accuracy with attention ${on.copyAccuracy}`);
  assert.ok(on.copyAccuracy > chance + 0.5, "well above chance");
  assert.ok(off.copyAccuracy < 0.35, `copy accuracy without attention ${off.copyAccuracy}`);
  assert.ok(on.copyAccuracy - off.copyAccuracy > 0.5, "attention is what makes the difference");
  const probe = attentionOn(createModel({}, 7), PROBES[0].words);
  assert.equal(probe.layers.length, 2);
  assert.equal(probe.top5[0].length, 5);
});
