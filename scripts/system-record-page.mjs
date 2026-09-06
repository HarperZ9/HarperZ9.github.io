// Renders one system record page from system/systems.json.
//
// scripts/render-system-pages.mjs is the only writer; this module holds the
// template so neither file outgrows the 300-line limit. Every value on the page
// comes from the registry, so a record edit is the only way to change a page.
import { escapeCopy, escapeHtml, localHref, MIDDOT, publicOnly } from "./system-page-parts.mjs";
import { renderHead } from "./system-record-head.mjs";

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
  return `<section class="mv" id="${id}" aria-labelledby="${id}-h"><h2 id="${id}-h">${heading}</h2>${body}</section>`;
}

function sourceLink(system) {
  return `<a href="${escapeHtml(system.sourceHref)}" rel="noopener">Inspect the public source</a>`;
}

function heroActions(system) {
  const open = system.sourceHref
    ? `<a href="${escapeHtml(system.sourceHref)}" rel="noopener">Open source</a>`
    : "";
  const run =
    system.entryCommand || system.verificationCommand
      ? '<a href="#run-or-evaluate">Open run details</a>'
      : "";
  return [
    '<div class="system-hero-actions">',
    open,
    run,
    '<a href="#current-evidence">Open evidence</a>',
    "</div>",
  ].join("");
}

// The four stamps a reader needs before trusting anything below: how mature the
// work is, how they can get at it, what is actually released, and when the
// record was last checked against the source.
function heroMeta(system) {
  const stamps = [
    system.maturity,
    system.accessMode,
    system.releaseState,
    `verified ${system.lastVerified}`,
  ];
  return `<div class="system-meta">${stamps.map((stamp) => `<span>${escapeHtml(stamp)}</span>`).join("")}</div>`;
}

// tests/test_project_copy_ground_truth.py reads a product's one canonical
// definition back off the page by this marker, so the records it names carry
// it on the lede. Pages outside that set state the same purpose unmarked.
const CANONICAL_PURPOSE_IDS = new Set([
  "flywheel",
  "index",
  "gather",
  "buildlang",
  "phantom",
  "accountable-surface",
  "array",
  "seed",
  "sofer",
  "isomorph",
  "bounds",
  "kun",
]);

function canonicalMark(system) {
  return CANONICAL_PURPOSE_IDS.has(system.id)
    ? ` data-canonical-purpose="${escapeHtml(system.id)}"`
    : "";
}

function hero(system, ctx) {
  const domains = system.domains.map((id) => ctx.domainById.get(id)?.label ?? id);
  return [
    '<div class="frame system-hero"><div class="bar">',
    '<span class="nm">Zentropy Labs</span>',
    `<span class="rt">${escapeHtml(system.productType)}</span></div>`,
    `<div class="mid"><h1>${escapeHtml(system.name)}.</h1>`,
    `<p class="lede"${canonicalMark(system)}>${escapeCopy(system.purpose)}</p>`,
    heroActions(system),
    heroMeta(system),
    "</div>",
    `<div class="seal">${escapeHtml(domains.join(` ${MIDDOT} `))}</div></div>`,
  ].join("");
}

function command(label, value) {
  if (!value) {
    return `<div class="system-command system-null"><strong>${label}</strong><span>Not publicly verified.</span></div>`;
  }
  return `<div class="system-command"><strong>${label}</strong><code>${escapeHtml(value)}</code></div>`;
}

function runBlock(system) {
  const source = system.sourceHref ? `<p class="body-text">${sourceLink(system)}</p>` : "";
  return `${command("Entry", system.entryCommand)}${command("Verification", system.verificationCommand)}${source}`;
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
  const links = peers.map(anchor).join(` ${MIDDOT} `);
  return `<nav class="system-family-nav" aria-label="${escapeHtml(system.family)} family"><strong>Peer records</strong> ${links}</nav>`;
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

function architectureBlock(system, ctx) {
  const dependencies = system.dependencies.length
    ? list(system.dependencies)
    : NULL_LINE("None declared in the public registry.");
  const related = recordLinks(ctx, system.related);
  const relatedList = related.length
    ? `<ul class="system-list">${related.map((other) => `<li>${anchor(other)}</li>`).join("")}</ul>`
    : NULL_LINE("No public related record is declared.");
  return [
    familyNav(system, ctx),
    '<div class="system-grid">',
    `<div><h3>Dependencies</h3>${dependencies}</div>`,
    `<div><h3>Related records</h3>${relatedList}</div>`,
    "</div>",
    "<h3>Relation-backed claims</h3>",
    claims(system, ctx),
    ROUTE_NOTES.get(system.id) ?? "",
  ].join("");
}

function evidenceBlock(system) {
  const rows = system.evidence
    .map((evidence) =>
      [
        '<article class="index-row" role="listitem"><span class="index-term">',
        `<a href="${escapeHtml(evidence.href)}" rel="noopener">${escapeHtml(evidence.label)}</a></span>`,
        `<span class="index-gloss">${escapeHtml(evidence.summary)}<br>`,
        `<small>${escapeHtml(evidence.status)} ${MIDDOT} ${escapeHtml(evidence.date)}</small></span></article>`,
      ].join(""),
    )
    .join("");
  return `<div class="index system-evidence" role="list">${rows}</div>`;
}

function limitsBlock(system) {
  return `${list(system.limitations)}<p class="body-text"><strong>Authorization boundary.</strong> ${escapeHtml(system.boundary)}</p>`;
}

function nextBlock(system, ctx) {
  const related = recordLinks(ctx, system.related);
  const sentence = related.length
    ? `<p class="body-text">Continue with ${related.map(anchor).join(", ")}.</p>`
    : "";
  const source = system.sourceHref ? ` ${MIDDOT} ${sourceLink(system)}` : "";
  return `${sentence}<p class="seal-line"><a href="/catalog.html">Return to the system catalog</a>${source}</p>`;
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
    hero(system, ctx),
    '\n<main id="main">\n  ',
    main.slice(0, 2).join("\n  "),
    "\n",
    main.slice(2).join("\n"),
    "\n</main>\n</body>\n</html>\n",
  ].join("");
}
