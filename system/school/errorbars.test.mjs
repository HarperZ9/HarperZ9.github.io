// Tests for lesson E23, "Error bars: how sure is the number".
// Run: node --test system/school/errorbars.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { scoreItems, firstRows, unitsOf, scoreOf, quantile, ratioSE, normalInterval, bootstrapInterval, createBootstrap, diffInterval, diffNormal, permuteUnits, designEffect, generatorItems, createCoverage, repeatRows } from "./errorbars.mjs";
import { generatorExpectedLoss, bruteExpectedLoss } from "./errorbars-truth.mjs";
import { fromJSON, evaluate, rng } from "./tinyformer.mjs";
import { gauss } from "./tinyformer-ops.mjs";
import { heldOut, makeBatch } from "./corpus.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/errorbars/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8")), MODEL = fromJSON(M.weights);
const HELD = heldOut(256), ITEMS = scoreItems(MODEL, HELD);

test("per-item scores average to evaluate()'s numbers on the standard held-out rows", () => {
  const e = evaluate(MODEL, HELD);
  assert.ok(Math.abs(scoreOf(unitsOf(ITEMS, "loss", "row")) - e.loss) < 1e-6);
  assert.ok(Math.abs(scoreOf(unitsOf(ITEMS, "loss", "word")) - e.loss) < 1e-6);
  assert.equal(scoreOf(unitsOf(ITEMS, "accuracy", "row")), e.accuracy);
  assert.equal(scoreOf(unitsOf(ITEMS, "lookback", "row")), e.copyAccuracy);
  assert.equal(scoreOf(unitsOf(ITEMS, "lookback", "word")), e.copyAccuracy);
  const big = heldOut(64), small = heldOut(16), cut = firstRows(scoreItems(MODEL, big), 16);
  assert.deepEqual(Array.from(cut.loss), Array.from(scoreItems(MODEL, small).loss), "the first 16 of 64 held-out rows are the 16-row set");
});

test("the generator's expected loss: merged states equal brute force over every word string; a wrong merge does not", () => {
  for (const ctx of [5, 7]) {
    const merged = generatorExpectedLoss(ctx), brute = bruteExpectedLoss(ctx);
    assert.ok(Math.abs(merged.mean - brute.mean) < 1e-12, `ctx ${ctx}: ${merged.mean} vs ${brute.mean}`);
    assert.ok(Math.abs(merged.mass - 1) < 1e-9);
  }
  const wrong = generatorExpectedLoss(7, { mergeBy: "lastWord" }), brute = bruteExpectedLoss(7);
  assert.ok(Math.abs(wrong.mean - brute.mean) > 0.01, `merging by last word must be caught (${wrong.mean} vs ${brute.mean})`);
});

test("quantiles and standard errors: type 7 quantile, ratio SE equals sd / sqrt(n) for single words", () => {
  const s = Float64Array.from([1, 2, 3, 4, 5]);
  assert.equal(quantile(s, 0.5), 3);
  assert.equal(quantile(s, 0.1), 1.4);
  const u = { num: Float64Array.from([1, 2, 3, 4, 10]), den: new Float64Array(5).fill(1) }, m = 4;
  const sd = Math.sqrt([1, 2, 3, 4, 10].reduce((a, v) => a + (v - m) ** 2, 0) / 4);
  assert.ok(Math.abs(ratioSE(u) - sd / Math.sqrt(5)) < 1e-12);
  const iv = normalInterval(u);
  assert.ok(Math.abs(iv.hi - iv.lo - 2 * 1.959963984540054 * sd / Math.sqrt(5)) < 1e-12);
});

