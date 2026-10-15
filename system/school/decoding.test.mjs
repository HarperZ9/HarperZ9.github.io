// Tests for lesson L15, "Decoding: temperature, top-k, top-p".
// Run: node --test system/school/decoding.test.mjs
// Every claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  createCache, stepCache, settingProbs, entropy, sampleIndex, generate, distinctN, endsInLoop, bigramSet, bigramCheck, argmax, V,
} from "./decoding.mjs";
import { softmax, countNgrams } from "./nextword.mjs";
import { grammarCheck, sampleGenerator } from "./corpus-grammar.mjs";
import { fromJSON, forward } from "./tinyformer.mjs";
import { PROBES, encode, decode, makeBatch } from "./corpus.mjs";
import { rng, gauss } from "./tinyformer-ops.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/decoding/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8")), model = fromJSON(M.weights);
const PROMPTS = [["tallow", "found", "a", "map", "."], ["rerun", "painted", "the", "boat", ".", "the", "bell", "rang", "."], ["pylon"]];
const randomLogits = (r) => Array.from({ length: V }, () => 2 * gauss(r));

function cachedLogits(words, skip = false) {
  const x = encode(words), C = createCache(model, 1), out = [];
  for (const id of x) { if (skip) C.pos += 1; out.push(Float64Array.from(stepCache(model, C, [id]))); if (skip) break; }
  return { x, out };
}

test("the cached step gives the same logits as forward() on the whole prefix", () => {
  for (const p of PROBES) {
    const { x, out } = cachedLogits(p.words), full = forward(model, x, 1, x.length).logits;
    for (let t = 0; t < x.length; t++) for (let v = 0; v < V; v++) assert.ok(Math.abs(out[t][v] - full[t * V + v]) < 1e-4);
  }
});

test("control: a cache fed the wrong position disagrees with forward()", () => {
  const w = PROBES[0].words, { out } = cachedLogits(w, true), full = forward(model, encode(w), 1, w.length).logits;
  let worst = 0;
  for (let v = 0; v < V; v++) worst = Math.max(worst, Math.abs(out[0][v] - full[v]));
  assert.ok(worst > 1e-2, `position error not detected (${worst})`);
});

test("settings: temperature 1 is the softmax; greedy is one-hot; uniform is 1/V", () => {
  const r = rng(2), z = randomLogits(r), p = settingProbs(z, {}), s = softmax(z);
  for (let v = 0; v < V; v++) assert.ok(Math.abs(p[v] - s[v]) < 1e-15);
  const g = settingProbs(z, { mode: "greedy" });
  assert.equal(g[argmax(z)], 1);
  assert.equal(entropy(g), 0);
  assert.ok(Math.abs(entropy(settingProbs(z, { mode: "uniform" })) - Math.log(V)) < 1e-12);
});

test("temperature: below 1 sharpens and above 1 flattens (entropy moves the right way)", () => {
  const r = rng(5);
  for (let k = 0; k < 10; k++) {
    const z = randomLogits(r), h = (T) => entropy(settingProbs(z, { temperature: T }));
    assert.ok(h(0.5) < h(1) && h(1) < h(2) && h(2) < Math.log(V));
  }
});

test("top-k keeps exactly k words; top-p keeps the smallest set reaching p", () => {
  const r = rng(6);
  for (let k = 0; k < 20; k++) {
    const z = randomLogits(r), s = softmax(z), q = settingProbs(z, { topK: 5 });
    assert.equal(q.filter((x) => x > 0).length, 5);
    const kept = Array.from(settingProbs(z, { topP: 0.8 }), (x, i) => [x, s[i]]).filter(([x]) => x > 0).map(([, si]) => si).sort((a, b) => b - a);
    const mass = kept.reduce((a, b) => a + b, 0);
    assert.ok(mass >= 0.8 - 1e-12 && mass - kept.at(-1) < 0.8, `kept ${kept.length} words, mass ${mass}`);
  }
});

