#!/usr/bin/env node
// Build experiments/index.html, the living index of our experiments, from experiments/experiments.json
// (written by tools/experiments/select.py, which decides what may be shown and checks every number).
//
//   node scripts/build-experiments.mjs
//
// One page, not a page per study: a field at the top (each study a mark, placed by when it ran and its domain)
// and a stream of cards under it, filterable by domain. Each card: the finding, its numbers, the forecast against
// the outcome, the verdict, the limits, the lock and a Verified line. Content is static HTML; the script only
// filters, so the page reads whole with scripts off.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { esc } from "./studies-markdown.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(readFileSync(path.join(site, "experiments/experiments.json"), "utf8"));
const cards = data.cards, domains = data.domains.filter((d) => cards.some((c) => c.domains.includes(d.id)));
const LABELS = { denominator: "Sample", interval: "Result", controls: "Controls", forecast_vs_outcome: "Forecast against outcome", known_answer: "Known answer" };
const DATE = new Date(data.built + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// the field: x is the finding's place in the ledger (time), y its first domain; each mark links to its card
function field() {
  const W = 960, rowH = 22, top = 8, H = top * 2 + domains.length * rowH, min = Math.min(...cards.map((c) => c.n)), max = Math.max(...cards.map((c) => c.n));
  const x = (n) => 150 + ((n - min) / Math.max(1, max - min)) * (W - 170);
  const rows = domains.map((d, i) => `<text x="140" y="${top + i * rowH + 15}" text-anchor="end" class="xf-lab">${esc(d.label)}</text><line x1="150" x2="${W - 20}" y1="${top + i * rowH + 11}" y2="${top + i * rowH + 11}" class="xf-rule"/>`).join("");
  // a study with several domains has a mark on each of their rows; only its first mark is a stop for the keyboard
  const marks = cards.map((c) => c.domains.map((d, k) => {
    const i = domains.findIndex((x) => x.id === d);
    return `<a href="#${c.id.toLowerCase()}" class="xf-mark" data-domains="${d}"${k ? ' tabindex="-1" aria-hidden="true"' : ""}><circle cx="${x(c.n).toFixed(1)}" cy="${top + i * rowH + 11}" r="4.5"><title>${esc(c.id)}: ${esc(c.title)}</title></circle></a>`;
  }).join("")).join("");
  return `<figure class="xf"><div class="xf-scroll" tabindex="0" role="region" aria-label="The field of studies"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Every study on this page, placed by when it ran (left to right) and by its domain; each mark links to its card">${rows}${marks}</svg></div>
<figcaption>Each mark is one study, earliest on the left. Choose a mark to go to its card.</figcaption></figure>`;
}

function card(c) {
  const nums = Object.entries(c.numbers).map(([k, v]) => `<dt>${LABELS[k] || esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  const scorer = c.scorer ? `${esc(c.scorer)}${c.self_graded ? ", self-graded" : ""}` : (c.self_graded ? "self-graded" : "");
  const verified = `<b>Verified</b> ${DATE}: all ${c.checked_numbers} numbers on this card appear in the study's own ledger entry (checked by the site's build, <code>tools/experiments/select.py</code>).${scorer ? ` The study was scored by ${scorer}.` : ""} No outside reviewer has read it.`;
  const domainNames = c.domains.map((d) => domains.find((x) => x.id === d)?.label).filter(Boolean).join(", ");
  return `<li class="xc" id="${c.id.toLowerCase()}" data-domains="${c.domains.join(" ")}">
  <p class="xc-meta"><span class="xc-n">${esc(c.id)}</span> <span>${esc(domainNames)}</span>${c.rung ? ` <span>${esc(c.rung)}</span>` : ""}</p>
  <h2 class="xc-title">${esc(c.title)}</h2>
  ${c.finding !== c.title ? `<p class="xc-finding">${esc(c.finding)}</p>` : ""}
  ${nums ? `<dl class="xc-nums">${nums}</dl>` : ""}
  <p class="xc-verdict"><span class="xc-tag">Null or refuted</span> ${esc(c.verdict)}</p>
  ${c.limits ? `<p class="xc-limits"><b>Limits</b> ${esc(c.limits)}</p>` : ""}
  ${c.lock ? `<p class="xc-lock">Design locked before the run: <code>sha256 ${esc(c.lock)}</code></p>` : ""}
  <p class="verified">${verified}</p>
</li>`;
}

const body = `<article class="tool xp">
<h1>Experiments</h1>
<p>Studies we ran, wrote down before running, and report whatever they found. This page holds the ones that came back null or refuted their own forecast: ${cards.length} studies, newest first. Studies whose signal is still under test are not here yet; they join when they are cleared for reporting.</p>
<p>Each card keeps its number in our findings ledger (F667 is the 667th finding). It gives the finding, the numbers behind it, the forecast against the outcome where the study made one, the verdict, the limits, and a Verified line saying what was checked.</p>
${field()}
<div class="xp-filter" role="group" aria-label="Show one domain"><button type="button" data-domain="" aria-pressed="true">All <span>${cards.length}</span></button>${domains.map((d) => `<button type="button" data-domain="${d.id}" aria-pressed="false">${esc(d.label)} <span>${cards.filter((c) => c.domains.includes(d.id)).length}</span></button>`).join("")}</div>
<p class="xp-count" aria-live="polite">${cards.length} studies shown.</p>
<ol class="xp-stream">${cards.map(card).join("\n")}</ol>
</article>
<script type="module" src="/world/site/experiments.js"></script>`;

const description = `${cards.length} preregistered studies that came back null or refuted their own forecast, each with its numbers, verdict, limits and what was checked.`;
writeFileSync(path.join(site, "experiments/index.html"), page({ path: "experiments/", title: "Experiments", description, body, extraHead: '<link rel="stylesheet" href="/world/site/experiments.css">' }));
console.log(`experiments/index.html: ${cards.length} studies in ${domains.length} domains`);
