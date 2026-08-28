import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeTime, smoothMu } from "./fractal.js";

test("a point deep in the main cardioid never escapes", () => {
  const r = escapeTime(-0.5, 0.0, 200);
  assert.equal(r.n, 200);                       // interior: hits maxIter
});
test("a point well outside escapes quickly and smoothing is finite & monotone-ish", () => {
  const a = escapeTime(2.0, 2.0, 200);
  assert.ok(a.n < 5, "far point escapes fast");
  const mu = smoothMu(a.n, a.zr, a.zi);
  assert.ok(Number.isFinite(mu) && mu >= a.n - 1 && mu <= a.n + 1, "mu refines n by <1");
});
test("the period-2 bulb point (-1,0) stays bounded", () => {
  assert.equal(escapeTime(-1.0, 0.0, 100).n, 100);
});
