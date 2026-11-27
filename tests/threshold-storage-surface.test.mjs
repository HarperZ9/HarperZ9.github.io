// tests/threshold-storage-surface.test.mjs: Node contract, live WASM, and 3/3 planted tamper suite for Wave 165A Drop-In #17.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAttackVector, runNominalModule, verifyAndInstantiateZeroImport,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/threshold-storage/threshold_storage_lab.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PG = path.resolve(HERE, "..", "playground", "threshold-storage");
const html = readFileSync(path.join(PG, "index.html"), "utf8");
const js = readFileSync(path.join(PG, "threshold_storage_lab.mjs"), "utf8");
const jsonBuf = readFileSync(path.join(PG, "threshold_storage_manifest.json"));
const metaMatch = html.match(/<meta name="ts-manifest-sha256" content="([0-9a-f]{64})">/);

test("manifest SHA-256 is pinned and binds 2 strictly 0-import MIT WASMs (20,066 B) and 8 attacks", async () => {
  assert.ok(metaMatch, "Missing ts-manifest-sha256 meta tag");
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);
  assert.equal(m.total_modules, 2);
  assert.equal(m.total_wasm_bytes, 20066);
  assert.equal(m.total_attacks, 8);
  for (const mod of m.modules) {
    assert.equal(mod.imports_count, 0);
    assert.equal(mod.strict_zero_imports, true);
  }
});

test("both 0-import WASM binaries execute live nominally with exact RFC 6962 roots and trap all 8/8 attacks", async () => {
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);
  for (const mod of m.modules) {
    const raw = readFileSync(path.join(PG, "wasm", mod.file));
    const ex = await verifyAndInstantiateZeroImport(raw, mod);
    const nom = runNominalModule(mod, ex);
    assert.equal(nom.ok, true, `${mod.id} nominal failed`);
    assert.equal(nom.rootHex, mod.expected_root_hex);
    if (mod.id === "raid6_fs") {
      assert.equal(nom.healed, 15);
      assert.equal(nom.bytesHealed, 2880);
    }
    for (const a of m.attacks.filter((x) => x.module_id === mod.id)) {
      const ex2 = await verifyAndInstantiateZeroImport(raw, mod);
      const r = runAttackVector(a, mod, ex2);
      assert.equal(r.blocked, true, `Attack ${a.id} expected ${a.expected_rc}, got ${r.rc}`);
    }
  }
});

test("3/3 planted fail-closed tamper controls reject manifest tamper, 1-byte WASM flip, and bad schema", async () => {
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);

  const badJson = Buffer.from(jsonBuf);
  badJson[badJson.length - 3] ^= 0x01;
  await assert.rejects(() => verifyPinnedManifest(badJson, metaMatch[1]), /Manifest SHA-256 mismatch/);

  const raidMod = m.modules.find((x) => x.id === "raid6_fs");
  const wBuf = Buffer.from(readFileSync(path.join(PG, "wasm", raidMod.file)));
  wBuf[wBuf.length - 1] ^= 0x01;
  await assert.rejects(() => verifyAndInstantiateZeroImport(wBuf, raidMod), /SHA-256 mismatch/);

  const badSchema = Buffer.from(JSON.stringify({ ...m, schema: "evil-tampered/999" }));
  const badSha = (await import("node:crypto")).createHash("sha256").update(badSchema).digest("hex");
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
