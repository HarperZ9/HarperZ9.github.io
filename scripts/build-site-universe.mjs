#!/usr/bin/env node
// scripts/build-site-universe.mjs
// Scans EVERY HTML page across the entire site and generates data/site-universe-manifest.json
// so studio.html's One-Viewport Shell can open any domain, tool, study, exhibit, finding,
// swatch, map, world, experiment, research paper, or repo explainer inside ONE single viewport.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", "node_modules", "tests", ".github"]);
const SKIP_FILES = new Set(["404.html", "img/og/_card.html"]);

const LIVE_WASM_MAP = {
  "studio.html": { domain: "engine", source: "atelier" },
  "floor.html": { domain: "tools", source: "superframe" },
  "elements.html": { domain: "tools", source: "elements" },
  "swatches.html": { domain: "tools", source: "atelier" },
  "type-forge.html": { domain: "type", source: "type" },
  "accession.html": { domain: "type", source: "type" },
  "build-color.html": { domain: "light-glass", source: "elements" },
  "truth-enb.html": { domain: "engine", source: "raw" },
  "brender-archival.html": { domain: "engine", source: "brender" },
  "skyrimbridge.html": { domain: "engine", source: "raw" },
  "buildlang.html": { domain: "engine", source: "superframe" },
  "flywheel.html": { domain: "tools", source: "superframe" },
  "cmmns.html": { domain: "tools", source: "superframe" },
  "articulate.html": { domain: "tools", source: "superframe" },
  "workshop.html": { domain: "tools", source: "superframe" },
  "tools.html": { domain: "tools", source: "superframe" },
  "experiments/index.html": { domain: "data", source: "discovery" },
};

function classify(rel, title) {
  const low = (rel + " " + title).toLowerCase();
  if (rel.startsWith("world/exhibit/") || low.includes("exhibit") || low.includes("gallery")) return "Exhibit";
  if (low.includes("film") || low.includes("motion") || low.includes("video") || low.includes("explainer")) return "Motion & Film";
  if (low.includes("sound") || low.includes("audio") || low.includes("music") || low.includes("daw") || low.includes("chladni")) return "Sound";
  if (low.includes("ink") || low.includes("water") || low.includes("fluid") || low.includes("wash") || low.includes("estuary")) return "Ink & Water";
  if (low.includes("mosaic") || low.includes("tile") || low.includes("loom") || low.includes("weave") || low.includes("plot")) return "Mosaic";
  if (low.includes("type") || low.includes("letter") || low.includes("accession") || low.includes("font") || low.includes("glyph")) return "Type & Lettering";
  if (low.includes("light") || low.includes("glass") || low.includes("optic") || low.includes("prism") || low.includes("color") || low.includes("swatch")) return "Light & Glass";
  if (rel.startsWith("playground/") || low.includes("engine") || low.includes("raw") || low.includes("superframe") || low.includes("buildlang") || low.includes("shader") || low.includes("brender") || low.includes("fractal") || low.includes("voxel")) return "Engine";
  if (rel.startsWith("analytics/") || rel.startsWith("figures/") || rel.startsWith("findings/") || low.includes("visual") || low.includes("map") || low.includes("universe") || low.includes("data") || low.includes("benchmark")) return "Data & Visualizer";
  if (rel.startsWith("tools/") || rel.startsWith("plugins/") || rel.startsWith("demos/") || rel.startsWith("experiments/") || low.includes("tool") || low.includes("workshop") || low.includes("element")) return "Tools";
  if (rel.startsWith("studies/") || rel.startsWith("research") || rel.startsWith("frontier-safety/") || rel.startsWith("briefings/") || low.includes("research") || low.includes("study")) return "Studies & Research";
  if (rel.startsWith("repo-explainers/") || rel.startsWith("systems/") || low.includes("security") || low.includes("flywheel") || low.includes("cmmns") || low.includes("architecture")) return "Platforms & Security";
  if (rel.startsWith("world/")) return "Exhibit";
  if (rel.startsWith("career/") || low.includes("resume") || low.includes("cv")) return "About & Career";
  return "Essays & Writing";
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full, out);
    } else if (ent.isFile() && ent.name.endsWith(".html")) {
      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      if (SKIP_FILES.has(rel)) continue;
      const head = fs.readFileSync(full, "utf8").slice(0, 4096);
      if (/<meta\s+http-equiv=["']refresh["']/i.test(head)) continue;
      const m = head.match(/<title>([\s\S]*?)<\/title>/i);
      const rawTitle = m ? m[1].replace(/\s+/g, " ").trim() : rel;
      const title = rawTitle
        .replace(/&middot;/g, "·")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s*\|\s*Zain Dana Harper$/i, "")
        .replace(/\s*·\s*Zain Dana Harper$/i, "")
        .trim() || rel;
      const category = classify(rel, title);
      const wasm = LIVE_WASM_MAP[rel] || null;
      out.push({
        p: "/" + rel,
        t: title,
        c: category,
        ...(wasm ? { s: wasm.source } : {}),
      });
    }
  }
}

const items = [];
walk(ROOT, items);
items.sort((a, b) => a.c.localeCompare(b.c) || a.t.localeCompare(b.t) || a.p.localeCompare(b.p));

const counts = {};
for (const it of items) counts[it.c] = (counts[it.c] || 0) + 1;

const manifest = {
  schema: "site-universe-manifest/1",
  total: items.length,
  categories: Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count })),
  items,
};

const outPath = path.join(ROOT, "data", "site-universe-manifest.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(manifest), "utf8");
console.log(`site-universe-manifest.json: ${manifest.total} pages across ${manifest.categories.length} unified categories`);
for (const c of manifest.categories) console.log(`  ${c.name}: ${c.count}`);
