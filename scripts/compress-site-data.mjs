#!/usr/bin/env node
// scripts/compress-site-data.mjs
// Extracts and compresses the entire 633-page site into 4 structured JSON archives
// (research-archive, platforms-security, writing-essays, creative-modes) plus a
// legacy-route-map.json for the 6-surface compressed site architecture.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", "node_modules", "tests", ".github"]);
const SKIP_FILES = new Set(["404.html", "img/og/_card.html"]);

const CORE_PAGES = new Set([
  "index.html",
  "studio.html",
  "research.html",
  "platforms.html",
  "writing.html",
  "about.html",
]);

function decodeEntities(s) {
  return s
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/[\u2014\u2013]/g, ", ");
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractMeta(html, rel) {
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = decodeEntities((t ? t[1] : rel).replace(/\s+/g, " ").trim())
    .replace(/\s*\|\s*Zain Dana Harper$/i, "")
    .replace(/\s*·\s*Zain Dana Harper$/i, "")
    .trim() || rel;
  const d = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const description = d ? decodeEntities(d[1].trim()) : "";
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<article[\s\S]*?<\/article>/i);
  const excerpt = stripTags(mainMatch ? mainMatch[0] : html).slice(0, 600);
  const slug = rel.replace(/\.html$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return { slug, path: "/" + rel, title, description, excerpt };
}

function bucketOf(rel, title) {
  const low = (rel + " " + title).toLowerCase();
  if (
    rel.startsWith("world/") ||
    rel.startsWith("tools/") ||
    rel.startsWith("playground/") ||
    rel.startsWith("experiments/") ||
    rel.startsWith("demos/") ||
    rel.startsWith("media/") ||
    ["elements.html", "swatches.html", "type-forge.html", "accession.html", "build-color.html", "truth-enb.html", "brender-archival.html", "skyrimbridge.html", "workshop.html", "floor.html", "studio.html"].includes(rel)
  ) {
    return "creative";
  }
  if (
    rel.startsWith("findings/") ||
    rel.startsWith("studies/") ||
    rel.startsWith("figures/") ||
    rel.startsWith("frontier-safety/") ||
    rel.startsWith("analytics/") ||
    rel.startsWith("briefings/") ||
    rel.startsWith("research")
  ) {
    return "research";
  }
  if (
    rel.startsWith("repo-explainers/") ||
    rel.startsWith("plugins/") ||
    rel.startsWith("systems/") ||
    rel.startsWith("system/") ||
    low.includes("security") ||
    low.includes("flywheel") ||
    low.includes("buildlang") ||
    low.includes("cmmns") ||
    low.includes("articulate") ||
    low.includes("architecture") ||
    low.includes("catalog")
  ) {
    return "platforms";
  }
  if (rel.startsWith("career/") || rel.startsWith("resume") || rel === "cv.html" || rel === "hire.html" || rel === "person.html") {
    return "about";
  }
  return "writing";
}

function targetRoute(bucket, slug) {
  if (bucket === "creative") return `/studio.html#mode=${slug}`;
  if (bucket === "research") return `/research.html#${slug}`;
  if (bucket === "platforms") return `/platforms.html#${slug}`;
  if (bucket === "about") return `/about.html#${slug}`;
  return `/writing.html#${slug}`;
}

const buckets = { creative: [], research: [], platforms: [], writing: [], about: [] };
const routeMap = {};

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
    } else if (ent.isFile() && ent.name.endsWith(".html")) {
      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      if (SKIP_FILES.has(rel)) continue;
      const html = fs.readFileSync(full, "utf8");
      if (/<meta\s+http-equiv=["']refresh["']/i.test(html.slice(0, 2048))) continue;
      const meta = extractMeta(html, rel);
      const bucket = bucketOf(rel, meta.title);
      buckets[bucket].push(meta);
      if (!CORE_PAGES.has(rel)) {
        routeMap["/" + rel] = targetRoute(bucket, meta.slug);
      }
    }
  }
}

walk(ROOT);

const outDir = path.join(ROOT, "data", "compressed");
fs.mkdirSync(outDir, { recursive: true });

for (const [name, items] of Object.entries(buckets)) {
  items.sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(
    path.join(outDir, `${name}.json`),
    JSON.stringify({ schema: "site-compressed/1", bucket: name, count: items.length, items }),
    "utf8"
  );
}
fs.writeFileSync(
  path.join(outDir, "legacy-route-map.json"),
  JSON.stringify({ schema: "site-legacy-routes/1", count: Object.keys(routeMap).length, routes: routeMap }),
  "utf8"
);

console.log("Compressed site data generated:");
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k}: ${v.length}`);
console.log(`  legacy routes mapped: ${Object.keys(routeMap).length}`);
