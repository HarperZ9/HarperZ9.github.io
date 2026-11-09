#!/usr/bin/env node
// Build the findings pages from the write-ups in findings/src/ (brought in by scripts/import-findings.mjs).
//
//   node scripts/build-findings.mjs           write findings/index.html, findings/<id>-<slug>.html, findings/pages.json
//   node scripts/build-findings.mjs --check   write nothing; exit 1 when any page on disk differs from a fresh build
//
// The index: a field of every finding (placed by its ledger number and its domain, drawn by its tier), filters by
// tier and by domain, and the list itself, newest first. Honest nulls sit in the same list as the signals, with the
// same weight. Each finding's page: the question, how we tested it, the controls, the result with its numbers, the
// limits, the Verified line, how to reproduce it, and its sources. Content is static HTML; the script only filters.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, toHTML } from "./studies-markdown.mjs";
import { page } from "./studies-shell.mjs";
import { TIERS, DOMAINS, domainLabel, readWriteup, glyph, laneMark, plate } from "./findings-parts.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(site, "findings");
const CHECK = process.argv.includes("--check");
const PUBLISHED = "2026-11-09";
const CSS = '<link rel="stylesheet" href="/world/site/experiments.css">\n<link rel="stylesheet" href="/world/site/findings.css">\n';
const SECTION_ORDER = ["The question", "How we tested it", "Controls and planted checks", "Result", "Limits", "Verified", "Reproduce", "Sources"];

const figures = JSON.parse(readFileSync(path.join(DIR, "figures.json"), "utf8"));
const items = readdirSync(path.join(DIR, "src")).filter((f) => f.endsWith(".md"))
  .map((f) => readWriteup(readFileSync(path.join(DIR, "src", f), "utf8"), f))
  .sort((a, b) => b.n - a.n);
for (const it of items) it.href = `${it.id}-${it.slug}.html`;
const domains = DOMAINS.map(([id]) => id).filter((id) => items.some((it) => it.domains.includes(id)));
const tiers = Object.keys(TIERS).filter((t) => items.some((it) => it.tier === t));
const count = (pred) => items.filter(pred).length;
const nulls = count((it) => it.tier === "D");

const tierTag = (it) => `<span class="fd-tier" data-tier="${it.tierInfo.key}">${glyph(it.tier)}${esc(it.tierInfo.label)}</span>`;
const domainList = (it) => `<span class="xc-lanes">${it.domains.map((d) => laneMark(d)).join("")}${esc(it.domains.map(domainLabel).join(", "))}</span>`;

// the field: x is the finding's place in the ledger, y its first domain; the mark's drawing is its tier
function field() {
  const W = 960, rowH = 22, top = 8, H = top * 2 + domains.length * rowH;
  const min = Math.min(...items.map((c) => c.n)), max = Math.max(...items.map((c) => c.n));
  const x = (n) => 150 + ((n - min) / Math.max(1, max - min)) * (W - 170);
  const rows = domains.map((d, i) => `<text x="140" y="${top + i * rowH + 15}" text-anchor="end" class="xf-lab">${esc(domainLabel(d))}</text><line x1="150" x2="${W - 20}" y1="${top + i * rowH + 11}" y2="${top + i * rowH + 11}" class="xf-rule"/>`).join("");
  const marks = items.map((c) => c.domains.map((d, k) => {
    const y = top + domains.indexOf(d) * rowH + 11, cx = x(c.n).toFixed(1);
    return `<a href="${c.href}" class="fd-mark" data-tier="${c.tierInfo.key}" data-domains="${d}"${k ? ' tabindex="-1" aria-hidden="true"' : ""}><g transform="translate(${(cx - 7).toFixed(1)} ${y - 7})">${glyph(c.tier, 14, "fd-mglyph").replace(/<svg[^>]*>|<\/svg>/g, "")}<rect width="14" height="14" fill="transparent"/></g><title>${esc(c.id)}, ${esc(c.tierInfo.label)}: ${esc(c.title)}</title></a>`;
  }).join("")).join("");
  return `<figure class="xf"><div class="xf-scroll" tabindex="0" role="region" aria-label="The field of findings"><svg viewBox="-56 0 ${W + 56} ${H}" role="group" aria-label="Every finding on this page, placed by its number in the ledger (left to right) and by its domain; a filled disc is a strong signal, a ring a signal, a struck ring an honest null; each mark links to its write-up">${rows}${marks}</svg></div>
<figcaption>Each mark is one finding, earliest on the left: ${glyph("B*", 12)} strong signal, ${glyph("B", 12)} signal, ${glyph("D", 12)} honest null. Choose a mark to read it.</figcaption></figure>`;
}

