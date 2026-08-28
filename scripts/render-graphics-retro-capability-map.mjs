import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateRegistry } from "./system-registry-contract.mjs";


const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registry = validateRegistry(JSON.parse(await readFile(resolve(root, "system", "systems.json"), "utf8")));
const systems = registry.systems.filter((system) => system.primaryDomain === "graphics-media");
const systemById = new Map(systems.map((system) => [system.id, system]));
const orderedIds = [
  "retro-engine",
  "studio-engine",
  "build-color",
  "raw",
  "engine-revival",
  "brender-archival",
  "elder-enb",
  "truth-enb",
  "enb-runtime-core",
  "skyrimbridge",
];

for (const id of orderedIds) {
  if (!systemById.has(id)) throw new Error(`graphics map is missing ${id}`);
}

const relationPresentation = {
  "accepts-evidence-from": { label: "accepts public release evidence from", type: "evidence-import" },
  "optional-native-runtime-dependency": { label: "optional native runtime dependency", type: "optional-integration" },
  "optional-runtime-integration": { label: "optional runtime integration", type: "optional-integration" },
  "build-dependency": { label: "native runtime build dependency", type: "dependency" },
  "optional-native-render-bridge": { label: "optional native CLI bridge", type: "optional-integration" },
};

const edges = registry.relations
  .filter((relation) => systemById.has(relation.source) && systemById.has(relation.target))
  .filter((relation) => relation.status === "verified-in-source")
  .map((relation) => {
    const presentation = relationPresentation[relation.relation];
    if (!presentation) throw new Error(`graphics map has no presentation for ${relation.relation}`);
    return { ...relation, ...presentation };
  });

const nodes = orderedIds.map((id) => {
  const system = systemById.get(id);
  return {
    id,
    label: system.name,
    status: "verified",
    stateLabel: system.productType,
    group: system.family,
    nodeType: "system",
  };
});

const companion = {
  renderer: "telos-figure/v1",
  viewBox: "0 0 960 720",
  figure: {
    id: "graphics-retro-capability-map",
    kind: "relationship",
    title: "Graphics, rendering, retro, and preservation systems",
    description: "Ten independently described systems. Solid and dashed connections appear only where current code, build configuration, or declared data contracts verify a relationship.",
    claim: "The map distinguishes product type from verified dependency, optional integration, and evidence-import relationships.",
    doesNotProve: "The map does not establish live game compatibility, visual quality, production adoption, performance, independent review, or that adjacent systems share a runtime or release state.",
    sources: [
      { label: "Canonical public system registry", href: "https://github.com/HarperZ9/HarperZ9.github.io/blob/main/system/systems.json" },
      { label: "Owning project source and build manifests", href: "https://github.com/HarperZ9" },
    ],
    retrievedAt: "2026-08-28",
    units: "systems and verified implementation relationships",
    transformations: [
      "Only systems whose primary catalog placement is graphics and media are shown.",
      "Product types are copied from the implementation-backed registry.",
      "Relationships without current code, build, or data-contract evidence are omitted.",
    ],
    uncertainty: "Local source can be newer than the latest public release. Release state remains written on each project record rather than inferred from this map.",
    data: { type: "relationship", nodes, edges },
  },
};

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const positions = new Map(orderedIds.map((id, index) => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return [id, { x: column === 0 ? 40 : 500, y: 70 + row * 122 }];
}));

