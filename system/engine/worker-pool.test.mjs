// system/engine/worker-pool.test.mjs
// Node:test suite for the PURE worker-pool gating helpers (canOffscreen, workerPoolSize). The actual
// worker spawn + OffscreenCanvas transfer is browser-only and exercised live by the controller; here
// we test the capability-record gate that decides whether the off-main-thread path is taken at all,
// which is the load-bearing graceful-degradation decision. Run:
//   node --test system/engine/worker-pool.test.mjs
// ASCII only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { canOffscreen, workerPoolSize } from "./worker-pool.js";

test("canOffscreen: true only when BOTH workers and OffscreenCanvas are present", () => {
  assert.equal(canOffscreen({ workers: true, offscreenCanvas: true }), true);
  assert.equal(canOffscreen({ workers: true, offscreenCanvas: false }), false);
  assert.equal(canOffscreen({ workers: false, offscreenCanvas: true }), false);
  assert.equal(canOffscreen({ workers: false, offscreenCanvas: false }), false);
});

test("canOffscreen: a capability record with explicit false fields is honored (no live probe)", () => {
  // Even though node has no OffscreenCanvas, an explicit record drives the decision deterministically.
  assert.equal(canOffscreen({ workers: true, offscreenCanvas: true }), true);
});

test("canOffscreen under node (no record) falls to a live check and is false (graceful floor)", () => {
  // node has neither Worker (in this test runner context) nor OffscreenCanvas, so the live fallback
  // must report false, which forces the main-thread path. This proves the degradation gate.
  const live = canOffscreen();
  assert.equal(typeof live, "boolean");
  assert.equal(live, false);
});

test("workerPoolSize: min(cores-1, 4) floored at 1 (hardwareConcurrency sizes the pool ONLY)", () => {
  assert.equal(workerPoolSize({ cores: 32 }), 4);
  assert.equal(workerPoolSize({ cores: 8 }), 4);
  assert.equal(workerPoolSize({ cores: 5 }), 4);
  assert.equal(workerPoolSize({ cores: 4 }), 3);
  assert.equal(workerPoolSize({ cores: 3 }), 2);
  assert.equal(workerPoolSize({ cores: 2 }), 1);
  assert.equal(workerPoolSize({ cores: 1 }), 1);
  assert.equal(workerPoolSize({ cores: 0 }), 1);
});
