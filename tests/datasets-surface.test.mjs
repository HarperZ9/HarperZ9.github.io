// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Deterministic surface, category filter, and fail-closed controls for Wave 132B /playground/datasets/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterCategories, sha256Hex, verifyPinnedDatasets, verifySurfaceConsistency,
} from "../playground/datasets/datasets_explorer.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PG = path.join(HERE, "..", "playground", "datasets");
const html = readFileSync(path.join(PG, "index.html"), "utf8");
const mjs = readFileSync(path.join(PG, "datasets_explorer.mjs"), "utf8");
const rawJson = readFileSync(path.join(PG, "datasets_manifest.json"));
const data = JSON.parse(rawJson.toString("utf8"));

test("manifest SHA-256 is pinned and pins BuildDB V6 (2,328/15), RLVR v9 (640/16), and Bicentennial GPU 200-Pack", async () => {
  const m = html.match(/<meta name="datasets-manifest-sha256" content="([0-9a-f]{64})">/);
  assert.ok(m, "missing datasets-manifest-sha256 meta tag");
  const { sha256, data: verified } = await verifyPinnedDatasets(rawJson, m[1]);
  assert.equal(sha256, m[1]);
  assert.equal(verified.builddb_v6.total_rows, 2328);
  assert.equal(verified.builddb_v6.non_mit_rows, 0);
  assert.equal(verified.builddb_v6.receipt_catalogue_id, 68839);
  assert.equal(verified.record_categories.length, 15);
  assert.equal(verified.record_categories.reduce((n, c) => n + c.rows, 0), 2328);
  assert.equal(verified.rlvr_v9.total_tasks, 640);
  assert.equal(verified.rlvr_v9.train_tasks, 544);
  assert.equal(verified.rlvr_v9.eval_tasks, 96);
  assert.equal(verified.rlvr_v9.categories.length, 16);
  assert.equal(verified.rlvr_v9.receipt_catalogue_id, 68861);
  assert.equal(verified.gpu_200pack.total_shaders, 200);
  assert.equal(verified.gpu_200pack.unique_kernels, 40);
  assert.equal(verified.gpu_200pack.total_rewrites, 1228);
  assert.equal(verified.gpu_200pack.receipt_catalogue_id, 68850);
});

test("category dropdown, corpus group pills, and search partition all 15 categories deterministically", () => {
  assert.equal(filterCategories(data.record_categories, { category: "rlvr_task" }).length, 1);
  assert.equal(filterCategories(data.record_categories, { group: "kernels-certs" }).length, 5);
  assert.equal(filterCategories(data.record_categories, { group: "os-bench-sbom" }).length, 5);
  assert.equal(filterCategories(data.record_categories, { group: "rlvr-signals-papers" }).length, 5);
  assert.equal(filterCategories(data.record_categories, { query: "68850" }).length, 2);
  assert.equal(filterCategories(data.record_categories, { group: "os-bench-sbom", query: "rlvr" }).length, 0);
});

test("3/3 planted fail-closed controls reject 1-byte tamper, forged schema, and truncated category list", async () => {
  const realSha = await sha256Hex(rawJson);
  const tampered = new Uint8Array(rawJson);
  tampered[tampered.length - 2] ^= 0x01;
  await assert.rejects(() => verifyPinnedDatasets(tampered, realSha), (e) => e.code === "sha256_mismatch");

  const badSchema = Buffer.from(JSON.stringify({ ...data, schema: "forged/9" }), "utf8");
  const badSchemaSha = await sha256Hex(badSchema);
  await assert.rejects(() => verifyPinnedDatasets(badSchema, badSchemaSha), (e) => e.code === "bad_schema");

  const trunc = Buffer.from(JSON.stringify({ ...data, record_categories: data.record_categories.slice(0, 14) }), "utf8");
  const truncSha = await sha256Hex(trunc);
  await assert.rejects(() => verifyPinnedDatasets(trunc, truncSha), (e) => e.code === "bad_category_count");
});

test("page markup matches Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", () => {
  const chk = verifySurfaceConsistency(html, data);
  assert.equal(chk.ok, true);
  assert.equal(chk.catRows, 15);
  assert.equal(chk.rlvrRows, 16);
  assert.equal(chk.gpuRows, 8);
  assert.match(html, /class="reading ds-sheet"/);
  assert.match(html, /\/world\/ui\/shell\/shell\.css/);
  assert.doesNotMatch(html, /\bdata-copy=/);
  assert.doesNotMatch(html, /https?:\/\/(?:cdn|unpkg|jsdelivr|fonts\.googleapis)/i);
  assert.doesNotMatch(mjs, /from\s+["']node:/);
  for (const [name, txt] of [["index.html", html], ["datasets_explorer.mjs", mjs], ["datasets_manifest.json", rawJson.toString("utf8")]]) {
    assert.doesNotMatch(txt, /[\u2013\u2014]/, `${name} contains em/en dash`);
    assert.doesNotMatch(txt, /[A-Za-z]:\\|\/Users\/|\/home\//, `${name} contains local path`);
  }
});
