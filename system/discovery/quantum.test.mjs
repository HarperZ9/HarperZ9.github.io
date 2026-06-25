// quantum.test.mjs: the R2 quantum substrate must conserve what physics says it conserves.
// Run: node --test system/discovery/quantum.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fft, makeGrid, gaussianPacket, observables, evolve, spectrum, fitSpectrum } from "./quantum.js";
import { qho, free, QSYSTEMS } from "./quantum-system.js";
import { makeSpectrumTools } from "./spectrum-discovery.js";
import { conservationOracle } from "./verify.js";
import { makeTools } from "./tools.js";

function relVar(arr) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of arr) { if (v < min) min = v; if (v > max) max = v; sum += v; }
  return (max - min) / (Math.abs(sum / arr.length) + 1e-12);
}

test("fft inverse round-trips to the original signal", () => {
  const re = [1, 2, 3, 4, 4, 3, 2, 1], im = [0, 0, 0, 0, 0, 0, 0, 0];
  const r0 = re.slice(), i0 = im.slice();
  fft(re, im, -1); fft(re, im, 1);
  for (let i = 0; i < re.length; i++) {
    assert.ok(Math.abs(re[i] - r0[i]) < 1e-9 && Math.abs(im[i] - i0[i]) < 1e-9);
  }
});

test("a fresh Gaussian packet is normalized", () => {
  const grid = makeGrid(256, 20);
  const psi = gaussianPacket(grid, { x0: 1.5, sigma: 1, p0: 0 });
  const o = observables(psi, grid, grid.x.map((x) => 0.5 * x * x));
  assert.ok(Math.abs(o.norm - 1) < 1e-9, `norm ${o.norm}`);
});

test("Schrodinger evolution conserves norm (unitarity) and energy <H>", () => {
  const grid = makeGrid(256, 20);
  const V = (x) => 0.5 * x * x; // harmonic well, omega = 1
  const series = evolve(grid, V, { x0: 1.5, sigma: 1, p0: 0, dt: 0.01, n: 700 });
  const norm = series.map((o) => o.norm);
  const H = series.map((o) => o.H);
  const X = series.map((o) => o.x);
  assert.ok(relVar(norm) < 1e-6, `norm relVar ${relVar(norm)} should be ~0 (unitary)`);
  assert.ok(relVar(H) < 2e-3, `energy relVar ${relVar(H)} should be tiny (conserved)`);
  // the packet must actually move, or "conserved" would be trivial: <x> swings through a wide range
  const xRange = Math.max(...X) - Math.min(...X);
  assert.ok(xRange > 1.5, `<x> range ${xRange} should be large (packet oscillates)`);
});

// ── the discovery loop on a QUANTUM system (R2) ──────────────────────────────────────
const QOPTS = { dt: 0.01, n: 400, trials: 5, tol: 0.05 };

test("verifier CERTIFIES the quantum energy x2 + p2 (rediscovered from moments)", () => {
  const o = conservationOracle("x2 + p2", qho, QOPTS);
  assert.equal(o.verdict, "verified", JSON.stringify(o.evidence));
});

test("verifier REFUSES a non-conserved quantum moment (<x> oscillates)", () => {
  assert.equal(conservationOracle("x", qho, QOPTS).verdict, "refuted");
  assert.equal(conservationOracle("p", qho, QOPTS).verdict, "refuted");
});

test("fit recovers the quantum energy from a generous moment library", () => {
  const t = makeTools(qho, QOPTS);
  const r = t.fit(["x", "x2", "p", "p2"]);
  assert.equal(r.verdict, "verified", JSON.stringify(r));
});

// generality: a DIFFERENT quantum system has a DIFFERENT conserved law (momentum, not energy)
const FOPTS = { dt: 0.02, n: 200, trials: 5, tol: 0.05 };

test("free particle: the loop discovers MOMENTUM <p> is conserved", () => {
  assert.equal(conservationOracle("p", free, FOPTS).verdict, "verified");
  assert.equal(conservationOracle("p2", free, FOPTS).verdict, "verified");
});

test("free particle: the oscillator's energy and <x> are NOT conserved (engine is not hardcoded)", () => {
  assert.equal(conservationOracle("x2 + p2", free, FOPTS).verdict, "refuted"); // <x2> grows as it spreads
  assert.equal(conservationOracle("x", free, FOPTS).verdict, "refuted");        // <x> drifts
});

test("fit discovers a conserved observable that is constant along the trajectory", () => {
  const t = makeTools(free, FOPTS);
  assert.equal(t.fit(["p2"]).verdict, "verified");                 // a single conserved observable
  assert.equal(t.fit(["x", "x2", "p", "p2"]).verdict, "verified"); // finds the conserved p / p2 direction
});

// ── TISE quantization: discover the energy-level RULE of a quantum system ────────────
test("quantization: the harmonic oscillator has an EQUALLY-SPACED ladder E_n = (n+1/2)", () => {
  const E = spectrum(makeGrid(128, 16), (x) => 0.5 * x * x, 5);
  assert.ok(Math.abs(E[0] - 0.5) < 0.05, `E0=${E[0]} should be ~0.5`);
  assert.ok(Math.abs((E[1] - E[0]) - 1) < 0.05 && Math.abs((E[2] - E[1]) - 1) < 0.05, `spacing ${E}`);
  const f = fitSpectrum(E);
  assert.equal(f.rule, "linear");
  assert.ok(Math.abs(f.linear.a - 1) < 0.05, `spacing a=${f.linear.a}`);    // hbar*omega = 1
  assert.ok(Math.abs(f.linear.b - 0.5) < 0.05, `zero-point b=${f.linear.b}`); // 1/2 hbar omega
});

test("quantization: a box well has a QUADRATIC spectrum E_n ~ (n+1)^2", () => {
  const E = spectrum(makeGrid(128, 16), (x) => (Math.abs(x) < 4 ? 0 : 5000), 5);
  const f = fitSpectrum(E);
  assert.equal(f.rule, "quadratic", JSON.stringify({ E, f }));
  assert.ok(f.quadRelErr < 0.05, `quad rel err ${f.quadRelErr}`);
});

// the discovery loop applied to a SPECTRUM: the rule must PREDICT held-out levels
test("spectrum discovery: the harmonic ladder is LINEAR in n and predicts held-out levels", () => {
  const t = makeSpectrumTools(makeGrid(128, 16), (x) => 0.5 * x * x, "qho-spectrum", { K: 7, nTrain: 5, tol: 0.03 });
  assert.equal(t.fit(["1", "n"]).verdict, "verified");
  assert.equal(t.fit(["1", "n^2"]).verdict, "refuted"); // wrong rule fails the held-out prediction
  assert.equal(t.submit(t.fit(["1", "n"]).expr).verdict, "verified");
});

test("spectrum discovery: the box spectrum is QUADRATIC; the linear rule fails to predict", () => {
  const t = makeSpectrumTools(makeGrid(128, 16), (x) => (Math.abs(x) < 4 ? 0 : 5000), "box-spectrum", { K: 7, nTrain: 4, tol: 0.05 });
  assert.equal(t.fit(["1", "(n+1)^2"]).verdict, "verified");
  assert.equal(t.fit(["1", "n"]).verdict, "refuted");
});
