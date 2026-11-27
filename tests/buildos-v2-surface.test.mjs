// tests/buildos-v2-surface.test.mjs: Node contract & live WASM test suite for Wave 136D /playground/buildos-v2/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_SOVEREIGN_ROOT, runKernelAttack, runSovereignBoot,
  verifyAndInstantiateKernel, verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/buildos-v2/buildos_v2_showcase.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = path.resolve(HERE, "..", "playground", "buildos-v2");
const HTML = readFileSync(path.join(PAGE_DIR, "index.html"), "utf8");
const MANIFEST_RAW = readFileSync(path.join(PAGE_DIR, "buildos_v2_manifest.json"));
const META_SHA = (HTML.match(/<meta name="buildos-v2-manifest-sha256" content="([0-9a-f]{64})">/) || [])[1];

test("manifest SHA-256 is pinned and binds zero-import 134,198 B BuildOS-2.0 WASM, 12 subsystems, and 8 attacks", async () => {
  assert.ok(META_SHA, "Missing buildos-v2-manifest-sha256 meta tag");
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  assert.equal(manifest.wasm.bytes, 134198);
  assert.equal(manifest.wasm.imports_count, 0);
  assert.equal(manifest.wasm.expected_sovereign_root, EXPECTED_SOVEREIGN_ROOT);
  assert.equal(manifest.subsystems.length, 12);
  assert.equal(manifest.attacks.length, 8);
});

test("live BuildOS-2.0 WASM boots all 12 subsystems to exact RFC 6962 root and traps all 8/8 attacks (-101..-801)", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  const wasmRaw = readFileSync(path.join(PAGE_DIR, "wasm", manifest.wasm.file));
  const ex = await verifyAndInstantiateKernel(wasmRaw, manifest.wasm);
  const boot = runSovereignBoot(ex);
  assert.equal(boot.ok, true);
  assert.equal(boot.subsystems_booted, 12);
  assert.equal(boot.smp_cores, 4);
  assert.equal(boot.ed25519_checks, 3);
  assert.equal(boot.pq_modulus_q, 3329);
  assert.equal(boot.sovereign_root, EXPECTED_SOVEREIGN_ROOT);

  let blocked = 0;
  for (const atk of manifest.attacks) {
    const res = runKernelAttack(atk, ex);
    assert.equal(res.blocked, true, `Attack ${atk.id} returned ${res.rc}, expected ${atk.expected_rc}`);
    assert.equal(res.rc, atk.expected_rc);
    blocked++;
  }
  assert.equal(blocked, 8);
});

test("3/3 planted fail-closed tamper controls reject manifest tamper, WASM 1-byte tamper, and bad schema", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  // Control 1: 1-byte manifest tamper
  const badManifest = Buffer.from(MANIFEST_RAW);
  badManifest[0] ^= 0x20;
  await assert.rejects(() => verifyPinnedManifest(badManifest, META_SHA), /SHA-256 mismatch/);

  // Control 2: 1-byte WASM binary tamper
  const badWasm = Buffer.from(readFileSync(path.join(PAGE_DIR, "wasm", manifest.wasm.file)));
  badWasm[badWasm.length - 1] ^= 0x01;
  await assert.rejects(() => verifyAndInstantiateKernel(badWasm, manifest.wasm), /SHA-256 mismatch/);

  // Control 3: Forged schema with valid SHA-256
  const forged = { ...manifest, schema: "forged-v2/99" };
  const forgedBuf = Buffer.from(JSON.stringify(forged), "utf8");
  const forgedSha = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", forgedBuf)), (b) => b.toString(16).padStart(2, "0")).join("");
  await assert.rejects(() => verifyPinnedManifest(forgedBuf, forgedSha), /Unexpected manifest schema/);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  verifySurfaceConsistency(HTML, manifest);
  assert.ok(HTML.includes('class="reading ds-sheet"'));
  assert.ok(HTML.includes('id="v2-boot-btn"'));
  assert.ok(HTML.includes('id="v2-attack"'));
  assert.ok(HTML.includes('id="v2-attack-btn"'));
  assert.ok(HTML.includes('id="v2-all-attacks-btn"'));
  assert.ok(!HTML.includes("data-copy="));
  const jsSrc = readFileSync(path.join(PAGE_DIR, "buildos_v2_showcase.mjs"), "utf8");
  assert.ok(!/from\s+["']node:/.test(jsSrc), "Browser module must have zero Node imports");
});