test("temperature near 0 decodes the same text as greedy", () => {
  for (const w of PROMPTS) {
    const ids = encode(w), maxNew = 24 - ids.length, g = generate(model, ids, { mode: "greedy" }, { n: 1, maxNew }).rows[0].join(",");
    const cold = generate(model, ids, { temperature: 0.01 }, { n: 10, maxNew, seed: 3 });
    for (const row of cold.rows) assert.equal(row.join(","), g);
  }
});

test("row b of a batch equals a one-row run with seed + b", () => {
  const ids = encode(PROMPTS[2]), big = generate(model, ids, {}, { n: 4, maxNew: 10, seed: 7 });
  for (let b = 0; b < 4; b++) assert.deepEqual(Array.from(generate(model, ids, {}, { n: 1, maxNew: 10, seed: 7 + b }).rows[0]), Array.from(big.rows[b]));
});

test("sampleIndex draws words at their probabilities", () => {
  const p = [0.5, 0.3, 0.2, 0], r = rng(9), hits = [0, 0, 0, 0], n = 20000;
  for (let i = 0; i < n; i++) hits[sampleIndex(p, r())]++;
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(hits[i] / n - p[i]) < 0.015, `word ${i}: ${hits[i] / n}`);
  assert.equal(hits[3], 0);
});

test("grammar check: the generator's own continuations always pass; uniform sampling almost never does", () => {
  const ids = encode(PROMPTS[0]), ref = sampleGenerator(ids, 19, Array.from({ length: 100 }, (_, b) => rng(100 + b)));
  for (const r of ref.rows) assert.ok(grammarCheck([...ids, ...r]).ok);
  const uni = generate(model, ids, { mode: "uniform" }, { n: 100, maxNew: 19, seed: 1 });
  assert.equal(uni.rows.filter((r) => grammarCheck([...ids, ...r]).ok).length, 0);
});

test("control: a who-answer naming the wrong guide passes the bigram check but fails the grammar", () => {
  const words = ["rerun", "painted", "the", "boat", ".", "who", "painted", "the", "boat", "?", "tallow", "."];
  const r = rng(M.dataSeed), batches = Array.from({ length: 200 }, () => makeBatch(r, M.batch, 24));
  assert.ok(bigramCheck(encode(words), bigramSet(countNgrams(batches).bi)).ok);
  assert.equal(grammarCheck(words).ok, false);
  words[10] = "rerun";
  assert.ok(grammarCheck(words).ok);
});

test("loop and diversity measures on hand-made rows", () => {
  assert.equal(endsInLoop([1, 2, 3, 4, 3, 4, 3, 4], 2, 3), true);
  assert.equal(endsInLoop([1, 2, 3, 4, 3, 4, 4, 3], 2, 3), false);
  assert.equal(endsInLoop([5, 5, 5, 5, 5, 5], 2, 3), true);
  assert.equal(distinctN([[1, 2, 3], [1, 2, 4]], 2), 3 / 4);
});

test("sampling at temperature 1 is grammatical most of the time; at temperature 2 mostly not", () => {
  const ids = encode(PROMPTS[0]), rate = (s) => generate(model, ids, s, { n: 200, maxNew: 19, seed: 1 }).rows.filter((r) => grammarCheck([...ids, ...r]).ok).length / 200;
  const t1 = rate({}), t2 = rate({ temperature: 2 });
  assert.ok(t1 > 0.8 && t2 < 0.5 && t1 > t2, `t1 ${t1} t2 ${t2}`);
});

test("facts.json, if present, matches this model and reproduces a greedy row", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const p of f.prompts) {
    const ids = encode(p.prompt), g = generate(model, ids, { mode: "greedy" }, { n: 1, maxNew: p.maxNew }).rows[0];
    assert.equal(p.settings.greedy.examples[0], decode(g).join(" "));
    assert.equal(p.settings.greedy.grammatical, 1);
    assert.equal(p.nearZeroTemperature.sameAsGreedy, 1);
  }
});
