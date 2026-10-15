// Tests for lesson F4 (backpropagation). Run: node --test system/school/backprop.test.mjs
// Every claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { twoSpirals, createNet, gradCheck, countOps, train, accuracy, trace, attentionGradCheck } from "./backprop.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);

test("every parameter gradient matches finite differences; one wrong local derivative fails", () => {
  const net = createNet(3), d = twoSpirals(16, 1);
  const ok = gradCheck(net, d.X, d.Y);
  assert.equal(ok.nParams, 114);
  assert.ok(ok.worst < 1e-6, `worst tensor ${ok.worstTensor} ${ok.worst}`);
  const bad = gradCheck(net, d.X, d.Y, { broken: true });
  // The wrong link is tanh' in the second hidden layer: it and every tensor
  // before it fail, the tensors after it still pass. The check localises.
  for (const n of ["W2", "b2", "W1", "b1"]) assert.ok(bad.perTensor[n] > 1e-2, `${n} must fail, got ${bad.perTensor[n]}`);
  for (const n of ["W3", "b3"]) assert.ok(bad.perTensor[n] < 1e-6, `${n} is downstream and must pass, got ${bad.perTensor[n]}`);
});

test("cost: counted multiply-adds match the layer sizes; backward is about twice forward", () => {
  const c = countOps(createNet(3));
  assert.equal(c.forward, 2 * 8 + 8 * 8 + 8 * 2 + 2);
  assert.equal(c.backward, 2 * (2 * 8 + 8 * 8 + 8 * 2) - 2 * 8 + 2 * (8 + 8));
  assert.ok(c.ratio > 1.5 && c.ratio < 3, `ratio ${c.ratio}`);
  const wide = countOps(createNet(3, [2, 32, 32, 2]));
  assert.ok(Math.abs(wide.ratio - 2) < 0.2, `wider net ratio ${wide.ratio}`);
});

test("chain trace: each upstream gradient is the next one times a local derivative", () => {
  const net = createNet(3), t = trace(net, [0.4, -0.3], 1);
  t.output.probs.forEach((p, j) => assert.ok(Math.abs(t.output.gradLogits[j] - (p - (j === 1 ? 1 : 0))) < 1e-15));
  for (const L of [t.hidden1, t.hidden2]) {
    L.value.forEach((a, i) => {
      assert.ok(Math.abs(L.local[i] - (1 - a * a)) < 1e-15);
      assert.ok(Math.abs(L.gradPre[i] - L.gradOut[i] * L.local[i]) < 1e-15);
    });
  }
  assert.ok(Math.abs(t.loss + Math.log(t.output.probs[1])) < 1e-12);
});

test("training reaches 95 percent held-out accuracy; shuffled labels (control) stay near chance", () => {
  const data = twoSpirals(400, 1), held = twoSpirals(400, 2);
  const net = createNet(3);
  const curve = train(net, data, held, { steps: 4000, lr: 0.3, batch: 32, seed: 5, every: 1000 });
  const last = curve[curve.length - 1];
  assert.ok(last.heldAccuracy >= 0.95, `held-out accuracy ${last.heldAccuracy}`);
  assert.ok(curve[0].heldAccuracy < 0.7, "the untrained net is not already right");
  const shuffled = { X: data.X, Y: data.Y.map((_, i) => (Math.imul(i + 1, 2654435761) >>> 16) & 1) };
  const ctl = createNet(3);
  train(ctl, shuffled, held, { steps: 4000, lr: 0.3, batch: 32, seed: 5, every: 4000 });
  const ctlAcc = accuracy(ctl, held.X, held.Y);
  assert.ok(ctlAcc < 0.65, `a net trained on shuffled labels must not generalise, got ${ctlAcc}`);
});

test("attention model: the manual backward matches finite differences; the broken-softmax control fails", () => {
  const bytes = readFileSync(MODEL_URL), M = JSON.parse(bytes.toString("utf8"));
  const model = fromJSON(M.weights), rows = heldOut(2, M.config.ctx);
  const r = attentionGradCheck(model, rows, { tensors: ["wout", "l1.w2", "l0.wqkv", "wte"], top: 2, random: 1 });
  assert.ok(r.float64.worst.relErr < 1e-5, `float64 worst ${r.float64.worst.tensor} ${r.float64.worst.relErr}`);
  const ctl = attentionGradCheck(model, rows, { tensors: ["wout", "l0.wqkv"], top: 3, random: 0, brokenSoftmax: true });
  assert.ok(ctl.float64.worst.relErr > 1e-2, `broken backward must fail, worst ${ctl.float64.worst.relErr}`);
  assert.ok(ctl.float64.rows.filter((x) => x.tensor === "wout").every((x) => x.relErr < 1e-5), "the readout is downstream of attention and must pass");
  const facts = JSON.parse(readFileSync(new URL("../../media/school/backprop/facts.json", import.meta.url), "utf8"));
  assert.equal(facts.modelJsonSha256, createHash("sha256").update(bytes).digest("hex"), "re-run tools/school/fill_backprop.mjs");
  assert.ok(facts.training.finalHeldAccuracy >= 0.95);
});
