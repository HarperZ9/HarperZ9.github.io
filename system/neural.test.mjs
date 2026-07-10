// Contracts for the seed-authored neural instruments: the seed fully
// determines the network (reproducible art), different seeds give different
// networks, the CPPN stays in gamut, and the neural SDF is a bounded,
// sign-changing, renderable field.
import test from "node:test";
import assert from "node:assert/strict";
import {
  neuralSeed, buildMlp, mlpForward, buildCppn, buildNeuralSdf,
} from "./neural.js";

test("neuralSeed is a stable u32 hash", () => {
  assert.equal(neuralSeed("first-light"), neuralSeed("first-light"));
  assert.notEqual(neuralSeed("a"), neuralSeed("b"));
  const h = neuralSeed("x");
  assert.ok(h >= 0 && h <= 0xffffffff && Number.isInteger(h));
});

test("buildMlp shapes weights and biases per layer, deterministically", () => {
  const s = neuralSeed("mlp");
  const a = buildMlp(s, [3, 5, 2]);
  const b = buildMlp(s, [3, 5, 2]);
  assert.equal(a.W.length, 2);
  assert.equal(a.W[0].length, 5 * 3);
  assert.equal(a.W[1].length, 2 * 5);
  assert.equal(a.B[0].length, 5);
  assert.equal(a.acts.length, 1, "one hidden layer -> one activation");
  assert.deepEqual([...a.W[0]], [...b.W[0]], "same seed -> same weights");
  const c = buildMlp(neuralSeed("other"), [3, 5, 2]);
  assert.notDeepEqual([...a.W[0]], [...c.W[0]], "different seed -> different weights");
});

test("mlpForward produces finite output of the right shape", () => {
  const mlp = buildMlp(neuralSeed("fwd"), [4, 8, 8, 3]);
  const out = mlpForward(mlp, [0.2, -0.5, 0.9, 1]);
  assert.equal(out.length, 3);
  assert.ok(out.every((v) => Number.isFinite(v)), "no NaN/Inf");
  assert.deepEqual(out, mlpForward(mlp, [0.2, -0.5, 0.9, 1]), "deterministic");
});

test("CPPN evaluates in gamut, varies over space, and reproduces per seed", () => {
  const net = buildCppn(neuralSeed("cppn-a"));
  const samples = [];
  for (let i = 0; i < 40; i += 1) {
    const nx = (i / 40) * 2 - 1;
    const c = net.eval(nx, Math.sin(nx));
    assert.equal(c.length, 3);
    for (const ch of c) assert.ok(ch >= 0 && ch <= 1, "channel out of [0,1]: " + ch);
    samples.push(c.join(","));
  }
  assert.ok(new Set(samples).size > 10, "the field must vary across space, not be flat");
  const net2 = buildCppn(neuralSeed("cppn-a"));
  assert.deepEqual(net.eval(0.3, -0.4), net2.eval(0.3, -0.4), "same seed reproduces the field");
  const other = buildCppn(neuralSeed("cppn-b"));
  assert.notDeepEqual(net.eval(0.3, -0.4), other.eval(0.3, -0.4), "a new seed is a new field");
});

test("neural SDF is bounded, closed, and changes sign (a real surface)", () => {
  const sdf = buildNeuralSdf(neuralSeed("sdf-a"));
  assert.ok(sdf.bound > 1 && sdf.bound < 2, "bound near the sphere radius");
  // Far outside is strongly positive; the origin is inside (negative).
  assert.ok(sdf.dist(3, 0, 0) > 1, "far field must be positive");
  assert.ok(sdf.dist(0, 0, 0) < 0, "the centre must be inside the surface");
  // The surface exists: some ray from centre outward crosses zero within bound.
  let crossed = false;
  for (let t = 0; t <= sdf.bound + 0.1; t += 0.02) {
    if (sdf.dist(t, 0, 0) >= 0) { crossed = true; break; }
  }
  assert.ok(crossed, "a radial ray must cross the surface");
  assert.equal(sdf.dist(0.5, 0.5, 0.5), buildNeuralSdf(neuralSeed("sdf-a")).dist(0.5, 0.5, 0.5), "deterministic");
});

test("neural SDF displacement stays within amp (Lipschitz-safe marching)", () => {
  const sdf = buildNeuralSdf(neuralSeed("sdf-b"), { amp: 0.4 });
  for (let i = 0; i < 50; i += 1) {
    const x = (i / 50) * 2 - 1, y = Math.sin(i), z = Math.cos(i * 0.7);
    assert.ok(Math.abs(sdf.displace(x, y, z)) <= 0.4 + 1e-6, "displacement exceeded amp");
  }
});
