#!/usr/bin/env node
// Build the world's plain pages: floor.html (everything, in plain links), elements.html, swatches.html,
// accession.html and credits.html. Run after scripts/import-mission-control.mjs and scripts/build-studies.mjs.
//
//   node scripts/build-world-pages.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { esc } from "./studies-markdown.mjs";
import { PLACES } from "../site-src/world/bazaar.mjs";
import { workIndex } from "./work-index.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(path.join(site, p), "utf8");
const json = (p) => JSON.parse(read(p));
const titleOf = (p) => { try { const m = read(p).match(/<title>([^<]*)<\/title>/); return m ? m[1].replace(/\s*\|\s*Zain Dana Harper$/, "").trim() : null; } catch { return null; } };
const caps = (t) => (/^[A-Z0-9 ]{3,}$/.test(t) ? ' class="caps"' : "");
const list = (items) => `<ul class="floor-list">${items.map(([href, t]) => `<li><a href="${esc(href)}"${caps(t)}>${esc(t)}</a></li>`).join("")}</ul>`;
const section = (id, title, items) => items.length ? `<section aria-labelledby="f-${id}"><h2 id="f-${id}">${esc(title)}</h2>${list(items)}</section>` : "";
const write = (p, html) => { writeFileSync(path.join(site, p), html); return p; };

function roadStops() {
  const p = read("world/universe/proto/path.html");
  return [...p.matchAll(/<section class="stop" id="([^"]+)"[\s\S]*?<h2 id="[^"]+"[^>]*>([^<]+)<\/h2>/g)].map((m) => [`/world/universe/proto/path.html#${m[1]}`, m[2]]);
}
function mapPlaces() {
  const u = json("world/universe/universe.json"), statics = new Set(readdirSync(path.join(site, "world/universe/proto/places")));
  return u.nodes.map((n) => {
    const href = n.land ? `/world/${n.land}` : statics.has(`${n.id}.html`) ? `/world/universe/proto/places/${n.id}.html` : n.href ? (/^https?:/.test(n.href) ? n.href : `/${n.href}`) : null;
    return href ? [href, n.name || n.title || n.id] : null;
  }).filter(Boolean).sort((a, b) => a[1].localeCompare(b[1]));
}
function livePieces() {
  const pages = ["world/universe/proto/path.html", "world/universe/proto/index.html", "world/typeengine/living/index.html", "world/typeengine/room/index.html",
    "world/typeengine/specimens/index.html", "world/glass/index.html", "world/visualizer/web/index.html", "world/visualizer/web/grid.html", "world/sound/theme/index.html",
    "world/superframe/room/index.html", "world/ui/directions/cs-max/index.html", "world/ui/directions/cs-max/flywheel.html", "world/ui/directions/cs-max/exhibit.html",
    "world/ui/shell/organic/parts.html", "world/exhibit/index.html",
    ...readdirSync(path.join(site, "world/playbook/examples")).filter((f) => f.endsWith(".html") && f !== "index.html").map((f) => `world/playbook/examples/${f}`),
    ...["22", "23", "24", "25", "29"].map((n) => `world/feed-${n}/build/index.html`)];
  return pages.filter((p) => existsSync(path.join(site, p))).map((p) => [`/${p}`, titleOf(p) || p]);
}
function sitePages() {
  const sm = read("sitemap.xml"), out = [];
  for (const m of sm.matchAll(/<loc>https:\/\/harperz9\.github\.io\/([^<]*)<\/loc>/g)) {
    const rel = m[1] === "" ? "workshop.html" : m[1].endsWith("/") ? m[1] + "index.html" : m[1];
    if (rel.startsWith("world/") || rel.startsWith("studies/") || !existsSync(path.join(site, rel))) continue;
    out.push([`/${rel.replace(/index\.html$/, "")}`, titleOf(rel) || rel]);
  }
  return out.sort((a, b) => a[1].localeCompare(b[1]));
}
function studyPages() {
  const f = "studies/pages.json"; if (!existsSync(path.join(site, f))) return [];
  return json(f).pages.map((p) => [`/${p.path.replace(/index\.html$/, "")}`, p.title]);
}

