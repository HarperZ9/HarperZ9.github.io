import test from "node:test";
import assert from "node:assert/strict";
import { detentStep, DETENTS } from "./palpable.js";

test("detents divide the travel into the house fourteen", () => {
  assert.equal(DETENTS, 14);
  assert.equal(detentStep(0, 0, 140, 14), 0);
  assert.equal(detentStep(140, 0, 140, 14), 14);
  assert.equal(detentStep(70, 0, 140, 14), 7);
});

test("detent steps are stable within a notch and move across one", () => {
  const a = detentStep(30, 0, 100, 14);
  const b = detentStep(31, 0, 100, 14);
  const c = detentStep(40, 0, 100, 14);
  assert.equal(a, b, "small wiggle stays in the notch");
  assert.notEqual(a, c, "real travel crosses a notch");
});

test("degenerate ranges do not divide by zero", () => {
  assert.equal(detentStep(5, 5, 5, 14), 0);
  assert.equal(detentStep(0, 10, 0, 14), 0);
});
