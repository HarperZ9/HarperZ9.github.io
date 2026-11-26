#!/usr/bin/env node
// Check the address ledger and build 404.html from it.
//
// The ledger (site-src/world/addresses.json) lists every address the site has published; no address in it may go
// dead. This script:
//   1. adds a row for each served page that has none yet (kind and surface from scripts/addresses-classify.mjs,
//      "since" today), at the end of the ledger, and leaves every existing row as it is;
//   2. checks every row: a live row has its page, a redirect row has a stub that leads where the row says and ends
//      at a page, a moved row has no file and ends at a page that has the place it names, a gone row names the
//      commit that removed it; any problem stops the build;
//   3. writes 404.html, the page GitHub Pages serves for an address with no file. It reads the ledger and offers
//      the nearest live address, and takes a reader on a moved address straight to its new place. Without scripts
//      it lists every moved address beside a link to its new place, then the six surfaces, the home and the index.
//
//   node scripts/build-addresses.mjs           add rows, check, write 404.html
//   node scripts/build-addresses.mjs --check   check only (404.html must equal what would be written); write nothing
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LEDGER, SITE, SITE_INDEX, SURFACES, addressOf, follow, loadLedger, serialize, servedPages, validate } from "./addresses-lib.mjs";
import { classifier } from "./addresses-classify.mjs";
import { page } from "./studies-shell.mjs";

const checkOnly = process.argv.includes("--check");
const ledger = loadLedger(), pages = servedPages(), known = new Set(ledger.rows.map((r) => r.path));
const today = new Date().toISOString().slice(0, 10), classify = classifier();
const added = [];
for (const file of pages) {
  const address = addressOf(file);
  if (known.has(address) || file === "404.html") continue;
  const c = classify(address, readFileSync(path.join(SITE, file), "utf8"));
  added.push({ path: address, kind: c.kind, surface: c.surface, ...(c.to ? { to: c.to } : {}), since: today });
}
if (added.length && checkOnly) {
  console.error(`addresses: ${added.length} served pages have no row:\n  ${added.map((r) => r.path).join("\n  ")}\nRun node scripts/build-addresses.mjs to add them.`);
  process.exit(1);
}
ledger.rows.push(...added);

