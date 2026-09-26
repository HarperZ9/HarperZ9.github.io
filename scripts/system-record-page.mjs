// Renders one system record page from system/systems.json.
//
// scripts/render-system-pages.mjs is the only writer; this module holds the
// template so neither file outgrows the 300-line limit. Every value on the page
// comes from the registry, so a record edit is the only way to change a page.
//
// The page is a poster (scripts/system-record-head.mjs draws it) and a run of
// numbered plates. Evidence summaries carry digests, so each sits under
// "How we know".
import {
  disclosure,
  escapeCopy,
  escapeHtml,
  evidenceStatusOf,
  linkRow,
  localHref,
  publicOnly,
  verdictLine,
} from "./system-page-parts.mjs";
import { hero, renderHead } from "./system-record-head.mjs";

const NULL_LINE = (message) => `<p class="body-text system-null">${message}</p>`;

function list(values) {
  return `<ul class="system-list">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function grid(leftLabel, leftValues, rightLabel, rightValues) {
  return [
    '<div class="system-grid">',
    `<div><h3>${leftLabel}</h3>${list(leftValues)}</div>`,
    `<div><h3>${rightLabel}</h3>${list(rightValues)}</div>`,
    "</div>",
  ].join("");
}

function section(id, heading, body) {
  return `<section class="mv" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${heading}</h2><div class="plate-body">${body}</div></section>`;
}

function sourceLink(system) {
  return `<a href="${escapeHtml(system.sourceHref)}" rel="noopener">Inspect the public source</a>`;
}

function command(label, value) {
  if (!value) {
    return `<div class="system-command system-null"><strong>${label}</strong><span>Not publicly verified.</span></div>`;
  }
  return `<div class="system-command"><strong>${label}</strong><code>${escapeHtml(value)}</code></div>`;
}

function runGuide(system) {
  const guide = system.runGuide;
  if (!guide?.href || !guide?.label) return "";
  const summary = guide.summary ? ` ${escapeCopy(guide.summary)}` : "";
  return `<p class="body-text"><a href="${escapeHtml(guide.href)}" rel="noopener">${escapeHtml(guide.label)}</a>${summary}</p>`;
}

function runBlock(system) {
  const source = system.sourceHref ? `<p class="body-text">${sourceLink(system)}</p>` : "";
  return `${command("Entry", system.entryCommand)}${runGuide(system)}${command("Verification", system.verificationCommand)}${source}`;
}

function recordLinks(ctx, ids) {
  return ids
    .map((id) => ctx.systemById.get(id))
    .filter((system) => system && system.maturity !== "controlled-private");
}

function anchor(system) {
  return `<a href="${escapeHtml(localHref(system.href))}">${escapeHtml(system.name)}</a>`;
}

// Peers are the other public records sharing this family. Family is taxonomy,
// so the nav is navigation only and asserts nothing about shared code.
function familyNav(system, ctx) {
  const peers = publicOnly(ctx.registry.systems).filter(
    (other) => other.family === system.family && other.id !== system.id,
  );
  if (peers.length === 0) return "";
  return `<nav class="system-family-nav" aria-label="${escapeHtml(system.family)} family"><strong>Peer records</strong>${linkRow(peers.map(anchor))}</nav>`;
}

// Only typed relations appear here. A related id is navigation and never
// implies that one system is built on the other.
function claims(system, ctx) {
  const relations = ctx.registry.relations.filter(
    (relation) => relation.source === system.id || relation.target === system.id,
  );
  if (relations.length === 0) {
    return NULL_LINE("No relation-backed claims are registered for this system.");
  }
  const items = relations
    .map((relation) => {
      const source = ctx.systemById.get(relation.source);
      const target = ctx.systemById.get(relation.target);
      const label = escapeHtml(relation.relation.replaceAll("-", " "));
      return [
        `<li>${anchor(source)} <span>${label}</span> ${anchor(target)}<br>`,
        `<span class="system-null">${escapeHtml(relation.claimScope)}</span></li>`,
      ].join("");
    })
    .join("");
  return `<ul class="system-list">${items}</ul>`;
}

// A record whose site carries sibling routes says so here, because a reader
// who lands on the record has no other way to find them.
const ROUTE_NOTES = new Map([
  [
    "accountable-surface",
    '<p class="body-text"><a href="/accountable-machines.html">Accountable Machines</a>'
      + " is the companion theory route, not this product route.</p>",
  ],
  [
    "bulletin",
    '<p class="body-text">The board is readable live at <a href="/bulletin.html">Bulletin</a>,'
      + ' and <a href="/join.html">Join the board</a> carries the registration path an agent runs.</p>',
  ],
]);

// Related records, each with its product type, as an index a reader can scan.
function relatedIndex(ctx, system) {
  const related = recordLinks(ctx, system.related);
  if (related.length === 0) return NULL_LINE("No public related record is declared.");
  const rows = related.map(
    (other) => `<li>${anchor(other)}<span class="sys-related-type">${escapeHtml(other.productType)}</span></li>`,
  );
  return `<ul class="system-list sys-related">${rows.join("")}</ul>`;
}

// The related records and the family peers stay in view; dependencies and
// relation-backed claims are the checker's detail, under the disclosure.
function architectureBlock(system, ctx) {
  const dependencies = system.dependencies.length
    ? list(system.dependencies)
    : NULL_LINE("None declared in the public registry.");
  const inside = [
    `<h3>Dependencies</h3>${dependencies}`,
    "<h3>Relation-backed claims</h3>",
    claims(system, ctx),
  ].join("");
  return [
    `<div><h3>Related records</h3>${relatedIndex(ctx, system)}</div>`,
    familyNav(system, ctx),
    ROUTE_NOTES.get(system.id) ?? "",
    '<details class="product-record-details" id="architecture-details">',
    "<summary>Architecture, dependencies, and relationship notes</summary>",
    `<div class="disclosure-body">${inside}</div>`,
    "</details>",
  ].join("");
}

// One row per evidence record: its name, its verdict and date in view, and the
// summary (with its digests) under "How we know".
function evidenceRow(evidence) {
  const date = escapeHtml(evidence.date);
  return [
    '<article class="product-card sys-evidence-row" role="listitem"><div class="product-card-heading">',
    `<h3 class="product-card-title"><a href="${escapeHtml(evidence.href)}" rel="noopener">${escapeHtml(evidence.label)}</a></h3>`,
    verdictLine("product-verdict", evidenceStatusOf(evidence.status), ` <time datetime="${date}">${date}</time>`),
    '</div><div class="product-card-body">',
    disclosure("product-how", "How we know", `<p class="product-purpose">${escapeHtml(evidence.summary)}</p>`),
    "</div></article>",
  ].join("");
}

function evidenceBlock(system) {
  return `<div class="product-list system-evidence" role="list">${system.evidence.map(evidenceRow).join("")}</div>`;
}

function limitsBlock(system) {
  return `${list(system.limitations)}<p class="body-text system-boundary"><strong>Authorization boundary.</strong> ${escapeHtml(system.boundary)}</p>`;
}

function nextBlock(system, ctx) {
  const related = recordLinks(ctx, system.related);
  const sentence = related.length
    ? `<p class="body-text">Continue with ${related.map(anchor).join(", ")}.</p>`
    : "";
  const links = ['<a href="/catalog.html">Return to the system catalog</a>'];
  if (system.sourceHref) links.push(sourceLink(system));
  return `${sentence}${linkRow(links, "sys-link-row sys-next")}`;
}

export function renderRecordPage(system, ctx) {
  const head = renderHead(system, ctx);
  const main = [
    section(
      "who-it-is-for",
      "Who it is for",
      grid("Audiences", system.audiences, "Deployment contexts", system.deploymentContexts),
    ),
    section(
      "inputs-and-outputs",
      "Inputs and outputs",
      grid("Inputs", system.inputs, "Outputs", system.outputs),
    ),
    section("run-or-evaluate", "Run or evaluate", runBlock(system)),
    section(
      "architecture-and-relationships",
      "Architecture and relationships",
      architectureBlock(system, ctx),
    ),
    section("current-evidence", "Current evidence", evidenceBlock(system)),
    section(
      "limitations-and-boundaries",
      "Limitations and authorization boundaries",
      limitsBlock(system),
    ),
    section("related-and-next", "Related systems and next action", nextBlock(system, ctx)),
  ];
  return [
    head,
    '<main id="main" class="sys-record">\n',
    hero(system, ctx),
    "\n  ",
    main.slice(0, 2).join("\n  "),
    "\n",
    main.slice(2).join("\n"),
    "\n</main>\n</body>\n</html>\n",
  ].join("");
}
