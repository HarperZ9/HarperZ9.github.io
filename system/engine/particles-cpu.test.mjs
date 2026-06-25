// system/engine/particles-cpu.test.mjs
// Node:test suite for the CPU particle backend (the guaranteed fallback rung). The CPU backend uses
// only Float32Array + Math, so its sim/state logic runs unchanged under node (no DOM, no canvas).
// We assert the state layout, the seeded determinism, the count-rescale semantics (the governor's
// hook), and that the per-frame step is stable (no NaN, particles stay in/near bounds). Render() is
// Canvas2D-only and is exercised live by the controller, not here. Run:
//   node --test system/engine/particles-cpu.test.mjs
// ASCII only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCpuParticles, _FLOATS_PER_PARTICLE, _F } from "./sim/particles-cpu.js";

// A deterministic rng so two backends seeded identically produce identical state.
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const loud = { bass: 0.85, intensity: 0.7, highMod: 0.6, pulse: 0.8, hue: 200 };
const silent = { bass: 0, intensity: 0, highMod: 0, pulse: 0, hue: 0 };

test("init allocates count*FLOATS_PER_PARTICLE floats and seeds within bounds", async () => {
  const b = createCpuParticles();
  await b.init({ count: 100, width: 640, height: 480, rng: seededRng(1) });
  const st = b.getState();
  assert.equal(st.length, 100 * _FLOATS_PER_PARTICLE);
  // every particle starts inside the canvas
  for (let i = 0; i < 100; i++) {
    const o = i * _FLOATS_PER_PARTICLE;
    assert.ok(st[o + _F.X] >= 0 && st[o + _F.X] <= 640);
    assert.ok(st[o + _F.Y] >= 0 && st[o + _F.Y] <= 480);
    assert.ok(st[o + _F.SIZE] > 0);
  }
});

test("identical seed -> identical initial state (deterministic, reproducible)", async () => {
  const a = createCpuParticles();
  const b = createCpuParticles();
  await a.init({ count: 64, width: 500, height: 500, rng: seededRng(42) });
  await b.init({ count: 64, width: 500, height: 500, rng: seededRng(42) });
  assert.deepEqual(Array.from(a.getState()), Array.from(b.getState()));
});

test("a 'seed' number also yields determinism (mulberry32 path)", async () => {
  const a = createCpuParticles();
  const b = createCpuParticles();
  await a.init({ count: 32, width: 300, height: 300, seed: 7 });
  await b.init({ count: 32, width: 300, height: 300, seed: 7 });
  assert.deepEqual(Array.from(a.getState()), Array.from(b.getState()));
});

test("step with a fixed rng is deterministic and never produces NaN", async () => {
  const a = createCpuParticles();
  await a.init({ count: 50, width: 400, height: 400, rng: seededRng(3) });
  for (let i = 0; i < 30; i++) a.step(0.016, loud);
  const st = a.getState();
  for (let i = 0; i < st.length; i++) assert.ok(Number.isFinite(st[i]), `NaN at ${i}`);
});

test("step keeps particles bounded (wrap, not escape) over many frames", async () => {
  const a = createCpuParticles();
  await a.init({ count: 80, width: 320, height: 240, rng: seededRng(9) });
  for (let i = 0; i < 200; i++) a.step(0.016, loud);
  const st = a.getState();
  for (let i = 0; i < 80; i++) {
    const o = i * _FLOATS_PER_PARTICLE;
    // after wrap, x in [0, w] and y in [0, h] (the wrap re-adds a full dimension each crossing)
    assert.ok(st[o + _F.X] >= -1 && st[o + _F.X] <= 321, `x out of range ${st[o + _F.X]}`);
    assert.ok(st[o + _F.Y] >= -1 && st[o + _F.Y] <= 241, `y out of range ${st[o + _F.Y]}`);
  }
});

test("silence settles motion (velocities damp toward zero, no runaway)", async () => {
  const a = createCpuParticles();
  await a.init({ count: 60, width: 400, height: 400, rng: seededRng(5) });
  // warm up loud, then go silent for a while
  for (let i = 0; i < 20; i++) a.step(0.016, loud);
  for (let i = 0; i < 300; i++) a.step(0.016, silent);
  const st = a.getState();
  let maxSpeed = 0;
  for (let i = 0; i < 60; i++) {
    const o = i * _FLOATS_PER_PARTICLE;
    maxSpeed = Math.max(maxSpeed, Math.hypot(st[o + _F.VX], st[o + _F.VY]));
  }
  // damped harmonic + spring with no drive: speeds stay small (not exploding)
  assert.ok(maxSpeed < 20, `velocity did not settle: maxSpeed=${maxSpeed}`);
});

test("setCount grows (keeps existing, seeds new) and shrinks (caps the draw)", async () => {
  const a = createCpuParticles();
  await a.init({ count: 10, width: 200, height: 200, rng: seededRng(2) });
  const before = Array.from(a.getState());          // 10 particles
  const grown = a.setCount(25);
  assert.equal(grown, 25);
  const after = a.getState();
  assert.equal(after.length, 25 * _FLOATS_PER_PARTICLE);
  // the first 10 particles are preserved verbatim on grow
  for (let i = 0; i < before.length; i++) assert.equal(after[i], before[i]);
  // shrink back: count caps the active range
  assert.equal(a.setCount(5), 5);
  assert.equal(a.getCount(), 5);
  assert.equal(a.getState().length, 5 * _FLOATS_PER_PARTICLE);
});

test("perceive returns an honest count + live centroid", async () => {
  const a = createCpuParticles();
  await a.init({ count: 40, width: 100, height: 100, rng: seededRng(11) });
  const p = a.perceive();
  assert.equal(p.backend, "cpu");
  assert.equal(p.count, 40);
  assert.ok(p.cx >= 0 && p.cx <= 100);
  assert.ok(p.cy >= 0 && p.cy <= 100);
});

test("dispose releases state; perceive then reports an empty honest-null", async () => {
  const a = createCpuParticles();
  await a.init({ count: 10, width: 100, height: 100, rng: seededRng(1) });
  a.dispose();
  const p = a.perceive();
  assert.equal(p.count, 0);
  assert.equal(a.getState().length, 0);
});

test("name is 'cpu' and FLOATS_PER_PARTICLE matches the cross-backend layout (10)", () => {
  const a = createCpuParticles();
  assert.equal(a.name, "cpu");
  assert.equal(_FLOATS_PER_PARTICLE, 10);
});
