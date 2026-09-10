import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "system", "routes.js");
const homeOutputPath = resolve(root, "home", "src", "site-routes.ts");
const current = await readFile(outputPath, "utf8");
const systemRegistry = JSON.parse(await readFile(resolve(root, "system", "systems.json"), "utf8"));
const ROUTE_CACHE_STAMP = "20260909-pillar-navigation";
const encoded = current.match(/ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");/)?.[1];
if (!encoded) throw new Error("system/routes.js does not contain a readable route registry");

const registry = JSON.parse(JSON.parse(encoded));
for (const family of registry.families) {
  for (const route of family.routes) {
    delete route.searchText;
    delete route.maturity;
  }
}
const systems = registry.families.find((family) => family.label === "Systems");
const overview = systems?.routes.find((route) => route.href === "overview.html");
if (!overview) throw new Error("overview route is missing");
overview.label = "Systems";

const studio = registry.families.find((family) => family.label === "Studio");
const elder = studio?.routes.find((route) => route.href === "elder-enb.html");
const truth = studio?.routes.find((route) => route.href === "truth-enb.html");
if (!elder || !truth) throw new Error("ENB studio routes are missing");
const summaryOverrideHrefs = new Set();
elder.summary = "Active Skyrim SE/AE ENB shader-suite work; branch state and live-host acceptance remain separate from public release state.";
truth.summary = "Skyrim SE/AE ENBSeries 0.504 shader suite with procedural sky, clouds, aurora, exposure, tone mapping, and an optional camera bridge.";
summaryOverrideHrefs.add(elder.href);
summaryOverrideHrefs.add(truth.href);

const security = registry.families.find((family) => family.label === "Security");
if (!security) throw new Error("security route family is missing");
const privateRoutes = [
  ["Array", "array.html"],
  ["Seed", "seed.html"],
  ["Sofer", "sofer.html"],
  ["Isomorph", "isomorph.html"],
  ["Bounds", "bounds.html"],
  ["Kun", "kun.html"],
];
security.routes = security.routes.filter((route) => route.href !== "aeterna.html");
const insertion = security.routes.findIndex((route) => route.href === "catalog.html");
for (const [label, href] of [...privateRoutes].reverse()) {
  if (!security.routes.some((route) => route.href === href)) {
    security.routes.splice(insertion >= 0 ? insertion : security.routes.length, 0, { label, href });
  }
}

studio.routes = studio.routes.filter((route) => route.href !== "aeterna.html");

const research = registry.families.find((family) => family.label === "Research");
if (!research) throw new Error("research route family is missing");
const incidentBrief = {
  label: "OpenAI / Hugging Face incident",
  href: "frontier-safety-openai-hugging-face-incident.html",
  summary: "August 26 incident-source comparison with public-safe control-plane visualization.",
};
if (!research.routes.some((route) => route.href === incidentBrief.href)) {
  const frontierIndex = research.routes.findIndex((route) => route.href === "frontier-safety.html");
  research.routes.splice(frontierIndex >= 0 ? frontierIndex : research.routes.length, 0, incidentBrief);
}

const liveBoard = {
  label: "Bulletin",
  href: "bulletin.html",
  summary: "The live public board where AI agents post, reply, and coordinate, read as it happens.",
};
if (!systems.routes.some((route) => route.href === liveBoard.href)) {
  const boardIndex = systems.routes.findIndex((route) => route.href === "index-graph.html");
  systems.routes.splice(boardIndex >= 0 ? boardIndex : systems.routes.length, 0, liveBoard);
}

const joinBoard = {
  label: "Join the board",
  href: "join.html",
  summary: "How an agent on any machine registers a key and posts, in one command or six steps.",
};
if (!systems.routes.some((route) => route.href === joinBoard.href)) {
  const afterBoard = systems.routes.findIndex((route) => route.href === liveBoard.href);
  systems.routes.splice(afterBoard >= 0 ? afterBoard + 1 : systems.routes.length, 0, joinBoard);
}

const canon = {
  label: "Canon",
  href: "canon.html",
  summary: "Provider-neutral continuity capsules for selected context preview, export, and instruction-surface checks.",
};
if (!systems.routes.some((route) => route.href === canon.href)) {
  const afterIndex = systems.routes.findIndex((route) => route.href === "index-graph.html");
  systems.routes.splice(afterIndex >= 0 ? afterIndex + 1 : systems.routes.length, 0, canon);
}

function moveRoute(href, targetFamily, afterHref) {
  let route = null;
  for (const family of registry.families) {
    const index = family.routes.findIndex((item) => item.href === href);
    if (index < 0) continue;
    if (route) throw new Error(`${href} appears in more than one route family`);
    [route] = family.routes.splice(index, 1);
  }
  if (!route) throw new Error(`${href} route is missing`);
  const insertion = targetFamily.routes.findIndex((item) => item.href === afterHref);
  targetFamily.routes.splice(insertion >= 0 ? insertion + 1 : targetFamily.routes.length, 0, route);
  return route;
}

const catalog = moveRoute("catalog.html", systems, "overview.html");
catalog.breadcrumbLabel = "Systems";

const rawSystem = systemRegistry.systems.find((system) => system.id === "raw");
const rawDomain = systemRegistry.domains.find((domain) => domain.id === rawSystem?.primaryDomain);
if (!rawDomain) throw new Error("RAW primary domain is missing from the system registry");
const raw = moveRoute("raw.html", studio, "skyrimbridge.html");
raw.breadcrumbLabel = rawDomain.label;

function takeRoute(href) {
  let route = null;
  for (const family of registry.families) {
    const index = family.routes.findIndex((item) => item.href === href);
    if (index < 0) continue;
    if (route) throw new Error(`${href} appears in more than one route family`);
    [route] = family.routes.splice(index, 1);
  }
  if (!route) throw new Error(`${href} route is missing`);
  return route;
}

const systemByHref = new Map(systemRegistry.systems.map((system) => [system.href, system]));
const domainById = new Map(systemRegistry.domains.map((domain) => [domain.id, domain]));

function cleanText(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function localFileForHref(href) {
  let route = String(href || "").split("#")[0].split("?")[0].replace(/^\//, "");
  if (!route) route = "index.html";
  if (route.endsWith("/")) route += "index.html";
  return route;
}

function hrefExists(href) {
  return existsSync(resolve(root, localFileForHref(href)));
}

function normalizePublicHref(href) {
  if (!href) return "";
  const value = String(href).trim();
  if (!value || value.startsWith("#") || value.startsWith("mailto:")) return "";
  let local = value;
  if (/^https?:\/\//.test(local)) {
    const url = new URL(local);
    if (url.hostname !== "harperz9.github.io") return "";
    local = url.pathname.replace(/^\//, "") + url.search + url.hash;
  }
  local = local.replace(/^\//, "");
  if (local === "briefings/") return "briefings/index.html";
  return local;
}

function isIndexedPublicHref(href) {
  if (!href) return false;
  if (["index.html", "site-index.html", "orca.html"].includes(href)) return false;
  if (href.startsWith("frontier-safety/archive/")) return false;
  if (href.startsWith("private-practice.html#")) return false;
  return hrefExists(href);
}

function readPublicHtml(href) {
  const file = resolve(root, localFileForHref(href));
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

function firstMatch(source, pattern) {
  return cleanText(source.match(pattern)?.[1] || "");
}

function fallbackLabel(href) {
  const leaf = localFileForHref(href).split("/").pop().replace(/\.html$/, "") || "page";
  return leaf.split(/[-_]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function pageMetadata(href) {
  const source = readPublicHtml(href);
  if (!source) return { label: fallbackLabel(href), href };
  const h1 = firstMatch(source, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = firstMatch(source, /<title\b[^>]*>([\s\S]*?)<\/title>/i)
    .replace(/\s+(?:·|\|)\s+(?:Zain Dana Harper|Zentropy Labs).*$/i, "");
  const summary = firstMatch(source, /<meta\s+name="description"\s+content="([^"]*)"/i)
    || firstMatch(source, /<p\b[^>]*class="[^"]*(?:lede|lead|dek|body-text)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const structuredText = [...source.matchAll(/<(h[1-3]|dt|caption)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => cleanText(match[2]))
    .join(" ");
  return {
    label: h1 || title || fallbackLabel(href),
    href,
    summary,
    searchText: [structuredText, summary, h1, title].filter(Boolean).join(" "),
  };
}

function addSourceMetadata(map, href, metadata) {
  const normalizedHref = normalizePublicHref(href);
  if (!normalizedHref) return;
  const existing = map.get(normalizedHref) || { href: normalizedHref };
  const searchText = cleanText([
    existing.searchText,
    metadata.searchText,
    metadata.label,
    metadata.maturity,
    metadata.summary,
  ].filter(Boolean).join(" "));
  map.set(normalizedHref, {
    href: normalizedHref,
    label: existing.label || cleanText(metadata.label),
    maturity: existing.maturity || cleanText(metadata.maturity),
    summary: existing.summary || cleanText(metadata.summary),
    searchText,
  });
}

function authoredSourceMetadata() {
  const map = new Map();

  const research = readPublicHtml("research.html");
  const entryPattern = /<div class="entry">\s*<div class="entry-head">([\s\S]*?)<\/div>\s*<ul\b[^>]*>\s*<li>([\s\S]*?)<\/li>\s*<\/ul>\s*<\/div>/g;
  for (const match of research.matchAll(entryPattern)) {
    const head = match[1];
    const link = head.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    addSourceMetadata(map, link[1], {
      label: link[2],
      maturity: head.match(/<span class="entry-meta">([\s\S]*?)<\/span>/i)?.[1],
      summary: match[2],
    });
  }

  for (const sourceFile of ["publications.html", "writing.html"]) {
    const source = readPublicHtml(sourceFile);
    for (const match of source.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)) {
      const block = match[1];
      const link = block.match(/<h[23]\b[^>]*>\s*<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/i);
      if (!link) continue;
      const afterHeading = block.slice(block.indexOf(link[0]) + link[0].length);
      addSourceMetadata(map, link[1], {
        label: link[2],
        maturity: block.match(/<p\b[^>]*class="[^"]*(?:publication-meta|role|path-state)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1],
        summary: afterHeading.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1],
      });
    }
  }

  return map;
}

function publicInventoryHrefs() {
  const sitemap = readFileSync(resolve(root, "sitemap.xml"), "utf8");
  return [...sitemap.matchAll(/<loc>https:\/\/harperz9\.github\.io\/([^<]*)<\/loc>/g)]
    .map((match) => normalizePublicHref(match[1] || "index.html"))
    .filter(isIndexedPublicHref);
}

function findRouteByHref(href) {
  for (const family of registry.families) {
    const route = family.routes.find((item) => item.href === href);
    if (route) return { family, route };
  }
  return null;
}

function familyByLabel(label) {
  const family = registry.families.find((item) => item.label === label);
  if (!family) throw new Error(`${label} route family is missing`);
  return family;
}

function appendSearchText(route, value) {
  const incoming = cleanText(value);
  if (!incoming) return;
  const currentText = cleanText(route.searchText);
  if (!currentText) {
    route.searchText = incoming;
  } else if (!currentText.includes(incoming)) {
    route.searchText = `${currentText} ${incoming}`;
  }
}

function mergeRouteMetadata(route, metadata) {
  const summary = cleanText(metadata.summary);
  if (summary && (!route.summary || !summaryOverrideHrefs.has(route.href))) route.summary = summary;
  if (!route.maturity && metadata.maturity) route.maturity = cleanText(metadata.maturity);
  if (!route.breadcrumbLabel && metadata.breadcrumbLabel) route.breadcrumbLabel = cleanText(metadata.breadcrumbLabel);
  appendSearchText(route, [metadata.searchText, metadata.maturity, metadata.summary].filter(Boolean).join(" "));
  return route;
}

function upsertRoute(familyLabel, metadata, afterHref = null) {
  const existing = findRouteByHref(metadata.href);
  if (existing) return mergeRouteMetadata(existing.route, metadata);
  const family = familyByLabel(familyLabel);
  const route = {
    label: cleanText(metadata.label) || fallbackLabel(metadata.href),
    href: metadata.href,
  };
  mergeRouteMetadata(route, metadata);
  const insertion = afterHref ? family.routes.findIndex((item) => item.href === afterHref) : -1;
  family.routes.splice(insertion >= 0 ? insertion + 1 : family.routes.length, 0, route);
  return route;
}

function systemMetadata(system) {
  const domainLabels = (system.domains || [])
    .map((domainId) => domainById.get(domainId)?.label)
    .filter(Boolean);
  return {
    label: system.name,
    href: system.href,
    maturity: system.maturity,
    summary: system.purpose,
    searchText: [
      system.name,
      system.purpose,
      ...(system.useCases || []),
      system.productType,
      system.releaseState,
      system.maturity,
      ...domainLabels,
    ].filter(Boolean).join(" "),
  };
}

function familyForSystem(system) {
  if (system.primaryDomain === "security-privacy") return "Security";
  if (system.primaryDomain === "graphics-media") return "Studio";
  if (system.primaryDomain === "research-education") return "Research";
  return "Systems";
}

function familyForHref(href, metadata) {
  const existing = findRouteByHref(href);
  if (existing) return existing.family.label;
  const system = systemByHref.get(href);
  if (system) return familyForSystem(system);
  if (href.startsWith("analytics/")) return "Research";
  if (href.startsWith("research-")) return "Research";
  if (href.startsWith("briefings/")) return "Research";
  if (href.startsWith("frontier-safety")) return "Research";
  if (href.startsWith("systems/")) return "Systems";
  if (href.startsWith("demos/")) return "Systems";
  if (href.startsWith("security-") || href.includes("proof") || href.includes("receipt")) return "Security";
  if (/^(growth-needs-a-before|what-the-label-changes|the-second-hearing|availability-is-not-reach|no-receipt-no-accept|pick-the-lock-for-everyone|pick-the-lock-for-everyone-talk|models-propose-oracles-dispose)\.html$/.test(href)) return "Research";
  if (/^(current-story|gaussian-splats|loom|retro|engine-revival|brender-archival|elder-enb|truth-enb|enb-runtime-core|skyrimbridge|raw)\.html$/.test(href)) return "Studio";
  if (/^(cv|resume|portfolio|cover-letter|person|test-run-request|hire)\.html/.test(href)) return "Work";
  if (/^(fonts|typeface)\.html$/.test(href)) return "Fonts";
  return metadata?.family || "Systems";
}

function reconcilePublicRoutes() {
  systems.prefixes = [...new Set([...(systems.prefixes || []), "systems/", "demos/"])];
  research.prefixes = [...new Set([...(research.prefixes || []), "research-", "briefings/", "frontier-safety/", "analytics/"])];

  const sourceMetadata = authoredSourceMetadata();
  for (const system of systemRegistry.systems) {
    const href = normalizePublicHref(system.href);
    if (!isIndexedPublicHref(href)) continue;
    upsertRoute(familyForSystem(system), systemMetadata(system));
  }

  for (const href of publicInventoryHrefs()) {
    const system = systemByHref.get(href);
    const metadata = sourceMetadata.get(href) || (system ? systemMetadata(system) : null) || pageMetadata(href);
    upsertRoute(familyForHref(href, metadata), { ...metadata, href });
  }
}

const typeface = takeRoute("typeface.html");
registry.families = registry.families.filter((family) => family.label !== "Fonts");
registry.families.push({
  label: "Fonts",
  routes: [
    { label: "Fonts", href: "fonts.html" },
    { ...typeface, label: "Typography specimen", href: "typeface.html" },
  ],
});

const pillarOrder = ["flywheel.html", "research.html", "studio.html", "fonts.html", "hire.html"];
for (const family of registry.families) {
  for (const route of family.routes) {
    route.primary = pillarOrder.includes(route.href);
    if (route.href === "hire.html") route.label = "Work";
  }
}
if (!systems.routes.some((route) => route.href === "site-index.html")) {
  systems.routes.push({ label: "Site index", href: "site-index.html", summary: "Find every sector, product, workflow and publication route." });
}
if (!research.routes.some((route) => route.href === "a-witness-should-not-become-a-ruler.html")) {
  research.routes.push({ label: "A witness should not become a ruler", href: "a-witness-should-not-become-a-ruler.html", summary: "AI-prepared editorial working draft; personal author review pending." });
}
reconcilePublicRoutes();
const serialized = JSON.stringify(JSON.stringify(registry, null, 2));
const output = `// Generated by scripts/render-route-registry.mjs. Edit the renderer, then rerun it.
export const ROUTE_CACHE_STAMP = ${JSON.stringify(ROUTE_CACHE_STAMP)};
export const ROUTE_REGISTRY_JSON = ${serialized};
export const ROUTE_REGISTRY = JSON.parse(ROUTE_REGISTRY_JSON);
const PILLAR_ORDER = ${JSON.stringify(pillarOrder)};
export const PRIMARY_ROUTES = ROUTE_REGISTRY.families.flatMap((family) => family.routes
  .filter((route) => route.primary)
  .map((route) => ({ ...route, family: family.label, primary: true })))
  .sort((a, b) => PILLAR_ORDER.indexOf(a.href) - PILLAR_ORDER.indexOf(b.href));
export const SECONDARY_GROUPS = ROUTE_REGISTRY.families.map((family) => ({
  label: family.label,
  routes: family.routes.filter((route) => !route.primary).map((route) => ({ ...route, family: family.label, primary: false })),
})).filter((group) => group.routes.length);
export const EXTERNAL_ACTIONS = ROUTE_REGISTRY.externalActions;

function normaliseRoute(pathname) {
  try {
    const url = new URL(pathname || "index.html", "https://harperz9.github.io/");
    let path = url.pathname.replace(/^\\//, "");
    if (!path) path = "index.html";
    else if (path.endsWith("/")) path += "index.html";
    else if (!(path.split("/").pop() || "").includes(".")) path += ".html";
    return path + url.search + url.hash;
  }
  catch { return ""; }
}
export function routeFamily(pathname) {
  const route = normaliseRoute(pathname);
  const routePath = route.split("#")[0].split("?")[0];
  for (const family of ROUTE_REGISTRY.families) {
    if (family.routes.some((item) => {
      const itemRoute = normaliseRoute(item.href);
      if (itemRoute === route || itemRoute.split("#")[0].split("?")[0] === routePath) return true;
      return (item.aliases || []).some((alias) => {
        const aliasRoute = normaliseRoute(alias);
        return aliasRoute === route || aliasRoute.split("#")[0].split("?")[0] === routePath;
      });
    })) return family.label;
  }
  for (const family of ROUTE_REGISTRY.families) {
    const stem = routePath.replace(/\\.html$/, "");
    if ((family.prefixes || []).some((prefix) => stem.startsWith(prefix))) return family.label;
  }
  return "";
}
`;

await writeFile(outputPath, output, "utf8");
console.log(`rendered ${outputPath}`);

const homeOutput = `// Mirrors system/routes.js. Generated by scripts/render-route-registry.mjs.
export const ROUTE_CACHE_STAMP = ${JSON.stringify(ROUTE_CACHE_STAMP)};
export const ROUTE_REGISTRY_JSON = ${serialized};
export const ROUTE_REGISTRY = JSON.parse(ROUTE_REGISTRY_JSON) as RouteRegistry;
const PILLAR_ORDER = ${JSON.stringify(pillarOrder)};
export const PRIMARY_ROUTES = ROUTE_REGISTRY.families.flatMap((family) => family.routes
  .filter((route) => route.primary)
  .map((route) => ({ ...route, family: family.label, primary: true })))
  .sort((a, b) => PILLAR_ORDER.indexOf(a.href) - PILLAR_ORDER.indexOf(b.href));
export const SECONDARY_GROUPS = ROUTE_REGISTRY.families.map((family) => ({
  label: family.label,
  routes: family.routes.filter((route) => !route.primary).map((route) => ({ ...route, family: family.label, primary: false })),
})).filter((group) => group.routes.length);
export const EXTERNAL_ACTIONS = ROUTE_REGISTRY.externalActions;

export type RouteFamily = string;
export type Route = { label: string; href: string; aliases?: string[]; family: RouteFamily; primary: boolean; summary?: string; searchText?: string; maturity?: string; breadcrumbLabel?: string };
type RegistryRoute = { label: string; href: string; aliases?: string[]; primary?: boolean; summary?: string; searchText?: string; maturity?: string; breadcrumbLabel?: string };
type RegistryFamily = { label: RouteFamily; prefixes?: string[]; routes: RegistryRoute[] };
type RouteRegistry = { families: RegistryFamily[]; externalActions: Array<{ label: string; href: string; external: true }> };
function normaliseRoute(pathname: string) {
  try {
    const url = new URL(pathname || "index.html", "https://harperz9.github.io/");
    let path = url.pathname.replace(/^\\//, "");
    if (!path) path = "index.html";
    else if (path.endsWith("/")) path += "index.html";
    else if (!(path.split("/").pop() || "").includes(".")) path += ".html";
    return path + url.search + url.hash;
  }
  catch { return ""; }
}
export function routeFamily(pathname: string): RouteFamily | "" {
  const route = normaliseRoute(pathname);
  const routePath = route.split("#")[0].split("?")[0];
  for (const family of ROUTE_REGISTRY.families) {
    if (family.routes.some((item) => {
      const itemRoute = normaliseRoute(item.href);
      if (itemRoute === route || itemRoute.split("#")[0].split("?")[0] === routePath) return true;
      return (item.aliases || []).some((alias) => {
        const aliasRoute = normaliseRoute(alias);
        return aliasRoute === route || aliasRoute.split("#")[0].split("?")[0] === routePath;
      });
    })) return family.label;
  }
  for (const family of ROUTE_REGISTRY.families) {
    const stem = routePath.replace(/\\.html$/, "");
    if ((family.prefixes || []).some((prefix) => stem.startsWith(prefix))) return family.label;
  }
  return "";
}
`;

await writeFile(homeOutputPath, homeOutput, "utf8");
console.log(`rendered ${homeOutputPath}`);
await import('./render-site-index.mjs');
