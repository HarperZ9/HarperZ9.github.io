// noether.js: symmetry -> conservation, made explicit and verifiable.
//
// Noether's theorem: every continuous symmetry of the dynamics has a conserved quantity (its
// generator). Here a symmetry is a transformation that COMMUTES WITH TIME EVOLUTION: evolving a
// transformed state equals transforming the evolved state. The engine tests that commutation
// directly, names the Noether charge, and verifies the charge is conserved with the same sound
// oracle. The link cuts both ways: break the symmetry (e.g. a position-dependent potential breaks
// translation) and the charge is no longer conserved. Zero dependencies beyond the substrate.
import { simulate } from "./integrator.js";
import { conservationOracle } from "./verify.js";

// --- continuous symmetry transforms: (state, system) -> transformed state ---

// translate every position coordinate by eps (velocities unchanged): spatial translation.
export const translateAll = (eps) => (s, system) => {
  const t = { ...s };
  for (const c of system.coords) t[c] = s[c] + eps;
  return t;
};

// rotate the first spatial pair (x, y) and its velocity pair (vx, vy) by theta: 2D rotation.
export const rotate2D = (theta) => (s, system) => {
  const [cx, cy] = system.coords, [vx, vy] = system.vels;
  const co = Math.cos(theta), si = Math.sin(theta), t = { ...s };
  t[cx] = s[cx] * co - s[cy] * si; t[cy] = s[cx] * si + s[cy] * co;
  t[vx] = s[vx] * co - s[vy] * si; t[vy] = s[vx] * si + s[vy] * co;
  return t;
};

function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Does `transform` commute with time evolution? evolve(T(s0)) vs T(evolve(s0)) along the trajectory.
export function isInvariant(system, transform, { eps, dt = 0.01, n = 600, tol = 1e-3, seed = 1 } = {}) {
  const s0 = system.sampleState(rngFrom(seed));
  const trajA = simulate(system, transform(s0, system), { dt, n }); // evolve the transformed IC
  const traj0 = simulate(system, s0, { dt, n });
  let maxAbs = 0, scale = 1e-9;
  for (let i = 0; i < trajA.length; i++) {
    const tT = transform(traj0[i], system); // transform each evolved state
    for (const v of system.vars) { maxAbs = Math.max(maxAbs, Math.abs(trajA[i][v] - tT[v])); scale = Math.max(scale, Math.abs(trajA[i][v])); }
  }
  const residual = maxAbs / scale;
  return { invariant: residual < tol, residual };
}

// For each candidate symmetry, report: does it hold, what is its Noether charge, and is the charge
// conserved (verified by the sound oracle)? This is the explicit symmetry <-> conservation link.
export function noetherReport(system, { oracle = {}, sym = {} } = {}) {
  const oOpts = { dt: 0.01, n: 1500, trials: 6, tol: 0.03, ...oracle };
  const sOpts = { dt: 0.01, n: 600, tol: 1e-3, ...sym };
  const rows = [];

  const transInv = isInvariant(system, translateAll(0.5), sOpts);
  const momExpr = system.vels.join(" + "); // total momentum = sum of velocities
  rows.push({
    symmetry: "spatial translation", invariant: transInv.invariant, residual: transInv.residual,
    charge: "momentum", expr: momExpr, conserved: conservationOracle(momExpr, system, oOpts).verdict,
  });

  if (system.coords.includes("x") && system.coords.includes("y")) {
    const rotInv = isInvariant(system, rotate2D(0.4), sOpts);
    const angExpr = "x*vy - y*vx";
    rows.push({
      symmetry: "rotation", invariant: rotInv.invariant, residual: rotInv.residual,
      charge: "angular momentum", expr: angExpr, conserved: conservationOracle(angExpr, system, oOpts).verdict,
    });
  }
  return rows;
}

// A row is consistent with Noether iff invariance and conservation agree: symmetry present <-> charge conserved.
export function noetherConsistent(row) {
  return row.invariant === (row.conserved === "verified");
}
