// Tests for lesson L8, "Embeddings: every token gets coordinates".
// Run: node --test system/school/embeddings.test.mjs
// Every claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  tokenStream, createSGNS, noiseCdf, sampleCdf, drawTriples, tripleLoss, gradCheck, batchLoss, trainSGNS, table, heldTriples, neighbourOverlap,
} from "./embeddings.mjs";
import { categoryOf, measureTable, shuffled, nearest, loadTables } from "./vectors.mjs";
import { VOCAB } from "./corpus.mjs";
import { rng } from "./tinyformer-ops.mjs";

const labels = categoryOf(VOCAB);
const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/embeddings/facts.json", import.meta.url);
const SHORT = { episodes: 600, epochs: 2 };

function smallCheck(seed) {
  const m = createSGNS(VOCAB.length, 6, seed, { outInit: 1 }), ids = tokenStream(100, seed);
  return { m, triples: drawTriples(ids, noiseCdf(ids, VOCAB.length), rng(seed + 1), 12) };
}

test("loss: with zero output vectors every term is log 2", () => {
  const m = createSGNS(VOCAB.length, 4, 1);
  assert.ok(Math.abs(tripleLoss(m, 3, 4, [5, 6]) - 3 * Math.log(2)) < 1e-12);
});

test("hand-written gradient matches central finite differences", () => {
  for (const seed of [1, 2, 3]) {
    const { m, triples } = smallCheck(seed), g = gradCheck(m, triples);
    assert.ok(g.checked > 100);
    assert.ok(g.worst < 1e-5, `seed ${seed}: worst relative error ${g.worst}`);
  }
});

test("control: the gradient with the noise words' term of dL/dv dropped fails the check", () => {
  for (const seed of [1, 2, 3]) {
    const { m, triples } = smallCheck(seed), g = gradCheck(m, triples, { drop: "negInInput" });
    assert.ok(g.worst > 1e-2, `seed ${seed}: the broken gradient passed (${g.worst})`);
  }
});

test("noise distribution: unigram^0.75 flattens the counts", () => {
  const ids = tokenStream(300, 4), cdf = noiseCdf(ids, VOCAB.length), r = rng(9), hits = new Float64Array(VOCAB.length);
  for (let n = 0; n < 20000; n++) hits[sampleCdf(cdf, r)]++;
  const counts = new Float64Array(VOCAB.length);
  for (const id of ids) counts[id]++;
  const dot = VOCAB.indexOf("."), rare = counts.indexOf(Math.min(...Array.from(counts).filter((c) => c > 0)));
  const raw = counts[dot] / counts[rare], noise = hits[dot] / Math.max(1, hits[rare]);
  assert.ok(noise < raw, `noise ratio ${noise} should be flatter than raw ${raw}`);
  assert.ok(Math.abs(noise - (counts[dot] / counts[rare]) ** 0.75) / noise < 0.25);
});

test("training is deterministic, lowers held-out loss, and records the snapshots asked for", () => {
  const snaps = [];
  const a = trainSGNS(SHORT, (m, info) => snaps.push({ ...info, t: table(m) }));
  const b = trainSGNS(SHORT);
  assert.deepEqual(Array.from(a.model.win), Array.from(b.model.win));
  assert.equal(snaps.length, 12);
  assert.deepEqual(snaps.map((s) => s.fraction), [0, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1]);
  const held = heldTriples(1000, a.ids), start = createSGNS(VOCAB.length, 32, 1);
  assert.ok(batchLoss(a.model, held) < batchLoss(start, held) - 1, "held-out loss falls by more than a nat");
});

test("a trained table beats the shuffle control; the untrained table and a shuffled trained table do not", () => {
  const snaps = [];
  const run = trainSGNS(SHORT, (m, info) => snaps.push(table(m)));
  const trained = measureTable(table(run.model), labels, { seeds: 200 });
  assert.ok(trained.beatsControl.top1 && trained.beatsControl.topk, JSON.stringify(trained));
  const untrained = measureTable(snaps[0], labels, { seeds: 200 });
  assert.equal(untrained.beatsControl.topk, false, "the control must fail at initialisation");
  const mixed = measureTable(shuffled(table(run.model), 4242), labels, { seeds: 200, seed0: 7000 });
  assert.equal(mixed.beatsControl.topk, false, "the control must fail on a shuffled table");
});

test("neighbour overlap: a table with itself is 1, with a shuffled copy near chance", () => {
  const t = loadTables(JSON.parse(readFileSync(MODEL_URL, "utf8"))).wte;
  assert.equal(neighbourOverlap(t, t, 3, nearest), 1);
  assert.ok(neighbourOverlap(t, shuffled(t, 3), 3, nearest) < 0.2);
});

test("facts.json, when present, matches model.json and keeps its controls", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(readFileSync(MODEL_URL)).digest("hex"));
  assert.ok(f.gradient.passes && f.gradient.controlFails);
  assert.equal(f.training.snapshots[0].share.beatsControl.top3, false);
  assert.equal(f.training.snapshots.at(-1).share.beatsControl.top3, true);
  assert.ok(f.comparison.overlapWithWte > f.comparison.overlapControl.hi95);
  assert.equal(f.training.snapshots.at(-1).table.length, 46);
});
