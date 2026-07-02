// showcase.test.mjs: the eight tests the First Integral spec (TESTS section) pins. Node's test
// runner, zero extra deps. Runs headlessly: buildReport / recheck / serializeReport are pure and
// use globalThis.crypto.subtle, so node >= 18 reproduces the browser digest exactly. ASCII only;
// no em or en dashes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildReport, recheck, serializeReport, deriveIC, SHOWCASE_CONF } from "./report.js";
import { simulate } from "../discovery/integrator.js";
import { SYSTEMS } from "../discovery/systems.js";
import { conservationOracle } from "../discovery/verify.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

// 1) Determinism: buildReport twice yields byte-identical canonical JSON, identical SHA-256,
//    and a stable ground World id.
test("1. determinism: byte-identical canonical JSON and SHA-256 across calls", async () => {
  const a = await buildReport({ seed: "1", system: "kepler" });
  const b = await buildReport({ seed: "1", system: "kepler" });
  assert.equal(a.canonical, b.canonical, "canonical JSON must be byte-identical");
  assert.equal(a.sha256, b.sha256, "SHA-256 must be identical");
  assert.equal(a.report.ground.world.id, b.report.ground.world.id, "ground World id must be stable");
  assert.match(a.sha256, /^[0-9a-f]{64}$/);
});

// 2) Pow-fix pin (D1): the kepler accel source contains no Math.pow, and two independent
//    2000-step integrations from the shipped literals produce identical joined state strings
//    (the bit-hash precondition).
test("2. pow-fix pin: no Math.pow in kepler accel, and bit-identical re-integration", async () => {
  const systemsSrc = readFileSync(join(ROOT, "system", "discovery", "systems.js"), "utf8");
  const keplerBlock = systemsSrc.slice(systemsSrc.indexOf("export const kepler"), systemsSrc.indexOf("export const oscillator2d"));
  assert.ok(!/Math\.pow/.test(keplerBlock), "the kepler right-hand side must not use Math.pow (D1)");
  const ic = deriveIC("kepler", "1");
  const line = (states) => states.map((s) => SYSTEMS.kepler.vars.map((v) => String(s[v])).join(",")).join(";");
  const s1 = simulate(SYSTEMS.kepler, ic, { dt: 0.004, n: 2000 });
  const s2 = simulate(SYSTEMS.kepler, ic, { dt: 0.004, n: 2000 });
  assert.equal(line(s1), line(s2), "two integrations from the same literals must be bit-identical");
});

// 3) Verdicts: recheck(report) is MATCH; a tampered coefficient is DRIFT carrying the actual
//    deltas; a stubbed capability failure is UNVERIFIABLE with the stated reason.
test("3. verdicts: MATCH, tampered -> DRIFT with deltas, stubbed cap -> UNVERIFIABLE", async () => {
  const { report } = await buildReport({ seed: "1", system: "kepler" });
  const match = await recheck(report);
  assert.equal(match.verdict, "MATCH");
  assert.equal(match.deltas.length, 0);

  const tampered = JSON.parse(JSON.stringify(report));
  tampered.coefficients[0] = tampered.coefficients[0] + 0.5;
  const drift = await recheck(tampered);
  assert.equal(drift.verdict, "DRIFT");
  assert.ok(drift.deltas.length > 0, "DRIFT must carry the actual deltas");
  const coefDelta = drift.deltas.find((d) => d.field === "coefficients[0]");
  assert.ok(coefDelta && coefDelta.recorded !== coefDelta.recomputed, "the tampered coefficient delta must be present");

  const unver = await recheck(report, { capability: { canRun: false, reason: "no canvas and no worker budget" } });
  assert.equal(unver.verdict, "UNVERIFIABLE");
  assert.match(unver.reason, /no canvas and no worker budget/);
});

