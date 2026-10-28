#!/usr/bin/env node
// Cache revisions for the world's pages. Every stylesheet and script a world page loads by href or src carries
// ?v=<revision>, the site's cache rule (tests/test_zentropy_sitewide_contract.py). The revision is a hash of the
// imported pieces and the site's own world code, so it changes exactly when one of them does, and it is recorded in
// world/IMPORT.json for the test to read.
//
//   node scripts/world-asset-revision.mjs
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rel = (p) => path.relative(site, p).split(path.sep).join("/");
const OWN = ["index.html", "floor.html", "elements.html", "swatches.html", "accession.html", "credits.html", "cmmns.html"];
// asset folders governed by the world revision (the test reads the same list from IMPORT.json)
const SCOPE = ["world/", "studies/", "system/fonts/accession/"];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    f.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

function revision() {
  const h = createHash("sha256"), imp = JSON.parse(readFileSync(path.join(site, "world/IMPORT.json"), "utf8"));
  for (const f of imp.files) h.update(`${f.path}:${f.sourceSha256}\n`);
  for (const f of walk(path.join(site, "world/site")).sort()) h.update(`${rel(f)}:${createHash("sha256").update(readFileSync(f)).digest("hex")}\n`);
  for (const f of walk(path.join(site, "studies")).filter((p) => p.endsWith(".css")).sort()) h.update(`${rel(f)}:${createHash("sha256").update(readFileSync(f)).digest("hex")}\n`);
  return "world-" + h.digest("hex").slice(0, 10);
}

function inScope(pageRel, target) {
  const clean = target.split("?")[0];
  const asset = clean.startsWith("/") ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(pageRel), clean));
  return SCOPE.some((s) => asset.startsWith(s));
}

function stamp(file, rev) {
  const pageRel = rel(file);
  const src = readFileSync(file, "utf8");
  const out = src.replace(/\b(href|src)="([^"#:]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, a, t) => (inScope(pageRel, t) ? `${a}="${t}?v=${rev}"` : m));
  if (out !== src) writeFileSync(file, out);
  return out !== src;
}

const rev = revision();
const pages = [...walk(path.join(site, "world")), ...walk(path.join(site, "studies")), ...OWN.map((p) => path.join(site, p))]
  .filter((p) => p.endsWith(".html") && existsSync(p) && statSync(p).isFile());
const changed = pages.filter((p) => stamp(p, rev)).length;
const impPath = path.join(site, "world/IMPORT.json"), imp = JSON.parse(readFileSync(impPath, "utf8"));
imp.assetRevision = rev; imp.assetRevisionScope = SCOPE;
writeFileSync(impPath, JSON.stringify(imp, null, 1) + "\n");
console.log(`asset revision ${rev}: ${changed} of ${pages.length} world pages updated`);
