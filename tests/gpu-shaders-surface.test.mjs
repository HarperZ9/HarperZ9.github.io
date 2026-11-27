import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MANIFEST_EXPECTED_SHA256,
  classifyDomain,
  computeSummary,
  filterShaders,
  renderBackendSvg,
  renderShaderRows,
  verifySurfaceConsistency,
} from "../playground/gpu-shaders/gpu_shaders.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const GPU_DIR = path.join(ROOT, "playground", "gpu-shaders");

const manifestPath = path.join(GPU_DIR, "gpu_120pack_manifest.json");
const htmlPath = path.join(GPU_DIR, "index.html");
const modPath = path.join(GPU_DIR, "gpu_shaders.mjs");

const rawManifest = readFileSync(manifestPath);
const manifest = JSON.parse(rawManifest.toString("utf8"));
const html = readFileSync(htmlPath, "utf8");
const modSrc = readFileSync(modPath, "utf8");

test("gpu_120pack_manifest.json matches exact SHA-256 and 120/120 schema", () => {
  const digest = `sha256:${createHash("sha256").update(rawManifest).digest("hex")}`;
  assert.equal(digest, MANIFEST_EXPECTED_SHA256);
  assert.equal(manifest.schema, "buildlang-workstation-gpu-120pack/1");
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.unique_kernels, 24);
  assert.equal(manifest.gpu_targets, 5);
  assert.equal(manifest.total_certified_shaders, 120);
  assert.equal(manifest.total_superopt_rewrites, 500);
  assert.equal(manifest.total_shader_bytes, 390286);
  assert.equal(manifest.shaders.length, 120);
});

test("all 120/120 displayed entries in index.html match gpu_120pack_manifest.json", () => {
  const verdict = verifySurfaceConsistency(html, manifest);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.checkedShaders, 120);

  const s = computeSummary(manifest);
  assert.equal(s.totalShaders, 120);
  assert.equal(s.passCount, 120);
  assert.equal(s.totalRewrites, 500);
  assert.equal(s.totalBytes, 390286);
  assert.equal(s.domains["AI/LLM"] + s.domains["Rendering/RT"] + s.domains["Physics/Ocean"] + s.domains["Crypto/Merkle"], 120);
  for (const t of ["wgsl", "hlsl", "msl", "spirv", "glsl"]) {
    assert.equal(s.targets[t], 24, `Expected 24 shaders for ${t}`);
  }
});

test("domain, backend, search, sort, and SVG summary helpers work accurately", () => {
  assert.equal(filterShaders(manifest.shaders, { domain: "AI/LLM" }).length, 30);
  assert.equal(filterShaders(manifest.shaders, { domain: "Rendering/RT" }).length, 65);
  assert.equal(filterShaders(manifest.shaders, { domain: "Physics/Ocean" }).length, 20);
  assert.equal(filterShaders(manifest.shaders, { domain: "Crypto/Merkle" }).length, 5);

  for (const t of ["wgsl", "hlsl", "msl", "spirv", "glsl"]) {
    assert.equal(filterShaders(manifest.shaders, { target: t }).length, 24);
  }

  const aiHlsl = filterShaders(manifest.shaders, { domain: "AI/LLM", target: "hlsl" });
  assert.equal(aiHlsl.length, 6);
  assert.ok(aiHlsl.every((x) => classifyDomain(x.kernel) === "AI/LLM" && x.target === "hlsl"));

  const shaSearch = filterShaders(manifest.shaders, { query: manifest.shaders[0].shader_sha256.slice(0, 16) });
  assert.equal(shaSearch.length, 1);
  assert.equal(shaSearch[0].kernel, manifest.shaders[0].kernel);

  const byRewrites = filterShaders(manifest.shaders, { sortBy: "rewrites_desc" });
  assert.ok(byRewrites[0].rewrites >= byRewrites[byRewrites.length - 1].rewrites);

  const svg = renderBackendSvg(computeSummary(manifest));
  assert.ok(svg.includes("<svg"));
  for (const lbl of ["WGSL", "HLSL", "MSL", "SPIR-V", "GLSL"]) {
    assert.ok(svg.includes(lbl), `SVG missing ${lbl}`);
  }

  const rows = renderShaderRows(aiHlsl);
  assert.equal((rows.match(/data-kernel="/g) || []).length, 6);
});

test("planted fail-closed controls catch tampered SHA-256, rewrite drift, and failed cert", () => {
  // Control 1: 1-char tampered shader_sha256
  const badSha = structuredClone(manifest);
  const orig = badSha.shaders[0].shader_sha256;
  badSha.shaders[0].shader_sha256 = (orig[0] === "0" ? "1" : "0") + orig.slice(1);
  assert.throws(() => verifySurfaceConsistency(html, badSha), /missing shader_sha256 prefix/);

  // Control 2: tampered total_superopt_rewrites
  const badRewrites = structuredClone(manifest);
  badRewrites.total_superopt_rewrites = 999;
  assert.throws(() => verifySurfaceConsistency(html, badRewrites), /Rewrite count mismatch/);

  // Control 3: verify_cert flipped to FAIL
  const badCert = structuredClone(manifest);
  badCert.shaders[119].verify_cert = "FAIL";
  assert.throws(() => verifySurfaceConsistency(html, badCert), /Fail-closed cert check failed/);
});

test("DESIGN-RULES.md One Shell Measured Drafting Sheet and strict public hygiene", () => {
  assert.ok(html.includes('href="/world/ui/shell/shell.css'));
  assert.ok(html.includes('href="/studies/studies.css'));
  assert.ok(html.includes('class="reading ds-sheet"'));
  assert.ok(html.includes('class="o-hand o-said"'));
  assert.ok(html.includes('id="o-menu"'));
  assert.ok(html.includes('class="ds-prov"'));
  assert.ok(!html.includes('class="gw-backdrop"'));

  const cdnRegex = /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|stackpath\.bootstrapcdn)/i;
  assert.ok(!cdnRegex.test(html), "External CDN link found in index.html");
  assert.ok(!cdnRegex.test(modSrc), "External CDN link found in gpu_shaders.mjs");

  const manifestText = rawManifest.toString("utf8");
  for (const [label, text] of [
    ["index.html", html],
    ["gpu_shaders.mjs", modSrc],
    ["gpu_120pack_manifest.json", manifestText],
  ]) {
    assert.ok(!text.includes("\u2014"), `${label}: em dash found`);
    assert.ok(!text.includes("\u2013"), `${label}: en dash found`);
    assert.ok(!/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(text), `${label}: local path found`);
    assert.ok(!/zentropy|DS-08|isomorph/i.test(text), `${label}: forbidden token found`);
  }
});
