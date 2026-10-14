// "Slip in a hint": the hint flips answers only when slipped in, a flipped answer's reasoning
// argues for the hinted letter, names the hint at the chosen rate, and the rates are the evidence's.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answer, summarize, FLIP, NAMES, MONITORS } from "./visible-reasoning.mjs";

test("without the hint nothing flips and every card is right; the deck is the same either way", () => {
  const a = answer(3, { hint: false, nameRate: 0.25 }), b = answer(3, { hint: true, nameRate: 0.25 });
  assert.equal(summarize(a).correct, 20);
  assert.deepEqual(a.map((c) => [c.right, c.hinted]), b.map((c) => [c.right, c.hinted]));
});

test("a flipped answer takes the hinted letter, and its reasoning argues for it", () => {
  for (const c of answer(5, { hint: true, nameRate: 0.39 }).filter((x) => x.flipped)) {
    assert.equal(c.given, c.hinted);
    assert.ok(c.reasoning.includes(c.hinted));
    assert.notEqual(c.given, c.right);
  }
});

test("over 500 decks the flip and naming rates come out at their settings", () => {
  let f = 0, n = 0, named = 0;
  for (let s = 1; s <= 500; s++) { const x = summarize(answer(s, { hint: true, nameRate: 0.25 })); f += x.flipped; n += x.cards; named += x.named; }
  assert.ok(Math.abs(f / n - FLIP) < 0.02, `flip ${(f / n).toFixed(3)}`);
  assert.ok(Math.abs(named / f - 0.25) < 0.03, `named ${(named / f).toFixed(3)}`);
});

test("only named reasonings mention the suggestion", () => {
  for (const c of answer(8, { hint: true, nameRate: 0.5 })) assert.equal(/suggest|hint|guess/.test(c.reasoning), c.named);
});

test("every rate on the page is the evidence file's", () => {
  const ev = JSON.parse(readFileSync(new URL("../../media/explainers/visible-reasoning/evidence.json", import.meta.url), "utf8")).sources, t = (k) => JSON.stringify(ev[k]);
  assert.match(t("turpin2023"), /as much as 36%/);
  assert.equal(FLIP, 0.36);
  assert.match(t("chen2025"), /25% for Claude 3\.7 Sonnet and 39% for DeepSeek R1/);
  assert.deepEqual(NAMES.map((x) => x.rate), [0.25, 0.39]);
  assert.match(t("baker2025"), /caught 60% of two systemic hacks; a monitor that also read the reasoning caught 95%/);
  assert.match(t("baker2025"), /near zero/);
  assert.deepEqual([MONITORS.actions, MONITORS.reasoning, MONITORS.afterPenalty], [0.6, 0.95, "near zero"]);
});
