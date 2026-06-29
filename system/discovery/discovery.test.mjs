// discovery.test.mjs: substrate tests for the Telos Discovery Engine (R0).
// Deterministic, no model in the loop. Run: node --test system/discovery/discovery.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { SYSTEMS, sho, pendulum, kepler, oscillator2d, coupledOscillators, rng } from "./systems.js";
import { simulate, trajectory } from "./integrator.js";
import { makeFn, variation, toRPN } from "./expr.js";
import { conservedSubspace } from "./reference.js";
import { conservationOracle, certifyConservation, recheckConservation } from "./verify.js";
import { recheckCertificate2 } from "../../shared-frame/certificate.js";
import { makeTools } from "./tools.js";
import { perceive, renderPerception } from "./observables.js";
import { leastVarianceCombo, jacobiEigen } from "./reference.js";

// ── integrator: a symplectic integrator conserves the known invariant ──────────────
const CONS = {
  sho: { dt: 0.01, n: 2000, tol: 2e-3 },
  pendulum: { dt: 0.01, n: 2000, tol: 2e-3 },
  kepler: { dt: 0.004, n: 2500, tol: 8e-3 },
};

for (const name of ["sho", "pendulum", "kepler"]) {
  test(`integrator conserves energy on ${name}`, () => {
    const sys = SYSTEMS[name];
    const r = rng(name === "sho" ? 1 : name === "pendulum" ? 2 : 3);
    const states = simulate(sys, sys.sampleState(r), CONS[name]);
    const energy = states.map((s) => sys.knownInvariant(s));
    const v = relVar(energy);
    assert.ok(v < CONS[name].tol, `${name} energy relVar ${v} should be < ${CONS[name].tol}`);
  });
}

test("kepler also conserves angular momentum", () => {
  const r = rng(7);
  const states = simulate(kepler, kepler.sampleState(r), CONS.kepler);
  const L = states.map((s) => kepler.knownAngularMomentum(s));
  assert.ok(relVar(L) < 1e-6, `angular momentum relVar ${relVar(L)} should be ~0`);
});

test("coupled oscillators conserve total spring energy", () => {
  const r = rng(13);
  const states = simulate(coupledOscillators, coupledOscillators.sampleState(r), { dt: 0.01, n: 2200 });
  const energy = states.map((s) => coupledOscillators.knownInvariant(s));
  assert.ok(relVar(energy) < 4e-3, `coupled energy relVar ${relVar(energy)} should stay small`);
});

test("a damped system does NOT conserve energy (negative control)", () => {
  const r = rng(11);
  const states = simulate(sho, sho.sampleState(r), { dt: 0.01, n: 2000, drag: 0.05 });
  const energy = states.map((s) => sho.knownInvariant(s));
  assert.ok(relVar(energy) > 0.2, `damped energy relVar ${relVar(energy)} should be large`);
});

// ── expr: correctness ──────────────────────────────────────────────────────────────
test("expr evaluates a known invariant expression correctly", () => {
  // sho energy with omega=1.3 -> omega^2 = 1.69
  const fn = makeFn("0.5*v^2 + 0.5*1.69*x^2", sho.vars);
  const s = { x: 0.7, v: -0.4 };
  assert.ok(Math.abs(fn(s) - sho.knownInvariant(s)) < 1e-12);
});

test("expr supports functions and unary minus", () => {
  const fn = makeFn("0.5*w^2 - 9.81*cos(theta)", pendulum.vars);
  const s = { theta: 0.5, w: 0.3 };
  assert.ok(Math.abs(fn(s) - (0.5 * 0.09 - 9.81 * Math.cos(0.5))) < 1e-12);
  const neg = makeFn("-x + 2", sho.vars);
  assert.equal(neg({ x: 3, v: 0 }), -1);
});

