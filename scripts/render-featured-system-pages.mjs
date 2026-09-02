import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRegistry } from "./system-registry-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = validateRegistry(JSON.parse(await readFile(resolve(root, "system", "systems.json"), "utf8")));
const systemById = new Map(registry.systems.map((system) => [system.id, system]));
const domainById = new Map(registry.domains.map((domain) => [domain.id, domain]));
const generatedIds = [
  "behavior-transform",
  "relay",
  "plexus",
  "mneme",
  "studio-engine",
  "accountable-surface",
  "elder-enb",
  "enb-runtime-core",
  "skyrimbridge",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function metaDescription(purpose) {
  if (purpose.length <= 160) return purpose;
  const clipped = purpose.slice(0, 157).replace(/\s+\S*$/, "");
  return `${clipped}...`;
}

function cardFor(system) {
  return system.id;
}

function localHref(href) {
  if (href.startsWith("http") || href.startsWith("/")) return href;
  return `/${href}`;
}

function list(values) {
  return `<ul class="system-list">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function linkList(ids) {
  if (!ids.length) return '<p class="body-text system-null">No navigation-only related records are declared.</p>';
  return `<ul class="system-list">${ids.map((id) => {
    const system = systemById.get(id);
    return `<li><a href="${escapeHtml(localHref(system.href))}">${escapeHtml(system.name)}</a></li>`;
  }).join("")}</ul>`;
}

function evidenceList(system) {
  return system.evidence.map((evidence) => `<article class="index-row" role="listitem"><span class="index-term"><a href="${escapeHtml(evidence.href)}" rel="noopener">${escapeHtml(evidence.label)}</a></span><span class="index-gloss">${escapeHtml(evidence.summary)}<br><small>${escapeHtml(evidence.status)} · ${escapeHtml(evidence.date)}</small></span></article>`).join("");
}

function relationshipList(system) {
  const relations = registry.relations.filter((relation) => relation.source === system.id || relation.target === system.id);
  if (!relations.length) return '<p class="body-text system-null">No implementation relationship is asserted by the current typed registry.</p>';
  return `<div class="index system-evidence" role="list">${relations.map((relation) => {
    const outbound = relation.source === system.id;
    const other = systemById.get(outbound ? relation.target : relation.source);
    const labels = {
      "integrates-lane": outbound ? `Launches ${other.name} as a configured lane` : `Launched by ${other.name} as a configured lane`,
      "accepts-corpus-from": outbound ? `Accepts a corpus from ${other.name}` : `Supplies a corpus accepted by ${other.name}`,
      "accepts-evidence-from": outbound ? `Accepts evidence from ${other.name}` : `Supplies evidence accepted by ${other.name}`,
      "build-dependency": outbound ? `Builds against ${other.name}` : `Used as a build dependency by ${other.name}`,
      "optional-native-render-bridge": outbound ? `Offers an optional native render bridge to ${other.name}` : `Can use an optional native render bridge from ${other.name}`,
      "optional-native-runtime-dependency": outbound ? `Can use ${other.name} as an optional native runtime dependency` : `Can serve as an optional native runtime dependency for ${other.name}`,
      "optional-runtime-integration": outbound ? `Offers optional runtime integration with ${other.name}` : `Can use optional runtime integration from ${other.name}`,
    };
    const label = labels[relation.relation] ?? `${relation.claimScope} (${other.name})`;
    return `<article class="index-row" role="listitem"><span class="index-term">${escapeHtml(label)}</span><span class="index-gloss">${escapeHtml(relation.claimScope)}<br><small>${escapeHtml(relation.status)} · evidence ${escapeHtml(relation.evidenceIds.join(", "))}</small></span></article>`;
  }).join("")}</div>`;
}

function render(system) {
  const domains = system.domains.map((id) => domainById.get(id)?.label ?? id);
  const description = metaDescription(system.purpose);
  const card = cardFor(system);
  const dependencies = system.dependencies.length
    ? list(system.dependencies)
    : '<p class="body-text system-null">No runtime dependency is declared in the public registry.</p>';
  const sourceLink = system.sourceHref
    ? `<p class="body-text"><a href="${escapeHtml(system.sourceHref)}" rel="noopener">Inspect the public source</a></p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(system.name)} · System record</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="https://harperz9.github.io/${escapeHtml(system.href)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Zain Dana Harper"><meta property="og:title" content="${escapeHtml(system.name)} · System record"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="https://harperz9.github.io/${escapeHtml(system.href)}"><meta property="og:image" content="https://harperz9.github.io/img/og/${escapeHtml(card)}.png"><meta property="og:image:alt" content="${escapeHtml(system.name)} system card"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(system.name)} · System record"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="https://harperz9.github.io/img/og/${escapeHtml(card)}.png"><meta name="color-scheme" content="dark"><link rel="stylesheet" href="/system/system.css?v=20260902-creative-chassis"><style>
