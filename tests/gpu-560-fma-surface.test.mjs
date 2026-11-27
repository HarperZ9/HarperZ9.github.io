// tests/gpu-560-fma-surface.test.mjs: Node contract, live WASM, and 3/3 planted tamper suite for Wave 168A Drop-In #18.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_IRID_HASH, runLiveWasm, verifyAndInstantiatePrintOnly,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/gpu-560-fma/gpu_560_fma_lab.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PG = path.resolve(HERE, "..", "playground", "gpu-560-fma");
const html = readFileSync(path.join(PG, "index.html"), "utf8");
const js = readFileSync(path.join(PG, "gpu_560_fma_lab.mjs"), "utf8");
const jsonBuf = readFileSync(path.join(PG, "gpu_560_fma_manifest.json"));
const metaMatch = html.match(/<meta name="gf-manifest-sha256" content="([0-9a-f]{64})">/);

test("manifest SHA-256 is pinned and binds 560/560 shaders (112 kernels, 4,009 rewrites) and 2 MIT WASMs", async () => {
  assert.ok(metaMatch, "Missing gf-manifest-sha256 meta tag");
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);
  assert.equal(m.total_shaders, 560);
  assert.equal(m.unique_kernels, 112);
  assert.equal(m.total_rewrites, 4009);
  assert.equal(m.fma_5way_sites_total, 230);
  assert.equal(m.total_wasm_bytes, 43980);
});

test("both MIT WASM payloads execute live with 0-ULP Belcour-Barla hash and FlashAttn drift <= 1e-12 + 2/2 traps", async () => {
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);
  for (const w of m.wasms) {
    const raw = readFileSync(path.join(PG, "wasm", w.file));
    const ex = await verifyAndInstantiatePrintOnly(raw, w);
    const r = runLiveWasm(w.id, ex);
    assert.equal(r.ok, true, `${w.id} failed: ${r.summary}`);
    if (w.id === "iridescence") assert.equal(r.hash, EXPECTED_IRID_HASH);
    if (w.id === "flash_attn") {
      assert.equal(r.metrics.failures, 0);
      assert.ok(r.metrics.max_energy_drift <= 1e-12);
      assert.equal(r.traps.badZero, 0);
      assert.equal(r.traps.badNeg, 0);
    }
  }
});

test("3/3 planted fail-closed tamper controls reject manifest tamper, 1-byte WASM flip, and bad schema", async () => {
  const m = await verifyPinnedManifest(jsonBuf, metaMatch[1]);

  const badJson = Buffer.from(jsonBuf);
  badJson[badJson.length - 3] ^= 0x01;
  await assert.rejects(() => verifyPinnedManifest(badJson, metaMatch[1]), /Manifest SHA-256 mismatch/);

  const fa = m.wasms.find((x) => x.id === "flash_attn");
  const wBuf = Buffer.from(readFileSync(path.join(PG, "wasm", fa.file)));
  wBuf[wBuf.length - 1] ^= 0x01;
  await assert.rejects(() => verifyAndInstantiatePrintOnly(wBuf, fa), /SHA-256 mismatch/);

  const badSchema = Buffer.from(JSON.stringify({ ...m, schema: "evil-tampered/999" }));
  const badSha = (await import("node:crypto")).createHash("sha256").update(badSchema).digest("hex");
  await assert.rejects(() => verifyPinnedManifest(badSchema, badSha), /Unexpected schema/);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], #gf-kernel/#gf-backend, zero local paths", async () => {
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