test("the bootstrap is seeded and exact; its width falls about as 1 / sqrt(rows); a single resample is a point", () => {
  const u = unitsOf(ITEMS, "loss", "row"), a = bootstrapInterval(u, { seed: 3 }), b = bootstrapInterval(u, { seed: 3 }), c = bootstrapInterval(u, { seed: 4 });
  assert.deepEqual(a, b);
  assert.notEqual(a.lo, c.lo);
  assert.ok(a.lo < a.mean && a.mean < a.hi);
  const w16 = bootstrapInterval(unitsOf(firstRows(ITEMS, 16), "loss", "row")).width, w256 = a.width;
  assert.ok(w16 / w256 > 2 && w16 / w256 < 6, `16 rows against 256 rows should be near 4 times as wide (${w16 / w256})`);
  const one = createBootstrap(u, 1);
  one.step(1);
  assert.equal(one.interval().width, 0, "one resample gives no spread: the interval needs many");
});

test("paired comparison: on the same rows the paired interval is narrower; shuffling one model's rows loses the advantage", () => {
  const other = fromJSON(M.weights), r = rng(11);
  for (const n of other.names) { const p = other.params[n]; for (let i = 0; i < p.length; i++) p[i] += 0.02 * gauss(r); }
  const A = unitsOf(ITEMS, "loss", "row"), B = unitsOf(scoreItems(other, HELD), "loss", "row");
  const paired = diffInterval(A, B, { mode: "paired" }), unpaired = diffInterval(A, B, { mode: "unpaired" });
  assert.ok(paired.width < 0.5 * unpaired.width, `paired ${paired.width} vs unpaired ${unpaired.width}`);
  assert.ok(diffNormal(A, B, "paired").width < 0.5 * diffNormal(A, B, "unpaired").width);
  const broken = diffInterval(A, permuteUnits(B, 5), { mode: "paired" });
  assert.ok(broken.width > 0.8 * unpaired.width, `a broken pairing must not keep the advantage (${broken.width} vs ${unpaired.width})`);
});

test("design effect: words of a row are scored together, so row and word standard errors differ", () => {
  const d = designEffect(ITEMS);
  assert.ok(d.rowSE > 0 && d.wordSE > 0 && Math.abs(d.deff - 1) > 0.2, `deff ${d.deff}`);
  const rep = designEffect(repeatRows(ITEMS, 4));
  assert.ok(Math.abs(rep.rowSE - d.rowSE / 2) < 0.2 * d.rowSE, "four copies of every row look like four times the rows to a naive interval");
});

test("coverage on the generator: row intervals hold the exact truth near 95 percent; a wrong truth and duplicated rows fail", () => {
  const truth = generatorExpectedLoss(24).mean;
  assert.ok(Math.abs(truth - 0.636) < 0.001, `truth ${truth}`);
  const items = generatorItems(makeBatch(rng(1), 4, 24));
  assert.ok(items.loss.every((v) => v >= 0 && Number.isFinite(v)));
  const run = (opts) => { const c = createCoverage({ rows: 16, seed: 21, resamples: 400, ...opts }); for (let i = 0; i < 200; i++) c.step(); return c.summary(); };
  const ok = run({ truth });
  assert.ok(ok.rowPct.coverage > 0.9 && ok.rowPct.coverage < 0.99, `row coverage ${ok.rowPct.coverage}`);
  assert.ok(Math.abs(ok.meanOfMeans - truth) < 0.01);
  const off = run({ truth: truth + 0.05 });
  assert.ok(off.rowPct.coverage < 0.7, `a truth 0.05 nats off must be missed often (${off.rowPct.coverage})`);
  const dup = run({ truth, copies: 4 });
  assert.ok(dup.rowPct.coverage < 0.8 && dup.clusterPct.coverage > 0.85, `duplicated rows: naive ${dup.rowPct.coverage}, by cluster ${dup.clusterPct.coverage}`);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["items", "widths", "unit", "paired", "seeds", "coverage", "speed"]) assert.ok(f[sec].about.length > 60, sec);
  assert.ok(Math.abs(f.coverage.truth - 0.6361) < 1e-3);
  assert.ok(f.paired.at1024.pairedPct.width < f.paired.at1024.unpairedPct.width);
  assert.ok(f.paired.at1024.shuffledPct.width > 0.8 * f.paired.at1024.unpairedPct.width);
});
