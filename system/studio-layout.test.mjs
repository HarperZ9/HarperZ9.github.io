import { test } from "node:test";
import assert from "node:assert/strict";
import { readingsOpen, CHECKING_SOURCES } from "./studio-layout.js";

test("the readings fold by default on making sources and stay open where a claim is checked", () => {
  assert.equal(readingsOpen("sketch", null), false);
  assert.equal(readingsOpen("gallery", null), false);
  for (const s of CHECKING_SOURCES) assert.equal(readingsOpen(s, null), true, s);
});
test("the visitor's choice wins on every source", () => {
  assert.equal(readingsOpen("sketch", "open"), true);
  assert.equal(readingsOpen("showcase", "closed"), false);
});