// ── expr: injection-safety ──────────────────────────────────────────────────────────
test("expr rejects unknown identifiers and JS injection (no eval reachable)", () => {
  assert.throws(() => toRPN("constructor", sho.vars), /unknown identifier/);
  assert.throws(() => toRPN("x.constructor", sho.vars), /bad token|unparsed/);
  assert.throws(() => toRPN("alert(1)", sho.vars), /unknown identifier/);
  assert.throws(() => toRPN("globalThis", sho.vars), /unknown identifier/);
  assert.throws(() => toRPN("x; y", sho.vars), /bad token|unparsed/);
  assert.throws(() => toRPN("`x`", sho.vars), /bad token|unparsed/);
});

// ── variation: conserved vs not ─────────────────────────────────────────────────────
test("variation is ~0 for the true invariant and large for a non-invariant", () => {
  const r = rng(5);
  const states = simulate(sho, sho.sampleState(r), CONS.sho);
  const energyFn = makeFn("0.5*v^2 + 0.5*1.69*x^2", sho.vars);
  assert.ok(variation(energyFn, states) < 5e-3);
  const xFn = makeFn("x", sho.vars); // x swings: not conserved
  assert.ok(variation(xFn, states) > 0.5);
});

// ── verifier soundness: the load-bearing claim (it must never certify a false law) ──
const ENERGY = {
  sho: "0.5*v^2 + 0.5*1.69*x^2",                 // omega=1.3 -> omega^2 = 1.69
  pendulum: "0.5*w^2 - 9.81*cos(theta)",          // g/l = 9.81
  kepler: "0.5*(vx^2+vy^2) - 1/sqrt(x^2+y^2)",    // mu = 1
};
const OPTS = {
  sho: { dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  pendulum: { dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  kepler: { dt: 0.004, n: 2000, trials: 6, tol: 0.05 },
};

for (const name of ["sho", "pendulum", "kepler"]) {
  test(`verifier CERTIFIES the true energy invariant on ${name}`, () => {
    const o = conservationOracle(ENERGY[name], SYSTEMS[name], OPTS[name]);
    assert.equal(o.verdict, "verified", JSON.stringify(o.evidence));
  });
}

test("verifier REFUSES a non-conserved quantity", () => {
  assert.equal(conservationOracle("x", sho, OPTS.sho).verdict, "refuted");
  assert.equal(conservationOracle("vx", kepler, OPTS.kepler).verdict, "refuted");
});

test("verifier REFUSES energy on a DAMPED system (negative control)", () => {
  assert.equal(conservationOracle(ENERGY.sho, sho, { ...OPTS.sho, drag: 0.05 }).verdict, "refuted");
});

test("verifier REFUSES trivial constants", () => {
  assert.equal(conservationOracle("5", sho, OPTS.sho).verdict, "refuted");
  assert.equal(conservationOracle("x - x", sho, OPTS.sho).verdict, "refuted");
});

test("a huge additive constant cannot disguise a non-invariant as conserved", () => {
  assert.equal(conservationOracle("1000 + x", sho, OPTS.sho).verdict, "refuted");
});

test("the conservation metric is scale-invariant and constant-offset tolerant", () => {
  // a scaled invariant is still an invariant; energy + a constant is still conserved
  assert.equal(conservationOracle("1000000 * (0.5*v^2 + 0.5*1.69*x^2)", sho, OPTS.sho).verdict, "verified");
  assert.equal(conservationOracle("500 + 0.5*v^2 + 0.5*1.69*x^2", sho, OPTS.sho).verdict, "verified");
});

test("an invalid / unknown-identifier submission is unverifiable, never certified", () => {
  const o = conservationOracle("0.5*kinetic + potential", sho, OPTS.sho); // unknown identifiers
  assert.equal(o.verdict, "unverifiable");
});

test("certificate certifies a true law and re-checks two independent ways", () => {
  const cert = certifyConservation(ENERGY.sho, sho, OPTS.sho);
  assert.equal(cert.verdict, "verified");
  assert.equal(cert.certified, true);
  assert.equal(recheckCertificate2(cert).matches, true);          // verdict-logic re-check
  assert.equal(recheckConservation(cert, SYSTEMS).matches, true); // physics re-run re-check
});

test("a refuted submission yields a refuted, re-checkable certificate", () => {
  const cert = certifyConservation("x", sho, OPTS.sho);
  assert.equal(cert.verdict, "refuted");
  assert.equal(recheckConservation(cert, SYSTEMS).matches, true);
});

// ── perception + tools (the model-facing surface), deterministic ────────────────────
test("perception exposes only observables, never the equations or the invariant", () => {
  const states = simulate(sho, sho.sampleState(rng(1)), CONS.sho);
  const p = perceive(sho, states);
  assert.deepEqual(p.variables, ["x", "v"]);
  assert.ok(p.samples.length > 0 && "x" in p.samples[0] && "v" in p.samples[0]);
  const text = renderPerception(p);
  assert.ok(!/omega|invariant|energy|1\.69/i.test(text), "perception text must not leak the law");
});

test("tools.evaluate gives a sound-aligned signal; submit certifies", () => {
  const t = makeTools(sho, OPTS.sho);
  assert.equal(t.evaluate("0.5*v^2 + 0.5*1.69*x^2").verdict, "verified");
  assert.equal(t.evaluate("x").verdict, "refuted");
  const cert = t.submit("0.5*v^2 + 0.5*1.69*x^2");
  assert.equal(cert.verdict, "verified");
  assert.equal(recheckConservation(cert, SYSTEMS).matches, true);
});

test("jacobiEigen diagonalizes a small symmetric matrix", () => {
  const { values } = jacobiEigen([[2, 0], [0, 5]]);
  const sorted = values.slice().sort((a, b) => a - b);
  assert.ok(Math.abs(sorted[0] - 2) < 1e-9 && Math.abs(sorted[1] - 5) < 1e-9);
});

test("fit tool recovers the conserved combination once the model picks the right terms", () => {
  // the model's job is to choose the terms; fit finds the weights, the verifier certifies
  for (const name of ["sho", "pendulum"]) {
    const t = makeTools(SYSTEMS[name], OPTS[name]);
    const terms = name === "sho" ? ["x^2", "v^2"] : ["w^2", "cos(theta)"];
    const r = t.fit(terms);
    assert.equal(r.verdict, "verified", `fit(${terms}) on ${name}: ${JSON.stringify(r)}`);
    assert.equal(t.submit(r.expr).verdict, "verified");
  }
});

test("fit does NOT rescue a wrong basis (the model must choose the right terms)", () => {
  const t = makeTools(sho, OPTS.sho);
  const r = t.fit(["x", "v"]); // linear terms cannot form the (quadratic) invariant
  assert.equal(r.verdict, "refuted");
});

test("fit handles a GENEROUS library: recovers the invariant despite distractor terms", () => {
  const ts = makeTools(sho, OPTS.sho);
  assert.equal(ts.fit(["x^2", "v^2", "x", "v", "x*v"]).verdict, "verified");
  const tp = makeTools(pendulum, OPTS.pendulum);
  assert.equal(tp.fit(["theta^2", "w^2", "cos(theta)", "sin(theta)", "theta*w"]).verdict, "verified");
});

test("a generous library WITHOUT the needed terms is still refuted (cross-IC guards overfitting)", () => {
  const t = makeTools(sho, OPTS.sho);
  assert.equal(t.fit(["x", "v", "x*v"]).verdict, "refuted"); // no squares: cannot form the invariant
});

test("fit drops a literal constant but still finds the real invariant", () => {
  const t = makeTools(sho, OPTS.sho);
  assert.equal(t.fit(["1", "x^2", "v^2"]).verdict, "verified"); // "1" same on both ICs -> dropped; energy found
});

test("a single system can carry MULTIPLE laws: the 2D oscillator has energy AND angular momentum", () => {
  const opts = { dt: 0.01, n: 1500, trials: 6, tol: 0.02 };
  const t = makeTools(oscillator2d, opts);
  assert.equal(t.fit(["x^2", "y^2", "vx^2", "vy^2"]).verdict, "verified"); // an energy-type invariant
  assert.equal(t.fit(["x*vy", "y*vx"]).verdict, "verified");               // angular momentum L_z
});

test("fit recovers the coupled-oscillator energy basis", () => {
  const t = makeTools(coupledOscillators, { dt: 0.01, n: 1600, trials: 6, tol: 0.02 });
  const r = t.fit(["x1^2", "x2^2", "v1^2", "v2^2", "x1*x2"]);
  assert.equal(r.verdict, "verified", JSON.stringify(r));
});

test("conserved-subspace discovery: the 2D oscillator has 3 independent quadratic laws", () => {
  const t = makeTools(oscillator2d, { dt: 0.01, n: 1500, trials: 6, tol: 0.02, seed: 1 });
  const r = t.discoverLaws(["x^2", "y^2", "vx^2", "vy^2", "x*vy", "y*vx"]); // E_x, E_y, L_z span it
  assert.equal(r.dimension, 3, JSON.stringify(r));
  assert.ok(r.laws.filter((L) => L.verdict === "verified").length >= 2, JSON.stringify(r));
});

test("conserved-subspace discovery: the 1D oscillator has exactly 1 independent law", () => {
  const t = makeTools(sho, OPTS.sho);
  const r = t.discoverLaws(["x^2", "v^2", "x", "v", "x*v"]); // only energy is conserved
  assert.equal(r.dimension, 1, JSON.stringify(r));
});

test("GENUINE discovery: a HIDDEN 4th law emerges from a general (uncurated) basis", () => {
  // all degree-2 monomials, nothing curated toward the answer
  const basis = ["x^2", "y^2", "vx^2", "vy^2", "x*y", "vx*vy", "x*vx", "y*vy", "x*vy", "y*vx"];
  const trajs = Array.from({ length: 14 }, (_, i) => trajectory(oscillator2d, oscillator2d.sampleState(rng(101 + i * 7)), { dt: 0.01, n: 1500 }));
  const sub = conservedSubspace(basis, oscillator2d.vars, trajs, { ratioTol: 1e-3 });
  // energy_x, energy_y, angular momentum -- AND the hidden Fradkin off-diagonal: four, not three
  assert.equal(sub.dimension, 4, JSON.stringify(sub.laws.map((l) => l.expr)));
  const o = (e) => conservationOracle(e, oscillator2d, { dt: 0.01, n: 1500, trials: 8, tol: 0.03 }).verdict;
  assert.equal(o("vx*vy + 1.21*x*y"), "verified"); // the hidden invariant (not energy, not L)
  assert.equal(o("vx*vy"), "refuted");              // its parts are not conserved on their own
  assert.equal(o("x*y"), "refuted");
});

test("GENUINE discovery: Kepler's hidden Laplace-Runge-Lenz vector emerges from an LRL-capable basis", () => {
  const basis = ["x*vy^2", "y*vx*vy", "x/sqrt(x^2+y^2)", "x*vx*vy", "y*vx^2", "y/sqrt(x^2+y^2)"];
  const trajs = Array.from({ length: 14 }, (_, i) => trajectory(kepler, kepler.sampleState(rng(101 + i * 7)), { dt: 0.004, n: 2000 }));
  const sub = conservedSubspace(basis, kepler.vars, trajs, { ratioTol: 5e-3 });
  assert.equal(sub.dimension, 2, JSON.stringify(sub.laws.map((l) => l.expr))); // the two LRL components
  // the A_x component is conserved (the reason bound orbits do not precess)
  assert.equal(conservationOracle("x*vy^2 - y*vx*vy - x/sqrt(x^2+y^2)", kepler, { dt: 0.004, n: 2000, trials: 6, tol: 0.05 }).verdict, "verified");
});

// helper: relative variation of a numeric array
function relVar(arr) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of arr) { if (v < min) min = v; if (v > max) max = v; sum += v; }
  return (max - min) / (Math.abs(sum / arr.length) + 1e-9);
}
