// Tests for lesson L9, "Next-word prediction and the loss".
// Run: node --test system/school/nextword.test.mjs
// Every claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  softmax, crossEntropy, xentGrad, finiteDiff, relError, workedExample, scoreModel, scoreTable, uniformTable,
  countNgrams, ngramTable, topKCredit, probeReport, V,
} from "./nextword.mjs";
import { trueTable, grammarCheck, startParse, advance, nextWordProbs } from "./corpus-grammar.mjs";
import { fromJSON, createModel, evaluate } from "./tinyformer.mjs";
import { VOCAB, PROBES, heldOut, makeBatch, encode } from "./corpus.mjs";
import { rng, gauss } from "./tinyformer-ops.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/nextword/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8")), model = fromJSON(M.weights);
const HELD = heldOut(64, M.config.ctx);
const trainBatches = (steps) => { const r = rng(M.dataSeed), out = []; for (let s = 0; s < steps; s++) out.push(makeBatch(r, M.batch, M.config.ctx)); return out; };

test("worked example: softmax by hand, loss is minus log of the right word's probability", () => {
  const w = workedExample([2, 1, 0, -1], 0);
  const s = Math.exp(2) + Math.exp(1) + 1 + Math.exp(-1);
  assert.ok(Math.abs(w.probs[0] - Math.exp(2) / s) < 1e-12);
  assert.ok(Math.abs(w.probs.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(w.loss + Math.log(Math.exp(2) / s)) < 1e-12);
  assert.ok(w.shiftInvariant < 1e-12, "adding a constant to every score must not change the probabilities");
});

test("d loss / d logits = p - onehot matches central finite differences", () => {
  const r = rng(3);
  for (let k = 0; k < 20; k++) {
    const logits = Array.from({ length: 6 }, () => 3 * gauss(r)), target = k % 6;
    assert.ok(relError(xentGrad(logits, target), finiteDiff(logits, target)) < 1e-5);
  }
});

test("control: the gradient missing the minus one fails the same check", () => {
  const r = rng(4);
  for (let k = 0; k < 20; k++) {
    const logits = Array.from({ length: 6 }, () => 3 * gauss(r)), target = k % 6;
    const err = relError(xentGrad(logits, target, { broken: true }), finiteDiff(logits, target));
    assert.ok(err > 0.1, `the broken gradient passed (${err})`);
  }
});

test("uniform scores: loss log V, perplexity V, top-1 credit 1/V with ties at random", () => {
  const z = new Array(V).fill(0);
  assert.ok(Math.abs(crossEntropy(z, 5) - Math.log(V)) < 1e-12);
  const s = scoreTable(uniformTable(HELD.y.length), HELD).all;
  assert.ok(Math.abs(s.perplexity - V) < 1e-9);
  assert.ok(Math.abs(s.top1 - 1 / V) < 1e-12 && Math.abs(s.top5 - 5 / V) < 1e-12);
  assert.equal(topKCredit([0.5, 0.2, 0.2, 0.1], 2, 2), 0.5);
});

test("the module's held-out loss agrees with the lab's evaluate()", () => {
  const mine = scoreModel(model, HELD).all.loss, theirs = evaluate(model, HELD).loss;
  assert.ok(Math.abs(mine - theirs) < 1e-5, `${mine} vs ${theirs}`);
});

test("untrained network sits near the uniform guess; trained beats every n-gram baseline", () => {
  const untrained = scoreModel(createModel(M.weights.config, M.seed), HELD).all.loss;
  assert.ok(Math.abs(untrained - Math.log(V)) < 0.1, `untrained loss ${untrained}`);
  const counts = countNgrams(trainBatches(200));
  const loss = (o) => scoreTable(ngramTable(counts, HELD, o), HELD).all.loss;
  const trained = scoreModel(model, HELD).all.loss, [u, b, t] = [loss(1), loss(2), loss(3)];
  assert.ok(trained < t && t < b && b < u && u < Math.log(V), `trained ${trained} trigram ${t} bigram ${b} unigram ${u}`);
});

test("n-gram tables are distributions; the trigram backs off to the bigram at a row's first word", () => {
  const counts = countNgrams(trainBatches(20)), bi = ngramTable(counts, HELD, 2), tri = ngramTable(counts, HELD, 3);
  for (let n = 0; n < 50; n++) { let s = 0; for (let v = 0; v < V; v++) s += tri[n * V + v]; assert.ok(Math.abs(s - 1) < 1e-12); }
  for (let v = 0; v < V; v++) assert.equal(tri[v], bi[v]);
});

test("generator parse: every training and held-out row is accepted and its next-word odds sum to 1", () => {
  for (const seed of [1, 2, 3]) {
    const b = makeBatch(rng(seed), 8, 24);
    for (let i = 0; i < 8; i++) assert.ok(grammarCheck(Array.from(b.x.subarray(i * 24, (i + 1) * 24))).ok, `seed ${seed} row ${i}`);
  }
  let p = startParse();
  for (const id of encode(["tallow", "found", "a", "map", "."])) p = advance(p, id);
  const q = nextWordProbs(p);
  assert.ok(Math.abs(q.reduce((a, c) => a + c, 0) - 1) < 1e-12);
  assert.ok(Math.abs(q[VOCAB.indexOf("pylon")] - (1 / 3 + (2 / 3) * 0.65 * (2 / 8))) < 1e-12, "pylon: close the episode now, or a pylon local sentence");
});

test("control: a copy that names the wrong thing is rejected by the grammar", () => {
  const good = ["rerun", "found", "a", "kettle", ".", "pylon", "put", "a", "cone", "on", "the", "kettle", "."];
  assert.ok(grammarCheck(good).ok);
  const bad = grammarCheck([...good.slice(0, 11), "map", "."]);
  assert.equal(bad.ok, false);
  assert.equal(bad.failAt, 11);
});

test("the generator's own odds are the floor: copy targets cost nothing, and the model cannot beat it", () => {
  const P = trueTable(HELD), s = scoreTable(P, HELD);
  assert.ok(s.copy.loss < 1e-12, `copy loss under the generator ${s.copy.loss}`);
  const trained = scoreModel(model, HELD).all.loss;
  assert.ok(trained > s.all.loss, `model ${trained} below the floor ${s.all.loss}`);
});

test("probes: the trained model puts the expected answer first; the untrained one does not", () => {
  const untrained = createModel(M.weights.config, M.seed);
  for (const p of PROBES) {
    assert.equal(probeReport(model, p).rank, 0, p.answer);
    assert.ok(probeReport(untrained, p).pAnswer < 0.1);
  }
});

test("facts.json, if present, matches this model and this code", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  const full = heldOut(M.heldOutRows, M.config.ctx);
  assert.ok(Math.abs(f.held.scores.trained.all.loss - scoreModel(model, full).all.loss) < 1e-4);
  assert.ok(f.worked.passes && f.worked.controlFails);
  assert.ok(Math.abs(softmax(f.worked.logits)[0] - f.worked.probs[0]) < 1e-5);
});
