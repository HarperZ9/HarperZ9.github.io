// noether.test.mjs: symmetry <-> conservation, made explicit. A symmetry that commutes with the
// dynamics has a conserved Noether charge; breaking the symmetry breaks the conservation.
// Run: node --test system/discovery/noether.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { SYSTEMS } from "./systems.js";
import { noetherReport, noetherConsistent } from "./noether.js";

const find = (rows, sym) => rows.find((r) => r.symmetry === sym);

test("translation symmetry <-> momentum: present for the two-body spring, broken for the SHO", () => {
  const tb = find(noetherReport(SYSTEMS.twoBody), "spatial translation");
  assert.equal(tb.invariant, true, JSON.stringify(tb));
  assert.equal(tb.conserved, "verified");   // total momentum v1 + v2 is conserved
  assert.ok(noetherConsistent(tb));

  const sho = find(noetherReport(SYSTEMS.sho), "spatial translation");
  assert.equal(sho.invariant, false, JSON.stringify(sho)); // 1/2 w^2 x^2 breaks translation
  assert.equal(sho.conserved, "refuted");                  // so momentum is NOT conserved
  assert.ok(noetherConsistent(sho));
});

test("rotation symmetry <-> angular momentum for central / isotropic systems", () => {
  const kep = noetherReport(SYSTEMS.kepler, { oracle: { dt: 0.004, n: 2000, trials: 6, tol: 0.05 }, sym: { dt: 0.004, n: 800 } });
  const rot = find(kep, "rotation");
  assert.equal(rot.invariant, true, JSON.stringify(rot));
  assert.equal(rot.conserved, "verified");                 // angular momentum conserved
  assert.ok(noetherConsistent(rot));
  const trans = find(kep, "spatial translation");
  assert.equal(trans.invariant, false, JSON.stringify(trans)); // central potential breaks translation
  assert.ok(noetherConsistent(trans));

  const osc = find(noetherReport(SYSTEMS.oscillator2d), "rotation");
  assert.equal(osc.invariant, true, JSON.stringify(osc));
  assert.equal(osc.conserved, "verified");
  assert.ok(noetherConsistent(osc));
});
