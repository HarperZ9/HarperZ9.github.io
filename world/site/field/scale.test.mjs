// scale.test.mjs: the field's scale ceiling and its governor (field.js), run as plain arithmetic.
import test from "node:test";
import assert from "node:assert/strict";
import { scaleCeiling, scaleGovernor } from "./field.js";

const MID = 2.1e6, run = (g, n, dt, top, native = top) => { let s = 0; for (let i = 0; i < n; i++) s = g.step(dt, top, native); return s; };

test("the ceiling: a mid-range machine draws the screen's own pixels inside the budget", () => {
  assert.equal(scaleCeiling(1366, 768, 1, 1, MID), 1);
  assert.equal(scaleCeiling(1280, 720, 1.25, 1, MID), 1.25, "1600 by 900 is 1.44 million pixels");
  assert.equal(scaleCeiling(1366, 768, 1.25, 1, MID), 1.25, "1708 by 960 is 1.64 million pixels");
  const big = scaleCeiling(1440, 900, 2, 1, MID); assert.ok(big > 1.27 && big < 1.28, `a 2880 by 1800 screen is held to the budget (${big})`);
  assert.ok(Math.abs(1440 * big * 900 * big - MID) < 1, "and the scene there holds the budget's pixel count");
  assert.equal(scaleCeiling(2560, 1440, 1, 1, MID), 1, "the budget never takes the ceiling under dprCap: that step belongs to the frame time");
});
test("the ceiling without a pixel budget is dprCap, as before", () => {
  for (const dpr of [1, 1.25, 2, 3]) assert.equal(scaleCeiling(1366, 768, dpr, 1.5), 1.5);
  assert.equal(scaleCeiling(1366, 768, 1, 2, 8.3e6), 2, "a strong machine may draw above the screen's pixels");
});
test("frames on budget keep the scale at the start", () => {
  const g = scaleGovernor({ budgetMs: 16.7, minScale: 0.6 }); assert.equal(run(g, 2000, 16.7, 1.25), 1.25);
});
test("a strong machine starts at the screen's pixels and goes above them only with a clear margin", () => {
  const at60 = scaleGovernor(); assert.equal(run(at60, 3000, 16.7, 2, 1), 1, "on budget at 60 Hz says nothing about room to spare");
  const at120 = scaleGovernor(); assert.equal(run(at120, 3000, 8.3, 2, 1), 2);
});
test("frames over budget step down in tenths, never under the floor", () => {
  const g = scaleGovernor({ budgetMs: 16.7, minScale: 0.6 }); const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(+g.step(30, 1).toFixed(4));
  assert.equal(g.scale, 0.6); assert.deepEqual([...seen].slice(0, 3), [1, 0.9, 0.81]);
});
test("a renderer that takes a quarter second a frame steps down at once", () => {
  const g = scaleGovernor({ budgetMs: 16.7, minScale: 0.6 }); run(g, 3, 400, 1); assert.equal(g.scale, 0.75); run(g, 6, 400, 1); assert.equal(g.scale, 0.6);
  const one = scaleGovernor(); run(one, 40, 16.7, 1); one.step(900, 1); run(one, 200, 16.7, 1); assert.equal(one.scale, 1, "one long gap (a hidden tab) is not a slow renderer");
});
test("the scale does not flap: a size that fails is held off longer after each failure", () => {
  // a machine that holds 60 frames a second at 0.9 of the screen and misses them at 0.94 and above
  const g = scaleGovernor({ budgetMs: 16.7, minScale: 0.6 }); let changes = 0, prev = null; const at = [];
  for (let i = 0; i < 36000; i++) { const s = g.step((prev ?? 1) > 0.93 ? 24 : 16.7, 1); if (prev !== null && s !== prev) { changes++; at.push(i); } prev = s; }
  // ten minutes of frames: the old rule's shape (down at once, up as soon as frames are short) would change size every second or two
  assert.ok(changes <= 30, `${changes} changes of size in 36000 frames`);
  const gaps = at.slice(1).map((x, i) => x - at[i]).filter((d) => d > 100);
  assert.ok(gaps[gaps.length - 1] >= 3600, `the last tries are a minute apart (${gaps.slice(-3)})`);
  assert.ok(g.scale >= 0.83 && g.scale <= 0.93, `it rests within a step of the largest size the machine carries (${g.scale})`);
});
test("the scale comes back when the load goes", () => {
  const g = scaleGovernor({ budgetMs: 16.7, minScale: 0.6 }); run(g, 400, 30, 1.25); assert.ok(g.scale < 1.05);
  run(g, 8000, 16.7, 1.25); assert.equal(g.scale, 1.25);
});
test("a ceiling that falls takes the scale with it", () => {
  const g = scaleGovernor(); run(g, 10, 16.7, 2, 2); assert.equal(g.step(16.7, 1, 1), 1);
});
