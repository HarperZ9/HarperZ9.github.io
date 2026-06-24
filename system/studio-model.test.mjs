// studio-model.test.mjs — node tests for the pure studio-model helpers.
// Verifies: buildModelHeaders omits Authorization when keyless; adds it when key is present.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModelHeaders } from "./studio-model.js";

test("buildModelHeaders always includes Content-Type", () => {
  const h = buildModelHeaders("");
  assert.equal(h["Content-Type"], "application/json");
});

test("buildModelHeaders with empty key has NO Authorization header", () => {
  const h = buildModelHeaders("");
  assert.ok(!("Authorization" in h), "Authorization must be absent for empty key");
});

test("buildModelHeaders with null key has NO Authorization header", () => {
  const h = buildModelHeaders(null);
  assert.ok(!("Authorization" in h), "Authorization must be absent for null key");
});

test("buildModelHeaders with undefined key has NO Authorization header", () => {
  const h = buildModelHeaders(undefined);
  assert.ok(!("Authorization" in h), "Authorization must be absent for undefined key");
});

test("buildModelHeaders with a non-empty key includes Authorization: Bearer <key>", () => {
  const h = buildModelHeaders("sk-test-abc123");
  assert.equal(h["Authorization"], "Bearer sk-test-abc123");
});

test("buildModelHeaders with key does not mutate between calls", () => {
  const h1 = buildModelHeaders("key-one");
  const h2 = buildModelHeaders("key-two");
  assert.equal(h1["Authorization"], "Bearer key-one");
  assert.equal(h2["Authorization"], "Bearer key-two");
});

test("buildModelHeaders returns a plain object (not a Headers instance)", () => {
  const h = buildModelHeaders("any-key");
  assert.ok(typeof h === "object" && h !== null && !(h instanceof Headers));
});
