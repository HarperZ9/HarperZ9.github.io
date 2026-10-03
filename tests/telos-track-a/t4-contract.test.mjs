// t4-contract.test.mjs: Telos Track A step T4, the site side of the measurement contract v2.
// Rules: tests/telos-track-a/PREREGISTRATION.md, pre-registration 2 (T4) and amendments 2 and 3. The
// contract itself lives in the Telos MCP repo (demo/measurement-image.mjs, its own suite and mutation
// runner). Here: the vendored copies there are byte-identical to the sources here, and the exact-mean
// constants equal a fresh 60-digit regeneration.
// Run: node --test tests/telos-track-a/t4-contract.test.mjs   (TELOS_MCP_ROOT=<Telos repo> for the vendor check)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIN_Q40, M1_Q40, M2_Q40, oklabMeanExact } from "../../system/lib/sense-core/oklab-mean-exact.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const MCP = process.env.TELOS_MCP_ROOT;
const VENDORED = {
  "sense-core/oklab-int.mjs": "system/lib/sense-core/oklab-int.mjs",
  "sense-core/layers-int.mjs": "system/lib/sense-core/layers-int.mjs",
  "sense-core/resample-int.mjs": "system/lib/sense-core/resample-int.mjs",
  "sense-core/oklab-mean-exact.mjs": "system/lib/sense-core/oklab-mean-exact.mjs",
  "shared-frame/canonical.js": "shared-frame/canonical.js",
  "shared-frame/sha256.js": "shared-frame/sha256.js",
};
const lf = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("T4.vendor eq: the Telos MCP vendored files are byte-identical to the site sources", { skip: MCP && existsSync(join(MCP, "demo", "vendor")) ? false : "needs a Telos MCP checkout that carries demo/vendor; set TELOS_MCP_ROOT to run it" }, () => {
  const drift = Object.entries(VENDORED).filter(([v, s]) => lf(join(MCP, "demo", "vendor", v)) !== lf(join(ROOT, s))).map(([v]) => v);
  assert.deepEqual(drift, []);
  const manifest = JSON.parse(readFileSync(join(MCP, "demo", "vendor", "VENDOR.json"), "utf8"));
  for (const [v, s] of Object.entries(VENDORED)) {
    assert.equal(manifest.files[v], createHash("sha256").update(lf(join(ROOT, s))).digest("hex"), `manifest hash of ${v}`);
  }
});

test("T4.const eq: the exact-mean constants equal a fresh 60-digit regeneration", () => {
  const gen = JSON.parse(execFileSync("python", ["gen_oklab_int_constants.py"], { cwd: join(HERE, "py"), encoding: "utf8" }));
  assert.deepEqual(LIN_Q40.map(String), gen.lin_q40.map(String));
  assert.deepEqual(M1_Q40.map((r) => r.map(String)), gen.m1_q40.map((r) => r.map(String)));
  assert.deepEqual(M2_Q40.map((r) => r.map(String)), gen.m2_q40.map((r) => r.map(String)));
});

// Ottosson's published matrices do not map white exactly to (1, 0, 0): float64 gives L 0.999999993474,
// a 8.1e-11, b 3.7274e-8. The exact path must reproduce that to 1e-9, and black must read 0.
test("T4.mean: white matches float OKLab of white to 1e-9 and black reads 0", () => {
  const one = (r, g, b) => oklabMeanExact(Uint8Array.from([r, g, b, 255]), 1, 1);
  const w = one(255, 255, 255), k = one(0, 0, 0);
  const ref = { L: 0.999999993474, a: 0.000000000081, b: 0.000000037274 };
  for (const c of ["L", "a", "b"]) assert.ok(Math.abs(Number(w[c]) - ref[c]) <= 1e-9, `${c} ${w[c]}`);
  assert.deepEqual(k, { L: "0.000000000", a: "0.000000000", b: "0.000000000" });
});
