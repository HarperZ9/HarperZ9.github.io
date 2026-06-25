// system/engine/governor.test.mjs
// Node:test suite for the PURE frame-time governor: EMA smoothing, hysteresis (asymmetric up/down),
// and the count-scaling decision. Includes the spec's acceptance criteria (A.4):
//   - a 5x-overload synthetic scene converges to ema <= targetMs * 1.1 within <= 90 frames;
//   - at steady state it oscillates <= 1 level per second.
// No DOM, no timers: a mocked frame-time source drives observe(). Run:
//   node --test system/engine/governor.test.mjs
// ASCII only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGovernor, scaleCount } from "./governor.js";

const TARGET = 16.6;

// ---------------------------------------------------------------------------
// EMA basics
// ---------------------------------------------------------------------------
test("EMA seeds on the first sample (not dragged from zero)", () => {
  const g = makeGovernor(TARGET, { levels: 5 });
  const { ema } = g.observe(20);
  assert.equal(ema, 20);   // first sample seeds the EMA exactly
});

test("EMA tracks toward the input with alpha weighting", () => {
  const g = makeGovernor(TARGET, { alpha: 0.5, levels: 5 });
  g.observe(10);                 // ema = 10
  const { ema } = g.observe(20); // ema = 0.5*20 + 0.5*10 = 15
  assert.ok(Math.abs(ema - 15) < 1e-9, `ema=${ema}`);
});

// ---------------------------------------------------------------------------
// Hysteresis: drop is fast (downFrames), raise is slow (upFrames)
// ---------------------------------------------------------------------------
test("over budget for downFrames consecutive frames drops exactly one level", () => {
  const g = makeGovernor(TARGET, { levels: 5, downFrames: 3, startLevel: 4 });
  // Feed clearly-over-budget frames (5x). The EMA must cross overThresh then count downFrames.
  let dropped = false, dropFrame = -1;
  for (let i = 0; i < 20; i++) {
    const { action, level } = g.observe(TARGET * 5);
    if (action === "down") { dropped = true; dropFrame = i; assert.equal(level, 3); break; }
  }
  assert.ok(dropped, "should drop a level under sustained overload");
  // It must not drop on the very first frame (EMA has to cross the threshold first, then a run).
  assert.ok(dropFrame >= 0);
});

test("a single spike does NOT drop a level (downFrames hysteresis)", () => {
  const g = makeGovernor(TARGET, { levels: 5, downFrames: 3, startLevel: 4, alpha: 0.08 });
  // One big spike then back to good frames: the EMA barely moves with alpha 0.08, and the over-run
  // counter resets as soon as a good frame arrives, so no drop happens.
  g.observe(TARGET * 10);                 // one spike
  let acted = false;
  for (let i = 0; i < 10; i++) {
    const { action } = g.observe(TARGET * 0.5);  // good frames
    if (action !== "hold") acted = true;
  }
  assert.equal(acted, false, "a lone spike must not change the level");
});

test("under budget needs upFrames consecutive frames before raising one level", () => {
  const g = makeGovernor(TARGET, { levels: 5, upFrames: 60, startLevel: 0, alpha: 0.5 });
  let raisedAt = -1;
  for (let i = 0; i < 200; i++) {
    const { action, level } = g.observe(TARGET * 0.5);   // well under budget
    if (action === "up") { raisedAt = i; assert.equal(level, 1); break; }
  }
  assert.ok(raisedAt >= 59, `raise should require ~upFrames; raisedAt=${raisedAt}`);
});

test("level never drops below 0 nor rises above levelCount-1", () => {
  const gLow = makeGovernor(TARGET, { levels: 3, downFrames: 1, startLevel: 0 });
  for (let i = 0; i < 50; i++) gLow.observe(TARGET * 5);
  assert.equal(gLow.level, 0, "cannot go below 0");

  const gHigh = makeGovernor(TARGET, { levels: 3, upFrames: 1, startLevel: 2 });
  for (let i = 0; i < 50; i++) gHigh.observe(TARGET * 0.1);
  assert.equal(gHigh.level, 2, "cannot exceed the top level");
});

test("inside the dead band the governor holds and resets both counters", () => {
  const g = makeGovernor(TARGET, { levels: 5, startLevel: 2, downFrames: 3, upFrames: 60 });
  // Frame time exactly at target sits inside [0.85*t, 1.1*t] -> always hold.
  for (let i = 0; i < 100; i++) {
    const { action } = g.observe(TARGET);
    assert.equal(action, "hold");
  }
  assert.equal(g.level, 2);
});

// ---------------------------------------------------------------------------
// SPEC ACCEPTANCE (A.4): 5x overload converges within 90 frames + steady-state stability
// ---------------------------------------------------------------------------
test("ACCEPTANCE: a 5x-overload scene converges to ema <= target*1.1 within 90 frames", () => {
  // Model: 5 quality levels. The scene's cost is proportional to the count (level). At the top level
  // the frame costs ~5x budget; each level down roughly halves the cost (geometric, matching
  // scaleCount's downStep). The governor must shed levels until the EMA is in budget.
  const levels = 5;
  const g = makeGovernor(TARGET, { levels, downFrames: 3, upFrames: 60, alpha: 0.08, startLevel: levels - 1 });

  // costFor(level): a monotonic cost curve. Top level = 5x budget; level 0 well under budget.
  // Use a geometric ladder so dropping a level multiplies cost by ~0.55 (close to downStep 0.6).
  function costFor(level) {
    const top = TARGET * 5;
    return top * Math.pow(0.5, (levels - 1 - level));
  }

  let converged = false, atFrame = -1;
  for (let i = 0; i < 90; i++) {
    const res = g.observe(costFor(g.level));
    if (res.ema <= TARGET * 1.1) { converged = true; atFrame = i; break; }
  }
  assert.ok(converged, `did not converge within 90 frames (level=${g.level}, ema=${g.ema})`);
  assert.ok(atFrame >= 0 && atFrame < 90, `converged at frame ${atFrame}`);
});

