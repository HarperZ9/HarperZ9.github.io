import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRegistry } from "./system-registry-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = validateRegistry(JSON.parse(await readFile(resolve(root, "system", "systems.json"), "utf8")));
const systemById = new Map(registry.systems.map((system) => [system.id, system]));
const evidenceById = new Map(registry.systems.flatMap((system) => system.evidence.map((evidence) => [evidence.id, evidence])));
const verifiedRelations = registry.relations.filter((relation) => relation.status === "verified-in-source");

const relationLabels = {
  "accepts-corpus-from": "accepts corpus from",
  "accepts-evidence-from": "accepts evidence from",
  "build-dependency": "builds against",
  "integrates-lane": "launches as a configured lane",
  "optional-native-render-bridge": "can invoke as an optional native bridge",
  "optional-native-runtime-dependency": "optionally links at runtime",
  "optional-runtime-integration": "supports an optional runtime integration",
};

const configurations = [
  {
    id: "system-capability-map",
    title: "Verified cross-system relationships",
    description: "Every row is one implementation relationship recorded in the public system registry. Systems repeat when they participate in more than one relationship.",
    claim: (relations) => `${relations.length} implementation relationships are backed by the evidence IDs on their registry records. The map does not infer family, ownership, or general-association lines.`,
    doesNotProve: "A recorded relationship does not establish product ownership, general interoperability, production adoption, performance, correctness, safety, or independent review.",
    uncertainty: "The registry is a checked snapshot. Local source or a public release can change after its recorded verification date.",
    selectSystems() {
      const endpointIds = new Set(verifiedRelations.flatMap((relation) => [relation.source, relation.target]));
      return registry.systems.filter((system) => endpointIds.has(system.id));
    },
    transformations: [
      "Only verified-in-source typed relation records are included.",
      "Systems with no typed relationship are omitted from this relationship view.",
      "Rows are sorted by source name, relationship type, and target name.",
    ],
  },
  {
    id: "security-capability-map",
    title: "Security and privacy systems",
    description: "Distinct public and private-practice systems whose registry record includes security and privacy work. Product type remains visible so unlike tools are not collapsed into one category.",
    claim: (relations) => relations.length
      ? `${relations.length} verified typed implementation relationships have both endpoints in this domain view.`
      : "The current registry asserts no verified typed implementation relationship whose endpoints both appear in this domain view.",
    doesNotProve: "Domain placement does not establish authorization for a use, operational safety, shared implementation, equal maturity, product ownership, deployment fitness, or independent review.",
    uncertainty: "An absent line means no typed relationship is recorded in the current public registry, not that integration is impossible or absent in private work.",
    domain: "security-privacy",
    transformations: [
      "Systems are included when security-privacy appears in their registry domains.",
      "Only verified typed relations whose source and target are both in this view can be drawn.",
      "No line is drawn from related navigation lists or shared domain membership.",
    ],
  },
  {
    id: "verification-capability-map",
    title: "Evaluation and verification systems",
    description: "Systems whose registry record includes evaluation and verification, with only implementation relationships whose endpoints both remain in view.",
    claim: (relations) => `${relations.length} verified typed registry relationships connect two systems in this evaluation-and-verification view.`,
    doesNotProve: "The map does not establish evaluation quality, evidence sufficiency, general correctness, runtime compatibility, product ownership, production adoption, or independent review.",
    uncertainty: "Shared domain placement is taxonomy only. Systems without a line can still be independently useful, and lines can lag code changed after the verification date.",
    domain: "evaluation-verification",
    transformations: [
      "Systems are included when evaluation-verification appears in their registry domains.",
      "Only verified typed relations whose source and target are both in this view are drawn.",
      "No line is inferred from shared domain membership, dependencies text, or related navigation lists.",
    ],
  },
];

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const compareByName = (left, right) => left.name.localeCompare(right.name, "en");

function relationshipLabel(relation) {
  const label = relationLabels[relation.relation];
  if (!label) throw new Error(`no presentation label for typed relation ${relation.relation}`);
  return label;
}

