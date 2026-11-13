#!/usr/bin/env node
// Check the address ledger and build 404.html from it.
//
// The ledger (site-src/world/addresses.json) lists every address the site has published; no address in it may go
// dead. This script:
//   1. adds a row for each served page that has none yet (kind and surface from scripts/addresses-classify.mjs,
//      "since" today), at the end of the ledger, and leaves every existing row as it is;
//   2. checks every row: a live row has its page, a redirect row has a stub that leads where the row says and ends
//      at a page, a gone row names the commit that removed it; any problem stops the build;
//   3. writes 404.html, the page GitHub Pages serves for an address with no file. It reads the ledger and offers
//      the nearest live address. Without scripts it is a list of the six surfaces, the home and the index.
//
//   node scripts/build-addresses.mjs           add rows, check, write 404.html
//   node scripts/build-addresses.mjs --check   check only; write nothing
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LEDGER, SITE, SITE_INDEX, SURFACES, addressOf, loadLedger, serialize, servedPages, validate } from "./addresses-lib.mjs";
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
  writeFileSync(path.join(SITE, "404.html"), notFound());
}
const count = (kind) => ledger.rows.filter((r) => r.kind === kind).length;
console.log(`addresses: ${ledger.rows.length} rows (${count("redirect")} redirects, ${count("gone")} gone), ${added.length} added${checkOnly ? "" : "; 404.html written"}`);
for (const r of added.filter((x) => x.surface === "unassigned")) console.log(`  unassigned: ${r.path}`);

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
fetch("/${LEDGER}").then((r) => { if (!r.ok) throw new Error("address ledger: HTTP " + r.status); return r.json(); }).then((ledger) => {
  const found = nearest(location.pathname, ledger.rows, ledger.projectSites || []);
  if (!found) { near.textContent = "No address on the site is close to this one. The six parts of the site and the index are listed below."; return; }
  const a = document.createElement("a");
  a.href = found.path + (found.path.includes("#") ? "" : location.hash);
  a.textContent = found.path;
  near.replaceChildren(WHY[found.why] + " ", a, ".");
}).catch((error) => {
  console.error(error);
  near.textContent = "The list of addresses did not load, so no nearest address can be offered. The six parts of the site and the index are listed below.";
});`;
}

function notFound() {
  const rows = SURFACES.map((s) => `<li><a href="${s.path}">${s.name}</a>: ${s.does}.</li>`).join("\n");
  const body = `<article class="nf">
<h1>No page at this address</h1>
<p hidden>You asked for <code id="nf-asked"></code>.</p>
<p id="nf-near" role="status" aria-live="polite"></p>
<h2>The site</h2>
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
    description: "No page is at this address. This page offers the nearest live address and lists the six parts of the site, the home and the index.", body });
}
