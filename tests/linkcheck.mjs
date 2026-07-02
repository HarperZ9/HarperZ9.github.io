// Dead-link crawl: fetch each shipped page, extract internal *.html links, assert each resolves (200).
import http from "node:http";
const BASE = "http://localhost:8802/";
const get = p => new Promise(r => { const req = http.get(BASE + p, res => { res.resume(); r(res.statusCode); }); req.on("error", () => r(0)); req.setTimeout(4000, () => { req.destroy(); r(0); }); });
const getBody = p => new Promise(r => { const req = http.get(BASE + p, res => { let d=""; res.on("data",c=>d+=c); res.on("end",()=>r(d)); }); req.on("error",()=>r("")); req.setTimeout(4000,()=>{req.destroy();r("");}); });
const PAGES = ["index.html","studio.html","overview.html","gather.html","crucible.html","learn.html","research.html","research-formal-replay-preflight.html","writing.html","why.html","cv.html","resume.html","person.html","emet.html","proof-surface.html","coherence-membrane.html","accountable-machines.html","accountable-engine.html","quantalang.html","raw.html","quanta-color.html","quanta-products.html","toolkit.html","provenance-sensorium.html","orca.html","aleph.html","presentation.html","warden.html","emet-sample.html","proof-surface-sample.html","proof-index-sample.html","public-surface-sweeper-sample.html","atelier.html","gallery.html","demonstrations.html"];
const seen = new Map(); let bad = 0, checked = 0;
for (const p of PAGES) {
  const body = await getBody(p);
  const links = [...body.matchAll(/href="([^"#?:]+\.html)(?:[#?][^"]*)?"/g)].map(m=>m[1]).filter(h=>!h.startsWith("http"));
  for (const l of new Set(links)) {
    const key = l.replace(/^\.\//,"");
    if (!seen.has(key)) seen.set(key, await get(key));
    checked++;
    if (seen.get(key) !== 200) { console.log(`BAD ${seen.get(key)}  ${p} -> ${l}`); bad++; }
  }
}
console.log(`checked ${checked} internal links across ${PAGES.length} pages; ${bad} broken`);
process.exit(bad ? 1 : 0);
