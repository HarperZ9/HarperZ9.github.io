import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BOM_EXPECTED_SHA256,
  FLAGSHIP_REPOS,
  MCP_REPOS,
  computeSbomSummary,
  filterComponents,
  renderLicenseSvg,
  verifySbomSurface,
} from "../playground/sbom/sbom_explorer.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const SBOM_DIR = path.join(ROOT, "playground", "sbom");

const bomPath = path.join(SBOM_DIR, "harper-ecosystem-15repos.cdx.json");
const htmlPath = path.join(SBOM_DIR, "index.html");
const modPath = path.join(SBOM_DIR, "sbom_explorer.mjs");

const rawBom = readFileSync(bomPath);
const bom = JSON.parse(rawBom.toString("utf8"));
const html = readFileSync(htmlPath, "utf8");
const modSrc = readFileSync(modPath, "utf8");

test("bundled CycloneDX 1.5 BOM matches exact SHA-256 and covers 15/15 repos + 556 components", () => {
  const actualSha = `sha256:${createHash("sha256").update(rawBom).digest("hex")}`;
  assert.equal(actualSha, BOM_EXPECTED_SHA256);

  const verdict = verifySbomSurface(html, bom, { expectedSha256: BOM_EXPECTED_SHA256, actualSha256: actualSha });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.repos, 15);
  assert.equal(verdict.components, 556);

  const summary = computeSbomSummary(bom);
  assert.equal(summary.flagshipCount, 5);
  assert.equal(summary.mcpCount, 10);
  const repoNames = summary.repos.map((r) => r.repo);
  for (const f of FLAGSHIP_REPOS) assert.ok(repoNames.includes(f), `Missing flagship ${f}`);
  for (const m of MCP_REPOS) assert.ok(repoNames.includes(m), `Missing MCP server ${m}`);
});

test("interactive tier, repository, SPDX license, type, search filters and SVG strip work", () => {
  const summary = computeSbomSummary(bom);
  const flagships = filterComponents(summary.items, { tier: "flagship" });
  const mcps = filterComponents(summary.items, { tier: "mcp_server" });
  assert.equal(flagships.length + mcps.length, 556);
  assert.ok(flagships.length > 400);
  assert.ok(mcps.length > 50);

  const apps = filterComponents(summary.items, { type: "application" });
  assert.equal(apps.length, 15);

  const mitComps = filterComponents(summary.items, { license: "MIT" });
  assert.equal(mitComps.length, 192);

  const buildlangOnly = filterComponents(summary.items, { repo: "buildlang" });
  assert.ok(buildlangOnly.length >= 240);

  const searchHit = filterComponents(summary.items, { query: "pkg:github/harperz9/flywheel" });
  assert.equal(searchHit.length, 1);
  assert.equal(searchHit[0].repo, "flywheel");

  const svg = renderLicenseSvg(summary);
  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes("MIT"));
  assert.ok(svg.includes("556 Components"));
});

test("2/2 planted fail-closed negative controls catch tampered BOM SHA-256 and forbidden license injection", () => {
  // Control 1: 1-char tampered BOM SHA-256
  const badSha =
    "sha256:" +
    (BOM_EXPECTED_SHA256[7] === "0" ? "1" : "0") +
    BOM_EXPECTED_SHA256.slice(8);
  assert.throws(
    () => verifySbomSurface(html, bom, { expectedSha256: BOM_EXPECTED_SHA256, actualSha256: badSha }),
    /Fail-closed BOM SHA-256 mismatch/
  );

  // Control 2: Injected forbidden license (SSPL-1.0) inside BOM component
  const poisonedBom = structuredClone(bom);
  poisonedBom.components[10].licenses = [{ license: { id: "SSPL-1.0" } }];
  assert.throws(
    () => verifySbomSurface(html, poisonedBom, { expectedSha256: BOM_EXPECTED_SHA256, actualSha256: BOM_EXPECTED_SHA256 }),
    /Fail-closed forbidden license detected/
  );
});

test("DESIGN-RULES.md One Shell Measured Drafting Sheet, K1 stability, and strict public hygiene", () => {
  assert.ok(html.includes('href="/world/ui/shell/shell.css'));
  assert.ok(html.includes('href="/studies/studies.css'));
  assert.ok(html.includes('class="reading ds-sheet"'));
  assert.ok(html.includes('class="o-hand o-said"'));
  assert.ok(html.includes('id="o-menu"'));
  assert.ok(html.includes('class="ds-prov"'));
  assert.ok(!html.includes('class="gw-backdrop"'));
  assert.ok(html.includes("min-height: 760px"));

  const cdnRegex = /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|stackpath\.bootstrapcdn)/i;
  assert.ok(!cdnRegex.test(html), "External CDN link found in index.html");
  assert.ok(!cdnRegex.test(modSrc), "External CDN link found in sbom_explorer.mjs");

  const bomText = rawBom.toString("utf8");
  for (const [label, text] of [
    ["index.html", html],
    ["sbom_explorer.mjs", modSrc],
    ["harper-ecosystem-15repos.cdx.json", bomText],
  ]) {
    assert.ok(!text.includes("\u2014"), `${label}: em dash found`);
    assert.ok(!text.includes("\u2013"), `${label}: en dash found`);
    assert.ok(!/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(text), `${label}: local path found`);
    assert.ok(!/zentropy|DS-08|isomorph/i.test(text), `${label}: forbidden token found`);
  }
});
