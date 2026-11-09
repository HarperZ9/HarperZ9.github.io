// Tests for lesson L11, "The transformer block".
// Run: node --test system/school/block.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hookedForward, readout, score, paramCounts, streamStats, logitLens, ablations, knockoutList } from "./block.mjs";
import { fromJSON, createModel, forward, evaluate } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/block/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8"));
const model = fromJSON(M.weights), untrained = createModel(M.weights.config, M.seed);
const HELD = heldOut(64, M.config.ctx);
const run = (m, opts) => hookedForward(m, HELD.x, HELD.batch, HELD.ctx, opts);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// A copy of the model with some weights zeroed, the independent route to a
// knockout: change the weights, then run the unmodified tinyformer forward.
function surgery(names, rows = null) {
  const m = fromJSON(M.weights), d = m.config.dModel;
  for (const n of names) {
    if (!rows) m.params[n].fill(0);
    else for (const r of rows) m.params[n].fill(0, r * d, (r + 1) * d);
  }
  return forward(m, HELD.x, HELD.batch, HELD.ctx).logits;
}

test("hooked forward with nothing changed equals tinyformer forward bit for bit", () => {
  const ref = forward(model, HELD.x, HELD.batch, HELD.ctx).logits.slice();
  assert.ok(same(run(model).logits, ref));
  assert.equal(score(model, run(model).logits, HELD).loss, evaluate(model, HELD).loss);
});

test("the last stream read through the final norm and output matrix is the model's output", () => {
  const fw = run(model, { streams: true });
  assert.deepEqual(fw.streams.map((s) => s.at), ["embed", "l0.attn", "l0.mlp", "l1.attn", "l1.mlp"]);
  assert.ok(same(readout(model, fw.streams.at(-1).h, HELD.y.length), fw.logits));
  const lens = logitLens(model, HELD);
  assert.equal(lens.at(-1).loss, evaluate(model, HELD).loss);
  assert.ok(lens[0].loss > lens.at(-1).loss + 1, "the embedding alone should predict far worse than the full model");
});

test("parameter counts per part add up to the model's total", () => {
  const p = paramCounts(model), c = model.config;
  assert.equal(p.total, model.nParams);
  assert.equal(p.embeddings, (c.vocab + c.ctx) * c.dModel);
  assert.equal(p.mlp, c.nLayers * (2 * c.dModel * c.dFF + c.dFF + c.dModel));
  assert.equal(p.attention, c.nLayers * (4 * c.dModel * c.dModel + 4 * c.dModel));
});

test("zero knockouts equal weight surgery on an unmodified forward", () => {
  const mlp = run(model, { knockouts: [{ layer: 1, part: "mlp", mode: "zero" }] }).logits;
  assert.ok(same(mlp, surgery(["l1.w2", "l1.b2"])), "MLP knockout = zero w2 and b2");
  const attn = run(model, { knockouts: [{ layer: 0, part: "attn", mode: "zero" }] }).logits;
  assert.ok(same(attn, surgery(["l0.wo", "l0.bo"])), "attention knockout = zero wo and bo");
  const hd = model.config.dModel / model.config.nHeads, rows = Array.from({ length: hd }, (_, i) => hd + i);
  const head = run(model, { knockouts: [{ layer: 1, part: "head", head: 1, mode: "zero" }] }).logits;
  const cut = surgery(["l1.wo"], rows);
  let worst = 0;
  for (let i = 0; i < head.length; i++) worst = Math.max(worst, Math.abs(head[i] - cut[i]));
  assert.ok(worst < 1e-4, `head knockout = zero head 1's input rows of wo (worst ${worst})`);
});

test("control: zeroing the wrong slice of wo (head 0's rows) does not match the head 1 knockout", () => {
  const head = run(model, { knockouts: [{ layer: 1, part: "head", head: 1, mode: "zero" }] }).logits;
  const hd = model.config.dModel / model.config.nHeads;
  const wrong = surgery(["l1.wo"], Array.from({ length: hd }, (_, i) => i));
  let worst = 0;
  for (let i = 0; i < head.length; i++) worst = Math.max(worst, Math.abs(head[i] - wrong[i]));
  assert.ok(worst > 0.1, `the wrong surgery matched (worst ${worst})`);
});

test("knocking out the copy head hurts copy targets; the untrained model shows no such effect", () => {
  const list = knockoutList(model, ["zero"]).filter((k) => k.name === "l1.h1" || k.name === "l1.h0");
  const t = ablations(model, HELD, list), u = ablations(untrained, HELD, list);
  const h1 = t.rows.find((r) => r.name === "l1.h1"), h0 = t.rows.find((r) => r.name === "l1.h0");
  assert.ok(t.base.copyAccuracy - h1.copyAccuracy > 0.3, "layer 1 head 1 carries the look-back");
  assert.ok(t.base.copyAccuracy - h0.copyAccuracy < 0.05, "layer 1 head 0 does not");
  for (const r of u.rows) assert.ok(Math.abs(r.dLoss) < 0.05, "untrained knockouts move the loss by little");
});

test("shuffle and mean knockouts use recorded activations; replace drops the residual", () => {
  const rec = run(model, { record: true }).record;
  assert.ok(["attn0", "mlp0", "attn1", "mlp1", "ao0", "ao1"].every((k) => rec[k]));
  const t = ablations(model, HELD, knockoutList(model, ["shuffle", "mean"]).filter((k) => k.name === "l0.mlp" && k.mode !== "replace").concat(
    [{ name: "l0.attn", mode: "replace", knockouts: [{ layer: 0, part: "attn", mode: "replace" }] }]));
  for (const r of t.rows) assert.ok(r.dLoss > 0.5, `${r.name} ${r.mode} should hurt (${r.dLoss})`);
});

test("stream statistics: norms are positive and the ratio is per position", () => {
  const s = streamStats(model, HELD);
  assert.equal(s.steps.length, 5);
  assert.equal(s.adds.length, 4);
  for (const a of s.adds) assert.ok(a.addNorm > 0 && a.ratioToStream > 0 && Math.abs(a.cosineWithStream) <= 1);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  assert.equal(f.params.counts.total, M.nParams);
  for (const sec of ["params", "stream", "lens", "ablations", "residual"]) assert.ok(f[sec].about.length > 40, sec);
});
