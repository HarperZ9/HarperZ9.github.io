// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Deterministic surface, category filter, and fail-closed controls for Wave 164C /playground/datasets/.
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

test("manifest SHA-256 is pinned and pins BuildDB V10 (4,016/30), RLVR v14 (1,280/36), and GPU 560-Pack", async () => {
  const m = html.match(/<meta name="datasets-manifest-sha256" content="([0-9a-f]{64})">/);
  assert.ok(m, "missing datasets-manifest-sha256 meta tag");
  const { sha256, data: verified } = await verifyPinnedDatasets(rawJson, m[1]);
  assert.equal(sha256, m[1]);
  assert.equal(verified.builddb_v10.total_rows, 4016);
  assert.equal(verified.builddb_v10.non_mit_rows, 0);
  assert.equal(verified.builddb_v10.receipt_catalogue_id, 68955);
  assert.equal(verified.record_categories.length, 30);
  assert.equal(verified.record_categories.reduce((n, c) => n + c.rows, 0), 4016);
  assert.equal(verified.rlvr_v14.total_tasks, 1280);
  assert.equal(verified.rlvr_v14.train_tasks, 1104);
  assert.equal(verified.rlvr_v14.eval_tasks, 176);
  assert.equal(verified.rlvr_v14.categories.length, 36);
  assert.equal(verified.rlvr_v14.receipt_catalogue_id, 68968);
  assert.equal(verified.gpu_560pack.total_shaders, 560);
  assert.equal(verified.gpu_560pack.unique_kernels, 112);
  assert.equal(verified.gpu_560pack.total_rewrites, 4009);
  assert.equal(verified.gpu_560pack.receipt_catalogue_id, 68973);
});

test("category dropdown, corpus group pills, and search partition all 30 categories deterministically", () => {
  assert.equal(filterCategories(data.record_categories, { category: "rlvr_task" }).length, 1);
  const kc = filterCategories(data.record_categories, { group: "kernels-certs" }).length;
  const ob = filterCategories(data.record_categories, { group: "os-bench-sbom" }).length;
  const rs = filterCategories(data.record_categories, { group: "rlvr-signals-papers" }).length;
  assert.equal(kc + ob + rs, 30);
  assert.ok(filterCategories(data.record_categories, { query: "68973" }).length >= 1);
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

  const trunc = Buffer.from(JSON.stringify({ ...data, record_categories: data.record_categories.slice(0, 29) }), "utf8");
  const truncSha = await sha256Hex(trunc);
  await assert.rejects(() => verifyPinnedDatasets(trunc, truncSha), (e) => e.code === "bad_category_count");
});

test("page markup matches Measured Drafting Sheet canon, zero [data-copy], zero CDN, zero local paths", () => {
  const chk = verifySurfaceConsistency(html, data);
  assert.equal(chk.ok, true);
  assert.equal(chk.catRows, 30);
  assert.equal(chk.rlvrRows, 36);
  assert.equal(chk.gpuRows, 17);
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
