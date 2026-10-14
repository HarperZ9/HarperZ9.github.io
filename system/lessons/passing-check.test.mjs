// "Check the check": the right function passes every test, coverage and catching come apart,
// the rounding break survives everything, and the control exposes a suite that checks nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RIGHT, TESTS, MUTANTS, assess, ROUNDING_CASE } from "./passing-check.mjs";

const ALL = TESTS.map((t) => t.id);

test("the right version passes every test", () => {
  assert.equal(assess(ALL).passes, true);
  assert.equal(RIGHT(30, 5), 130);
  assert.equal(RIGHT(10, 2), 18);
});

test("the test that checks nothing runs every line and catches no break, and fails no control", () => {
  const a = assess(["t4"]);
  assert.equal(a.coverage, 1);
  assert.equal(a.caught, 0);
  assert.equal(a.controlFails, false);
});

test("all four tests catch five of six breaks; the rounding break survives, and it is a real fault", () => {
  const a = assess(ALL);
  assert.equal(a.caught, 5);
  assert.deepEqual(a.mutants.filter((m) => !m.caught).map((m) => m.id), ["m5"]);
  assert.equal(a.controlFails, true);
  assert.equal(ROUNDING_CASE.right, 0.3);
  assert.notEqual(ROUNDING_CASE.mutant, 0.3);
});

test("coverage does not order suites by what they catch", () => {
  const t4 = assess(["t4"]), t2 = assess(["t2"]);
  assert.ok(t4.coverage > t2.coverage);
  assert.ok(t2.caught > t4.caught);
});

test("no tests: nothing runs, nothing is caught, and the page must not call that a pass", () => {
  const a = assess([]);
  assert.equal(a.coverage, 0);
  assert.equal(a.caught, 0);
  assert.equal(a.controlFails, false);
});

test("the studies quoted beside the demo say what the page says", () => {
  const ev = JSON.parse(readFileSync(new URL("../../media/explainers/passing-check/evidence.json", import.meta.url), "utf8")).sources;
  assert.match(JSON.stringify(ev.just2014), /73% of real faults were coupled to generated mutants; 17% were coupled to no mutant/);
  assert.match(JSON.stringify(ev.inozemtseva2014), /low to moderate/);
  assert.equal(MUTANTS.length, 6);
});