function filters() {
  const tierButtons = tiers.map((t) => `<button type="button" data-tier="${TIERS[t].key}" aria-pressed="false">${glyph(t, 14, "fd-glyph")}${esc(TIERS[t].label)} <span>${count((it) => it.tier === t)}</span></button>`).join("");
  const domainButtons = domains.map((d) => `<button type="button" data-domain="${d}" aria-pressed="false">${laneMark(d, "xp-lane", 20)}${esc(domainLabel(d))} <span>${count((it) => it.domains.includes(d))}</span></button>`).join("");
  return `<div class="xp-filter fd-filter" role="group" aria-label="Show one kind of result"><button type="button" data-tier="" aria-pressed="true">Every result <span>${items.length}</span></button>${tierButtons}</div>
<div class="xp-filter fd-filter" role="group" aria-label="Show one field"><button type="button" data-domain="" aria-pressed="true">Every field <span>${items.length}</span></button>${domainButtons}</div>`;
}

function entry(it) {
  return `<li class="xc fd-item" id="${it.id.toLowerCase()}" data-tier="${it.tierInfo.key}" data-domains="${it.domains.join(" ")}">
  <p class="xc-meta"><span class="xc-n">${esc(it.id)}</span> ${tierTag(it)} ${domainList(it)}</p>
  <h2 class="xc-title"><a href="${it.href}">${esc(it.title)}</a></h2>
  <p class="xc-finding">${esc(it.standfirst)}</p>
</li>`;
}

function indexPage() {
  const tierKey = tiers.map((t) => `<dt>${glyph(t)}${esc(TIERS[t].label)}</dt><dd>${esc(TIERS[t].blurb)}.</dd>`).join("");
  const body = `<article class="tool xp fd">
<h1>Findings</h1>
<p>What our experiments found, written up one at a time. Each piece says what the result means, the question, how we tested it, the controls we planted to catch our own mistakes, the numbers with their sample sizes and intervals, the limits, and how to repeat it. Each ends with a Verified line naming what was checked against the study's own files before it went up.</p>
<p>${items.length} findings so far, and ${nulls} of them are honest nulls: tests that failed, claims that did not hold, and errors of our own that we found and fixed. They carry the same weight as the results that held, because knowing what does not work saves the next person the trip. More join as each one is checked.</p>
<dl class="fd-key">${tierKey}</dl>
${field()}
${filters()}
<p class="xp-count" aria-live="polite">${items.length} findings shown.</p>
<ol class="xp-stream">${items.map(entry).join("\n")}</ol>
<p class="fd-also">Looking for the shorter cards? <a href="/experiments/">Experiments</a> lists the preregistered studies that came back null, one card each.</p>
</article>
<script type="module" src="/world/site/findings.js"></script>`;
  const description = `${items.length} experimental findings written up in full, ${nulls} of them honest nulls, each with its numbers, limits, a Verified line and how to reproduce it.`;
  return page({ path: "findings/", title: "Findings", description, body, extraHead: CSS });
}

// the Verified section reads "Verified: ...", drawn as the site's Verified line
function verifiedLine(md) {
  const text = md.replace(/^Verified:\s*/, "");
  return `<p class="verified"><b>Verified</b>${toHTML(text).replace(/^<p>|<\/p>$/g, "")}</p>`;
}