function selectSystems(configuration) {
  const systems = configuration.selectSystems
    ? configuration.selectSystems()
    : registry.systems.filter((system) => system.domains.includes(configuration.domain));
  return [...systems].sort(compareByName);
}

function selectRelations(systems) {
  const included = new Set(systems.map((system) => system.id));
  return verifiedRelations
    .filter((relation) => included.has(relation.source) && included.has(relation.target))
    .map((relation) => ({
      ...relation,
      label: relationshipLabel(relation),
      type: relation.relation,
    }))
    .sort((left, right) => {
      const sourceOrder = systemById.get(left.source).name.localeCompare(systemById.get(right.source).name, "en");
      if (sourceOrder) return sourceOrder;
      const relationOrder = left.relation.localeCompare(right.relation, "en");
      if (relationOrder) return relationOrder;
      return systemById.get(left.target).name.localeCompare(systemById.get(right.target).name, "en");
    });
}

function systemNodes(systems) {
  return systems.map((system) => ({
    id: system.id,
    label: system.name,
    status: "verified",
    stateLabel: system.productType,
    group: registry.domains.find((domain) => domain.id === system.primaryDomain)?.label ?? system.primaryDomain,
    nodeType: "system",
  }));
}

function wrapText(value, maxLength = 34, maxLines = 2) {
  const words = String(value).split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const candidate = `${lines.at(-1)} ${word}`.trim();
    if (candidate.length > maxLength && lines.at(-1) && lines.length < maxLines) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  return lines;
}

function renderNode(system, x, y, width, instance) {
  const productLines = wrapText(system.productType, 31, 2);
  const height = 82;
  return `<g data-figure-point="true" data-figure-key="${escapeXml(system.id)}" data-node-instance="${instance}" role="graphics-symbol" aria-label="${escapeXml(system.name)}. ${escapeXml(system.productType)}." tabindex="0">
    <rect class="focus-ring" x="${x - 4}" y="${y - 4}" width="${width + 8}" height="${height + 8}" rx="10" fill="none" stroke="transparent"/>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" fill="#10191e" stroke="#87d7df" stroke-width="2"/>
    <text x="${x + 16}" y="${y + 27}" font-size="17" font-weight="700">${escapeXml(system.name)}</text>
    ${productLines.map((line, index) => `<text x="${x + 16}" y="${y + 51 + index * 18}" class="mono muted" font-size="16">${escapeXml(line)}</text>`).join("\n    ")}
  </g>`;
}