function floor() {
  const wi = workIndex();
  write(wi.restPath, wi.rest);
  const body = `<article class="floor"><h1>Everything</h1>
<p class="wi-lead">All the work, current and past: ${wi.count} pieces by platform, newest first, each with its status as its release or registry records it. The places and pages of the site follow.</p>
${wi.html}
<h2 class="wi-rule">The site</h2>
${section("road", "The road", roadStops())}
${section("places", "The places", PLACES.map((p) => [`/#p-${p.id}`, p.title]))}
${section("parts", "Parts", [["/elements.html", "The element table"], ["/swatches.html", "The swatch library"], ["/accession.html", "Accession"], ["/world/universe/proto/index.html", "The map"], ["/credits.html", "Credits"]])}
${section("live", "Live pieces", livePieces())}
${section("map", "Every place on the map", mapPlaces())}
${section("studies", "Studies", studyPages())}
${section("site", "Pages, writing and tools", sitePages())}
</article>`;
  return write("floor.html", page({ path: "floor.html", title: "Everything", description: "All of the work, current and past, by platform: The Flywheel, The Commons, The Playground, Articulate, BuildLang and Research, then every page of the site.", body, extraHead: '<link rel="stylesheet" href="/world/site/pages.css">' }));
}

// lead: a sentence under the heading. after: markup below the mounted part (a registry surface, for one).
// bench: the page sits on the bench's calm ground and loads its stylesheet.
function mountPage(file, title, description, heading, script, { lead = "", after = "", bench = false } = {}) {
  const body = `<article class="parts-page"><h1>${esc(heading)}</h1><h2 class="sr-only">${esc(title)}</h2>${lead ? `<p class="parts-lead">${esc(lead)}</p>` : ""}<div class="parts" id="parts"></div>${after}</article>
<script type="module">${script}</script>
<script type="module" src="/world/alive/alive.js"></script>`;
  return write(file, page({ path: file, title, description, body, htmlAttrs: 'data-alive-grain="off" data-lettering="/world/lettering/lib/letter.mjs"', bodyClass: bench || after ? "parts-body bench-body" : "parts-body",
    extraHead: '<link rel="stylesheet" href="/world/ui/shell/organic/parts.css">\n<link rel="stylesheet" href="/world/site/pages.css">' + (bench || after ? '\n<link rel="stylesheet" href="/world/site/surfaces/bench.css">' : "") }));
}
// The element table is the front bench of the design studio: every part is a surface from world/site/surfaces/registry.mjs.
// ?e=water,ink opens it on those elements.
const ELEMENTS = `import registry from "/world/site/surfaces/registry.mjs";
const asked = (new URLSearchParams(location.search).get("e") || "").split(",").filter(Boolean);
window.__bench = await registry.mount(document.getElementById("parts"), "bench", { elements: asked });
window.__surfaces = registry;`;
// A surface on another page: the registry mounts it from markup (world/site/surfaces/embed.mjs).
const surface = (names, ids, heading, lead) => `<section class="parts-surface" aria-labelledby="ps-h"><h2 id="ps-h">${esc(heading)}</h2><p>${esc(lead)}</p><div data-surface="${esc(names)}" data-elements="${esc(ids)}"></div></section>
<script type="module" src="/world/site/surfaces/embed.mjs"></script>`;
const SWATCHES = `import { mountSwatches } from "/world/ui/shell/organic/swatches.js";
const data = await (await fetch("/world/ui/shell/organic/data/swatches.json")).json();
mountSwatches(document.getElementById("parts"), data);`;

function accession() {
  const m = json("system/fonts/accession/MANIFEST.json"), fams = [...new Set(m.fonts.map((f) => f.family))].sort();
  const body = `<article class="tool"><h1 class="acc-specimen">Accession</h1>
<p>A family of type drawn in code, released under the SIL Open Font License 1.1. On this site it is one material among many: living type draws on it, and Hanken Grotesk and Conso stay as the still faces.</p>
<h2>The families</h2><ul class="acc-list">${fams.map((f) => `<li style="font-family:'${esc(f)}'">${esc(f)}</li>`).join("")}</ul>
<h2>Use it</h2><p><a href="/system/fonts/accession/accession.css">accession.css</a> declares every face with paths relative to its folder; <a href="/system/fonts/accession/OFL.txt">OFL.txt</a> is the licence, and <a href="/system/fonts/accession/MANIFEST.json">MANIFEST.json</a> lists every file with its size, coverage and SHA-256.</p>
${surface("living lettering motion well", "type ink paper", "Type as a material", "On the element table, type is a material like ink and paper. Here the three are blended: the type engine sets their names in letters bent by type's own measurements, the studio letters them in the blend's technique and colour, draws the timing the blend moves on, and runs them together in a well you can stir.")}
</article>`;
  return write("accession.html", page({ path: "accession.html", title: "Accession", description: "Accession, a type family drawn in code, under the SIL Open Font License 1.1: Text, Display, Mono, Super and the technique cuts.", body, bodyClass: "reading bench-body",
    // the specimen loads letter subsets of each face (system/fonts/accession/specimen/, about 225 KB against 1.5 MB);
    // the full faces stay one link away in accession.css
    extraHead: '<link rel="stylesheet" href="/system/fonts/accession/specimen/specimen.css">\n<link rel="stylesheet" href="/world/site/pages.css">' }));
}

function credits() {
  const imp = json("world/IMPORT.json"), els = json("world/ui/shell/organic/data/elements.json");
  const thumbs = new Set(els.elements.flatMap((e) => (e.refs || []).map((r) => r.thumb).filter(Boolean))).size;
  const body = `<article class="tool"><h1>Credits</h1>
<h2>Type</h2><p>Accession and its families: Zain Dana Harper, SIL Open Font License 1.1 (<a href="/system/fonts/accession/OFL.txt">OFL.txt</a>). Hanken Grotesk: SIL Open Font License 1.1. Conso: licensed for this site by its designer's terms.</p>
<h2>Archival plates</h2><p>The exhibit's pictures, film and sound are public domain, CC0 or CC BY, each with its source: <a href="/world/exhibit/credits.html">the exhibit's credits</a>. The shell's plates are public domain scans from open archives, among them Muybridge's cockatoo, Animal Locomotion plate 758 (<a href="https://purl.org/nga/collection/artobject/136539">National Gallery of Art</a>, CC0), Goya's Nobody knows himself (<a href="https://www.metmuseum.org/art/collection/search/377785">The Metropolitan Museum of Art</a>, CC0) and Doré's bust of Münchhausen (<a href="https://commons.wikimedia.org/wiki/File:Munchausen_by_Gustave_Dore_(31030896).jpg">Wikimedia Commons</a>, public domain). The home's dial is engraved from Regiomontanus's astrolabe of 1462 (<a href="https://www.metmuseum.org/art/collection/search/923639">The Metropolitan Museum of Art</a>, CC0), and the Low Water loop is low tide from Heavenly Bodies, 1920 (<a href="https://archive.org/details/Heavenly1920">Prelinger Archives</a>, public domain); <a href="/media/front-door/CREDITS.md">the dial's credits</a>.</p>
<h2>Reference credits</h2><p>The element table shows ${thumbs} small reference thumbnails of other people's published work, each with its maker's name, its title and a link to the original post. They are there as references, credited to their makers. To ask for one to be removed, write to <a href="mailto:zaindharper@gmail.com">zaindharper@gmail.com</a> or open an issue on <a href="https://github.com/HarperZ9/HarperZ9.github.io/issues">the site's repository</a>.</p>
<h2>Sound</h2><p>Hum v4, the site's theme, and its calm loop: Zain Dana Harper.</p>
<h2>Where the world's pieces come from</h2><p>The live pieces under /world/ were made in the author's workshop and imported on ${esc(imp.importedAt.slice(0, 10))}; <a href="/world/IMPORT.json">IMPORT.json</a> lists every file with its source folder and SHA-256.</p>
</article>`;
  return write("credits.html", page({ path: "credits.html", title: "Credits", description: "Credits for Zain Dana Harper's site: type, archival plates, reference thumbnails with their makers, and the theme.", body, extraHead: '<link rel="stylesheet" href="/world/site/pages.css">' }));
}

const made = [floor(),
  mountPage("elements.html", "The element table", "The world's concepts as an element table: each element runs live in its own medium, with its measured colour, bridges and references.", "Elements", ELEMENTS,
    { bench: true, lead: "The front bench of the design studio. Choose an element and it runs in the well from its own measurements. Stir it, move its properties, blend it with others, and take what you made with you." }),
  mountPage("swatches.html", "The swatch library", "The measured colours behind the work: palettes from studied works, overprint pairs with their measured gap, and the seven sheets.", "Colour", SWATCHES,
    { after: surface("well plate chart", "pigment ink paper", "The colours at work", "Three elements from the element table, pigment, ink and paper, share one well. Each is drawn from its own measured properties. Drag to stir them together; move a control on the chart and the well follows. The plate prints the well's colours through the studio's image lane.") }),
  accession(), credits()];
console.log(`world pages: ${made.join(", ")}`);
