// "What gets paid": the optimizer ends up doing what the checker pays for, reward and solved
// tasks come apart when a shortcut pays, and the moves are the ones the evidence file names.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { train, summarize, windows, reward, MOVES } from "./incentives.mjs";

const OPEN = { exitPasses: true, skipPasses: true }, SHUT = { exitPasses: false, skipPasses: false };

test("training is a pure function of the checker and the seed", () => {
  assert.deepEqual(train(OPEN, 4), train(OPEN, 4));
});

test("when a shortcut pays, it takes over, and reward stops meaning solved (over 50 seeds)", () => {
  let short = 0, gap = 0;
  for (let seed = 1; seed <= 50; seed++) { const s = summarize(train(OPEN, seed)); short += (s.exit + s.skip) / s.last; gap += (s.reward - s.solved) / s.last; }
  assert.ok(short / 50 > 0.9, `shortcut share ${(short / 50).toFixed(2)}`);
  assert.ok(gap / 50 > 0.8);
});

test("when the checker pays only for the property, the fix takes over and reward tracks solved", () => {
  let solve = 0;
  for (let seed = 1; seed <= 50; seed++) { const s = summarize(train(SHUT, seed)); solve += s.solve / s.last; assert.equal(s.reward, s.solved); }
  assert.ok(solve / 50 > 0.9);
});

test("closing one shortcut moves the optimizer to the other one that still pays", () => {
  const s = summarize(train({ exitPasses: false, skipPasses: true }, 9));
  assert.ok(s.skip > 80, JSON.stringify(s));
});

test("rewards and windows are what the page says", () => {
  assert.equal(reward("exit", false, OPEN), 1);
  assert.equal(reward("exit", false, SHUT), 0);
  assert.equal(reward("solve", false, OPEN), 0);
  const w = windows(train(OPEN, 2));
  assert.equal(w.length, 10);
  for (const x of w) assert.ok(Math.abs(x.share.solve + x.share.exit + x.share.skip - 1) < 1e-9);
});

test("the two shortcuts are the ones the evidence file names", () => {
  const ev = JSON.stringify(JSON.parse(readFileSync(new URL("../../media/explainers/incentives/evidence.json", import.meta.url), "utf8")).sources.baker2025);
  assert.match(ev, /exit\(0\) before the tests ran and raise SkipTest/);
  assert.deepEqual(MOVES.map((m) => m.id), ["solve", "exit", "skip"]);
});
