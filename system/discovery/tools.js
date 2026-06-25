// tools.js: the RANGE given to the solving model.
//
// A small, deterministic tool API over a FIXED perceived trajectory: evaluate a candidate
// quantity (get an honest, sound-aligned conservation signal), and submit (hand to the sound
// verifier for a witnessed certificate). No model lives here; this is the seam the model acts
// through. The model supplies the reasoning; these tools carry the numerics.
import { rng, SYSTEMS } from "./systems.js";
import { trajectory } from "./integrator.js";
import { makeFn } from "./expr.js";
import { perceive } from "./observables.js";
import { conservationOracle, certifyConservation } from "./verify.js";
import { leastVarianceCombo, conservedSubspace } from "./reference.js";

const round = (x) => (Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : x);

export function makeTools(system, opts = {}) {
  const { seed = 1, dt = 0.01, n = 1500, trials = 6, tol = 0.02 } = opts;
  const discovery = trajectory(system, system.sampleState(rng(seed)), { dt, n });
  const discovery2 = trajectory(system, system.sampleState(rng(seed + 1)), { dt, n }); // a 2nd IC, to tell a conserved observable from a literal constant
  const perception = perceive(system, discovery);

  // evaluate: a cheap, sound-ALIGNED signal (the same metric the final judge uses, fewer ICs)
  // plus a few sample values, so the model can iterate toward a conserved quantity honestly.
  function evaluate(expr) {
    const o = conservationOracle(String(expr || ""), system, { seed, dt, n, trials: 3, tol });
    const ev = Object.fromEntries(o.evidence.map(([k, v]) => [k, v]));
    let samples = null;
    try {
      const fn = makeFn(String(expr), system.vars);
      const stepi = Math.max(1, Math.floor(discovery.length / 5));
      samples = [];
      for (let i = 0; i < discovery.length && samples.length < 5; i += stepi) samples.push(round(fn(discovery[i])));
    } catch { /* invalid expression: samples stay null, verdict carries the reason */ }
    return {
      verdict: o.verdict,
      conservationScore: ev.max_score || ev.triviality || "na",
      reason: ev.reason || null,
      samples,
    };
  }

  // fit: the model supplies candidate TERMS (the physical insight: which features matter);
  // this returns the best-conserved linear combination of them (the arithmetic). The model
  // still must choose the right terms, and the verifier still has the final say on submit.
  function fit(terms) {
    if (!Array.isArray(terms) || terms.length === 0) return { ok: false, reason: "give a non-empty list of terms, e.g. [\"x^2\",\"v^2\"]" };
    let combo;
    try { combo = leastVarianceCombo(terms.map(String), system.vars, discovery, discovery2); }
    catch (e) { return { ok: false, reason: `invalid term: ${String(e.message || e)}` }; }
    if (!combo.ok) return combo;
    const ev = evaluate(combo.expr);
    return { ok: true, expr: combo.expr, coeffs: combo.coeffs, verdict: ev.verdict, conservationScore: ev.conservationScore };
  }

  // discoverLaws: find HOW MANY independent conserved quantities a candidate library supports, a basis
  // for them, and verify each. The model supplies the library; this reports the conservation structure.
  function discoverLaws(terms, T = 8) {
    if (!Array.isArray(terms) || terms.length === 0) return { ok: false, reason: "give a non-empty list of terms" };
    const trajs = [];
    for (let i = 0; i < T; i++) trajs.push(trajectory(system, system.sampleState(rng(seed + i * 1009 + 17)), { dt, n }));
    let sub;
    try { sub = conservedSubspace(terms.map(String), system.vars, trajs, { ratioTol: 1e-3 }); }
    catch (e) { return { ok: false, reason: `invalid term: ${String(e.message || e)}` }; }
    const laws = sub.laws.map((L) => ({ expr: L.expr, verdict: conservationOracle(L.expr, system, { seed, dt, n, trials, tol }).verdict }));
    return { ok: true, dimension: sub.dimension, laws };
  }

  // submit: the sound verifier + a witnessed, re-checkable certificate.
  function submit(expr) {
    return certifyConservation(String(expr || ""), system, { seed, dt, n, trials, tol });
  }

  return { perception, evaluate, fit, discoverLaws, submit, system };
}

export { SYSTEMS };
