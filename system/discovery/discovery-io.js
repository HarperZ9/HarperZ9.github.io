// discovery-io.js: Telos's binding to the witnessed-artifact I/O protocol. The discovery engine emits
// its discovered laws as witnessed artifacts and registers the verifier that re-runs them, so any peer
// flagship can re-verify a Telos discovery by re-running the sound oracle - trusting the proof, not Telos.
import { conservationOracle } from "./verify.js";
import { SYSTEMS } from "./systems.js";
import { QSYSTEMS } from "./quantum-system.js";
import { emitArtifact } from "./io-protocol.js";

const ALL = { ...SYSTEMS, ...QSYSTEMS };

// The verifier registry Telos contributes to the protocol. A peer calls verifyArtifact(artifact,
// telosVerifiers): for a "conservation" artifact it re-runs the sound oracle from the recheck params
// and returns the verdict, which verifyArtifact compares to the carried one.
export const telosVerifiers = {
  conservation(recheck) {
    const sys = ALL[recheck.system];
    if (!sys) return "unverifiable";
    return conservationOracle(String(recheck.expr), sys, {
      seed: +recheck.seed || 1, dt: +recheck.dt, n: +recheck.n,
      trials: +recheck.trials, tol: +recheck.tol,
    }).verdict;
  },
};

// Emit a discovered conservation law as a witnessed artifact other flagships can re-verify.
export function conservationArtifact(systemName, expr, certificate, params = {}) {
  const quantum = !!(ALL[systemName] && ALL[systemName].quantum);
  return emitArtifact({
    flagship: "telos",
    kind: "conservation-law",
    subject: { system: systemName, domain: quantum ? "quantum-mechanics" : "classical-mechanics" },
    claim: `Q = ${expr}`,
    certificate,
    recheck: {
      verifier: "conservation", expr, system: systemName,
      seed: params.seed || 1, dt: params.dt, n: params.n, trials: params.trials, tol: params.tol,
    },
  });
}
