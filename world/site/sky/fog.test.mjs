import test from "node:test";
import assert from "node:assert/strict";
import { advect, singleScatterAnalytic, singleScatterMarch } from "./fog.mjs";

test("sea mist: carrying the field downwind for 200 steps keeps its mass within 0.1 percent", () => {
  const n = 64; let g = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g[y * n + x] = Math.max(0, Math.sin(x * 0.3) * Math.cos(y * 0.2) + 0.4 * Math.sin((x + y) * 0.11));
  const m0 = g.reduce((a, b) => a + b);
  for (let i = 0; i < 200; i++) g = advect(g, n, 0.37, 0.11, 1);
  const m1 = g.reduce((a, b) => a + b);
  assert.ok(Math.abs(m1 - m0) / m0 < 1e-3, `mass ${m0} to ${m1}`);
});

test("long-range fog: the field's closed form for single scattering matches a direct march within 0.1 percent", () => {
  for (const [bt, d] of [[0.5, 1], [2, 3], [6.5, 0.4]]) {
    const a = singleScatterAnalytic(1, 0.08, bt * 0.9, bt, d), m = singleScatterMarch(1, 0.08, bt * 0.9, bt, d);
    assert.ok(Math.abs(a - m) / a < 1e-3, `beta ${bt}, d ${d}: ${a} against ${m}`);
  }
});

test("planted wrong case: forgetting the 1 / beta_t of the closed form is caught", () => {
  const a = 0.08 * 0.9 * 2 * (1 - Math.exp(-2 * 3)), m = singleScatterMarch(1, 0.08, 1.8, 2, 3);
  assert.ok(Math.abs(a - m) / m > 0.5);
});