function renderRelationshipSvg(configuration, systems, relations) {
  const width = 1200;
  const leftX = 44;
  const rightX = 824;
  const nodeWidth = 332;
  const rowHeight = 112;
  const firstY = 96;
  const relatedIds = new Set(relations.flatMap((relation) => [relation.source, relation.target]));
  const isolated = systems.filter((system) => !relatedIds.has(system.id));
  const isolatedRows = Math.ceil(isolated.length / 3);
  const relationAreaHeight = relations.length ? relations.length * rowHeight : 0;
  const emptyStateHeight = relations.length ? 0 : 94;
  const isolatedStart = firstY + relationAreaHeight + emptyStateHeight + (isolated.length ? 52 : 0);
  const height = Math.max(420, isolatedStart + isolatedRows * 104 + 72);

  const relationRows = relations.map((relation, index) => {
    const y = firstY + index * rowHeight;
    const source = systemById.get(relation.source);
    const target = systemById.get(relation.target);
    const lineY = y + 41;
    const label = relationshipLabel(relation);
    return `${renderNode(source, leftX, y, nodeWidth, `source-${index}`)}
  <path data-relationship-edge="true" data-edge-type="${escapeXml(relation.relation)}" d="M${leftX + nodeWidth} ${lineY} H${rightX}" fill="none" stroke="#e98455" stroke-width="3" marker-end="url(#${configuration.id}-arrow)">
    <title>${escapeXml(source.name)} ${escapeXml(label)} ${escapeXml(target.name)}</title>
  </path>
  <rect x="${leftX + nodeWidth + 16}" y="${lineY - 20}" width="${rightX - leftX - nodeWidth - 32}" height="40" rx="20" fill="#151d21" stroke="#e98455"/>
  <text x="600" y="${lineY + 6}" text-anchor="middle" class="mono relation-label" font-size="16">${escapeXml(label)}</text>
  ${renderNode(target, rightX, y, nodeWidth, `target-${index}`)}`;
  }).join("\n");

  const emptyState = relations.length ? "" : `<g role="note" aria-label="No typed implementation relationship is asserted among these systems in the current registry.">
    <line x1="44" y1="126" x2="1156" y2="126" stroke="#42545b" stroke-width="2" stroke-dasharray="6 8"/>
    <text x="600" y="116" text-anchor="middle" class="mono muted" font-size="16">No typed implementation relationship asserted in the current registry</text>
  </g>`;

  const isolatedHeading = isolated.length
    ? `<text x="44" y="${isolatedStart - 24}" class="mono muted" font-size="16">SYSTEMS IN SCOPE WITHOUT A TYPED RELATIONSHIP IN THIS VIEW</text>`
    : "";
  const isolatedNodes = isolated.map((system, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    return renderNode(system, 44 + column * 380, isolatedStart + row * 104, 332, `isolated-${index}`);
  }).join("\n");

  const content = [relationRows, emptyState, isolatedHeading, isolatedNodes].filter(Boolean).join("\n  ");
  return `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-labelledby="${configuration.id}-title ${configuration.id}-desc" data-figure-kind="relationship">
  <title id="${configuration.id}-title">${escapeXml(configuration.title)}</title>
  <desc id="${configuration.id}-desc">${escapeXml(configuration.description)} ${escapeXml(configuration.claim)} ${escapeXml(configuration.uncertainty)}</desc>
  <defs><marker id="${configuration.id}-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#e98455"/></marker></defs>
  <style>
    text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#eef6f6}
    .mono{font-family:"Conso","JetBrains Mono",ui-monospace,"SFMono-Regular",monospace}.muted{fill:#bcd0d4}.relation-label{fill:#f4ddd1}
    [data-figure-point]:focus{outline:none}[data-figure-point]:focus-visible .focus-ring{stroke:#f5f2e9;stroke-width:5}
  </style>
  <rect width="${width}" height="${height}" fill="#070c0f"/>
  <text x="44" y="48" class="mono muted" font-size="16">SOURCE SYSTEM</text>
  <text x="600" y="48" text-anchor="middle" class="mono muted" font-size="16">TYPED RELATIONSHIP</text>
  <text x="824" y="48" class="mono muted" font-size="16">TARGET SYSTEM</text>
  ${content}
  <text x="44" y="${height - 26}" class="mono muted" font-size="16">Lines: verified typed registry records only · no line: no relationship asserted by this figure</text>
</svg>`;
}

function evidenceMarkup(relation) {
  return relation.evidenceIds.map((id) => {
    const evidence = evidenceById.get(id);
    if (!evidence) throw new Error(`relation evidence ${id} does not resolve`);
    return `<a href="${escapeXml(evidence.href)}" rel="noopener">${escapeXml(evidence.label)}</a>`;
  }).join("; ");
}

function renderHtml(configuration, systems, relations, svg, retrievedAt) {
  const systemRows = systems.map((system) => `<tr><th scope="row"><a href="../${escapeXml(system.href)}">${escapeXml(system.name)}</a></th><td>${escapeXml(system.productType)}</td><td>${escapeXml(system.releaseState)}</td><td>${escapeXml(system.primaryDomain)}</td></tr>`).join("\n");
  const relationRows = relations.length
    ? relations.map((relation) => `<tr data-relationship-row><th scope="row">${escapeXml(systemById.get(relation.source).name)}</th><td>${escapeXml(relation.label)}</td><td>${escapeXml(systemById.get(relation.target).name)}</td><td>${escapeXml(relation.claimScope)}</td><td>${evidenceMarkup(relation)}</td></tr>`).join("\n")
    : `<tr><td colspan="5">No typed implementation relationship is asserted among the systems in this view.</td></tr>`;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(configuration.title)}</title><link rel="stylesheet" href="../system/figure.css?v=20260902-creative-chassis"></head>