function sectionHTML(it) {
  return SECTION_ORDER.filter((s) => it.sections[s]).map((s, i) => {
    const id = s.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "");
    const inner = s === "Verified" ? verifiedLine(it.sections[s]) : toHTML(it.sections[s], { idPrefix: `${id}-${i}` });
    return `<section class="fd-sec" aria-labelledby="${id}"><h2 id="${id}">${esc(s)}</h2>\n${inner}</section>`;
  }).join("\n");
}

function findingPage(it, i) {
  const newer = items[i - 1], older = items[i + 1];
  const nav = `<nav class="fd-next" aria-label="More findings">${newer ? `<a href="${newer.href}" rel="prev">Newer: ${esc(newer.id)}, ${esc(newer.title)}</a>` : ""}${older ? `<a href="${older.href}" rel="next">Older: ${esc(older.id)}, ${esc(older.title)}</a>` : ""}<a href="/findings/">Every finding</a></nav>`;
  const fig = it.figure === "traxler-slot" ? plate(figures.figures[it.id], figures) : "";
  const body = `<article class="tool st fd fd-page" data-tier="${it.tierInfo.key}">
<p class="xc-meta"><a class="fd-up" href="/findings/">Findings</a> <span class="xc-n">${esc(it.id)}</span> ${tierTag(it)} ${domainList(it)} <span>found ${esc(it.date_found)}</span></p>
<h1>${esc(it.title)}</h1>
<p class="fd-standfirst">${esc(it.standfirst)}</p>
${it.sections["What it means"] ? `<div class="fd-means">${toHTML(it.sections["What it means"], { idPrefix: "means" })}</div>` : ""}
${fig}
${sectionHTML(it)}
<p class="fd-data"><b>Data</b> ${toHTML(it.data || "").replace(/^<p>|<\/p>$/g, "")}</p>
<p class="fd-ledger">Finding ${esc(it.id)} is number ${esc(String(it.n))} in our findings ledger, where every result is kept in the order it came in. ${esc(it.tierInfo.label)} means ${esc(it.tierInfo.blurb)}.</p>
${nav}
</article>`;
  const jsonld = { "@context": "https://schema.org", "@type": "ScholarlyArticle", headline: it.title, abstract: it.standfirst, identifier: it.id,
    dateCreated: it.date_found, author: { "@type": "Person", name: "Zain Dana Harper", url: "https://harperz9.github.io/" },
    about: it.domains.map(domainLabel), isPartOf: { "@type": "CollectionPage", name: "Findings", url: "https://harperz9.github.io/findings/" } };
  return page({ path: `findings/${it.href}`, title: `${it.id}: ${it.title}`, description: it.standfirst, body, extraHead: CSS, jsonld });
}

const outputs = [["index.html", indexPage()], ...items.map((it, i) => [it.href, findingPage(it, i)])];
outputs.push(["pages.json", JSON.stringify({ built: PUBLISHED, pages: [{ path: "findings/", indexable: true }, ...items.map((it) => ({ path: `findings/${it.href}`, id: it.id, tier: it.tier, indexable: true }))] }, null, 1) + "\n"]);
const stale = readdirSync(DIR).filter((f) => /^F\d+-.+\.html$/.test(f) && !items.some((it) => it.href === f));
if (CHECK) {
  const differ = outputs.filter(([f, html]) => !existsSync(path.join(DIR, f)) || readFileSync(path.join(DIR, f), "utf8") !== html).map(([f]) => f);
  if (differ.length || stale.length) { console.error(`findings: out of date: ${[...differ, ...stale].join(", ")}`); process.exit(1); }
  console.log(`findings: ${outputs.length} files match a fresh build`);
} else {
  if (stale.length) console.error(`findings: remove pages with no write-up: ${stale.join(", ")}`);
  for (const [f, html] of outputs) writeFileSync(path.join(DIR, f), html);
  console.log(`findings: index and ${items.length} pages (${nulls} honest nulls) in ${domains.length} fields`);
}
