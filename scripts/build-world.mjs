#!/usr/bin/env node
// One run that brings the workshop's latest pieces into the site and rebuilds every page made from them.
//
//   node scripts/build-world.mjs [--no-media] [--src WORKSHOP]   (or MISSION_CONTROL=WORKSHOP)
//
// Steps, in order (each is its own script and can run alone):
//   1. import-mission-control.mjs   copy the pieces into world/ (and Accession into system/fonts/accession)
//   2. import-media.mjs             encode the name art, the loops and the theme into media/world/
//   3. build-studies.mjs, build-cmmns.mjs
//   4. build-world-home.mjs, build-world-pages.mjs, world-asset-revision.mjs, world-discovery.mjs
//      render-route-registry.mjs, render-site-index.mjs (the World family and pillar)
//   5. link cards for new sitemap pages, then the card tags on the world's pages only
//   6. structured data, and the publication receipt that pins sitemap.xml
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2), pass = args.filter((a) => a !== "--no-media");
const run = (cmd, a) => { console.log(`\n> ${cmd} ${a.join(" ")}`); execFileSync(cmd, a, { cwd: site, stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" } }); };
const node = (s, a = []) => run(process.execPath, [`scripts/${s}`, ...a]);
const py = process.platform === "win32" ? "python" : "python3";

const WORLD_STAMP = `
import sys
sys.path.insert(0, ".")
from tools.repo_art.site_cards import plan, stamp, write_manifest, SOURCES, ROOT
own = ("index.html", "workshop.html", "floor.html", "elements.html", "swatches.html", "accession.html", "credits.html", "cmmns.html")
cards = [c for c in plan() if c["rel"].startswith(("world/", "studies/")) or c["rel"] in own]
print(sum(stamp(c) for c in cards), "of", len(cards), "world pages stamped")
for c in cards:
    if c["rel"] in SOURCES: stamp(c, ROOT / SOURCES[c["rel"]])
write_manifest(plan())
`;

node("import-mission-control.mjs", pass);
if (!args.includes("--no-media")) node("import-media.mjs", pass);
node("build-studies.mjs", pass);
node("build-cmmns.mjs");
node("build-world-home.mjs");
node("build-world-pages.mjs");
node("world-asset-revision.mjs");
node("world-discovery.mjs");
node("render-route-registry.mjs");
node("render-site-index.mjs");
run(py, ["-m", "tools.repo_art.render_missing"]);
run(py, ["-c", WORLD_STAMP]);
run(py, ["tools/structured_data.py"]);
run(py, ["tools/build_publications.py", "--records-dir", "publications/data/records"]);
console.log("\nworld: built");
