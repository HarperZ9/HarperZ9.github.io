// Tests for lesson L16, "Evaluating a language model".
// Run: node --test system/school/evaluate.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { makeEvalSet, promptOf, cutAtDot, perfectJudge, fluentJudge, pairSet, scoreRows, createScorer, units, generatorExact, agreement, DOT } from "./evaluate.mjs";
import { fluentPair, pairwiseItems, pairwiseSummary, contaminationGap, pairedStatInterval } from "./evaluate-judge.mjs";
import { leakSchedule, createEvalTrainer, naturalOverlap } from "./evaluate-train.mjs";
import { scoreItems, unitsOf, scoreOf } from "./errorbars.mjs";
import { fromJSON, createModel, createTrainer, rng } from "./tinyformer.mjs";
import { makeBatch, encode, VOCAB } from "./corpus.mjs";
import { sampleGenerator } from "./corpus-grammar.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/evaluate/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8")), MODEL = fromJSON(M.weights);
const SET = makeEvalSet(90002, 64), PAIRS = pairSet();

test("eval sets are the generator's rows; one-answer words have exact truth the generator always gets right", () => {
  const plain = makeBatch(rng(90002), 64, 24);
  assert.deepEqual(Array.from(SET.x), Array.from(plain.x));
  assert.deepEqual(Array.from(SET.y), Array.from(plain.y));
  const g = generatorExact(SET);
  assert.ok(g.n > 100, `${g.n} one-answer words`);
  assert.equal(g.right, g.n, "the generator's own top word is right on every one-answer word");
  const V = VOCAB.length;
  let shifted = 0;
  for (let i = 1; i < SET.one.length; i++) if (SET.one[i] && SET.y[i - 1] === SET.y[i]) shifted++;
  assert.ok(shifted / g.n < 0.2, `a predictor copying the previous target must fail (${shifted / g.n})`);
  for (let i = 0; i < SET.one.length; i++) if (SET.one[i]) assert.ok(SET.P[i * V + SET.y[i]] > 1 - 1e-9);
});

test("judges: the grammar accepts the generator's own text and rejects a wrong copy; the fluent judge passes the wrong copy", () => {
  const prompt = encode(["rerun", "found", "a", "kettle", ".", "pylon", "put", "a", "cone", "on", "the"]);
  const right = encode(["kettle", "."]), wrong = encode(["map", "."]);
  assert.equal(perfectJudge(prompt, right), 1);
  assert.equal(perfectJudge(prompt, wrong), 0, "the cone on a thing nobody found is not the generator's text");
  assert.equal(fluentJudge(prompt, right, PAIRS), 1);
  assert.equal(fluentJudge(prompt, wrong, PAIRS), 1, "the fluent judge reads two words at a time and is fooled");
  assert.equal(fluentJudge(prompt, encode(["the", "the"]), PAIRS), 0, "a pair never seen in training text is rejected");
  const g = sampleGenerator(Array.from(promptOf(SET, 0)), 10, [rng(1), rng(2), rng(3)]);
  for (const row of g.rows) assert.equal(perfectJudge(promptOf(SET, 0), cutAtDot(row).ids), 1);
  assert.deepEqual(Array.from(cutAtDot(encode(["tallow", "lit", ".", "the"])).ids), Array.from(encode(["tallow", "lit", "."])));
  assert.equal(cutAtDot(encode(["the", "bell"])).stopped, false);
  assert.equal(DOT, 0);
});

test("per-row scores: sums match errorbars' per-word scores, and the step-at-a-time scorer gives the same rows", () => {
  const rows = scoreRows(MODEL, SET, { pairs: PAIRS }), items = scoreItems(MODEL, SET);
  assert.ok(Math.abs(scoreOf(units(rows, "loss")) - scoreOf(unitsOf(items, "loss", "row"))) < 1e-9);
  const sc = createScorer(MODEL, SET, { pairs: PAIRS, rowsPerStep: 16 });
  while (!sc.done) sc.step();
  assert.deepEqual(sc.rows, rows, "slicing rows into 16-row steps must not change any number");
  assert.ok(scoreOf(units(rows, "exact")) > 0.95, `the trained model answers the one-answer words (${scoreOf(units(rows, "exact"))})`);
  const untrained = scoreRows(createModel(M.config, 3), SET, { pairs: PAIRS });
  assert.ok(scoreOf(units(untrained, "exact")) < 0.2 && scoreOf(units(untrained, "perfect")) < 0.3, "an untrained model must fail both");
});

test("agreement: kappa 1 for one judge against itself, near 0 for an unrelated judge; false accepts counted", () => {
  const r = rng(5), a = Array.from({ length: 4000 }, () => (r() < 0.6 ? 1 : 0)), b = Array.from({ length: 4000 }, () => (r() < 0.6 ? 1 : 0));
  assert.equal(agreement(a, a).kappa, 1);
  assert.ok(Math.abs(agreement(a, b).kappa) < 0.05, `independent judges: kappa ${agreement(a, b).kappa}`);
  const g = agreement([1, 1, 0, 0], [1, 1, 1, 0]);
  assert.equal(g.falseAccept, 0.5);
  assert.equal(g.falseReject, 0);
});

