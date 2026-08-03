// system/spatial-core.test.mjs
// Tests for the pure spatial helpers: determinism, boundary, ordering, clock.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seedHash,
  mulberry32,
  veilParams,
  clampCamera,
  drawOrder,
  sceneTime,
  pauseMotion,
  resumeMotion,
  KIND_IDS,
} from "./spatial-core.js";

test("seedHash is deterministic and spreads nearby seeds", () => {
  assert.equal(seedHash("gallery-opening"), seedHash("gallery-opening"));
  assert.notEqual(seedHash("gallery-opening"), seedHash("gallery-opening2"));
  assert.notEqual(seedHash("a"), seedHash("b"));
});

test("mulberry32 replays the same stream per state", () => {
  const a = mulberry32(seedHash("folded-light"));
  const b = mulberry32(seedHash("folded-light"));
  for (let i = 0; i < 8; i += 1) assert.equal(a(), b());
  const c = mulberry32(seedHash("other"));
  assert.notEqual(a(), c());
});

test("veilParams derives one stable parameter set per seed", () => {
  const layers = [
    { name: "deep_veil", depth: 0.95 },
    { name: "near_veil", depth: 0.2 },
  ];
  const first = veilParams("folded-light", layers);
  const again = veilParams("folded-light", layers);
  assert.deepEqual(first, again);
  assert.equal(first.length, 2);
  for (const veil of first) {
    assert.ok(veil.foldFreq >= 14.0 && veil.foldFreq <= 28.0);
    assert.ok(veil.tint.every((channel) => channel > 0 && channel <= 1));
  }
  const other = veilParams("another-seed", layers);
  assert.notDeepEqual(first.map((v) => v.foldFreq), other.map((v) => v.foldFreq));
});

test("clampCamera enforces the declared boundary", () => {
  const boundary = { maxX: 0.045, maxY: 0.03, maxDolly: 0.12 };
  assert.deepEqual(
    clampCamera({ x: 9, y: -9, z: 0.05 }, boundary),
    { x: 0.045, y: -0.03, z: 0.05 },
  );
  assert.deepEqual(
    clampCamera({ x: NaN, y: 0.01, z: -9 }, boundary),
    { x: 0, y: 0.01, z: -0.12 },
  );
});

test("drawOrder is back to front and stable on ties", () => {
  const layers = [
    { name: "near", depth: 0.2 },
    { name: "mid_a", depth: 0.5 },
    { name: "mid_b", depth: 0.5 },
    { name: "deep", depth: 0.9 },
  ];
  assert.deepEqual(drawOrder(layers).map((l) => l.name), ["deep", "mid_a", "mid_b", "near"]);
});

test("the scene clock pauses, resumes, and freezes without jumps", () => {
  let motion = { paused: false, pausedAt: 0, offset: 0, freezeAt: null };
  assert.equal(sceneTime(10, motion), 10);
  motion = pauseMotion(12, motion);
  assert.equal(sceneTime(30, motion), 12);
  motion = resumeMotion(20, motion);
  assert.equal(sceneTime(20, motion), 12);
  assert.equal(sceneTime(25, motion), 17);
  assert.equal(sceneTime(99, { ...motion, freezeAt: 4 }), 4);
});

test("kind ids cover the shared vocabulary contiguously", () => {
  const values = Object.values(KIND_IDS).sort((a, b) => a - b);
  assert.deepEqual(values, [0, 1, 2, 3, 4, 5, 6, 7]);
});