<body class="figure-document"><main><figure class="evidence-figure" data-evidence-figure data-figure-kind="relationship">
  <figcaption class="figure-heading"><h1>${escapeXml(configuration.title)}</h1><p class="figure-description">${escapeXml(configuration.description)}</p><p class="figure-claim figure-finding">${escapeXml(configuration.claim)}</p></figcaption>
  <div class="figure-svg-scroll" tabindex="0" aria-label="Scrollable visualization for ${escapeXml(configuration.title)}">${svg}
</div>
  <section class="figure-records"><h2>Relationship records</h2><div class="figure-table-wrap figure-table-wrap--relationship"><table class="figure-table"><caption>Text equivalent for every relationship drawn in the figure.</caption><thead><tr><th scope="col">Source</th><th scope="col">Relationship</th><th scope="col">Target</th><th scope="col">Claim scope</th><th scope="col">Evidence</th></tr></thead><tbody>${relationRows}</tbody></table></div></section>
  <section class="figure-records"><h2>Systems in scope</h2><div class="figure-table-wrap"><table class="figure-table"><caption>Systems represented in this view, including systems with no typed relationship.</caption><thead><tr><th scope="col">System</th><th scope="col">Product type</th><th scope="col">Release state</th><th scope="col">Primary domain</th></tr></thead><tbody>${systemRows}</tbody></table></div></section>
  <dl class="figure-evidence figure-scope"><dt>Source</dt><dd><a href="https://github.com/HarperZ9/HarperZ9.github.io/blob/main/system/systems.json">Canonical public system registry</a></dd><dt>Checked</dt><dd><time datetime="${escapeXml(retrievedAt)}">${escapeXml(retrievedAt)}</time></dd><dt>Units</dt><dd>registry systems and verified typed relationship records</dd><dt>Transformations</dt><dd><ul>${configuration.transformations.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul></dd><dt>Uncertainty</dt><dd>${escapeXml(configuration.uncertainty)}</dd><dt>What this figure does not prove</dt><dd class="figure-does-not-prove figure-limitations">${escapeXml(configuration.doesNotProve)}</dd></dl>
</figure></main></body></html>`;
}

for (const configuredView of configurations) {
  const systems = selectSystems(configuredView);
  const relations = selectRelations(systems);
  const configuration = {
    ...configuredView,
    claim: typeof configuredView.claim === "function" ? configuredView.claim(relations, systems) : configuredView.claim,
  };
  const nodes = systemNodes(systems);
  const retrievedAt = systems.map((system) => system.lastVerified).sort().at(-1);
  const svg = renderRelationshipSvg(configuration, systems, relations);
  const companion = {
    renderer: "telos-figure/v1",
    viewBox: svg.match(/viewBox="([^"]+)"/)?.[1],
    figure: {
      id: configuration.id,
      kind: "relationship",
      title: configuration.title,
      description: configuration.description,
      claim: configuration.claim,
      doesNotProve: configuration.doesNotProve,
      sources: [{ label: "Canonical public system registry", href: "https://github.com/HarperZ9/HarperZ9.github.io/blob/main/system/systems.json" }],
      retrievedAt,
      units: "registry systems and verified typed relationship records",
      transformations: configuration.transformations,
      uncertainty: configuration.uncertainty,
      data: { type: "relationship", nodes, edges: relations },
    },
  };
  const html = renderHtml(configuration, systems, relations, svg, retrievedAt);
  await Promise.all([
    writeFile(resolve(root, "figures", `${configuration.id}.json`), `${JSON.stringify(companion, null, 2)}\n`, "utf8"),
    writeFile(resolve(root, "figures", `${configuration.id}.svg`), `${svg}\n`, "utf8"),
    writeFile(resolve(root, "figures", `${configuration.id}.html`), `${html}\n`, "utf8"),
  ]);
  console.log(`rendered ${configuration.id}: ${systems.length} systems, ${relations.length} typed relationships`);
}