// 4) Refusal is computed, not canned: the drag-0.02 run's recorded verdict equals the live
//    return of the verifier, asserted by calling the verifier independently here.
test("4. refusal verdict is the verifier's live return, not a canned string", async () => {
  const { report } = await buildReport({ seed: "1", system: "kepler" });
  const conf = SHOWCASE_CONF.kepler;
  const oracle = conservationOracle(conf.energy, SYSTEMS.kepler,
    { seed: 1, dt: report.dt, n: report.n, trials: 6, tol: conf.tol, drag: 0.02 });
  assert.equal(report.refusal.verdict, oracle.verdict, "the receipt verdict must equal the live oracle verdict");
  assert.equal(report.refusal.verdict, "refuted", "a damped Kepler energy candidate must be refuted");
});

// 5) Drift clamp: the shipped seed-1 literals give drift_ratio < 0.025 (headroom under lab tol
//    0.05), so the hero never DRIFTs on its own homepage.
test("5. drift clamp: shipped seed-1 gives drift_ratio < 0.025", async () => {
  const { report } = await buildReport({ seed: "1", system: "kepler" });
  assert.ok(report.drift_ratio < 0.025, `drift_ratio ${report.drift_ratio} must be < 0.025 (lab tol 0.05)`);
});

// 6) Policy split: the hash_policy string is present, and the serializer refuses to emit
//    trajectory_sha256 for sin-based systems (sho, pendulum, oscillator2d).
test("6. policy split: kepler bit-hashed, sin-based systems refuse trajectory_sha256", async () => {
  const kep = await buildReport({ seed: "1", system: "kepler" });
  assert.match(kep.report.hash_policy, /bit-hashed/);
  assert.ok(kep.report.trajectory_sha256, "kepler must carry a trajectory_sha256");

  for (const sys of ["sho", "pendulum", "oscillator2d"]) {
    const b = await buildReport({ seed: "1", system: sys });
    assert.equal(b.report.trajectory_sha256, undefined, `${sys} must not carry a trajectory_sha256`);
    const forged = { ...b.report, trajectory_sha256: "0".repeat(64) };
    assert.throws(() => serializeReport(forged), /policy split/, `serializer must refuse trajectory_sha256 for ${sys}`);
  }
});

// 7) CLI byte-identity: two runs of verify-cli.mjs are byte-equal, and equal to the
//    test-computed canonical JSON + sha256 (the headless MATCH assertion for CI).
test("7. CLI byte-identity: verify-cli.mjs is stable and matches the module output", async () => {
  const cli = join(HERE, "verify-cli.mjs");
  const run = () => spawnSync(process.execPath, [cli, "1", "kepler"], { encoding: "utf8" });
  const a = run(), b = run();
  assert.equal(a.status, 0, "CLI must exit 0: " + a.stderr);
  assert.equal(a.stdout, b.stdout, "two CLI runs must be byte-identical");
  const { canonical, sha256 } = await buildReport({ seed: "1", system: "kepler" });
  assert.equal(a.stdout, canonical + "\n" + "sha256 " + sha256 + "\n", "CLI output must equal the module's canonical JSON + sha256");
});

// 8) Em-dash scan: no em or en dash in any system/showcase/* file or in the src-showcase region
//    of studio.html.
test("8. no em or en dashes in system/showcase/* or the src-showcase region", () => {
  const bad = new RegExp("[\u2013\u2014]");   // en dash and em dash, built from escapes so the scanner file is dash-free
  for (const f of readdirSync(HERE)) {
    if (!/\.(js|mjs)$/.test(f)) continue;
    const src = readFileSync(join(HERE, f), "utf8");
    assert.ok(!bad.test(src), `${f} contains an em or en dash`);
  }
  const html = readFileSync(join(ROOT, "studio.html"), "utf8");
  const start = html.indexOf('id="src-showcase"');
  assert.ok(start >= 0, "src-showcase section must exist in studio.html");
  const end = html.indexOf("</section>", start);
  const region = html.slice(start, end >= 0 ? end : html.length);
  assert.ok(!bad.test(region), "the src-showcase region of studio.html contains an em or en dash");
});
