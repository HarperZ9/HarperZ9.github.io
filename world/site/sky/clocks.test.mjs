// Fast surface over slow body: two trackers must lock to different timescales, on a planted loop and on the sea.
import test from "node:test";
import assert from "node:assert/strict";
import { periodTracker, smooth, envelope } from "./clocks.mjs";
import { swellWaves, swellHeight, cascadeWaves, G } from "../field/ocean.js";
import { effectiveFetch } from "./weather.mjs";

test("planted loop: a 168 BPM pulse under a 32-bar envelope; the fast tracker finds the beat, the slow one the 32 bars", () => {
  const dt = 0.02, beat = 60 / 168, bars32 = 32 * 4 * beat, x = [];
  for (let t = 0; t < 3 * bars32; t += dt) x.push(Math.exp(-((t % beat) / 0.04)) * (0.25 + 0.75 * Math.sin((Math.PI * (t % bars32)) / bars32) ** 2));
  const fast = periodTracker(x, dt, 0.1, 2), slow = periodTracker(envelope(x, dt, 2), dt, 10, 100);
  assert.ok(Math.abs(fast.period - beat) < 0.03, `fast ${fast.period} s against ${beat}`);
  assert.ok(Math.abs(slow.period - bars32) / bars32 < 0.05, `slow ${slow.period} s against ${bars32}`);
});

test("the sea in a gale: chop and swell lock to timescales at least four times apart", () => {
  const U = 20, sw = swellWaves({ U10: U, fetch: effectiveFetch(U), windAngle: 0 });
  const chop = cascadeWaves({ tile: 5.3, kmin: 1.2, kmax: 40, n: 48, U10: U, fetch: effectiveFetch(U), windAngle: 0, seed: 3 });
  const dt = 0.05, x = [];
  for (let t = 0; t < 180; t += dt) {
    let c = 0; for (let i = 0; i < 48; i++) { const kx = chop[i * 4], kz = chop[i * 4 + 1], k = Math.hypot(kx, kz); c += chop[i * 4 + 2] * Math.cos(-Math.sqrt(G * k) * t + chop[i * 4 + 3]); }
    // the chop is scaled up 40 times so it shows against a 10 m swell; the test is about timescales, not heights
    x.push(swellHeight(sw, 0, 0, t) + c * 40);
  }
  const slowPart = smooth(x, dt, 3), fastPart = x.map((v, i) => v - slowPart[i]);
  const fast = periodTracker(fastPart, dt, 0.1, 4), slow = periodTracker(slowPart, dt, 4, 40);
  assert.ok(slow.period / fast.period >= 4, `slow ${slow.period.toFixed(2)} s, fast ${fast.period.toFixed(2)} s`);
});