test("pairwise rules: fluency, then length, then position; a swap exposes the position rule", () => {
  const A = { fluent: 1, perfect: 1, len: 2, gen: [1, 2] }, B = { fluent: 1, perfect: 0, len: 4, gen: [1, 2, 3, 4] }, C = { fluent: 1, perfect: 1, len: 2, gen: [5, 6] };
  assert.deepEqual(fluentPair(A, { ...B, fluent: 0 }), { win: "first", by: "fluency" });
  assert.deepEqual(fluentPair(A, B), { win: "second", by: "length" });
  assert.deepEqual(fluentPair(A, C), { win: "first", by: "position" });
  const s = pairwiseSummary(pairwiseItems([A, A], [B, C]));
  assert.equal(s.longerPicked, 1, "the grammar prefers the shorter A; the fluent judge picks the longer B");
  assert.equal(s.consistent, 0.5, "A against C flips with the order; A against B does not");
  assert.equal(s.firstBoth, 0.5);
});

test("contamination gap: zero with an interval holding zero when nothing leaked; resolved when only A moved", () => {
  const r = rng(8), u = (n, sh = 0) => ({ num: Float64Array.from({ length: n }, () => 24 * (1 + r() * 0.2) - sh), den: new Float64Array(n).fill(24) });
  const cA = u(200), cB = u(400), same = contaminationGap(cA, cA, cB, cB);
  assert.equal(same.gap, 0);
  assert.ok(same.lo <= 0 && same.hi >= 0);
  const kA = { num: cA.num.map((v) => v - 2.4), den: cA.den }, moved = contaminationGap(cA, kA, cB, cB);
  assert.ok(Math.abs(moved.gap - 0.1) < 1e-9 && moved.lo > 0, `gap ${moved.gap} [${moved.lo}, ${moved.hi}]`);
  const iv = pairedStatInterval([[1, 0, 1, 1]], (a) => a.reduce((x, y) => x + y, 0) / a.length, { resamples: 200 });
  assert.equal(iv.mean, 0.75);
});

test("training: with no leak the trainer equals createTrainer bit for bit; the leak schedule places every row exactly K times", () => {
  const a = createModel(M.config, M.seed), b = createModel(M.config, M.seed);
  const ta = createTrainer(a, { seed: M.dataSeed, batch: M.batch, lr: M.lr }), tb = createEvalTrainer(b, { seed: M.dataSeed, batch: M.batch, lr: M.lr });
  for (let i = 0; i < 12; i++) { ta.step(); tb.step(); }
  for (const n of a.names) assert.deepEqual(Array.from(a.params[n]), Array.from(b.params[n]), n);
  const plan = leakSchedule(50, 3, 40), seen = new Array(50).fill(0);
  for (const rows of plan.values()) for (const r of rows) seen[r]++;
  assert.ok(seen.every((c) => c === 3));
  assert.ok(Math.max(...[...plan.values()].map((x) => x.length)) <= 4);
  const ov = naturalOverlap(SET, M.dataSeed, 20);
  assert.equal(ov.trainingRows, 320);
});

test("a leak inflates the score on the leaked rows and not on fresh rows; leaking other rows does not", () => {
  const A = makeEvalSet(91001, 32), B = makeEvalSet(91002, 32), C = makeEvalSet(91003, 32);
  const tune = (leakSet) => {
    const m = fromJSON(M.weights), tr = createEvalTrainer(m, { seed: 5, batch: 16, lr: 3e-3, warmup: 1, leak: { set: leakSet, repeats: 40, steps: 100 } });
    for (let i = 0; i < 100; i++) tr.step();
    return { A: units(scoreRows(m, A, {}), "loss"), B: units(scoreRows(m, B, {}), "loss") };
  };
  const clean = { A: units(scoreRows(MODEL, A, {}), "loss"), B: units(scoreRows(MODEL, B, {}), "loss") };
  const leaked = tune(A), other = tune(C);
  const g = contaminationGap(clean.A, leaked.A, clean.B, leaked.B), o = contaminationGap(clean.A, other.A, clean.B, other.B);
  assert.ok(g.gap > 0.05 && g.lo > 0, `leaked rows: gap ${g.gap} [${g.lo}, ${g.hi}]`);
  assert.ok(Math.abs(o.gap) < g.gap / 3, `leaking other rows must not inflate A (${o.gap})`);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["sets", "checkpoints", "disagreements", "misses", "judges", "pairwise", "contamination", "speed", "film"]) assert.ok(f[sec].about.length > 60, sec);
  assert.equal(f.sets.reproducesModelJson, true, "seed 1 retrained is model.json");
  assert.equal(f.sets.B.generatorExact.right, f.sets.B.generatorExact.n);
  assert.ok(f.verdicts.length > 5);
});
