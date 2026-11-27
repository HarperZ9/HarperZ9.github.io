// tests/mir-assurance-surface.test.mjs: Node contract, live WASM, and 3/3 planted tamper suite for Wave 162A.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runHsmAttack, runHsmNominal, verifyAndInstantiateHsm,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/mir-assurance/mir_assurance_lab.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PG = path.resolve(HERE, "..", "playground", "mir-assurance");
const html = readFileSync(path.join(PG, "index.html"), "utf8");
const js = readFileSync(path.join(PG, "mir_assurance_lab.mjs"), "utf8");
const jsonBuf = readFileSync(path.join(PG, "mir_assurance_manifest.json"));
const metaMatch = html.match(/<meta name="mir-manifest-sha256" content="([0-9a-f]{64})">/);

test("manifest SHA-256 is pinned and binds 4 MIR pillars (66/66 fns), 11,087 B 0-import HSM WASM, and 4 attacks", async () => {
  assert.ok(metaMatch, "Missing mir-manifest-sha256 meta tag");
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);
  assert.equal(m.total_pillars, 4);
  assert.equal(m.total_core_modules, 5);
  assert.equal(m.total_core_functions, 66);
  assert.equal(m.hsm.bytes, 11087);
  assert.equal(m.hsm.imports_count, 0);
  assert.equal(m.hsm.strict_zero_imports, true);
  assert.equal(m.attacks.length, 4);
  const fnSum = m.core_modules.reduce((acc, x) => acc + x.functions, 0);
  assert.equal(fnSum, 66);
});

test("HSM WASM executes live nominally (1n, RFC 6962 root) and traps all 4/4 fail-closed attacks (-101..-401)", async () => {
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);
  const wBuf = readFileSync(path.join(PG, "wasm", m.hsm.file));
  const ex = await verifyAndInstantiateHsm(wBuf, m.hsm);
  const nom = runHsmNominal(ex);
  assert.equal(nom.ok, true);
  assert.equal(nom.rc, 1);
  assert.equal(nom.rootHex, m.hsm.expected_root_hex);
  for (const atk of m.attacks) {
    const ex2 = await verifyAndInstantiateHsm(wBuf, m.hsm);
    const r = runHsmAttack(atk, ex2);
    assert.equal(r.blocked, true, `Attack ${atk.id} expected ${atk.expected_rc}, got ${r.rc}`);
    assert.equal(r.rc, atk.expected_rc);
  }
});

test("3/3 planted fail-closed tamper controls reject manifest tamper, 1-byte WASM flip, and bad schema", async () => {
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);

  // Control 1: 1-byte manifest tamper
  const badJson = Buffer.from(jsonBuf);
  badJson[badJson.length - 3] ^= 0x01;
  await assert.rejects(() => verifyPinnedManifest(badJson, metaMatch[1]), /Manifest SHA-256 mismatch/);

  // Control 2: 1-byte WASM payload flip
  const wBuf = Buffer.from(readFileSync(path.join(PG, "wasm", m.hsm.file)));
  wBuf[wBuf.length - 1] ^= 0x01;
  await assert.rejects(() => verifyAndInstantiateHsm(wBuf, m.hsm), /HSM WASM SHA-256 mismatch/);

  // Control 3: corrupted schema version
  const badSchema = Buffer.from(JSON.stringify({ ...m, schema: "evil-tampered/999" }));
  const badSha = await (await import("node:crypto")).createHash("sha256").update(badSchema).digest("hex");
  await assert.rejects(() => verifyPinnedManifest(badSchema, badSha), /Unexpected schema/);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", async () => {
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);
  assert.equal(verifySurfaceConsistency(html, m), true);
  assert.equal(html.includes("data-copy"), false);
  assert.equal(/https?:\/\/(cdn\.|unpkg\.|fonts\.googleapis)/.test(html), false);
  for (const leak of ["C:/dev", "C:\\dev", "E:/wt", "E:\\wt", "C:/Users", "C:\\Users"]) {
    assert.equal(html.includes(leak), false, `Local path leak in HTML: ${leak}`);
    assert.equal(js.includes(leak), false, `Local path leak in JS: ${leak}`);
  }
  assert.equal(js.includes("node:"), false, "Browser ESM must have 0 node: imports");
});
