// tests/renderer-35-surface.test.mjs: Node live WASM & contract suite for Wave 151A /playground/renderer-35/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterModules, runRendererParity, verifyAndInstantiateRenderer,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/renderer-35/renderer_showcase.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = path.resolve(HERE, "..", "playground", "renderer-35");
const HTML = readFileSync(path.join(PAGE_DIR, "index.html"), "utf8");
const MANIFEST_RAW = readFileSync(path.join(PAGE_DIR, "renderer_35_manifest.json"));
const META_SHA = (HTML.match(/<meta name="renderer-35-manifest-sha256" content="([0-9a-f]{64})">/) || [])[1];

test("manifest SHA-256 is pinned and indexes 35/35 0-ULP modules and 4 live renderer WASMs (49,799 B)", async () => {
  assert.ok(META_SHA, "Missing renderer-35-manifest-sha256 meta tag");
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  assert.equal(m.modules.length, 35);
  assert.equal(m.wasm_modules.length, 4);
  assert.equal(m.total_wasm_bytes, 49799);
  assert.equal(m.modules[34].name, "art_hatch.bld");
  assert.equal(m.modules[34].fnv1a_pin, "0xbd556d27b9d7c43a");
  const c1 = filterModules(m.modules, { cohort: "core-1-11" });
  const c2 = filterModules(m.modules, { cohort: "pbr-bvh-12-24" });
  const c3 = filterModules(m.modules, { cohort: "crt-media-25-35" });
  assert.equal(c1.length, 11);
  assert.equal(c2.length, 13);
  assert.equal(c3.length, 11);
});

test("all 4 live renderer WASM binaries match C++23 FNV-1a pins at 0 ULP and reject 4/4 planted ablations", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  for (const w of m.wasm_modules) {
    const raw = readFileSync(path.join(PAGE_DIR, "wasm", w.file));
    const ex = await verifyAndInstantiateRenderer(raw, w);
    const nom = runRendererParity(w, ex, 0);
    assert.equal(nom.ok, true, `${w.id} nominal mismatch: ${nom.hashHex}`);
    const abl = runRendererParity(w, ex, 1);
    assert.equal(abl.rejected, true, `${w.id} ablation not rejected: ${abl.hashHex}`);
  }
});

test("3/3 planted fail-closed tamper controls reject manifest tamper, WASM 1-byte tamper, and bad schema", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  // Control 1: 1-byte manifest tamper
  const badMan = Buffer.from(MANIFEST_RAW);
  badMan[0] ^= 0x20;
  await assert.rejects(() => verifyPinnedManifest(badMan, META_SHA), /SHA-256 mismatch/);

  // Control 2: 1-byte WASM tamper
  const w0 = m.wasm_modules[0];
  const badWasm = Buffer.from(readFileSync(path.join(PAGE_DIR, "wasm", w0.file)));
  badWasm[badWasm.length - 1] ^= 0x01;
  await assert.rejects(() => verifyAndInstantiateRenderer(badWasm, w0), /SHA-256 mismatch/);

  // Control 3: Forged schema with valid SHA-256
  const forged = { ...m, schema: "forged-renderer/99" };
  const fBuf = Buffer.from(JSON.stringify(forged), "utf8");
  const fSha = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", fBuf)), (b) => b.toString(16).padStart(2, "0")).join("");
  await assert.rejects(() => verifyPinnedManifest(fBuf, fSha), /Unexpected manifest schema/);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  verifySurfaceConsistency(HTML, m);
  assert.ok(HTML.includes('class="reading ds-sheet"'));
  assert.ok(HTML.includes('id="ren-cohort"'));
  assert.ok(HTML.includes('id="ren-run-all"'));
  assert.ok(HTML.includes('id="ren-ablate-all"'));
  assert.ok(!HTML.includes("data-copy="));
  const jsSrc = readFileSync(path.join(PAGE_DIR, "renderer_showcase.mjs"), "utf8");
  assert.ok(!/from\s+["']node:/.test(jsSrc), "Browser module must have zero Node imports");
});
