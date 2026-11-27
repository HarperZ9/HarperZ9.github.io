// tests/buildos-cluster-surface.test.mjs: Node live WASM & contract suite for Wave 158A /playground/buildos-cluster/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  runAttackVector, runNominalModule, verifyAndInstantiateModule,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/buildos-cluster/cluster_lab.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = path.resolve(HERE, "..", "playground", "buildos-cluster");
const HTML = readFileSync(path.join(PAGE_DIR, "index.html"), "utf8");
const MANIFEST_RAW = readFileSync(path.join(PAGE_DIR, "cluster_manifest.json"));
const META_SHA = (HTML.match(/<meta name="cluster-manifest-sha256" content="([0-9a-f]{64})">/) || [])[1];

test("manifest SHA-256 is pinned and binds exact 4 MIT WASMs (136,145 B) and 16 fail-closed attacks", async () => {
  assert.ok(META_SHA, "Missing cluster-manifest-sha256 meta tag");
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  assert.equal(m.modules.length, 4);
  assert.equal(m.attacks.length, 16);
  assert.equal(m.total_wasm_bytes, 136145);
  const byId = Object.fromEntries(m.modules.map((x) => [x.id, x]));
  assert.equal(byId.cluster_v21.imports_count, 0);
  assert.equal(byId.bft_ledger.imports_count, 0);
  assert.equal(byId.zk_pedersen.imports_count, 0);
  assert.equal(byId.titan_rsi.bytes, 9261);
});

test("all 4 WASM binaries execute live nominally and trap all 16/16 fail-closed attacks", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  let blocked = 0;
  for (const mod of m.modules) {
    const raw = readFileSync(path.join(PAGE_DIR, "wasm", mod.file));
    const ex = await verifyAndInstantiateModule(raw, mod);
    const nom = runNominalModule(mod.id, ex);
    assert.equal(nom.ok, true, `Nominal failed for ${mod.id}: ${nom.summary}`);
    for (const atk of m.attacks.filter((a) => a.module_id === mod.id)) {
      const ex2 = await verifyAndInstantiateModule(raw, mod);
      const r = runAttackVector(atk, ex2);
      assert.equal(r.blocked, true, `Attack ${atk.id} returned ${r.rc}, expected ${atk.expected_rc}`);
      blocked++;
    }
  }
  assert.equal(blocked, 16);
});

test("3/3 planted fail-closed tamper controls reject manifest tamper, WASM 1-byte tamper, and bad schema", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  const badMan = Buffer.from(MANIFEST_RAW);
  badMan[0] ^= 0x20;
  await assert.rejects(() => verifyPinnedManifest(badMan, META_SHA), /SHA-256 mismatch/);

  const c0 = m.modules[0];
  const badWasm = Buffer.from(readFileSync(path.join(PAGE_DIR, "wasm", c0.file)));
  badWasm[badWasm.length - 1] ^= 0x01;
  await assert.rejects(() => verifyAndInstantiateModule(badWasm, c0), /SHA-256 mismatch/);

  const forged = { ...m, schema: "forged-cluster/99" };
  const fBuf = Buffer.from(JSON.stringify(forged), "utf8");
  const fSha = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", fBuf)), (b) => b.toString(16).padStart(2, "0")).join("");
  await assert.rejects(() => verifyPinnedManifest(fBuf, fSha), /Unexpected manifest schema/);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  verifySurfaceConsistency(HTML, m);
  assert.ok(HTML.includes('class="reading ds-sheet"'));
  assert.ok(HTML.includes('id="cl-module"'));
  assert.ok(HTML.includes('id="cl-attack"'));
  assert.ok(HTML.includes('id="cl-run-all"'));
  assert.ok(!HTML.includes("data-copy="));
  const jsSrc = readFileSync(path.join(PAGE_DIR, "cluster_lab.mjs"), "utf8");
  assert.ok(!/from\s+["']node:/.test(jsSrc), "Browser module must have zero Node imports");
});
