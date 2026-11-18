#!/usr/bin/env node
// Cache revisions for the world's pages. Every stylesheet and script a world page loads by href or src carries
// ?v=<revision>, the site's cache rule (tests/test_zentropy_sitewide_contract.py). The revision is a hash of the
// imported pieces and the site's own world code, so it changes exactly when one of them does, and it is recorded in
// world/IMPORT.json for the test to read.
//
//   node scripts/world-asset-revision.mjs           stamp every world page and record the revision
//   node scripts/world-asset-revision.mjs --check   write nothing; exit 1 when the recorded revision or any stamp
//                                                   differs from the hash of the inputs
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rel = (p) => path.relative(site, p).split(path.sep).join("/");
const OWN = ["index.html", "floor.html", "elements.html", "swatches.html", "accession.html", "credits.html", "cmmns.html", "superframe.html", "experiments/index.html", "glass-water.html", "playground/index.html", "playground/distill.html", "buildlang.html", "low-water.html", "raw.html", "404.html"];
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
  // the site-side patches change the shipped bytes of imported pieces, so they count too
  h.update(JSON.stringify(JSON.parse(readFileSync(path.join(site, "scripts/import-mission-control.config.json"), "utf8")).patches || []));
  // sorted by the site-relative name with forward slashes, so Windows and Linux hash the files in one order
  const inputs = [...walk(path.join(site, "world/site")).map(rel).sort(), ...walk(path.join(site, "studies")).map(rel).filter((p) => p.endsWith(".css")).sort()];
  for (const f of inputs) h.update(`${f}:${createHash("sha256").update(readFileSync(path.join(site, f))).digest("hex")}\n`);
  return "world-" + h.digest("hex").slice(0, 10);
}

function inScope(pageRel, target) {
  const clean = target.split("?")[0];
  const asset = clean.startsWith("/") ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(pageRel), clean));
  return SCOPE.some((s) => asset.startsWith(s));
}

function stamp(file, rev, write = true) {
  const pageRel = rel(file);
  const src = readFileSync(file, "utf8");
  const out = src.replace(/\b(href|src)="([^"#:]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, a, t) => (inScope(pageRel, t) ? `${a}="${t}?v=${rev}"` : m));
  if (out !== src && write) writeFileSync(file, out);
  return out !== src;
}

const rev = revision();
const pages = [...walk(path.join(site, "world")), ...walk(path.join(site, "studies")), ...walk(path.join(site, "findings")), ...OWN.map((p) => path.join(site, p))]
  .filter((p) => p.endsWith(".html") && existsSync(p) && statSync(p).isFile());
const impPath = path.join(site, "world/IMPORT.json"), imp = JSON.parse(readFileSync(impPath, "utf8"));
if (process.argv.includes("--check")) {
  const stale = pages.filter((p) => stamp(p, rev, false)).map(rel);
  const faults = [];
  if (imp.assetRevision !== rev) faults.push(`world/IMPORT.json records ${imp.assetRevision}; the inputs hash to ${rev}`);
  if (stale.length) faults.push(`${stale.length} of ${pages.length} world pages carry another stamp: ${stale.slice(0, 5).join(", ")}${stale.length > 5 ? ", ..." : ""}`);
  if (faults.length) {
    console.error(`asset revision differs: ${faults.join("; ")}. Run node scripts/world-asset-revision.mjs, then node scripts/build-addresses.mjs.`);
    process.exit(1);
  }
  console.log(`asset revision ${rev}: recorded value and ${pages.length} world pages agree`);
  process.exit(0);
}
const changed = pages.filter((p) => stamp(p, rev)).length;
imp.assetRevision = rev; imp.assetRevisionScope = SCOPE;
writeFileSync(impPath, JSON.stringify(imp, null, 1) + "\n");
console.log(`asset revision ${rev}: ${changed} of ${pages.length} world pages updated`);
