// tests/gpu-compute-surface.test.mjs: Node contract suite for Wave 167C /playground/gpu-compute/ (560-shader pack #68973)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  TARGETS, filterKernels, runFailClosedSelfTest,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/gpu-compute/gpu_explorer.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = path.resolve(HERE, "..", "playground", "gpu-compute");
const HTML = readFileSync(path.join(PAGE_DIR, "index.html"), "utf8");
const MANIFEST_RAW = readFileSync(path.join(PAGE_DIR, "gpu_explorer_manifest.json"));
const META_SHA = (HTML.match(/<meta name="gpu-manifest-sha256" content="([0-9a-f]{64})">/) || [])[1];

test("manifest SHA-256 is pinned and indexes exact 560 shaders (112 MIT kernels x 5 backends, 4,009 rewrites, 2,329,296 B)", async () => {
  assert.ok(META_SHA, "Missing gpu-manifest-sha256 meta tag");
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  assert.equal(manifest.receipt_catalogue_id, 68973);
  assert.equal(manifest.unique_kernels, 112);
  assert.equal(manifest.total_certified_shaders, 560);
  assert.equal(manifest.total_superopt_rewrites, 4009);
  assert.equal(manifest.total_shader_bytes, 2329296);
  assert.equal(manifest.batches.length, 17);
  for (const t of TARGETS) assert.equal(manifest.per_target_counts[t], 112);
});

test("domain, batch, backend, and search filters partition all 112 kernels deterministically", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  const domPbr = filterKernels(manifest.kernels, { domain: "rendering-pbr" });
  const domAi = filterKernels(manifest.kernels, { domain: "titan-ai-rlvr" });
  const domSci = filterKernels(manifest.kernels, { domain: "physics-sci-frontier" });
  assert.equal(domPbr.length, 24);
  assert.equal(domAi.length, 20);
  assert.equal(domSci.length, 68);
  assert.equal(domPbr.length + domAi.length + domSci.length, 112);
  assert.equal(filterKernels(manifest.kernels, { batch: "wave135c_frontier_domain_280pack" }).length, 8);
  assert.equal(filterKernels(manifest.kernels, { batch: "wave166a_qchem_zk_560pack" }).length, 8);
  assert.equal(filterKernels(manifest.kernels, { query: "flash_attention" }).length, 1);
  assert.equal(filterKernels(manifest.kernels, { backend: "wgsl" }).length, 112);
});

test("3/3 planted fail-closed tamper controls trap manifest tamper, forged cert digest, and truncated kernel list", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  const res = await runFailClosedSelfTest(MANIFEST_RAW, META_SHA, manifest);
  assert.equal(res.ok, true);
  assert.equal(res.caught, 3);
  assert.equal(res.total, 3);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", async () => {
  const manifest = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  verifySurfaceConsistency(HTML, manifest);
  assert.ok(HTML.includes('class="reading ds-sheet"'));
  assert.ok(HTML.includes('id="gpu-batch"'));
  assert.ok(HTML.includes('id="gpu-backend"'));
  assert.ok(HTML.includes('id="gpu-tamper-btn"'));
  assert.match(HTML, /\/world\/ui\/shell\/shell\.css/);
  assert.ok(!HTML.includes("data-copy="));
  const jsSrc = readFileSync(path.join(PAGE_DIR, "gpu_explorer.mjs"), "utf8");
  assert.ok(!/from\s+["']node:/.test(jsSrc), "Browser module must have zero Node imports");
  assert.doesNotMatch(HTML, /[\u2013\u2014]/);
});
