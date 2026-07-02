// Dead-link crawl: fetch each shipped page, extract internal *.html links, assert each resolves (200).
// PAGES is derived by walking the repo for *.html (dot-dirs and node_modules skipped), so every
// shipped page, including subdirectory pages, is covered automatically.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const BASE = "http://localhost:8802/";
const get = p => new Promise(r => { const req = http.get(BASE + p, res => { res.resume(); r(res.statusCode); }); req.on("error", () => r(0)); req.setTimeout(4000, () => { req.destroy(); r(0); }); });
const getBody = p => new Promise(r => { const req = http.get(BASE + p, res => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>r(d)); }); req.on("error",()=>r("")); req.setTimeout(4000,()=>{req.destroy();r("");}); });
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.name.startsWith(".") || e.name === "node_modules" ? []
  : e.isDirectory() ? walk(path.join(dir, e.name))
  : e.name.endsWith(".html") ? [path.relative(ROOT, path.join(dir, e.name)).replaceAll(path.sep, "/")]
  : []);
const PAGES = walk(ROOT).sort();
const seen = new Map(); let bad = 0, checked = 0;
for (const p of PAGES) {
  const body = await getBody(p);
  const links = [...body.matchAll(/href="([^"#?:]+\.html)(?:[#?][^"]*)?"/g)].map(m=>m[1]).filter(h=>!h.startsWith("http"));
  for (const l of new Set(links)) {
    const key = decodeURIComponent(new URL(l, BASE + p).pathname).replace(/^\//,"");
    if (!seen.has(key)) seen.set(key, await get(key));
    checked++;
    if (seen.get(key) !== 200) { console.log(`BAD ${seen.get(key)}  ${p} -> ${l}`); bad++; }
  }
}
if (checked === 0) { console.log("no internal links checked; is the server on :8802 up?"); process.exit(1); }
console.log(`checked ${checked} internal links across ${PAGES.length} pages; ${bad} broken`);
process.exit(bad ? 1 : 0);