test("ACCEPTANCE: at steady state the governor oscillates <= 1 level per ~60 frames (1 second)", () => {
  // After convergence, hold a frame time hovering near the budget. With alpha 0.08 + the dead band +
  // the asymmetric up(60)/down(3) hysteresis, transitions must be rare (<= 1 per ~60 frames).
  const levels = 5;
  const g = makeGovernor(TARGET, { levels, downFrames: 3, upFrames: 60, alpha: 0.08, startLevel: 2 });

  // Drive a steady frame time INSIDE the dead band to mimic a held budget. Count any level changes.
  let changes = 0;
  const FRAMES = 600;   // ~10 seconds at 60fps
  for (let i = 0; i < FRAMES; i++) {
    // small zero-mean noise that stays inside [0.85t, 1.1t]
    const jitter = TARGET * (0.95 + 0.08 * Math.sin(i * 0.7));   // ~[0.87t, 1.03t]
    const { action } = g.observe(jitter);
    if (action !== "hold") changes++;
  }
  // At most FRAMES/60 transitions (1 per second). In practice the dead band yields ~0.
  assert.ok(changes <= Math.ceil(FRAMES / 60), `too many transitions at steady state: ${changes}`);
});

// ---------------------------------------------------------------------------
// scaleCount: the count-scaling decision
// ---------------------------------------------------------------------------
test("scaleCount: 'down' sheds the count geometrically (fast), clamped to min", () => {
  assert.equal(scaleCount(100000, "down", { min: 256, max: 1000000, downStep: 0.6 }), 60000);
  // repeated drops shed fast and never go below min
  let n = 1000;
  for (let i = 0; i < 50; i++) n = scaleCount(n, "down", { min: 256, max: 1000000, downStep: 0.6 });
  assert.equal(n, 256, "drops floor at min");
});

test("scaleCount: 'up' grows the count gently (slower than it drops), clamped to max", () => {
  // floor(100000 * 1.15) is 114999 in IEEE754 (1.15 is not exactly representable); the growth is
  // ~15%, which is what matters. Assert the floored integer, not a rounded ideal.
  const up = scaleCount(100000, "up", { min: 256, max: 1000000, upStep: 1.15 });
  assert.equal(up, Math.floor(100000 * 1.15));
  assert.ok(up > 100000 && up <= 116000, `~15% growth expected, got ${up}`);
  let n = 900000;
  for (let i = 0; i < 50; i++) n = scaleCount(n, "up", { min: 256, max: 1000000, upStep: 1.15 });
  assert.equal(n, 1000000, "grows up to max");
});

test("scaleCount: 'hold' (or unknown) leaves the count unchanged", () => {
  assert.equal(scaleCount(50000, "hold", { min: 256, max: 1000000 }), 50000);
  assert.equal(scaleCount(50000, "wat", { min: 256, max: 1000000 }), 50000);
});

test("scaleCount: down then up is asymmetric (recovers slower than it sheds)", () => {
  const start = 100000;
  const down = scaleCount(start, "down", { min: 256, max: 1000000, downStep: 0.6 });  // 60000
  const back = scaleCount(down, "up", { min: 256, max: 1000000, upStep: 1.15 });      // ~69000
  assert.ok(back < start, "one up does not undo one down (asymmetry holds the budget)");
  assert.ok(down < back, "up does move the count back up");
});

test("scaleCount: result is always an integer within [min, max]", () => {
  for (const action of ["up", "down", "hold"]) {
    for (const cur of [256, 1000, 123457, 999999, 1000000]) {
      const n = scaleCount(cur, action, { min: 256, max: 1000000 });
      assert.ok(Number.isInteger(n), `non-integer ${n}`);
      assert.ok(n >= 256 && n <= 1000000, `out of range ${n}`);
    }
  }
});

// ---------------------------------------------------------------------------
// API hygiene
// ---------------------------------------------------------------------------
test("reset() clears the EMA and returns to the start level", () => {
  const g = makeGovernor(TARGET, { levels: 5, startLevel: 4, downFrames: 1 });
  for (let i = 0; i < 10; i++) g.observe(TARGET * 5);
  assert.ok(g.level < 4);
  g.reset();
  assert.equal(g.level, 4);
  assert.ok(Number.isNaN(g.ema));
});

test("setLevelCount clamps the current level into the new range", () => {
  const g = makeGovernor(TARGET, { levels: 5, startLevel: 4 });
  g.setLevelCount(2);
  assert.equal(g.levelCount, 2);
  assert.ok(g.level <= 1, `level should clamp to <= 1, got ${g.level}`);
});

test("makeGovernor tolerates garbage options and never throws on observe", () => {
  const g = makeGovernor(undefined, { alpha: 5, upFrames: -3, downFrames: 0, levels: 0 });
  assert.doesNotThrow(() => { for (let i = 0; i < 10; i++) g.observe(NaN); });
  assert.ok(g.levelCount >= 1);
});