function wrapLabel(value, max = 40) {
  const words = value.split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const candidate = `${lines.at(-1)} ${word}`.trim();
    if (candidate.length > max && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  return lines.slice(0, 2);
}

function edgePath(edge) {
  const from = positions.get(edge.source);
  const to = positions.get(edge.target);
  const x1 = from.x + 210;
  const y1 = from.y + 82;
  const x2 = to.x + 210;
  const y2 = to.y;
  const bend = (y1 + y2) / 2;
  const dash = edge.type === "dependency" ? "none" : edge.type === "evidence-import" ? "12 7" : "5 7";
  return `<path data-relationship-edge="true" data-edge-type="${escapeXml(edge.type)}" d="M${x1} ${y1} C${x1} ${bend} ${x2} ${bend} ${x2} ${y2}" fill="none" stroke="#8ee3f2" stroke-width="3" stroke-dasharray="${dash}" marker-end="url(#arrow)" opacity=".78"><title>${escapeXml(systemById.get(edge.source).name)} to ${escapeXml(systemById.get(edge.target).name)}: ${escapeXml(edge.label)}</title></path>`;
}

function nodeMarkup(node) {
  const { x, y } = positions.get(node.id);
  const lines = wrapLabel(node.stateLabel);
  return `<g data-figure-point="true" data-figure-key="${escapeXml(node.id)}" role="graphics-symbol" aria-label="${escapeXml(node.label)}. ${escapeXml(node.stateLabel)}." tabindex="-1">
    <rect class="focus-ring" x="${x - 3}" y="${y - 3}" width="426" height="96" fill="none" stroke="transparent"/>
    <rect x="${x}" y="${y}" width="420" height="90" rx="8" fill="#111b20" stroke="#8ee3f2" stroke-width="2"/>
    <text x="${x + 18}" y="${y + 29}" font-size="18" font-weight="700">${escapeXml(node.label)}</text>
    ${lines.map((line, index) => `<text x="${x + 18}" y="${y + 56 + index * 20}" class="mono muted" font-size="16">${escapeXml(line)}</text>`).join("\n")}
  </g>`;
}

const svg = `<svg role="img" xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720" aria-labelledby="graphics-retro-capability-map-title graphics-retro-capability-map-desc" data-figure-kind="relationship">
  <title id="graphics-retro-capability-map-title">${escapeXml(companion.figure.title)}</title>
  <desc id="graphics-retro-capability-map-desc">${escapeXml(companion.figure.description)} ${escapeXml(companion.figure.claim)}</desc>
  <defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#8ee3f2"/></marker></defs>
  <style>text{font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#eaf5f6}.mono{font-family:"Conso","JetBrains Mono",ui-monospace,monospace}.muted{fill:#c8dcdf}[data-figure-point]:focus-visible .focus-ring{stroke:#f2efe6;stroke-width:4}</style>
  <rect width="960" height="720" fill="#070b0d"/>
  ${edges.map(edgePath).join("\n")}
  ${nodes.map(nodeMarkup).join("\n")}
  <text x="40" y="694" class="mono muted" font-size="16">Solid: dependency · long dash: evidence import · short dash: optional integration</text>
</svg>`;

const rows = nodes.map((node) => {
  const outgoing = edges.filter((edge) => edge.source === node.id);
  const relations = outgoing.length
    ? outgoing.map((edge) => `${edge.label}: ${systemById.get(edge.target).name}`).join("; ")
    : "No relationship is asserted by this figure.";
  return `<tr><th scope="row">${escapeXml(node.label)}</th><td>${escapeXml(node.stateLabel)}</td><td>${escapeXml(relations)}</td></tr>`;
}).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(companion.figure.title)}</title><link rel="stylesheet" href="../system/figure.css?v=20260828-site-design"></head><body class="figure-document"><main><figure class="evidence-figure" data-evidence-figure data-figure-kind="relationship"><figcaption class="figure-heading"><h1>${escapeXml(companion.figure.title)}</h1><p class="figure-description">${escapeXml(companion.figure.description)}</p><p class="figure-claim figure-finding">${escapeXml(companion.figure.claim)}</p></figcaption><div class="figure-svg-scroll" tabindex="0" aria-label="Scrollable visualization for ${escapeXml(companion.figure.title)}">${svg}\n</div><div class="figure-table-wrap"><table class="figure-table"><caption>Text equivalent for the relationship map.</caption><thead><tr><th scope="col">System</th><th scope="col">Implemented product type</th><th scope="col">Verified outgoing relationship</th></tr></thead><tbody>${rows}</tbody></table></div><section class="figure-scope"><h2>Scope and method</h2><p>${escapeXml(companion.figure.transformations.join(" "))}</p></section><section class="figure-limitations"><h2>What this figure does not prove</h2><p>${escapeXml(companion.figure.doesNotProve)}</p><p>${escapeXml(companion.figure.uncertainty)}</p></section><footer><p>Sources: ${companion.figure.sources.map((source) => `<a href="${escapeXml(source.href)}" rel="noopener">${escapeXml(source.label)}</a>`).join(" · ")} · checked ${escapeXml(companion.figure.retrievedAt)}</p></footer></figure></main></body></html>`;

await Promise.all([
  writeFile(resolve(root, "figures", "graphics-retro-capability-map.json"), `${JSON.stringify(companion, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "figures", "graphics-retro-capability-map.svg"), `${svg}\n`, "utf8"),
  writeFile(resolve(root, "figures", "graphics-retro-capability-map.html"), `${html}\n`, "utf8"),
]);
console.log(`rendered graphics map with ${nodes.length} systems and ${edges.length} verified relationships`);
