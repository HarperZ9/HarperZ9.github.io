#!/usr/bin/env node
// Build the findings pages from the research records (findings/records/, written by scripts/record-findings.mjs).
//
//   node scripts/build-findings.mjs           write findings/index.html, findings/<id>-<slug>.html, glossary.html, pages.json
//   node scripts/build-findings.mjs --check   write nothing; exit 1 when any page on disk differs from a fresh build
//
// Each finding's page follows the research presentation system's landmarks (scripts/findings-page.mjs). Every link to
// a finding carries its standing flag, written here (scripts/finding-flags.mjs). A refuted or retracted finding's URL
// becomes a redirect stub, the site's pattern for moved pages: to the finding that replaced it, which carries the old
// record in its Trail, or to its entry on this index. The build stops when such a finding has no redirect entry in
// findings/data/ledger.json.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./studies-markdown.mjs";
import { page } from "./studies-shell.mjs";
import { cardTags } from "./analytics-cards.mjs";
import { flagLinks, standings } from "./finding-flags.mjs";
import { findingBody } from "./findings-page.mjs";
import { glossaryBody, indexBody, items } from "./findings-index.mjs";
import { chartsFor } from "./findings-charts.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(site, "findings");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const CSS = '<link rel="stylesheet" href="/world/site/experiments.css">\n<link rel="stylesheet" href="/world/site/findings.css">\n<link rel="stylesheet" href="/world/site/research.css">\n<script type="module" src="/world/site/research.js"></script>\n<script type="module" src="/world/site/research-type.js"></script>\n';
// pages that carry charts also load the chart styles and the live re-run loader
const CHART_HEAD = '<link rel="stylesheet" href="/world/site/findings-figures.css">\n<script type="module" src="/world/site/findings-live.js"></script>\n';
const AUTHOR = { "@type": "Person", name: "Zain Dana Harper", url: "https://harperz9.github.io/" };

// the plate beside a physics finding: the site's own copy of the period plate, with the paper's caption and alt text
function plateFor(figures) {
  return (b, ctx, caption) => {
    const fig = figures.figures[ctx.id];
    if (!fig) throw new Error(`${ctx.id}: plate ${b.src} has no entry in findings/figures.json`);
    const base = `/media/findings/traxler/traxler-1889-leaf-${fig.leaf}`;
    return `<figure class="fd-plate" id="${b.label.replace(":", "-")}"><img src="${base}-720.webp" srcset="${base}-720.webp 720w, ${base}-1440.webp 1440w" sizes="(max-width: 760px) 92vw, 560px" width="${fig.width}" height="${fig.height}" alt="${esc(b.alt || fig.alt)}" loading="lazy" decoding="async">
<figcaption>${caption}</figcaption></figure>`;
  };
}

// a finding's glossary: shared terms, overridden by the paper's own (the paper generator's rule), with anchors
function glossaryFor(id, glossary) {
  const out = {};
  for (const t of glossary.terms) if (t.scope === "shared") out[t.key] = { ...t, anchor: `g-${t.key}` };
  for (const t of glossary.terms) if (t.scope === id) out[t.key] = { ...t, anchor: `g-${t.key}-${id.toLowerCase()}` };
  return out;
}

// the site's moved-page stub (as daylight-commons/ uses): refresh, canonical, noindex, a plain link and the hash kept
export function redirectStub(to, words) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=${to}">
<link rel="canonical" href="https://harperz9.github.io${to.replace(/#.*$/, "")}">
<meta name="robots" content="noindex">
<title>Moved: ${esc(words)}</title></head>
<body style="font-family:'Hanken Grotesk',system-ui,sans-serif;max-width:40rem;margin:2.5rem auto;padding:0 1rem;line-height:1.6">
<p>${esc(words)} This page moved to <a href="${to}">${to}</a>.</p>
<script>location.replace(${JSON.stringify(to)}${to.includes("#") ? "" : " + location.hash"});</script></body></html>
`;
}

// redirects for refuted and retracted findings; throws when one has no entry
export function redirectsFor(records, st, ledger, pages) {
  const out = {};
  for (const r of records) {
    const id = r.document.id, type = st[id].type;
    if (type !== "refuted" && type !== "retracted") continue;
    if (!(id in (ledger.redirects || {}))) throw new Error(`${id} is ${type} and has no redirect target in findings/data/ledger.json`);
    const to = ledger.redirects[id];
    if (to && !pages[to]) throw new Error(`${id} redirects to ${to}, which has no page`);
    out[id] = { to, href: to ? pages[to] : `/findings/#${id.toLowerCase()}` };
  }
  return out;
}

