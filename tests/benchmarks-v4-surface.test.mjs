// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Deterministic surface, filter, and fail-closed verification tests for /playground/benchmarks-v4/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterWorkloads, sha256Hex, verifyPinnedBenchmarks, verifySurfaceConsistency,
} from "../playground/benchmarks-v4/benchmarks_v4_explorer.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PG = path.join(HERE, "..", "playground", "benchmarks-v4");
const html = readFileSync(path.join(PG, "index.html"), "utf8");
const mjs = readFileSync(path.join(PG, "benchmarks_v4_explorer.mjs"), "utf8");
const rawJson = readFileSync(path.join(PG, "benchmarks_v4_manifest.json"));
const data = JSON.parse(rawJson.toString("utf8"));

test("manifest SHA-256 is pinned in index.html and covers 20/20 workloads across 57 runtime cells (#68814)", async () => {
  const m = html.match(/<meta name="benchmarks-v4-sha256" content="([0-9a-f]{64})">/);
  assert.ok(m, "missing benchmarks-v4-sha256 meta tag");
  const { sha256, data: verified } = await verifyPinnedBenchmarks(rawJson, m[1]);
  assert.equal(sha256, m[1]);
  assert.equal(verified.workloads.length, 20);
  assert.equal(verified.summary.total_measured_runtime_cells, 57);
  assert.equal(verified.receipt_catalogue_id, 68814);
  const byId = Object.fromEntries(verified.workloads.map((w) => [w.id, w]));
  assert.equal(byId.titan_1m.native_speedup, 37.73);
  assert.equal(byId.indirect_draw_cull.native_speedup, 13.75);
  assert.equal(byId.sha256.wasm_speedup, 10.98);
  assert.equal(byId.buildos_slice21_net_pkg.wasm_speedup, 1.59);
  assert.equal(byId.cs014_fractal_weights.native_speedup, 2.24);
  assert.equal(byId.cs005_fca_titans_128k.native_speedup, 2.03);
});

test("category, tier, and search filters partition all 20 workloads deterministically", () => {
  assert.equal(filterWorkloads(data.workloads, { category: "buildos-zeroc" }).length, 4);
  assert.equal(filterWorkloads(data.workloads, { category: "crypto-tls" }).length, 4);
  assert.equal(filterWorkloads(data.workloads, { category: "ai-surpass" }).length, 6);
  assert.equal(filterWorkloads(data.workloads, { category: "graphics-graph" }).length, 6);
  assert.equal(filterWorkloads(data.workloads, { tier: "v4_frontier" }).length, 7);
  assert.equal(filterWorkloads(data.workloads, { query: "slice21" }).length, 1);
  assert.equal(filterWorkloads(data.workloads, { category: "crypto-tls", tier: "v4_frontier" }).length, 0);
});

test("3/3 planted fail-closed controls reject 1-byte tamper, forged schema, and truncated workload list", async () => {
  const realSha = await sha256Hex(rawJson);
  const tampered = new Uint8Array(rawJson);
  tampered[tampered.length - 2] ^= 0x01;
  await assert.rejects(() => verifyPinnedBenchmarks(tampered, realSha), (e) => e.code === "sha256_mismatch");

  const badSchema = Buffer.from(JSON.stringify({ ...data, schema: "forged/9" }), "utf8");
  const badSchemaSha = await sha256Hex(badSchema);
  await assert.rejects(() => verifyPinnedBenchmarks(badSchema, badSchemaSha), (e) => e.code === "bad_schema");

  const trunc = Buffer.from(JSON.stringify({ ...data, workloads: data.workloads.slice(0, 19) }), "utf8");
  const truncSha = await sha256Hex(trunc);
  await assert.rejects(() => verifyPinnedBenchmarks(trunc, truncSha), (e) => e.code === "bad_workload_count");
});

test("page markup matches Measured Drafting Sheet canon, zero CDN, zero local paths, zero em/en dashes", () => {
  const chk = verifySurfaceConsistency(html, data);
  assert.equal(chk.ok, true);
  assert.equal(chk.rows, 20);
  assert.match(html, /class="reading ds-sheet"/);
  assert.match(html, /\/world\/ui\/shell\/shell\.css/);
  assert.doesNotMatch(html, /https?:\/\/(?:cdn|unpkg|jsdelivr|fonts\.googleapis)/i);
  assert.doesNotMatch(mjs, /from\s+["']node:/);
  for (const [name, txt] of [["index.html", html], ["benchmarks_v4_explorer.mjs", mjs], ["benchmarks_v4_manifest.json", rawJson.toString("utf8")]]) {
    assert.doesNotMatch(txt, /[\u2013\u2014]/, `${name} contains em/en dash`);
    assert.doesNotMatch(txt, /[A-Za-z]:\\|\/Users\/|\/home\//, `${name} contains local path`);
  }
});
