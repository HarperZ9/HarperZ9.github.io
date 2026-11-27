// tests/buildos-pq-surface.test.mjs: Node contract & live WASM test suite for Wave 134E /playground/buildos-pq/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  runAttackVector, runNominalModule, verifyAndInstantiateWasm,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/buildos-pq/pq_showcase.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = path.resolve(HERE, "..", "playground", "buildos-pq");
const HTML = readFileSync(path.join(PAGE_DIR, "index.html"), "utf8");
const MANIFEST_RAW = readFileSync(path.join(PAGE_DIR, "pq_manifest.json"));
const META_SHA = (HTML.match(/<meta name="pq-manifest-sha256" content="([0-9a-f]{64})">/) || [])[1];

test("manifest SHA-256 is pinned and lists exact 4 MIT WASM binaries (89,840 B) and 12 attacks", async () => {
  assert.ok(META_SHA, "Missing pq-manifest-sha256 meta tag");
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  assert.equal(manifest.total_modules, 4);
  assert.equal(manifest.total_attacks, 12);
  assert.equal(manifest.total_wasm_bytes, 89840);
  const byId = Object.fromEntries(manifest.modules.map((m) => [m.id, m]));
  assert.equal(byId.pq_hybrid_kem.bytes, 25674);
  assert.equal(byId.pq_hybrid_kem.imports_count, 0);
  assert.equal(byId.enclave_attest.bytes, 35925);
  assert.equal(byId.enclave_attest.imports_count, 0);
  assert.equal(byId.mcts_goodhart.bytes, 13626);
  assert.equal(byId.rlvr_synthesizer.bytes, 14615);
});

test("all 4 WASM binaries verify SHA-256, execute live nominally, and trap 12/12 fail-closed attacks", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  const exMap = new Map();
  for (const m of manifest.modules) {
    const raw = readFileSync(path.join(PAGE_DIR, "wasm", m.file));
    const ex = await verifyAndInstantiateWasm(raw, m);
    exMap.set(m.id, ex);
    const nom = runNominalModule(m.id, ex);
    assert.equal(nom.ok, true, `Nominal run failed for ${m.id}: ${nom.summary}`);
  }
  let blocked = 0;
  for (const atk of manifest.attacks) {
    const res = runAttackVector(atk, exMap.get(atk.module_id));
    assert.equal(res.blocked, true, `Attack ${atk.id} returned ${res.rc}, expected ${atk.expected_rc}`);
    assert.equal(res.rc, atk.expected_rc);
    blocked++;
  }
  assert.equal(blocked, 12);
});

test("3/3 planted fail-closed tamper controls reject manifest tamper, WASM 1-byte tamper, and bad schema", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  // Control 1: 1-byte manifest tamper
  const tamperedManifest = Buffer.from(MANIFEST_RAW);
  tamperedManifest[0] ^= 0x20;
  await assert.rejects(() => verifyPinnedManifest(tamperedManifest, META_SHA), /SHA-256 mismatch/);

  // Control 2: 1-byte WASM binary tamper
  const pqSpec = manifest.modules[0];
  const tamperedWasm = Buffer.from(readFileSync(path.join(PAGE_DIR, "wasm", pqSpec.file)));
  tamperedWasm[tamperedWasm.length - 1] ^= 0x01;
  await assert.rejects(() => verifyAndInstantiateWasm(tamperedWasm, pqSpec), /SHA-256 mismatch/);

  // Control 3: Forged schema with matching digest
  const badObj = { ...manifest, schema: "forged-schema/99" };
  const badBuf = Buffer.from(JSON.stringify(badObj), "utf8");
  const badSha = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", badBuf)), (b) => b.toString(16).padStart(2, "0")).join("");
  await assert.rejects(() => verifyPinnedManifest(badBuf, badSha), /Unexpected manifest schema/);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  verifySurfaceConsistency(HTML, manifest);
  assert.ok(HTML.includes('class="reading ds-sheet"'));
  assert.ok(HTML.includes('id="pq-module"'));
  assert.ok(HTML.includes('id="pq-attack"'));
  assert.ok(HTML.includes('id="pq-run-all"'));
  assert.ok(HTML.includes('id="pq-run-attack"'));
  assert.ok(!HTML.includes("data-copy="));
  const jsSrc = readFileSync(path.join(PAGE_DIR, "pq_showcase.mjs"), "utf8");
  assert.ok(!/from\s+["']node:/.test(jsSrc), "Browser module must have zero Node imports");
});
