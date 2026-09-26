// Helpers shared by every page rendered from system/systems.json.
export const MIDDOT = "·";
export const SITE = "https://harperz9.github.io/";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Product copy keeps its apostrophes as typed. Every other registry string
// goes through escapeHtml, which encodes the apostrophe as well.
export function escapeCopy(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// An evidence link back to this site is written relative so a page resolves
// from a local checkout as well as from the deployed origin.
export function siteRelative(href) {
  return href.startsWith(SITE) ? href.slice(SITE.length) : href;
}

// Registry hrefs are repository-relative; page links are origin-absolute.
export function localHref(href) {
  if (href.startsWith("http") || href.startsWith("/")) return href;
  return `/${href}`;
}

// Controlled-private records keep a catalog row and a boundary page, and stay
// out of every list that reads as a public product route.
export function publicOnly(systems) {
  return systems.filter((system) => system.maturity !== "controlled-private");
}

// A row shows one sentence of purpose. The first sentence ends at a stop that
// a space and a capital follow, so "v1.0.4" and "transform.io" never split.
// The second value is empty when the purpose is one sentence long.
export function splitPurpose(purpose) {
  const match = String(purpose).match(/^(.+?[.!?])\s+(?=[A-Z(“"])/);
  return match ? [match[1], purpose.slice(match[0].length)] : [purpose, ""];
}

// Maturity is a release fact, not a verdict, so its glyph is drawn in ink and
// its shape carries the meaning: a filled square for a shipped release, a half
// filled square for work in progress, a dashed square for a private record.
const MATURITY = new Map([
  ["shipped", "shipped"],
  ["active", "active"],
  ["controlled-private", "private"],
]);

export function maturityState(maturity) {
  return MATURITY.get(maturity) ?? "stated";
}

// An evidence record carries the only verdict on these pages: verified, or
// reported by its owner. Its glyph is an aperture in the verdict color.
export function evidenceStatusOf(status) {
  if (status === "verified") return { verdict: "verified", word: "Verified" };
  const word = String(status).replaceAll("-", " ");
  return { verdict: "stated", word: word.charAt(0).toUpperCase() + word.slice(1) };
}

export function verdictLine(className, { verdict, word }, after = "") {
  return [
    `<p class="${className} verdict-line" data-verdict="${escapeHtml(verdict)}">`,
    '<span class="verdict-glyph" aria-hidden="true"></span>',
    `<span class="verdict-word">${escapeHtml(word)}</span>${after}</p>`,
  ].join("");
}

// A row of links that wraps between items and never on a separator.
export function linkRow(links, className = "sys-link-row") {
  return `<ul class="${className}">${links.map((link) => `<li>${link}</li>`).join("")}</ul>`;
}

// A pillar plate from the aperture art family. The light and dark drawings
// share one alt text, read from art/aperture/covers.json.
export function artPlate(name, alt, prefix = "") {
  const text = escapeHtml(alt);
  const image = (tone) =>
    `<img class="art-${tone}" src="${prefix}art/aperture/${name}-${tone}.svg" width="1200" height="900" alt="${text}" loading="lazy" decoding="async">`;
  return `<figure class="art art-pillar">${image("light")}${image("dark")}</figure>`;
}

// A closed disclosure in the site's "How we know" form. The body carries what
// a checker needs and a first-time reader does not.
// A "How we know" on the catalog carries detail each product page also holds, so paper
// keeps it folded (print.css and nav.js read data-print="closed").
export function disclosure(className, summary, body) {
  const printClosed = /(^|\s)product-how(\s|$)/.test(className) ? ' data-print="closed"' : "";
  return [
    `<details class="${className}"${printClosed}>`,
    `<summary>${summary}</summary>`,
    `<div class="disclosure-body">${body}</div>`,
    "</details>",
  ].join("");
}

// Row parts shared by the catalog and the product map.
//
// A release is the strongest evidence a product can show, so one wins whenever
// it exists. Inside the chosen pool the newest date wins, and a tie keeps the
// order the registry already declares.
export function headlineEvidence(system) {
  const releases = system.evidence.filter((item) => item.type === "release");
  const pool = releases.length > 0 ? releases : system.evidence;
  if (pool.length === 0) return null;
  return pool.reduce((best, item) => (item.date > best.date ? item : best), pool[0]);
}

// The maturity and the release state on one line, beside the name. The release
// state carries the honest nulls ("no PyPI release claimed"), so it stays in
// view. tests/test_engines_page_refresh.py reads "maturity · release" back.
export function stateLine(system) {
  return [
    `<p class="product-state" data-maturity="${maturityState(system.maturity)}">`,
    '<span class="state-glyph" aria-hidden="true"></span>',
    `<span class="state-text">${escapeHtml(system.maturity)} ${MIDDOT} ${escapeHtml(system.releaseState)}</span></p>`,
  ].join("");
}

// Name, type and state: the left rail of every product row.
export function rowHeading(system) {
  return [
    '<div class="product-card-heading">',
    `<h3 class="product-card-title"><a href="${escapeHtml(system.href)}">${escapeHtml(system.name)}</a></h3>`,
    `<p class="product-type">${escapeHtml(system.productType)}</p>`,
    stateLine(system),
    "</div>",
  ].join("");
}

// The row shows the first sentence. A longer purpose prints in full inside
// "How we know"; a one-sentence purpose is the row's own line.
export function purposeLead(system) {
  const [first, rest] = splitPurpose(system.purpose);
  return rest
    ? `<p class="product-lede">${escapeCopy(first)}</p>`
    : `<p class="product-purpose">${escapeCopy(system.purpose)}</p>`;
}

export function purposeInFull(system) {
  const [, rest] = splitPurpose(system.purpose);
  return rest ? `<p class="product-purpose">${escapeCopy(system.purpose)}</p>` : "";
}

// The same two facts as the state line, as a term list for a checker.
export function statusFacts(system) {
  const facts = [
    ["Status", system.maturity],
    ["Release", system.releaseState],
  ];
  return [
    '<dl class="product-status">',
    ...facts.map(
      ([term, value]) => `<div class="product-status-fact"><dt>${term}</dt><dd>${escapeHtml(value)}</dd></div>`,
    ),
    "</dl>",
  ].join("");
}

export function productActions(system) {
  const source = system.sourceHref
    ? `<a class="product-secondary-action" href="${escapeHtml(system.sourceHref)}" rel="noopener">Inspect source</a>`
    : "";
  return [
    '<div class="product-card-actions">',
    `<a class="product-action" href="${escapeHtml(system.href)}">Open product record</a>`,
    source,
    "</div>",
  ].join("");
}

// The headline evidence in view: its verdict in the verdict color, then what
// was checked and when. This is the only colored mark a row carries.
export function catalogEvidence(system) {
  const evidence = headlineEvidence(system);
  if (!evidence) return "";
  const { verdict, word } = evidenceStatusOf(evidence.status);
  const date = escapeHtml(evidence.date);
  return [
    `<p class="catalog-evidence" data-verdict="${verdict}">`,
    '<span class="verdict-glyph" aria-hidden="true"></span>',
    `<span class="verdict-word">${escapeHtml(word)}</span> `,
    `<a href="${escapeHtml(siteRelative(evidence.href))}" rel="noopener">${escapeHtml(evidence.label)}</a> `,
    `<time datetime="${date}">${date}</time></p>`,
  ].join("");
}

export const boundaryLine = (system) =>
  `<p class="body-text product-boundary"><strong>Boundary:</strong> ${escapeHtml(system.boundary)}</p>`;
