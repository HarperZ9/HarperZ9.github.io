import test from "node:test";
import assert from "node:assert/strict";
import { idlePath, delayEmbed, pathToStereo } from "./scope-voice.js";

test("idle path is deterministic, bounded, and closed-loop sized", () => {
  const a = idlePath("beam", 2.5, 0.5, 0.5, 0.5);
  const b = idlePath("beam", 2.5, 0.5, 0.5, 0.5);
  assert.deepEqual(Array.from(a.slice(0, 8)), Array.from(b.slice(0, 8)));
  assert.ok(a.length >= 256 && a.length % 2 === 0);
  for (const v of a) assert.ok(v >= -1 && v <= 1);
  const c = idlePath("other-seed", 2.5, 0.5, 0.5, 0.5);
  assert.notDeepEqual(Array.from(a.slice(0, 8)), Array.from(c.slice(0, 8)), "seed changes the figure");
});

test("delay embedding yields the documented pair count and bounds", () => {
  const mono = new Float32Array(512).map((_, i) => Math.sin(i * 0.1));
  const pts = delayEmbed(mono, 32, 1);
  assert.equal(pts.length, 2 * Math.floor((512 - 32) / 1));
  for (const v of pts) assert.ok(v >= -1 && v <= 1);
});

test("a square path becomes loopable stereo within range at constant speed", () => {
  const square = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]);
  const { left, right } = pathToStereo(square, 48000, 0.05);
  assert.equal(left.length, right.length);
  assert.equal(left.length, Math.round(48000 * 0.05));
  for (let i = 0; i < left.length; i++) {
    assert.ok(left[i] >= -1 && left[i] <= 1);
    assert.ok(right[i] >= -1 && right[i] <= 1);
  }
  const dEnd = Math.hypot(left[left.length - 1] - left[0], right[right.length - 1] - right[0]);
  assert.ok(dEnd < 0.1, "the loop closes: last sample lands near the first");
  const step = (i) => Math.hypot(left[i + 1] - left[i], right[i + 1] - right[i]);
  const mid = step(100), late = step(1800);
  assert.ok(Math.abs(mid - late) < mid * 0.5 + 1e-4, "speed stays near constant along the path");
});

test("a circle path puts quadrature sine and cosine on the two channels", () => {
  const N = 256, pts = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    pts[i * 2] = Math.cos((i / N) * Math.PI * 2) * 0.8;
    pts[i * 2 + 1] = Math.sin((i / N) * Math.PI * 2) * 0.8;
  }
  const { left, right } = pathToStereo(pts, 8000, 0.032);
  let dot = 0;
  for (let i = 0; i < left.length; i++) dot += left[i] * right[i];
  assert.ok(Math.abs(dot / left.length) < 0.05, "X and Y stay near orthogonal for a circle");
});
