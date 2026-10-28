#!/usr/bin/env node
// Keep sitemap.xml and llms.txt in step with the world. The world's block in each file sits between markers and is
// rewritten whole on each run, so a re-import never duplicates entries. Run after the page builders.
//
//   node scripts/world-discovery.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORIGIN = "https://harperz9.github.io/";
const read = (p) => readFileSync(path.join(site, p), "utf8");
const exists = (p) => existsSync(path.join(site, p));

const ROOT_PAGES = ["workshop.html", "floor.html", "elements.html", "swatches.html", "accession.html", "credits.html", "cmmns.html"];
const LIVE = ["world/universe/proto/path.html", "world/universe/proto/index.html", "world/typeengine/living/index.html", "world/typeengine/room/index.html",
  "world/typeengine/specimens/index.html", "world/glass/index.html", "world/visualizer/web/index.html", "world/visualizer/web/grid.html",
  "world/sound/theme/index.html", "world/superframe/room/index.html", "world/exhibit/index.html", "world/playbook/examples/index.html"];

function worldURLs() {
  const places = readdirSync(path.join(site, "world/universe/proto/places")).filter((f) => f.endsWith(".html")).map((f) => `world/universe/proto/places/${f}`);
  const studies = exists("studies/pages.json") ? JSON.parse(read("studies/pages.json")).pages.filter((p) => p.indexable).map((p) => p.path) : [];
  return [...ROOT_PAGES, ...LIVE, ...places, ...studies].filter(exists);
}

function between(text, start, end, block, anchor) {
  const re = new RegExp(`${start}[\\s\\S]*?${end}\\n?`);
  const body = `${start}\n${block}${end}\n`;
  return re.test(text) ? text.replace(re, body) : text.replace(anchor, body + anchor);
}

function sitemap() {
  const urls = worldURLs(), xml = read("sitemap.xml");
  const listed = new Set([...xml.replace(/<!-- world:start -->[\s\S]*?<!-- world:end -->/, "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const block = urls.filter((u) => !listed.has(ORIGIN + u)).map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>\n`).join("");
  writeFileSync(path.join(site, "sitemap.xml"), between(xml, "  <!-- world:start -->", "  <!-- world:end -->", block, "</urlset>"));
  return urls.length;
}

function llms() {
  const block = `## The world

The home page is the work as one world: a road through ink and water, then
places for light and glass, type and lettering, mosaic, sound, data, motion and
film, the exhibit, the engine and the tools.

- [Everything](${ORIGIN}floor.html): every page as a plain list of links.
- [The element table](${ORIGIN}elements.html): the world's concepts as elements,
  each with its measured colour, its bridges and credited references.
- [The swatch library](${ORIGIN}swatches.html): measured palettes and overprints.
- [Accession](${ORIGIN}accession.html): a type family drawn in code, SIL Open
  Font License 1.1.
- [The map](${ORIGIN}world/universe/proto/index.html): every place and thread.
- [Import record](${ORIGIN}world/IMPORT.json): every file under /world/ with its
  source folder and SHA-256.

`;
  const t = read("llms.txt");
  writeFileSync(path.join(site, "llms.txt"), between(t, "<!-- world:start -->", "<!-- world:end -->", block, "## The catalog as data"));
}

console.log(`discovery: ${sitemap()} world URLs in the sitemap; llms.txt world block written`);
llms();
