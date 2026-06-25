// verify.js: the SOUND verifier for a submitted conservation law, plus its certificate.
//
// A quantity is conserved iff its spread ALONG a trajectory is tiny RELATIVE TO its spread
// ACROSS phase space, and this holds across several INDEPENDENT initial conditions. That
// ratio is scale-invariant and additive-constant-robust: multiplying the quantity, or adding
// a huge constant, cannot disguise a non-invariant as conserved. A quantity that is
// effectively constant over phase space is rejected as trivial. The cross-initial-condition
// requirement is the soundness teeth: a quantity that merely fits one trajectory fails the
// others. Reuses shared-frame/certificate.js for the witnessed, re-checkable certificate.
import { trajectory } from "./integrator.js";
import { makeFn } from "./expr.js";
import { buildCertificate } from "../../shared-frame/certificate.js";

const TRIVIAL_FLOOR = 1e-6; // phaseStd / rms below this => effectively constant => trivial

function std(vals) {
  let m = 0; for (const v of vals) m += v; m /= vals.length;
  let s = 0; for (const v of vals) s += (v - m) * (v - m);
  return Math.sqrt(s / vals.length);
}
function rms(vals) { let s = 0; for (const v of vals) s += v * v; return Math.sqrt(s / vals.length); }
const fmt = (x) => (Number.isFinite(x) ? x.toExponential(3) : String(x));

// The sound oracle. Returns a certificate-grade oracle result (the shape buildCertificate expects):
// { tier, oracle, certified, verdict, evidence }. verdict in verified | refuted | unverifiable.
export function conservationOracle(exprString, system, opts = {}) {
  const { seed = 1, dt = 0.01, n = 1500, trials = 6, tol = 0.02, drag = 0 } = opts;
  let fn;
  try { fn = makeFn(exprString, system.vars); }
  catch (e) {
    return result("unverifiable", [["reason", "invalid-expression"], ["error", String(e.message || e)]]);
  }
  const trajs = [];
  for (let i = 0; i < trials; i++) {
    const r = rngFrom(seed + i * 9973);
    trajs.push(trajectory(system, system.sampleState(r), { dt, n, drag }));
  }
  const pooled = [];
  for (const tr of trajs) for (const s of tr) pooled.push(fn(s));
  if (pooled.some((v) => !Number.isFinite(v))) {
    return result("unverifiable", [["reason", "non-finite-values"], ["expr", exprString]]);
  }
  const phaseStd = std(pooled), poolRms = rms(pooled);
  const triviality = phaseStd / (poolRms + 1e-12);
  if (triviality < TRIVIAL_FLOOR) {
    return result("refuted", [["reason", "trivial-constant"], ["triviality", fmt(triviality)], ["expr", exprString]]);
  }
  let maxScore = 0;
  const perTraj = [];
  for (const tr of trajs) {
    const score = std(tr.map(fn)) / (phaseStd + 1e-12);
    perTraj.push(fmt(score));
    if (score > maxScore) maxScore = score;
  }
  const verdict = maxScore < tol ? "verified" : "refuted";
  return result(verdict, [
    ["expr", exprString], ["system", system.name],
    ["seed", String(seed)], ["dt", String(dt)], ["n", String(n)],
    ["trials", String(trials)], ["tol", String(tol)], ["drag", String(drag)],
    ["max_score", fmt(maxScore)], ["phase_std", fmt(phaseStd)],
    ["triviality", fmt(triviality)], ["per_traj_scores", perTraj.join("|")],
  ]);
}

function result(verdict, evidence) {
  return { tier: "physics", oracle: "conservation-v1", certified: true, verdict, evidence };
}

const CRITERION =
  "conserved: along-trajectory spread < tol of phase-space spread, across independent initial conditions, non-trivial";

// A full witnessed certificate for a submitted law. Re-checkable two ways: recheckCertificate2
// re-derives the verdict logic from the evidence; recheckConservation re-runs the physics.
export function certifyConservation(exprString, system, opts = {}) {
  const oracle = conservationOracle(exprString, system, opts);
  const ev = Object.fromEntries(oracle.evidence.map(([k, v]) => [k, v]));
  return buildCertificate({
    criterion: CRITERION,
    claim: `Q = ${exprString}` + (ev.max_score ? ` (along/phase spread ${ev.max_score})` : ""),
    oracleVerdict: oracle,
    evidence: [
      ["expr", exprString], ["system", system.name],
      ["seed", String(opts.seed ?? 1)], ["dt", String(opts.dt ?? 0.01)],
      ["n", String(opts.n ?? 1500)], ["trials", String(opts.trials ?? 6)],
      ["tol", String(opts.tol ?? 0.02)], ["drag", String(opts.drag ?? 0)],
    ],
  });
}

// Re-run the physics from the certificate's own embedded params and confirm the verdict reproduces.
export function recheckConservation(cert, systemsMap) {
  const ev = Object.fromEntries((cert.evidence || []).map(([k, v]) => [k, v]));
  const system = systemsMap[ev.system];
  if (!system) return { verdict: "unverifiable", matches: false, reason: "unknown-system" };
  const oracle = conservationOracle(ev.expr, system, {
    seed: +ev.seed, dt: +ev.dt, n: +ev.n, trials: +ev.trials, tol: +ev.tol, drag: +ev.drag,
  });
  return { verdict: oracle.verdict, matches: oracle.verdict === cert.verdict };
}

// Local deterministic rng (kept independent of systems.js to avoid an import cycle).
function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