.system-hero{min-height:68vh}.system-meta{display:flex;flex-wrap:wrap;gap:.65rem 1.1rem;margin-top:1.5rem;font-family:var(--mono);font-size:.76rem;line-height:1.6;color:var(--muted)}.system-meta span{border-bottom:1px solid var(--hairline);padding:.2rem 0}.system-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(16rem,.72fr);gap:clamp(2rem,5vw,5rem);max-width:72rem}.system-list{max-width:62ch;margin:1rem 0 0;padding-left:1.2rem;color:var(--bone);font-size:clamp(1rem,1.25vw,1.14rem);line-height:1.7}.system-list li+li{margin-top:.55rem}.system-command{max-width:64rem;border-top:1px solid var(--hairline);padding:1rem 0;display:grid;grid-template-columns:minmax(9rem,.3fr) 1fr;gap:1rem}.system-command strong{font-family:var(--mono);font-size:.76rem;letter-spacing:.06em;color:var(--orange)}.system-command code{overflow-wrap:anywhere;color:var(--bone)}.system-null{color:var(--muted)}.system-evidence{max-width:72rem}.system-evidence .index-row{grid-template-columns:minmax(13rem,.42fr) 1fr}@media(max-width:720px){.system-grid,.system-command,.system-evidence .index-row{grid-template-columns:1fr}.system-hero{min-height:56vh}}
</style></head><body class="inner-clean frame-compact"><a class="skip-link" href="#main">Skip to content</a><div id="site-nav" class="site-nav"></div><noscript><nav class="site-nav"><a href="/catalog.html">Catalog</a> <a href="/overview.html">Systems</a> <a href="/security.html">Security</a></nav></noscript><script type="module" src="/system/nav.js?v=20260902-creative-chassis"></script>
<header class="frame system-hero"><div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt">${escapeHtml(system.productType)}</span></div><div class="mid"><h1>${escapeHtml(system.name)}.</h1><p class="lede">${escapeHtml(system.purpose)}</p><div class="system-meta"><span>${escapeHtml(system.maturity)}</span><span>${escapeHtml(system.releaseState)}</span><span>checked ${escapeHtml(system.lastVerified)}</span></div></div><div class="seal">${escapeHtml(domains.join(" · "))}</div></header>
<main id="main"><section class="mv" aria-labelledby="what-h"><h2 id="what-h">What it does</h2><p class="body-text">${escapeHtml(system.purpose)}</p><h3>Current use cases</h3>${list(system.useCases)}</section>
<section class="mv" aria-labelledby="workflow-h"><h2 id="workflow-h">Inputs and outputs</h2><div class="system-grid"><div><h3>Inputs</h3>${list(system.inputs)}</div><div><h3>Outputs</h3>${list(system.outputs)}</div></div></section>
<section class="mv" aria-labelledby="run-h"><h2 id="run-h">Run or evaluate</h2>${system.entryCommand ? `<div class="system-command"><strong>Entry</strong><code>${escapeHtml(system.entryCommand)}</code></div>` : '<p class="body-text system-null">This public record does not expose an entry command.</p>'}${system.verificationCommand ? `<div class="system-command"><strong>Verification</strong><code>${escapeHtml(system.verificationCommand)}</code></div>` : ""}${sourceLink}</section>
<section class="mv" aria-labelledby="relationships-h"><h2 id="relationships-h">Implemented relationships</h2><p class="body-text">Only typed relationships backed by the registry&rsquo;s cited implementation evidence appear here. Domain membership and the links below are navigation, not ownership or dependency.</p>${relationshipList(system)}<div class="system-grid"><div><h3>Declared dependencies</h3>${dependencies}</div><div><h3>Related navigation</h3>${linkList(system.related)}</div></div></section>
<section class="mv" aria-labelledby="evidence-h"><h2 id="evidence-h">Current evidence</h2><div class="index system-evidence" role="list">${evidenceList(system)}</div></section>
<section class="mv" aria-labelledby="limits-h"><h2 id="limits-h">Limitations and boundary</h2>${list(system.limitations)}<p class="body-text"><strong>Boundary.</strong> ${escapeHtml(system.boundary)}</p></section>
<section class="mv"><p class="seal-line"><a href="/catalog.html">Return to the system catalog</a>${system.sourceHref ? ` · <a href="${escapeHtml(system.sourceHref)}" rel="noopener">Inspect the public source</a>` : ""}</p></section></main></body></html>`;
}

for (const id of generatedIds) {
  const system = systemById.get(id);
  if (!system) throw new Error(`missing system record ${id}`);
  await writeFile(resolve(root, system.href), `${render(system)}\n`, "utf8");
  console.log(`rendered ${system.href}`);
}
