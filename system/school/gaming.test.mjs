// Tests for lesson E24, "When the check can be fooled".
// Run: node --test system/school/gaming.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { whoPrompt, exactAnswer, makePrompts, CHECKERS, isCorrect, reinforceHead, createGamer, scorePolicy, checkpointAt, pearson, DOT, GUIDE_IDS } from "./gaming.mjs";
import { rng } from "./tinyformer.mjs";
import { encode } from "./corpus.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/gaming/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8"));
const ans = (words, stopped) => ({ words: Array.from(encode(words)), stopped });

test("who prompts: the generator can write every one, and its exact odds name the drawn guide with probability 1", () => {
  const ps = makePrompts(4242, 200);
  for (const p of ps) { assert.equal(p.truthP, 1); assert.equal(p.truth, p.drawn); assert.ok(p.ids.length <= 22); }
  const { words } = whoPrompt(rng(3)), cut = words.slice(words.indexOf("who"));
  assert.throws(() => exactAnswer(encode(cut)), /cannot write/, "a question with no deed before it is not something the generator writes");
});

test("checkers: the gamed one pays for a list of names and for padding; the fixed one pays only a right answer that stops", () => {
  const rerun = encode(["rerun"])[0];
  const cases = [
    [ans(["rerun"], true), { gamed: 1, patched: 1, fixed: 1, exact: 1 }],
    [ans(["tallow", "pylon", "rerun"], false), { gamed: 1, patched: 0, fixed: 0, exact: 0 }],
    [ans(["rerun", "rerun", "rerun"], false), { gamed: 1, patched: 1, fixed: 0, exact: 0 }],
    [ans(["rerun", "kept", "the"], false), { gamed: 1, patched: 1, fixed: 0, exact: 0 }],
    [ans(["rerun", "the"], true), { gamed: 1, patched: 1, fixed: 1, exact: 0 }],
    [ans(["pylon"], true), { gamed: 0, patched: 0, fixed: 0, exact: 0 }],
  ];
  for (const [a, want] of cases) for (const k of Object.keys(want)) assert.equal(CHECKERS[k](a, rerun), want[k], `${k} on ${a.words}`);
  assert.equal(isCorrect(ans(["rerun"], true), rerun), true);
  assert.equal(GUIDE_IDS.length, 3);
  assert.equal(DOT, 0);
});

test("the REINFORCE head's gradient matches finite differences of its loss; a flipped sign is caught", () => {
  const B = 2, C = 4, V = 46, r = rng(9), logits = Float64Array.from({ length: B * C * V }, () => r() * 4 - 2);
  const actions = [[{ pos: 1, id: 3 }, { pos: 2, id: 0 }], [{ pos: 3, id: 12 }]], adv = [0.5, -0.25];
  const head = reinforceHead(actions, adv, B, C), d = new Float64Array(B * C * V), N = B * C;
  const lossAt = () => head({ logits, dlogits: new Float64Array(B * C * V), N, V });
  head({ logits, dlogits: d, N, V });
  let err = 0, errFlip = 0, scale = 0;
  for (let i = 0; i < logits.length; i += 7) {
    const keep = logits[i];
    logits[i] = keep + 1e-6; const lp = lossAt(); logits[i] = keep - 1e-6; const lm = lossAt(); logits[i] = keep;
    const num = (lp - lm) / 2e-6;
    err = Math.max(err, Math.abs(num - d[i])); errFlip = Math.max(errFlip, Math.abs(num + d[i])); scale = Math.max(scale, Math.abs(num));
  }
  assert.ok(err < 1e-7, `gradient error ${err}`);
  assert.ok(errFlip > 1e-3 && scale > 1e-3, `a flipped gradient must be caught (${errFlip})`);
});

test("the optimiser does what the reward pays: the gamed checker raises reward and drops correctness; the fixed checker raises both", () => {
  const evalSet = makePrompts(4242, 128), run = (checker) => {
    const p = checkpointAt(M, 200), g = createGamer(p, checker, { batch: 16, lr: 3e-3, promptSeed: 11, sampleSeed: 21 });
    const before = scorePolicy(p, evalSet);
    for (let s = 0; s < 150; s++) g.step();
    return { before, after: scorePolicy(p, evalSet) };
  };
  const gamed = run("gamed"), fixed = run("fixed");
  assert.ok(gamed.before.correct < 0.45 && fixed.before.correct < 0.45, `the step-200 model is near chance (${gamed.before.correct})`);
  assert.ok(gamed.after.gamed > 0.9 && gamed.after.correct < 0.3, `gamed: reward ${gamed.after.gamed}, correct ${gamed.after.correct}`);
  assert.ok(fixed.after.fixed > 0.8 && fixed.after.correct > 0.8, `fixed: reward ${fixed.after.fixed}, correct ${fixed.after.correct}`);
});

test("pearson correlation: +1, -1, and NaN for a constant series", () => {
  assert.ok(Math.abs(pearson([1, 2, 3], [2, 4, 6]) - 1) < 1e-12);
  assert.ok(Math.abs(pearson([1, 2, 3], [3, 2, 1]) + 1) < 1e-12);
  assert.ok(Number.isNaN(pearson([1, 1, 1], [1, 2, 3])));
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["task", "checkers", "start200", "start2000", "correlation", "speed", "film"]) assert.ok(f[sec].about.length > 60, sec);
  const g = f.start200.gamed, x = f.start200.fixed;
  assert.ok(g.end.gamed.mean > 0.9 && g.end.correct.mean < 0.2, "the gamed checker is fooled");
  assert.ok(x.end.correct.mean > 0.9, "the fixed checker teaches the task");
});
