// system/engine/governor.js
// Stage 1 of the Telos scalable engine: the frame-time GOVERNOR.
// Zero external dependencies. Pure ES module, fully node-testable. ASCII only (no em-dashes).
//
// The governor holds a frame budget (~16.6 ms for 60 fps) by scaling quality up and down based on an
// exponential moving average (EMA) of measured frame time, with hysteresis so it does not oscillate.
//
// Why EMA + hysteresis (SPEC-telos-scalable-engine.md, web-verified 2026-06-25):
//  - rAF gives a timestamp, not GPU cost; the reliable signal is the wall-clock delta between
//    callbacks (WebGPU timestamp-query is optional and often absent on mobile) (moderate->high).
//  - Smooth with an EMA (ALPHA 0.05..0.1; the spec settles on 0.08).
//  - Reduce quality after a few consecutive overages (ignore single spikes); raise only after many
//    consecutive under-budget frames (a common heuristic is ~60 up, ~3 down) to stop oscillation.
//  - Quality levels are applied most-impactful-first: particle count -> sim steps -> resolution
//    (DRS) -> post passes. This ordering is the DRS best-practice finding (Unreal / Martin Fuller).
//
// The governor is the reason the tier guess (capability.js) does not have to be perfect: a machine
// that auto-selected a tier it cannot hold is pulled down to a stable level within ~1 second, and a
// sandbagged tier climbs up.

// makeGovernor(targetMs, opts) -> governor
//   targetMs : the per-frame budget in ms (default 16.6 for ~60 fps).
//   opts:
//     alpha       EMA smoothing factor (default 0.08).
//     upFrames    consecutive under-budget frames required before raising a level (default 60).
//     downFrames  consecutive over-budget frames required before dropping a level (default 3).
//     levels      number of quality levels (default 1; set via setLevelCount or the ctor).
//     overBudget  multiplier on targetMs above which a frame is "over" (default 1.1).
//     underBudget multiplier on targetMs below which a frame is "under" (default 0.85).
//     startLevel  initial level index (default levels-1, i.e. the most-impactful / highest quality).
//
// governor API:
//   observe(frameMs) -> { level, action, ema }
//       action is "up" | "down" | "hold". level is the current 0-based quality index AFTER the
//       decision. Level 0 is the LOWEST quality (smallest), level (count-1) is the HIGHEST.
//   level         the current quality index (getter-style property, kept in sync).
//   ema           the current EMA of frame time (NaN until the first observe).
//   reset()       clear EMA + counters back to the start level.
//   setLevelCount(n)  re-declare how many quality levels exist (clamps the current level).
//
// Level semantics: a module supplies an ORDERED list of quality levels (most-impactful-first per the
// DRS ordering). The governor returns an index into that list. The module maps the index to concrete
// settings (particle count, sim steps, resolution, post passes). The governor itself is unitless.

export function makeGovernor(targetMs, opts) {
  const o = opts || {};
  const target = posOr(targetMs, 16.6);
  const alpha = clamp01(numOr(o.alpha, 0.08));
  const upFrames = Math.max(1, Math.floor(numOr(o.upFrames, 60)));
  const downFrames = Math.max(1, Math.floor(numOr(o.downFrames, 3)));
  const overMul = posOr(o.overBudget, 1.1);
  const underMul = posOr(o.underBudget, 0.85);

  let levelCount = Math.max(1, Math.floor(numOr(o.levels, 1)));
  const overThresh = target * overMul;
  const underThresh = target * underMul;

  // Level index in [0, levelCount-1]; default to the highest quality (most-impactful) unless told.
  let level = clampInt(numOr(o.startLevel, levelCount - 1), 0, levelCount - 1);

  let ema = NaN;
  let overRun = 0;   // consecutive over-budget frames
  let underRun = 0;  // consecutive under-budget frames

  const gov = {
    get level() { return level; },
    get ema() { return ema; },
    get levelCount() { return levelCount; },
    get target() { return target; },

    observe(frameMs) {
      const raw = posOr(frameMs, target);
      // EMA update. Seed on the first sample so the average is not dragged from a stale 0.
      ema = Number.isFinite(ema) ? (alpha * raw + (1 - alpha) * ema) : raw;

      // The hysteresis counters track consecutive RAW over/under-budget frames. Counting the raw
      // signal (not the EMA) is what genuinely rejects a single spike: one lone over-budget frame
      // surrounded by good frames never reaches downFrames, no matter how large the spike was or how
      // long it lingers in the slow EMA. The EMA is the smoothed gate on WHETHER the sustained cost
      // is out of budget; the raw run is the spike-rejecting confirmation.
      const rawOver = raw > overThresh;
      const rawUnder = raw < underThresh;

      if (rawOver) { overRun++; underRun = 0; }
      else if (rawUnder) { underRun++; overRun = 0; }
      else { overRun = 0; underRun = 0; }   // a frame inside the dead band breaks any run

      let action = "hold";

      // Drop one level when the smoothed cost is over budget AND a run of raw-over frames confirms it
      // (ignore single spikes). Cannot drop below 0 (the lowest quality the module declared).
      if (ema > overThresh && overRun >= downFrames && level > 0) {
        level--;
        action = "down";
        overRun = 0;   // require a fresh run before the next drop (one level per run, no cascade)
      } else if (ema < underThresh && underRun >= upFrames && level < levelCount - 1) {
        // Raise one level only after a long stable run under budget, and never above the top level.
        level++;
        action = "up";
        underRun = 0;
      }

      return { level, action, ema };
    },

    setLevelCount(n) {
      levelCount = Math.max(1, Math.floor(numOr(n, 1)));
      level = clampInt(level, 0, levelCount - 1);
      return levelCount;
    },

    reset() {
      ema = NaN;
      overRun = 0;
      underRun = 0;
      level = clampInt(numOr(o.startLevel, levelCount - 1), 0, levelCount - 1);
    },
  };

  return gov;
}

// ---------------------------------------------------------------------------
// PURE: count-scaling decision (the heart of the unit test)
// ---------------------------------------------------------------------------

// scaleCount(currentCount, action, { min, max, step }) -> nextCount
// Maps a governor action to a concrete particle-count change, most-impactful-first. "down" multiplies
// the count down (geometric, so heavy overload sheds fast); "up" nudges it back up gently (a small
// geometric step, so it climbs slower than it drops, matching the asymmetric up/down hysteresis).
// Clamped to [min, max] and floored to an integer. Pure; the engine calls this with the module's
// declared budget bounds.
export function scaleCount(currentCount, action, opts) {
  const o = opts || {};
  const min = Math.max(1, Math.floor(numOr(o.min, 256)));
  const max = Math.max(min, Math.floor(numOr(o.max, 1000000)));
  const downStep = clamp01range(numOr(o.downStep, 0.6), 0.1, 0.95);  // shed to 60% on a drop
  const upStep = posOr(o.upStep, 1.15);                              // grow by 15% on a raise
  const cur = clampInt(numOr(currentCount, min), min, max);

  let next = cur;
  if (action === "down") next = Math.floor(cur * downStep);
  else if (action === "up") next = Math.floor(cur * upStep);
  return clampInt(next, min, max);
}

// ---------------------------------------------------------------------------
// small numeric helpers (kept local so this file has no imports)
// ---------------------------------------------------------------------------

function numOr(v, d) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}
function posOr(v, d) {
  const n = numOr(v, d);
  return n > 0 ? n : d;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function clamp01range(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function clampInt(v, lo, hi) {
  const n = Math.floor(numOr(v, lo));
  return n < lo ? lo : n > hi ? hi : n;
}

export default { makeGovernor, scaleCount };