const problems = validate(ledger, SITE, pages.filter((f) => f !== "404.html"));
if (problems.length) {
  console.error(`addresses: ${problems.length} problems\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
if (!checkOnly) {
  if (added.length) writeFileSync(path.join(SITE, LEDGER), serialize(ledger));
  writeFileSync(path.join(SITE, "404.html"), stamped(notFound()));
} else if (readFileSync(path.join(SITE, "404.html"), "utf8").replace(/\r\n/g, "\n") !== stamped(notFound())) {
  // the committed page is exactly what this script writes, cache stamps included
  console.error("addresses: 404.html differs from what the ledger builds. Run node scripts/build-addresses.mjs and commit 404.html.");
  process.exit(1);
}
const count = (kind) => ledger.rows.filter((r) => r.kind === kind).length;
console.log(`addresses: ${ledger.rows.length} rows (${count("redirect")} redirects, ${count("moved")} moved, ${count("gone")} gone), ${added.length} added${checkOnly ? "" : "; 404.html written"}`);
for (const r of added.filter((x) => x.surface === "unassigned")) console.log(`  unassigned: ${r.path}`);

// The page carries the cache revision already recorded in world/IMPORT.json, so this script's output passes the
// site's cache rule by itself. The revision is read, never computed here: scripts/world-asset-revision.mjs owns it.
function stamped(html) {
  const record = path.join(SITE, "world/IMPORT.json");
  const rev = existsSync(record) ? JSON.parse(readFileSync(record, "utf8")).assetRevision : null;
  if (!rev) return html;
  return html.replace(/\b(href|src)="(\/(?:world|studies|system\/fonts\/accession)\/[^"#:?]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, a, t) => `${a}="${t}?v=${rev}"`);
}

// The page's script: the ledger is fetched once, and the guess is the same code the tests call, set in as written
// (its opening comment and the word "export" left out).
function finder() {
  const source = readFileSync(new URL("./addresses-nearest.mjs", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("const fold")).replace(/^export /gm, "").trim();
  if (/^\s*import\s/m.test(code) || code.includes("`") || code.includes("</script")) throw new Error("addresses-nearest.mjs must stay free of imports, template strings and script tags");
  return `${code}
const WHY = {
  moved: "This address moved. Its page is now at",
  withdrawn: "The page at this address was withdrawn and nothing replaced it. The home page is at",
  spelling: "The page you asked for is at",
  name: "A page with this name is at",
  close: "The closest address on the site is",
  folder: "That page is not here. The part of the site it was under is at",
};
const asked = document.getElementById("nf-asked"), near = document.getElementById("nf-near");
asked.textContent = location.pathname;
asked.parentElement.hidden = false;
Promise.all([
  fetch("/${LEDGER}").then((r) => { if (!r.ok) throw new Error("address ledger: HTTP " + r.status); return r.json(); }),
  fetch("/assets/data/unified/legacy_route_map.json").then((r) => r.ok ? r.json() : null).catch(() => null),
]).then(([ledger, legacy]) => {
  const routes = (legacy && legacy.routes) || {};
  const direct = routes[location.pathname] || routes[location.pathname.replace(/\/$/, "/index.html")];
  const found = direct ? { path: direct, why: "moved" } : nearest(location.pathname, ledger.rows, ledger.projectSites || [], location.hash);
  if (!found) { near.textContent = "No address on the site is close to this one. The six parts of the site and the index are listed below."; return; }
  const a = document.createElement("a");
  // the query and the place the reader asked for travel with them, unless the new address names its own
  const to = new URL(found.path, location.origin);
  if (!to.search) to.search = location.search;
  if (!to.hash && !found.placed) to.hash = location.hash;
  a.href = to.pathname + to.search + to.hash;
  a.textContent = found.path;
  near.replaceChildren(WHY[found.why] + " ", a, ".");
  // A moved row is the site's own record of where this address went, so the reader is taken there. A guess is only offered.
  if (found.why === "moved") location.replace(a.href);
}).catch((error) => {
  console.error(error);
  near.textContent = "The list of addresses did not load, so no nearest address can be offered. The six parts of the site and the index are listed below.";
});`;
}

// Without scripts the page cannot read the address that was asked for, so every moved address is listed with a
// plain link to where it went. Crawlers read the same list.
function moved() {
  const byPath = new Map(ledger.rows.map((r) => [r.path, r])), esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const items = ledger.rows.filter((r) => r.kind === "moved").map((r) => {
    const end = follow(r, byPath, ledger), to = end.address || end.project;
    return `<li><code>${esc(r.path)}</code> is now at <a href="${esc(to)}">${esc(to)}</a></li>`;
  });
  return items.length ? ["<noscript>", "<h2>Addresses that moved</h2>", '<ul id="nf-moved">', ...items, "</ul>", "</noscript>", ""].join(String.fromCharCode(10)) : "";
}

function notFound() {
  const rows = SURFACES.map((s) => `<li><a href="${s.path}">${s.name}</a>: ${s.does}.</li>`).join("\n");
  const body = `<article class="nf">
<h1>No page at this address</h1>
<p hidden>You asked for <code id="nf-asked"></code>.</p>
<p id="nf-near" role="status" aria-live="polite"></p>
${moved()}<h2>The site</h2>
<ul>
${rows}
<li><a href="${SITE_INDEX}">The index</a>: the site's pages, listed by kind of work.</li>
</ul>
<p>Every address this site has published is kept in <a href="/${LEDGER}">one list</a>. If a link from this site or from a search result brought you here, that is a fault in the site: please <a href="https://github.com/HarperZ9/HarperZ9.github.io/issues">report it</a>.</p>
</article>
<script type="module">
${finder()}
</script>`;
  return page({ path: "404.html", title: "No page at this address", robots: "noindex",
    description: "No page is at this address. This page takes a moved address to its new place, offers the nearest live address and lists the six parts of the site.", body });
}
