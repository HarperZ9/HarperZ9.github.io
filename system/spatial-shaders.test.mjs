// spatial-shaders.test.mjs: the point-sprite size ceiling and the energy-preserving
// clamp in the two point lanes.
//
// S9 of the visual-engine audit: both point lanes clamped gl_PointSize to a floor of
// 1.0 without touching alpha. A point sprite cannot be drawn smaller than a pixel, so
// a splat that earned a quarter of a pixel was handed four times the area at unchanged
// peak alpha. Distant material read too dense, and every splat crossing the threshold
// under camera motion popped. Neither lane checked its hard-coded ceiling against the
// driver's ALIASED_POINT_SIZE_RANGE either, so a capped driver silently shrank the
// near field with nothing reported.

import { test } from "node:test";
import assert from "node:assert/strict";
import { maxPointSize, POINT_VS } from "./spatial-shaders.js";
import { CC_POINT_VS } from "./spatial-textured-shaders.js";

// A stand-in for a WebGL context that reports a point-size range.
function ctx(range) {
  return {
    ALIASED_POINT_SIZE_RANGE: 0x846d,
    getParameter(p) {
      if (p !== 0x846d) throw new Error("unexpected parameter");
      if (range === "throw") throw new Error("context lost");
      return range;
    },
  };
}

test("the driver's ceiling wins when it is lower than the lane's", () => {
  assert.equal(maxPointSize(ctx([1, 32]), 64), 32);
  assert.equal(maxPointSize(ctx([1, 16]), 42), 16);
});

test("the lane's ceiling wins when the driver allows more", () => {
  assert.equal(maxPointSize(ctx([1, 1024]), 64), 64);
  assert.equal(maxPointSize(ctx([1, 255]), 42), 42);
});

test("a missing or nonsense range falls back to the lane's ceiling, never to zero", () => {
  // A zero ceiling would collapse every sprite to nothing — fail open, not dark.
  for (const bad of [null, undefined, [1, 0], [1, NaN], [1, Infinity], "throw"]) {
    assert.equal(maxPointSize(ctx(bad), 64), 64, `range ${JSON.stringify(bad)} must fall back`);
  }
});

test("the range is queried once per context and cached", () => {
  let calls = 0;
  const counting = { ALIASED_POINT_SIZE_RANGE: 0x846d, getParameter() { calls += 1; return [1, 48]; } };
  for (let i = 0; i < 5; i += 1) maxPointSize(counting, 64);
  assert.equal(calls, 1, "the parameter must not be re-queried every frame");
});

test("both point lanes take their ceiling from the uniform, not a constant", () => {
  for (const [lane, src] of [["dust/beam", POINT_VS], ["crystal city", CC_POINT_VS]]) {
    assert.ok(src.includes("uMaxPoint"), `${lane}: declares and uses uMaxPoint`);
    assert.ok(!/clamp\([^)]*,\s*1\.0\s*,\s*(64|42)\.0\s*\)/.test(src),
      `${lane}: the hard-coded point-size ceiling is gone`);
  }
});

test("both point lanes scale alpha by the clamped area ratio", () => {
  // Losing this is a silent regression: the render still works, distant material
  // just goes back to being too bright and shimmering under motion.
  for (const [lane, src] of [["dust/beam", POINT_VS], ["crystal city", CC_POINT_VS]]) {
    assert.ok(/areaRatio\s*=\s*min\(1\.0,/.test(src), `${lane}: area ratio is capped at 1`);
    assert.ok(src.includes("areaRatio"), `${lane}: computes an area ratio`);
    // It must actually reach alpha, not just be computed and dropped.
    assert.ok(/vAlpha\s*=[^;]*areaRatio/.test(src), `${lane}: the ratio is applied to vAlpha`);
  }
});

test("the area ratio is the inverse square of the size inflation", () => {
  // Reproduce the shader's arithmetic: energy is alpha x area, and area goes as
  // size squared, so a sprite inflated from `want` to `size` must lose (want/size)^2.
  const ratio = (want, ceiling = 64) => {
    const size = Math.min(Math.max(want, 1.0), ceiling);
    return Math.min(1, (want / size) ** 2);
  };
  assert.equal(ratio(4.0), 1, "a sprite above the floor is untouched");
  assert.equal(ratio(1.0), 1, "a sprite exactly at the floor is untouched");
  assert.ok(Math.abs(ratio(0.5) - 0.25) < 1e-9, "half a pixel keeps a quarter of the energy");
  assert.ok(Math.abs(ratio(0.25) - 0.0625) < 1e-9, "a quarter pixel keeps a sixteenth");
  assert.equal(ratio(0), 0, "a zero-size sprite contributes nothing");
  // Above the ceiling alpha is NOT raised: it is already the most a sprite can carry.
  assert.equal(ratio(200, 64), 1, "the upper clamp must not push alpha past 1");
});