function stampAssets(html) {
  const imp = path.join(site, "world/IMPORT.json"), rev = existsSync(imp) ? json(imp).assetRevision : null;
  if (!rev) return html;
  return html.replace(/\b(href|src)="(\/(?:world|studies|system\/fonts\/accession)\/[^"#:?]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, a, t) => `${a}="${t}?v=${rev}"`);
}

// the page's link card from img/og/p/cards.json, in place of the shell's borrowed card, so a stamped page and a
// fresh build agree byte for byte
function withCard(html, rel) {
  let tags = null;
  try { tags = cardTags(rel); } catch { return html; }
  if (!tags || !tags.length) return html;
  return html.replace(/<meta property="og:image" content="[^"]*">\n<meta name="twitter:card" content="summary_large_image">/, tags.join("\n"));
}

export function build({ records, glossary, ledger, meta, figures }) {
  const pages = Object.fromEntries(records.map((r) => [r.document.id, `/findings/${r.document.id}-${meta[r.document.id].slug}.html`]));
  const st = standings(records.map((r) => ({ id: r.document.id, href: pages[r.document.id] })), ledger.relations);
  const redirects = redirectsFor(records, st, ledger, pages);
  const live = records.filter((r) => !redirects[r.document.id]);
  const titles = Object.fromEntries(records.map((r) => [r.document.id, r.document.title]));
  const outputs = [], uses = [];
  for (const rec of live) {
    const id = rec.document.id, d = rec.document;
    const replaced = Object.entries(redirects).filter(([, v]) => v.to === id).map(([old]) => {
      const o = records.find((r) => r.document.id === old), w = ledger.relations.filter((x) => x.to === old).sort((a, b) => a.date.localeCompare(b.date)).pop();
      return { id: old, title: o.document.title, claim: o.document.standfirst, date: w.date, type: w.type, why: w.note };
    });
    const chartFile = path.join(DIR, "charts", `${id}.json`), charts = existsSync(chartFile) ? chartsFor(rec, json(chartFile)) : null;
    const { body, termUses } = findingBody(rec, { pages, glossary: glossaryFor(id, glossary), plate: plateFor(figures), relations: ledger.relations, replaced, charts });
    for (const u of termUses) uses.push({ ...u, page: id });
    const jsonld = { "@context": "https://schema.org", "@type": "ScholarlyArticle", headline: d.title, abstract: d.standfirst, identifier: id, dateCreated: d.date_found,
      datePublished: rec.versions[rec.versions.length - 1].date, author: AUTHOR, about: d.fields, encoding: { "@type": "MediaObject", encodingFormat: "application/pdf", contentUrl: `https://harperz9.github.io/findings/papers/${id}.pdf` },
      isPartOf: { "@type": "CollectionPage", name: "Findings", url: "https://harperz9.github.io/findings/" } };
    const rel = pages[id].slice(1);
    outputs.push([path.basename(rel), page({ path: rel, title: `${id}: ${d.title}`, description: d.standfirst, body, extraHead: CSS + (charts ? CHART_HEAD : "") + `<meta name="citation_pdf_url" content="https://harperz9.github.io/findings/papers/${id}.pdf">\n`, jsonld })]);
  }
  for (const [id, v] of Object.entries(redirects)) outputs.push([path.basename(pages[id]), redirectStub(v.href, `Finding ${id} was ${st[id].word}.`)]);
  const list = items(records, pages).map((it) => ({ ...it, standing: st[it.id], redirect: redirects[it.id] }));
  const nulls = list.filter((it) => it.tier === "D").length;
  outputs.push(["index.html", page({ path: "findings/", title: "Findings", description: `${list.length} experimental findings written up in full, ${nulls} of them honest nulls, each with its standing, numbers, corrections, a Verified line, its PDF and how to reproduce it.`, body: indexBody(list), extraHead: CSS })]);
  outputs.push(["glossary.html", page({ path: "findings/glossary.html", title: "Findings glossary", description: "Every technical term on the findings pages, defined the way we use it, with the field it comes from, what it excludes and every page that uses it.", body: glossaryBody(glossary, uses, pages, titles), extraHead: CSS })]);
  const done = outputs.map(([f, html]) => [f, f.endsWith(".html") && !redirects[f.split("-")[0]] ? stampAssets(withCard(flagLinks(html, st), f === "index.html" ? "findings/index.html" : `findings/${f}`)) : html]);
  done.push(["pages.json", JSON.stringify({ built: "2026-11-09", pages: [{ path: "findings/", indexable: true }, { path: "findings/glossary.html", indexable: true },
    ...records.map((r) => ({ path: pages[r.document.id].slice(1), id: r.document.id, tier: r.document.tier, standing: st[r.document.id].type, indexable: !redirects[r.document.id], ...(redirects[r.document.id] ? { redirect: redirects[r.document.id].href } : {}) }))] }, null, 1) + "\n"]);
  return { outputs: done, uses, pages, standings: st, redirects };
}

export function loadAll() {
  const recDir = path.join(DIR, "records");
  const records = readdirSync(recDir).filter((f) => /^F\d+\.json$/.test(f)).map((f) => json(path.join(recDir, f))).sort((a, b) => a.document.id.slice(1) - b.document.id.slice(1));
  return { records, glossary: json(path.join(recDir, "glossary.json")), ledger: json(path.join(DIR, "data/ledger.json")),
    meta: json(path.join(DIR, "data/meta.json")).findings, figures: json(path.join(DIR, "figures.json")) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const CHECK = process.argv.includes("--check");
  const { outputs, uses, redirects } = build(loadAll());
  const stale = readdirSync(DIR).filter((f) => /^F\d+-.+\.html$/.test(f) && !outputs.some(([o]) => o === f));
  if (CHECK) {
    const differ = outputs.filter(([f, s]) => !existsSync(path.join(DIR, f)) || readFileSync(path.join(DIR, f), "utf8") !== s).map(([f]) => f);
    if (differ.length || stale.length) { console.error(`findings: out of date: ${[...differ, ...stale].join(", ")}`); process.exit(1); }
    console.log(`findings: ${outputs.length} files match a fresh build`);
  } else {
    if (stale.length) console.error(`findings: remove pages with no record: ${stale.join(", ")}`);
    for (const [f, s] of outputs) writeFileSync(path.join(DIR, f), s);
    console.log(`findings: index, glossary and ${outputs.length - 3} finding pages (${Object.keys(redirects).length} redirects), ${uses.length} term uses`);
  }
}
