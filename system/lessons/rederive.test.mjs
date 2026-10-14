// "Run it again": the publishing filter inflates what gets published, a repeat comes back
// smaller, bigger repeats miss fewer real effects, and the 2015 figures match the evidence file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES, OSC, makeField, rerun, summarize, se } from "./rederive.mjs";

test("a field is a pure function of its seed, and everything published cleared the bar", () => {
  assert.deepEqual(makeField(3), makeField(3));
  const f = makeField(3);
  assert.ok(f.published.length > 5);
  for (const s of f.published) assert.ok(s.original / se(RULES.originalN) > RULES.z);
});

test("over 200 fields, repeats come back smaller than the published originals", () => {
  let o = 0, a = 0;
  for (let seed = 1; seed <= 200; seed++) { const s = summarize(rerun(makeField(seed), 80, seed)); o += s.originalMean; a += s.againMean; }
  assert.ok(a / o < 0.75, `repeat over original ${(a / o).toFixed(2)}`);
});

test("bigger repeats bring back more, and small repeats miss real effects", () => {
  let small = 0, big = 0, missedReal = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const f = makeField(seed), s1 = summarize(rerun(f, 25, seed)), s2 = summarize(rerun(f, 400, seed));
    small += s1.back; big += s2.back; missedReal += s1.missedReal;
  }
  assert.ok(big > small * 1.5);
  assert.ok(missedReal > 0);
});

test("the 2015 figures on the page are the evidence file's", () => {
  const ev = JSON.stringify(JSON.parse(readFileSync(new URL("../../media/explainers/rederive/evidence.json", import.meta.url), "utf8")).sources.osc2015);
  assert.match(ev, /97 of 100 original studies reported positive results; 35 of those 97/);
  assert.match(ev, /0\.403/);
  assert.match(ev, /0\.197/);
  assert.deepEqual([OSC.originals, OSC.replicated, OSC.originalMean, OSC.replicationMean], [97, 35, 0.403, 0.197]);
});
