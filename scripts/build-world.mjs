#!/usr/bin/env node
// One run that brings the workshop's latest pieces into the site and rebuilds every page made from them.
//
//   node scripts/build-world.mjs [--no-media] [--src WORKSHOP]   (or MISSION_CONTROL=WORKSHOP)
//   node scripts/build-world.mjs --site-only   rebuild the site's own pages from what is already imported (steps 3 to 6,
//                                              without the workshop: no import, no media, no studies)
//   --offline   keep site-src/world/releases.json as last fetched instead of reading the releases again
//
// Steps, in order (each is its own script and can run alone):
//   1. import-mission-control.mjs   copy the pieces into world/ (and Accession into system/fonts/accession)
//   2. import-media.mjs             encode the name art, the loops and the theme into media/world/
//   3. build-studies.mjs, build-cmmns.mjs, build-experiments.mjs, record-findings.mjs and build-findings.mjs (from
//      findings/src/ and findings/data/, which scripts/import-findings.mjs fills from the workshop's papers)
//   4. fetch-releases.mjs (the versions behind every Verified line on the home), build-world-home.mjs,
//      build-product-pages.mjs (buildlang.html, low-water.html), build-world-pages.mjs, build-addresses.mjs (the address
//      ledger and 404.html), world-asset-revision.mjs, world-discovery.mjs
//      render-route-registry.mjs, render-site-index.mjs (the World family and pillar)
//   5. link cards for new sitemap pages, then the card tags on the world's pages only
//   6. structured data, and the publication receipt that pins sitemap.xml
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2), pass = args.filter((a) => !["--no-media", "--site-only", "--offline"].includes(a));
const siteOnly = args.includes("--site-only");
const run = (cmd, a) => { console.log(`\n> ${cmd} ${a.join(" ")}`); execFileSync(cmd, a, { cwd: site, stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" } }); };
const node = (s, a = []) => run(process.execPath, [`scripts/${s}`, ...a]);
const py = process.platform === "win32" ? "python" : "python3";

const WORLD_STAMP = `
import sys
sys.path.insert(0, ".")
from tools.repo_art.site_cards import plan, stamp, write_manifest, SOURCES, ROOT
own = ("index.html", "workshop.html", "floor.html", "elements.html", "swatches.html", "accession.html", "credits.html", "cmmns.html", "experiments/index.html", "glass-water.html", "playground/index.html", "playground/distill.html", "buildlang.html", "low-water.html")
cards = [c for c in plan() if c["rel"].startswith(("world/", "studies/", "findings/")) or c["rel"] in own]
print(sum(stamp(c) for c in cards), "of", len(cards), "world pages stamped")
for c in cards:
    if c["rel"] in SOURCES: stamp(c, ROOT / SOURCES[c["rel"]])
write_manifest(plan())
`;

if (!siteOnly) {
  node("import-mission-control.mjs", pass);
  if (!args.includes("--no-media")) node("import-media.mjs", pass);
  node("build-studies.mjs", pass);
}
// the home's versions and Verified lines come from the releases as they stand today (--offline keeps the last fetch)
node("fetch-releases.mjs", args.includes("--offline") ? ["--offline"] : []);
node("sync-field-css.mjs");
node("build-cmmns.mjs");
node("build-experiments.mjs");
node("record-findings.mjs");
node("build-findings.mjs");
node("build-glass-water.mjs");
node("build-distill.mjs");
node("build-world-home.mjs");
node("build-product-pages.mjs");
node("build-world-pages.mjs");
node("build-addresses.mjs");  // after every generator that can write a new page, before the revision stamp reaches 404.html
node("world-asset-revision.mjs");
node("world-discovery.mjs");
node("render-route-registry.mjs");
node("render-site-index.mjs");
node("finding-flags.mjs");  // after every page that can link to a finding is written
run(py, ["-m", "tools.repo_art.render_missing"]);
run(py, ["-c", WORLD_STAMP]);
run(py, ["tools/structured_data.py"]);
run(py, ["tools/build_publications.py", "--records-dir", "publications/data/records"]);
console.log("\nworld: built");
