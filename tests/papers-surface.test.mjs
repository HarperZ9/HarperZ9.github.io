// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Deterministic surface, citation, and fail-closed verification tests for /playground/papers/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterPapers, formatBibtex, formatCitation, sha256Hex, verifyPinnedCatalog, verifySurfaceConsistency,
} from "../playground/papers/papers_catalog.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PG = path.join(HERE, "..", "playground", "papers");
const html = readFileSync(path.join(PG, "index.html"), "utf8");
const mjs = readFileSync(path.join(PG, "papers_catalog.mjs"), "utf8");
const rawJson = readFileSync(path.join(PG, "papers_manifest.json"));
const data = JSON.parse(rawJson.toString("utf8"));

test("papers catalog SHA-256 is pinned in index.html and lists all 8 sealed preprints (68793..68967)", async () => {
  const m = html.match(/<meta name="papers-manifest-sha256" content="([0-9a-f]{64})">/);
  assert.ok(m, "missing papers-manifest-sha256 meta tag");
  const { sha256, data: verified } = await verifyPinnedCatalog(rawJson, m[1]);
  assert.equal(sha256, m[1]);
  assert.equal(verified.papers.length, 8);
  assert.deepEqual(verified.papers.map((p) => p.catalogue_id), [68793, 68797, 68808, 68852, 68873, 68900, 68929, 68967]);
  assert.ok(verified.receipt_ledger.length >= 73);
});

test("BibTeX and plain citation formatters and track filters work deterministically", () => {
  assert.equal(filterPapers(data.papers, "all").length, 8);
  assert.equal(filterPapers(data.papers, "cs.PL-cs.CR").length, 1);
  assert.equal(filterPapers(data.papers, "cs.PL-cs.OS").length, 1);
  assert.equal(filterPapers(data.papers, "cs.AI-cs.SE").length, 1);
  assert.equal(filterPapers(data.papers, "cs.GR").length, 1);
  assert.equal(filterPapers(data.papers, "cs.OS-SOSP").length, 1);
  assert.equal(filterPapers(data.papers, "cs.CR-cs.OS").length, 1);
  assert.equal(filterPapers(data.papers, "cs.LG-cs.AI").length, 1);
  assert.equal(filterPapers(data.papers, "cs.DC-cs.CR").length, 1);
  for (const p of data.papers) {
    const bib = formatBibtex(p);
    const cit = formatCitation(p);
    assert.match(bib, /^@misc\{harper2026/);
    assert.ok(bib.includes(`#${p.catalogue_id}`));
    assert.ok(cit.includes(p.title));
    assert.ok(cit.includes(`#${p.catalogue_id}`));
  }
});

test("planted fail-closed controls: 1-byte tamper, bad schema, and truncated paper list all reject", async () => {
  const realSha = await sha256Hex(rawJson);
  const tampered = new Uint8Array(rawJson);
  tampered[tampered.length - 2] ^= 0x01;
  await assert.rejects(() => verifyPinnedCatalog(tampered, realSha), (e) => e.code === "sha256_mismatch");

  const badSchema = Buffer.from(JSON.stringify({ ...data, schema: "forged/9" }), "utf8");
  const badSchemaSha = await sha256Hex(badSchema);
  await assert.rejects(() => verifyPinnedCatalog(badSchema, badSchemaSha), (e) => e.code === "bad_schema");

  const trunc = Buffer.from(JSON.stringify({ ...data, papers: data.papers.slice(0, 2) }), "utf8");
  const truncSha = await sha256Hex(trunc);
  await assert.rejects(() => verifyPinnedCatalog(trunc, truncSha), (e) => e.code === "bad_paper_count");
});

test("page markup matches Measured Drafting Sheet canon, honest negative results, zero CDN, zero local paths", () => {
  const chk = verifySurfaceConsistency(html, data);
  assert.equal(chk.ok, true);
  assert.equal(chk.cards, 8);
  assert.match(html, /class="reading ds-sheet"/);
  assert.match(html, /\/world\/ui\/shell\/shell\.css/);
  assert.match(html, /Honest negative results and scope limits/);
  assert.doesNotMatch(html, /https?:\/\/(?:cdn|unpkg|jsdelivr|fonts\.googleapis)/i);
  assert.doesNotMatch(mjs, /from\s+["']node:/);
  for (const [name, txt] of [["index.html", html], ["papers_catalog.mjs", mjs], ["papers_manifest.json", rawJson.toString("utf8")]]) {
    assert.doesNotMatch(txt, /[\u2013\u2014]/, `${name} contains em/en dash`);
    assert.doesNotMatch(txt, /[A-Za-z]:\\|\/Users\/|\/home\//, `${name} contains local path`);
  }
});
