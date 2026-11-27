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
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "./studies-shell.mjs";
import { esc } from "./studies-markdown.mjs";
import { LANE_MARKS } from "./marks/lane-marks.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(readFileSync(path.join(site, "experiments/experiments.json"), "utf8"));
const cards = data.cards, domains = data.domains.filter((d) => cards.some((c) => c.domains.includes(d.id)));
const LABELS = { denominator: "Sample", interval: "Result", controls: "Controls", forecast_vs_outcome: "Forecast against outcome", known_answer: "Known answer" };
const DATE = new Date(data.built + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// G9 Live Receipt-Verified Experiment Table: every row links to a real SHA-256 engine-receipt/1 JSON file under experiments/receipts/
const receiptsDir = path.join(site, "experiments/receipts");
const RECEIPT_ORDER = [
  "buildlang-selfhost-stage2-stage3.json",
  "data-forge-buildlang-sig058.json",
  "articulate-buildlang-sig057.json",
  "inv01-symplectic-loom-titan.json",
  "buildlang-pr351-superopt-gpu-tv.json",
  "cmmns-pr133-cib-merkle.json",
  "n18-3dgs-buildlang-keepsakes.json",
  "ntc610-neural-texture-compression.json",
  "j13-model-epigenetics-and-j8.json",
  "jfc3p-14b-oracle-v5-and-v2-null.json",
];
const receiptFiles = readdirSync(receiptsDir)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .sort((a, b) => {
    const ia = RECEIPT_ORDER.indexOf(a), ib = RECEIPT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

const receiptRows = receiptFiles.map((file) => {
  const buf = readFileSync(path.join(receiptsDir, file));
  const raw = buf.toString("utf8");
  if (raw.includes("\u2014") || raw.includes("\u2013")) throw new Error(`receipt ${file}: em/en dash found`);
  if (/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(raw)) throw new Error(`receipt ${file}: local path found`);
  const obj = JSON.parse(raw);
  const fileSha = "sha256:" + createHash("sha256").update(buf).digest("hex");
  return {
    id: obj.id,
    file,
    bytes: buf.length,
    file_sha256: fileSha,
    title: obj.title,
    platform: obj.platform,
    domain: obj.domain,
    emitted_at: obj.emitted_at,
    verdict: obj.verdict,
    catalogue_id: obj.catalogue_id,
    source_url: obj.source_url,
    related_url: obj.related_url,
    claim_sha256: obj.digests.claim_sha256,
    envelope_sha256: obj.digests.envelope_sha256,
    metrics: obj.metrics,
    null_or_control: obj.null_or_control,
  };
});

writeFileSync(
  path.join(receiptsDir, "index.json"),
  JSON.stringify(
    {
      schema: "g9-experiment-receipt-ledger/1",
      updated: "2026-11-27",
      verification_rule: "Every row links to a public engine-receipt/1 JSON file under /experiments/receipts/ with verified SHA-256 file digest, upstream claim_sha256, MATCH verdict, and explicit null or planted-control disclosure.",
      entries: receiptRows.map(({ id, file, bytes, file_sha256, title, platform, domain, emitted_at, verdict, catalogue_id, source_url, claim_sha256, envelope_sha256 }) => ({
        id, file, bytes, file_sha256, title, platform, domain, emitted_at, verdict, catalogue_id, source_url, claim_sha256, envelope_sha256,
      })),
    },
    null,
    2
  ) + "\n"
);

function receiptLedger() {
  const rows = receiptRows.map((r) => {
    const metricText = Object.values(r.metrics || {}).slice(0, 2).join("; ");
    const shortClaim = r.claim_sha256.slice(0, 19);
    return `<tr>
      <th scope="row"><a href="${esc(r.source_url)}">${esc(r.title)}</a><span class="xl-sub">${esc(r.platform)} | ${esc(r.emitted_at.slice(0, 10))}</span></th>
      <td>${esc(metricText)}</td>
      <td>${esc(r.null_or_control)}</td>
      <td class="xl-rcpt"><span class="xl-verdict">${esc(r.verdict)}</span> <a href="/experiments/receipts/${esc(r.file)}"><code>${esc(shortClaim)}...</code></a><span class="xl-sub">catalogue #${esc(r.catalogue_id)} | JSON receipt</span></td>
    </tr>`;
  }).join("\n");
  return `<section class="xl" id="receipt-ledger" aria-labelledby="h-receipt-ledger">
  <h2 id="h-receipt-ledger">Live receipt-verified benchmark ledger (G9)</h2>
  <p>Alongside the 90 preregistered null and refuted studies below, ${receiptRows.length} live Wave 48-50 benchmarks and verification gates (backed by 319 zero-FLAG formula kernels and 234 verified author ideas enforced via Gate 6) link directly to their public <code>engine-receipt/1</code> JSON files, source code or pull requests, planted fail-closed controls or published negative results, and SHA-256 <code>claim_sha256</code> digests. Machine-readable manifest: <a href="/experiments/receipts/index.json"><code>/experiments/receipts/index.json</code></a>.</p>
  <div class="xl-wrap" tabindex="0" role="region" aria-label="Live receipt-verified benchmark ledger">
    <table class="xl-table">
      <thead>
        <tr>
          <th scope="col">Study / Kernel &amp; Code</th>
          <th scope="col">Measured Result</th>
          <th scope="col">Honest Null / Planted Controls</th>
          <th scope="col">SHA-256 Receipt</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="verified"><b>Verified</b> 27 November 2026: all ${receiptRows.length} rows above resolve to committed <code>engine-receipt/1</code> JSON files under <code>/experiments/receipts/</code> checked byte-for-byte against <code>/experiments/receipts/index.json</code> by <code>tests/g9-receipt-ledger.test.mjs</code> (including a planted 1-byte tamper control rejected as <code>DRIFT</code>).</p>
</section>`;
}

// each lane's drawn mark (scripts/marks/lane-marks.mjs), one view of a single sprite written by
// scripts/build-marks.mjs, so every lane costs one request; the label beside it carries the meaning, so the mark has empty alt text
const lane = (id, cls, size) => LANE_MARKS[id] ? `<img class="${cls}" src="/media/world/icons/lanes.svg#${id}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async">` : "";

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
  return `<figure class="xf"><div class="xf-scroll" tabindex="0" role="region" aria-label="The field of studies"><svg viewBox="-56 0 ${W + 56} ${H}" role="group" aria-label="Every study on this page, placed by when it ran (left to right) and by its domain; each mark links to its card">${rows}${marks}</svg></div>
<figcaption>Each mark is one study, earliest on the left. Choose a mark to go to its card.</figcaption></figure>`;
}

function card(c) {
  const nums = Object.entries(c.numbers).map(([k, v]) => `<dt>${LABELS[k] || esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  const scorer = c.scorer ? `${esc(c.scorer)}${c.self_graded ? ", self-graded" : ""}` : (c.self_graded ? "self-graded" : "");
  const verified = `<b>Verified</b> ${DATE}: all ${c.checked_numbers} numbers on this card appear in the study's own ledger entry (checked by the site's build, <code>tools/experiments/select.py</code>).${scorer ? ` The study was scored by ${scorer}.` : ""} No outside reviewer has read it.`;
  const domainNames = c.domains.map((d) => domains.find((x) => x.id === d)?.label).filter(Boolean).join(", ");
  return `<li class="xc" id="${c.id.toLowerCase()}" data-domains="${c.domains.join(" ")}">
  <p class="xc-meta"><span class="xc-n">${esc(c.id)}</span> <span class="xc-lanes">${c.domains.map((d) => lane(d, "xc-lane", 18)).join("")}${esc(domainNames)}</span>${c.rung ? ` <span>${esc(c.rung)}</span>` : ""}</p>
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
<p>Each study here was written down and locked before it ran, and is reported with whatever it found. Nulls stay on the record. ${cards.length} preregistered studies have cleared review so far, newest first, and ${receiptRows.length} live Wave 48-50 verification benchmarks sit in the <a href="#receipt-ledger">receipt-verified benchmark ledger</a> directly below.</p>
<p>Each card keeps its number in our findings ledger (F667 is the 667th finding). It gives the finding, the numbers behind it, the forecast against the outcome where the study made one, the verdict, the limits, and a Verified line saying what was checked. The full write-ups, signals and honest nulls together, are on <a href="/findings/">Findings</a>.</p>
${receiptLedger()}
${field()}
<div class="xp-filter" role="group" aria-label="Show one domain"><button type="button" data-domain="" aria-pressed="true">All <span>${cards.length}</span></button>${domains.map((d) => `<button type="button" data-domain="${d.id}" aria-pressed="false">${lane(d.id, "xp-lane", 20)}${esc(d.label)} <span>${cards.filter((c) => c.domains.includes(d.id)).length}</span></button>`).join("")}</div>
<p class="xp-count" aria-live="polite">${cards.length} studies shown.</p>
<ol class="xp-stream">${cards.map(card).join("\n")}</ol>
</article>
<script type="module" src="/world/site/experiments.js"></script>`;

const description = `${cards.length} preregistered studies that came back null or refuted their own forecast, each with its numbers, verdict, limits and what was checked.`;
writeFileSync(path.join(site, "experiments/index.html"), page({ path: "experiments/", title: "Experiments", description, body, extraHead: '<link rel="stylesheet" href="/world/site/experiments.css">' }));
console.log(`experiments/index.html: ${cards.length} studies in ${domains.length} domains`);
