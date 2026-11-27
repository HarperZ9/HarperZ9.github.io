// tests/native-auditors-surface.test.mjs: Node contract suite for Wave 143D /playground/native-auditors/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterAuditors, runFailClosedSelfTest,
  verifyPinnedManifest, verifySurfaceConsistency,
} from "../playground/native-auditors/auditors_explorer.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = path.resolve(HERE, "..", "playground", "native-auditors");
const HTML = readFileSync(path.join(PAGE_DIR, "index.html"), "utf8");
const MANIFEST_RAW = readFileSync(path.join(PAGE_DIR, "auditors_manifest.json"));
const META_SHA = (HTML.match(/<meta name="auditors-manifest-sha256" content="([0-9a-f]{64})">/) || [])[1];

test("manifest SHA-256 is pinned and verifies 22/22 auditors, 15/15 OSS Gold (165/165), and 10/10 MCP Registry", async () => {
  assert.ok(META_SHA, "Missing auditors-manifest-sha256 meta tag");
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  assert.equal(m.cockpit.auditors.length, 22);
  assert.equal(m.cockpit.native_bins_tracked, 23);
  assert.equal(m.cockpit.stale_native_bins, 0);
  assert.equal(m.oss_gold_sbom_v3.gold_standard_score, "165/165");
  assert.equal(m.oss_gold_sbom_v3.total_sbom_files, 30);
  assert.equal(m.oss_gold_sbom_v3.total_components, 259);
  assert.equal(m.oss_gold_sbom_v3.stale_fsl, 0);
  assert.equal(m.oss_gold_sbom_v3.repositories.length, 15);
  assert.equal(m.mcp_registry.servers.length, 10);
  assert.equal(m.mcp_registry.total_dry_run_artifacts, 19);
});

test("lane, latency tier, and search filters partition all 22 native auditors deterministically", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  const core = filterAuditors(m.cockpit.auditors, { lane: "core-compiler-gates" });
  const sec = filterAuditors(m.cockpit.auditors, { lane: "security-os-gpu" });
  const gov = filterAuditors(m.cockpit.auditors, { lane: "data-docs-governance" });
  assert.equal(core.length, 7);
  assert.equal(sec.length, 7);
  assert.equal(gov.length, 8);
  assert.equal(core.length + sec.length + gov.length, 22);
  const sub = filterAuditors(m.cockpit.auditors, { speed: "sub-ms" });
  assert.ok(sub.length >= 6, `Expected >= 6 sub-ms auditors, got ${sub.length}`);
  const b2 = filterAuditors(m.cockpit.auditors, { query: "buildos_v2" });
  assert.equal(b2.length, 1);
});

test("3/3 planted fail-closed tamper controls trap manifest tamper, stale FSL injection, and truncated auditor list", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  const res = await runFailClosedSelfTest(MANIFEST_RAW, META_SHA, m);
  assert.equal(res.ok, true);
  assert.equal(res.caught, 3);
  assert.equal(res.total, 3);
});

test("page markup obeys Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", async () => {
  const m = await verifyPinnedManifest(MANIFEST_RAW, META_SHA);
  verifySurfaceConsistency(HTML, m);
  assert.ok(HTML.includes('class="reading ds-sheet"'));
  assert.ok(HTML.includes('id="aud-lane"'));
  assert.ok(HTML.includes('id="aud-speed"'));
  assert.ok(HTML.includes('id="aud-tamper-btn"'));
  assert.ok(!HTML.includes("data-copy="));
  const jsSrc = readFileSync(path.join(PAGE_DIR, "auditors_explorer.mjs"), "utf8");
  assert.ok(!/from\s+["']node:/.test(jsSrc), "Browser module must have zero Node imports");
});
