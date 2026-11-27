// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Deterministic surface and filter verification tests for /playground/competitive-surpass/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterSignals, sha256Hex, summarize, verifyPinnedMatrix, verifySurfaceConsistency,
} from "../playground/competitive-surpass/surpass_explorer.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PG = path.join(HERE, "..", "playground", "competitive-surpass");
const html = readFileSync(path.join(PG, "index.html"), "utf8");
const mjs = readFileSync(path.join(PG, "surpass_explorer.mjs"), "utf8");
const rawJson = readFileSync(path.join(PG, "surpass_matrix.json"));
const data = JSON.parse(rawJson.toString("utf8"));

test("matrix SHA-256 is pinned in index.html and covers 76 signals across 8 lanes (70 surpassed, 5 parity, 1 open)", async () => {
  const m = html.match(/<meta name="surpass-matrix-sha256" content="([0-9a-f]{64})">/);
  assert.ok(m, "missing surpass-matrix-sha256 meta tag");
  const { sha256, data: verified } = await verifyPinnedMatrix(rawJson, m[1]);
  assert.equal(sha256, m[1]);
  assert.equal(verified.signals.length, 76);
  assert.equal(verified.lanes.length, 8);
  const st = summarize(verified.signals);
  assert.equal(st.surpassed, 70);
  assert.equal(st.parity, 5);
  assert.equal(st.open, 1);
  assert.equal(st.covered, 75);
  const cs45 = verified.signals.find((s) => s.signal_id === "CS-045");
  const cs46 = verified.signals.find((s) => s.signal_id === "CS-046");
  const cs40 = verified.signals.find((s) => s.signal_id === "CS-040");
  assert.equal(cs45.tier, "surpassed_with_receipt");
  assert.ok(cs45.evidence_catalogue_ids.includes(68779));
  assert.equal(cs46.tier, "surpassed_with_receipt");
  assert.ok(cs46.evidence_catalogue_ids.includes(68779));
  assert.equal(cs40.tier, "open_next_wave_opportunity");
});

test("interactive lane, tier, flagship, and text filters partition all 76 rows deterministically", () => {
  assert.equal(filterSignals(data.signals, { lane: "graphics-shaders-rendering" }).length, 10);
  assert.equal(filterSignals(data.signals, { tier: "open_next_wave_opportunity" }).length, 1);
  assert.equal(filterSignals(data.signals, { tier: "parity_verified" }).length, 5);
  assert.equal(filterSignals(data.signals, { tier: "surpassed_with_receipt" }).length, 70);
  assert.equal(filterSignals(data.signals, { flagship: "cmmns" }).length, 8);
  assert.equal(filterSignals(data.signals, { query: "68779" }).length, 2);
  assert.equal(filterSignals(data.signals, { lane: "models-rl-arch", tier: "open_next_wave_opportunity" }).length, 0);
  const laneSum = data.lanes.reduce((n, l) => n + l.total, 0);
  assert.equal(laneSum, 76);
});

test("planted fail-closed controls: 1-byte tamper, bad schema, and wrong row count all reject", async () => {
  const realSha = await sha256Hex(rawJson);
  const tampered = new Uint8Array(rawJson);
  tampered[tampered.length - 2] ^= 0x01;
  await assert.rejects(() => verifyPinnedMatrix(tampered, realSha), (e) => e.code === "sha256_mismatch");

  const badSchema = Buffer.from(JSON.stringify({ ...data, schema: "forged/9" }), "utf8");
  const badSchemaSha = await sha256Hex(badSchema);
  await assert.rejects(() => verifyPinnedMatrix(badSchema, badSchemaSha), (e) => e.code === "bad_schema");

  const truncated = Buffer.from(JSON.stringify({ ...data, signals: data.signals.slice(0, 75) }), "utf8");
  const truncatedSha = await sha256Hex(truncated);
  await assert.rejects(() => verifyPinnedMatrix(truncated, truncatedSha), (e) => e.code === "bad_row_count");
});

test("page markup matches Measured Drafting Sheet canon, zero CDN, zero local paths, zero em/en dashes", () => {
  const chk = verifySurfaceConsistency(html, data);
  assert.equal(chk.ok, true);
  assert.equal(chk.signalRows, 76);
  assert.equal(chk.laneRows, 8);
  assert.match(html, /class="reading ds-sheet"/);
  assert.match(html, /\/world\/ui\/shell\/shell\.css/);
  assert.doesNotMatch(html, /https?:\/\/(?:cdn|unpkg|jsdelivr|fonts\.googleapis)/i);
  assert.doesNotMatch(mjs, /from\s+["']node:/);
  for (const [name, txt] of [["index.html", html], ["surpass_explorer.mjs", mjs], ["surpass_matrix.json", rawJson.toString("utf8")]]) {
    assert.doesNotMatch(txt, /[\u2013\u2014]/, `${name} contains em/en dash`);
    assert.doesNotMatch(txt, /[A-Za-z]:\\|\/Users\/|\/home\//, `${name} contains local path`);
  }
});
