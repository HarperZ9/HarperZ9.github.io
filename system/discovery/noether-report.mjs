// noether-report.mjs: print the computed + verified symmetry -> conservation map for every system.
// Run: node system/discovery/noether-report.mjs
import { SYSTEMS } from "./systems.js";
import { noetherReport, noetherConsistent } from "./noether.js";

const OPTS = { kepler: { oracle: { dt: 0.004, n: 2000, trials: 6, tol: 0.05 }, sym: { dt: 0.004, n: 800 } } };

console.log("\n=== Noether: symmetry -> conservation (each link computed and verified) ===\n");
for (const name of Object.keys(SYSTEMS)) {
  console.log(name + ":");
  for (const r of noetherReport(SYSTEMS[name], OPTS[name] || {})) {
    const link = r.invariant ? "symmetry PRESENT ->" : "symmetry BROKEN  ->";
    const flag = noetherConsistent(r) ? "[consistent]" : "[INCONSISTENT]";
    console.log(`  ${r.symmetry.padEnd(20)} ${link} ${r.charge} (${r.expr}): ${r.conserved}   ${flag}`);
  }
  console.log("");
}
