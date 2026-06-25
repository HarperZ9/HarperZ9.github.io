// hidden-laws.mjs: point the discovery loop at a system with a GENERAL basis (not curated to any
// answer) and see what conservation laws it finds, including HIDDEN ones beyond energy/momentum/L.
// The verifier stays the floor: it certifies whatever is genuinely conserved, known to anyone or not.
// Run: node system/discovery/hidden-laws.mjs
import { SYSTEMS, rng } from "./systems.js";
import { trajectory } from "./integrator.js";
import { conservedSubspace } from "./reference.js";
import { conservationOracle } from "./verify.js";

const trajsFor = (system, T, opts) => Array.from({ length: T }, (_, i) => trajectory(system, system.sampleState(rng(101 + i * 7)), opts));

// 2D isotropic oscillator (omega = 1.1 -> omega^2 = 1.21). General degree-2 monomial basis.
const osc = SYSTEMS.oscillator2d, oscOpts = { dt: 0.01, n: 1500 };
const basis = ["x^2", "y^2", "vx^2", "vy^2", "x*y", "vx*vy", "x*vx", "y*vy", "x*vy", "y*vx"];
const sub = conservedSubspace(basis, osc.vars, trajsFor(osc, 14, oscOpts), { ratioTol: 1e-3 });

console.log("\n=== genuine discovery: hidden conservation laws of the 2D isotropic oscillator ===");
console.log("general basis (all degree-2 monomials, nothing curated):", basis.join(", "));
console.log("\nindependent conserved quantities the loop found:", sub.dimension);
for (const law of sub.laws) console.log("   Q =", law.expr, "  (within/between ratio", law.ratio.toExponential(2) + ")");

const ora = (e) => conservationOracle(e, osc, { dt: 0.01, n: 1500, trials: 8, tol: 0.03 }).verdict;
console.log("\nthe HIDDEN invariant (off-diagonal Fradkin component), checked directly:");
console.log("   vx*vy + 1.21*x*y :", ora("vx*vy + 1.21*x*y"), "  <- conserved, but it is NOT energy and NOT angular momentum");
console.log("   its parts alone:  vx*vy :", ora("vx*vy"), "   x*y :", ora("x*y"), "  (neither is conserved on its own)");

// Kepler: the Laplace-Runge-Lenz vector, the famous HIDDEN invariant (why bound orbits do not precess).
const kep = SYSTEMS.kepler, kepOpts = { dt: 0.004, n: 2000 };
const lrlBasis = ["x*vy^2", "y*vx*vy", "x/sqrt(x^2+y^2)", "x*vx*vy", "y*vx^2", "y/sqrt(x^2+y^2)"];
const ksub = conservedSubspace(lrlBasis, kep.vars, trajsFor(kep, 14, kepOpts), { ratioTol: 5e-3 });
const okep = (e) => conservationOracle(e, kep, { dt: 0.004, n: 2000, trials: 6, tol: 0.05 }).verdict;
console.log("\n=== Kepler: the Laplace-Runge-Lenz vector (the hidden invariant of the 1/r force) ===");
console.log("LRL-capable basis:", lrlBasis.join(", "));
console.log("independent conserved quantities found:", ksub.dimension);
for (const law of ksub.laws) console.log("   Q =", law.expr, "(ratio", law.ratio.toExponential(2) + ")");
console.log("LRL component  x*vy^2 - y*vx*vy - x/sqrt(x^2+y^2) :", okep("x*vy^2 - y*vx*vy - x/sqrt(x^2+y^2)"));
