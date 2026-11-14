// Dead-link crawl: fetch each shipped page, extract its internal links, and assert each one resolves.
// PAGES is derived by walking the repo for *.html (dot-dirs and node_modules skipped), so every
// shipped page, including subdirectory pages, is covered automatically.
//
// A link is checked when it leads to a page (*.html, *.htm) or to a folder (/playground/, which must have an
// index.html: the test server lists a folder that has none, and GitHub Pages does not). When the link names a place
// inside the page (#fragment), that place must exist in the target as an id or a name. A page may load part of
// itself after it opens; site-src/world/addresses.json names those parts ("lateParts"), and a place inside one
// counts. Links into another repository's pages on the same host ("projectSites" in the same file) are not in
// this repository and are skipped.
//
//   python -m http.server 8802 &   then   node tests/linkcheck.mjs
//   SITE_BASE_URL=http://127.0.0.1:8899 node tests/linkcheck.mjs   for a server on another port
//   node tests/linkcheck.mjs --self-test    checks the link reader alone, with no server
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const BASE = (process.env.SITE_BASE_URL || "http://localhost:8802").replace(/\/$/, "") + "/";
const get = p => new Promise(r => { const req = http.get(BASE + p, res => { res.resume(); r(res.statusCode); }); req.on("error", () => r(0)); req.setTimeout(4000, () => { req.destroy(); r(0); }); });
const getBody = p => new Promise(r => { const req = http.get(BASE + p, res => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>r(d)); }); req.on("error",()=>r("")); req.setTimeout(4000,()=>{req.destroy();r("");}); });
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LEDGER = JSON.parse(fs.readFileSync(path.join(ROOT, "site-src/world/addresses.json"), "utf8"));
const LATE = LEDGER.lateParts || {}, PROJECT_SITES = LEDGER.projectSites || [];

// links(body) -> the internal links of a page as written: [{ href, target, fragment }]
function links(body) {
  const out = [];
  for (const m of body.matchAll(/href="([^"]*)"/g)) {
    const href = m[1].replaceAll("&amp;", "&");
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;   // another site, mailto:, data:
    if (href.includes("${")) continue;                                           // a template in a script, filled in when it runs
    const hash = href.indexOf("#"), before = (hash < 0 ? href : href.slice(0, hash)).split("?")[0];
    const fragment = hash < 0 ? "" : href.slice(hash + 1);
    if (before === "" && fragment === "") continue;
    if (before !== "" && !/(\.html?|\/)$/.test(before)) continue;                // a stylesheet, an image, a download
    out.push({ href, target: before, fragment });
  }
  return out;
}
// A redirect stub hands its reader on, so a place named on a link to a stub is looked for where the stub leads.
const REFRESH = /<meta[^>]+http-equiv="refresh"[^>]+content="\s*\d+\s*;\s*url=([^"#]+)(?:#[^"]*)?"/i;
// A place the browser provides or a text search, which no id answers.
const builtIn = f => f === "" || f === "top" || f.startsWith(":~:");
const hasPlace = (body, fragment) => new RegExp(`\\b(?:id|name)=["']${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(body);

if (process.argv.includes("--self-test")) {
  const found = links('<a href="/playground/">a</a><a href="x.html#p">b</a><a href="#here">c</a><a href="https://example.org/a.html">d</a><a href="/a.css">e</a><a href="b.html?x=1#q">f</a><a href="mailto:a@b.c">g</a><a href="#${l.id}">h</a>');
  const want = [["/playground/", ""], ["x.html", "p"], ["", "here"], ["b.html", "q"]];
  const ok = JSON.stringify(found.map(l => [l.target, l.fragment])) === JSON.stringify(want)
    && hasPlace('<h2 id="p">', "p") && hasPlace("<a name='q'>", "q") && !hasPlace('<h2 id="pp">', "p") && builtIn("top") && !builtIn("p")
    && REFRESH.exec('<meta http-equiv="refresh" content="0; url=/hire.html#x">')[1] === "/hire.html";
  console.log(ok ? "link reader: ok" : `link reader: wrong ${JSON.stringify(found)}`);
  process.exit(ok ? 0 : 1);
}

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  // `home` is the source tree for the built root index.html, not a shipped page. tools/repo_explainers
  // holds generator sources and local build output; the pages it publishes are crawled where they ship.
  path.join(dir, e.name) === path.join(ROOT, "tools", "repo_explainers") ||
  e.name.startsWith(".") || e.name === "node_modules" || (e.name === "home" && dir === ROOT.replace(/[\\/]$/, "")) || path.join(dir, e.name) === path.join(ROOT, "home") ? []
  : e.isDirectory() ? walk(path.join(dir, e.name))
  : e.name.endsWith(".html") || e.name.endsWith(".htm") ? [path.relative(ROOT, path.join(dir, e.name)).replaceAll(path.sep, "/")]
  : []);
const PAGES = walk(ROOT).sort();
const seen = new Map(), bodies = new Map(); let bad = 0, checked = 0, folders = 0, places = 0;
// the page's text with every part it loads later, for looking up a place
const whole = async key => {
  if (!bodies.has(key)) bodies.set(key, (await Promise.all([key, ...(LATE["/" + key.replace(/(^|\/)index\.html$/, "$1")] || [])].map(getBody))).join("\n"));
  return bodies.get(key);
};
for (const p of PAGES) {
  const body = await getBody(p);
  const unique = new Map(links(body).map(l => [l.href, l]));
  for (const l of unique.values()) {
    const url = new URL(l.target || p.split("/").pop(), BASE + p);
    let key = decodeURIComponent(url.pathname).replace(/^\//,"");
    if (PROJECT_SITES.some(s => ("/" + key).startsWith(s)) && !fs.existsSync(path.join(ROOT, key))) continue;
    if (key === "" || key.endsWith("/")) { key += "index.html"; folders++; }
    if (!seen.has(key)) seen.set(key, await get(key));
    checked++;
    if (seen.get(key) !== 200) { console.log(`BAD ${seen.get(key)}  ${p} -> ${l.href}`); bad++; continue; }
    if (builtIn(l.fragment)) continue;
    places++;
    let fragment = l.fragment;
    try { fragment = decodeURIComponent(fragment); } catch { /* compared as written */ }
    for (let hops = 0, onward; hops < 5 && (onward = REFRESH.exec(await whole(key))); hops++) {
      const next = new URL(onward[1], BASE + key);
      if (next.origin + "/" !== BASE || PROJECT_SITES.some(s => next.pathname.startsWith(s))) break;
      key = decodeURIComponent(next.pathname).replace(/^\//, "").replace(/(^|\/)$/, "$1index.html");
    }
    if (!hasPlace(await whole(key), fragment)) { console.log(`BAD #    ${p} -> ${l.href} (no place named ${fragment} in ${key})`); bad++; }
  }
}
if (checked === 0) { console.log(`no internal links checked; is the server at ${BASE} up?`); process.exit(1); }
console.log(`checked ${checked} internal links across ${PAGES.length} pages (${folders} to folders, ${places} to a place in a page); ${bad} broken`);
process.exit(bad ? 1 : 0);
