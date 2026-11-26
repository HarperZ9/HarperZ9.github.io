#!/usr/bin/env node
// build-search-index.mjs: deterministically compiles system/search-index.json for the global Ctrl+K Quick-Jump
// search and 5-pillar wayfinding overlay. Zero em dashes, zero local paths, zero retired names.
//
//   node scripts/build-search-index.mjs          write system/search-index.json
//   node scripts/build-search-index.mjs --check  verify system/search-index.json matches generator output
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_REGISTRY } from "../system/routes.js";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHECK = process.argv.includes("--check");
const readJson = (rel) => JSON.parse(readFileSync(path.join(site, rel), "utf8"));

export const PILLARS = [
  {
    id: "start",
    label: "Start",
    href: "/",
    summary: "Front door, five-platform architecture map, everything floor, and full site index.",
  },
  {
    id: "platforms",
    label: "Platforms & Tools",
    href: "/architecture.html",
    summary: "The Playground, BuildLang, The Flywheel, Articulate, The Commons, and 45 documented tools.",
  },
  {
    id: "demos",
    label: "Interactive Demos",
    href: "/playground/",
    summary: "Live WebGPU studios, Estuary Lantern, Low Water, Flywheel receipts, Night School, and fonts.",
  },
  {
    id: "research",
    label: "Research & Writing",
    href: "/research.html",
    summary: "16 papers and Zenodo DOIs, Who Knew First, 14 frontier lanes, DS-01 to DS-07 datasets, and findings.",
  },
  {
    id: "work",
    label: "Work With Me / CV",
    href: "/hire.html",
    summary: "41 merged upstream PRs, full CV, role resumes, Flywheel verification pilot, and independence policy.",
  },
];

function cleanText(raw, maxLen = 160) {
  let s = String(raw || "")
    .replace(/\u2014/g, ", ")
    .replace(/\u2013/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > maxLen) {
    const cut = s.slice(0, maxLen - 1);
    const space = cut.lastIndexOf(" ");
    s = (space > 60 ? cut.slice(0, space) : cut).replace(/[,;:\-]+$/, "").trim() + "...";
  }
  return s;
}

function normHref(href) {
  if (!href) return "/";
  if (/^https?:\/\//i.test(href)) return href;
  let h = String(href).trim();
  if (!h.startsWith("/")) h = "/" + h;
  if (h === "/index.html") return "/";
  return h;
}

function classifyRoute(familyLabel, href) {
  const h = normHref(href).toLowerCase();
  if (
    h === "/" ||
    h === "/architecture.html" ||
    h === "/floor.html" ||
    h === "/site-index.html" ||
    h === "/overview.html" ||
    h === "/catalog.html" ||
    h === "/guide.html" ||
    h === "/workshop.html" ||
    h === "/credits.html" ||
    h === "/world/universe/proto/index.html"
  ) {
    return "start";
  }
  if (
    familyLabel === "Work" ||
    /^\/(hire|portfolio|cv|resume|cover-letter|dossier|person|independence|income-ledger|flywheel-pilot|test-run-request|published-work)/.test(h)
  ) {
    return "work";
  }
  if (
    familyLabel === "Studio" ||
    familyLabel === "Fonts" ||
    /^\/(playground|estuary|low-water|glass-water|studio|fonts|gallery|demo-|demos\/|studies\/|elements|swatches|accession|explainers|world\/)/.test(h)
  ) {
    return "demos";
  }
  if (
    familyLabel === "Research" ||
    familyLabel === "Writing" ||
    familyLabel === "Who Knew First" ||
    /^\/(research|publications|who-knew-first|findings|experiments|briefings|frontier-safety|papers\/)/.test(h)
  ) {
    return "research";
  }
  return "platforms";
}

function titleFromFindingPath(relPath, id) {
  const base = path.basename(relPath, ".html");
  const slug = base.replace(/^F\d+-/i, "").replace(/-/g, " ").trim();
  const pretty = slug ? slug[0].toUpperCase() + slug.slice(1) : base;
  return id ? `${id}: ${pretty}` : pretty;
}

// Curated starting doors shown first when Quick-Jump opens with an empty query.
const FEATURED = [
  {
    title: "Home (Front Door)",
    href: "/",
    pillar: "start",
    kind: "Hub",
    summary: "The unified entrance to BuildLang, Flywheel, The Playground, Low Water, and the living site.",
    keywords: "home start entrance landmarks front door",
    featured: 1,
  },
  {
    title: "Five-Platform Architecture & Live Benchmarks",
    href: "/architecture.html",
    pillar: "start",
    kind: "Architecture",
    summary: "Interactive map of all 5 platforms, 7 open datasets (DS-01 to DS-07), 14 frontier lanes, and live verified metrics.",
    keywords: "architecture map platforms datasets benchmarks frontier lineage body of work",
    featured: 1,
  },
  {
    title: "Site Index (All Sectors)",
    href: "/site-index.html",
    pillar: "start",
    kind: "Directory",
    summary: "Complete searchable directory of every product, workflow, study, essay, and career page.",
    keywords: "site index directory map all pages sectors",
    featured: 1,
  },
  {
    title: "Everything Floor",
    href: "/floor.html",
    pillar: "start",
    kind: "Inventory",
    summary: "Every project, release, and experiment with its current status and evidence link.",
    keywords: "everything floor inventory status projects",
    featured: 1,
  },
  {
    title: "The Playground (Superframe + RAW DX12)",
    href: "/playground/",
    pillar: "platforms",
    kind: "Platform",
    summary: "Deterministic rendering engine, native DX12/Vulkan/WebGPU renderer, 286 science formulas, and Low Water.",
    keywords: "playground superframe raw dx12 vulkan webgpu renderer engine graphics",
    featured: 1,
  },
  {
    title: "BuildLang & BDB Embedded SQL",
    href: "/buildlang.html",
    pillar: "platforms",
    kind: "Platform",
    summary: "Effect-typed systems language (buildc 1.15.0) emitting deterministic C/HLSL/GLSL plus pure-BuildLang BDB SQL.",
    keywords: "buildlang buildc bdb sql compiler effect rows kcore riscv",
    featured: 1,
  },
  {
    title: "The Flywheel & Articulate (ARTIQL8)",
    href: "/flywheel.html",
    pillar: "platforms",
    kind: "Platform",
    summary: "Self-hosted AI workstation with signed offline receipts, Three-Plate Oracle, 30 consolidated tools, and Articulate.",
    keywords: "flywheel articulate artiql8 receipts verification three-plate oracle emet harness",
    featured: 1,
  },
  {
    title: "The Commons (CMMNS)",
    href: "/cmmns.html",
    pillar: "platforms",
    kind: "Platform",
    summary: "Local-first browser extension showing source provenance, coordination cues, and fact-checks in place.",
    keywords: "commons cmmns extension provenance fact-check daylight archive",
    featured: 1,
  },
  {
    title: "Estuary Lantern (Interactive WebGPU Field)",
    href: "/playground/#estuary",
    pillar: "demos",
    kind: "Interactive",
    summary: "Live physical light, colour metamer, and water simulation running in the browser with still fallback.",
    keywords: "estuary lantern demo interactive webgpu colour light water",
    featured: 1,
  },
  {
    title: "Low Water (Five-Era Narrative Game)",
    href: "/playground/#low-water",
    pillar: "demos",
    kind: "Game",
    summary: "Five-era narrative game built on The Playground as a full-scale world and lighting proof.",
    keywords: "low water game demo narrative world lighting",
    featured: 1,
  },
  {
    title: "Research Hub",
    href: "/research.html",
    pillar: "research",
    kind: "Hub",
    summary: "Preregistered investigations, AI safety research, empirical studies, findings, and collaboration routes.",
    keywords: "research hub studies findings ai safety preregistered",
    featured: 1,
  },
  {
    title: "Writing, Essays & 16 Papers (DOIs)",
    href: "/publications.html",
    pillar: "research",
    kind: "Hub",
    summary: "Every essay, Who Knew First investigation, briefing, and Zenodo DOI preprint in five sections.",
    keywords: "publications writing essays papers doi zenodo briefings",
    featured: 1,
  },
  {
    title: "Cohesive Multimodal & Procedural Pipelines (WF-01 to WF-08)",
    href: "/architecture.html#pipelines",
    pillar: "platforms",
    kind: "Pipelines",
    summary: "Eight end-to-end workflows spanning multimedia capture, audio stems, SDF/foliage procedural forge (WF-07), and authorized security assurance (WF-08).",
    keywords: "pipelines wf-01 wf-07 wf-08 procedural sdf foliage megascans security assurance workflows",
    featured: 1,
  },
  {
    title: "Aurora (WoW Origins & 4-Stage DSL Compiler)",
    href: "/architecture.html#lineage",
    pillar: "platforms",
    kind: "Lineage",
    summary: "435,306 LOC WoW SDK, 4-stage custom DSL compiler, TSTL, and capability/receipt catalogs bridging Shaders to BuildLang and Flywheel.",
    keywords: "aurora wow origins dsl compiler tstl lua family tree 7 buildlang flywheel ancestor",
  },
  {
    title: "Security & Purple-Team Hierarchy (2.62M+ LOC)",
    href: "/security.html#hierarchy",
    pillar: "platforms",
    kind: "Security",
    summary: "Full 18-repo security hierarchy: Sovereign -> WARDEN/Seed -> Sofer, Orca, Array, Isomorph, Bounds, Aleph, Kun -> Phantom & EMET.",
    keywords: "security purple team sovereign warden seed sofer orca array adversarial isomorph bounds aleph kun phantom emet hierarchy",
    featured: 1,
  },
  {
    title: "Security Engineering Toolkit & Complete Hierarchy",
    href: "/security-toolkit.html#full-hierarchy",
    pillar: "platforms",
    kind: "Security",
    summary: "All 16 security and purple-team tools with maturity tags (shipped, active, controlled-private, ancestor) and authorization boundaries.",
    keywords: "security toolkit maturity map sovereign warden sofer orca array bounds isomorph aleph kun phantom emet crucible secret redact",
  },
  {
    title: "Datasets (DS-01 to DS-07)",
    href: "/architecture.html#datasets",
    pillar: "research",
    kind: "Dataset",
    summary: "7,391 verified JSONL rows across 7 oracle-backed datasets covering tool repair, BuildLang, physics, RAW, and recall.",
    keywords: "datasets ds-01 ds-02 ds-03 ds-04 ds-05 ds-06 ds-07 benchmark jsonl",
    featured: 1,
  },
  {
    title: "14 Global-Frontier Engineering Lanes",
    href: "/architecture.html#frontier",
    pillar: "research",
    kind: "Benchmark",
    summary: "Peer-comparable baselines, 2025-2026 primary sources, open gaps, and falsification gates across 14 domains.",
    keywords: "frontier 14 lanes benchmarks competitors surpass falsification",
    featured: 1,
  },
  {
    title: "Work With Me / Hire",
    href: "/hire.html",
    pillar: "work",
    kind: "Career",
    summary: "Current resumes for AI evaluation, systems engineering, and field operations, plus verification pilot details.",
    keywords: "hire work resumes pilot contact collaboration",
    featured: 1,
  },
  {
    title: "Portfolio & 41 Merged Upstream PRs",
    href: "/portfolio.html",
    pillar: "work",
    kind: "Career",
    summary: "41 merged pull requests across 34 external repositories (DeepEval, Pydantic AI, Datasette, Biome, grimp) plus owned systems.",
    keywords: "portfolio prs open source contributions deepeval pydantic datasette biome grimp",
    featured: 1,
  },
  {
    title: "Full Curriculum Vitae (CV)",
    href: "/cv.html",
    pillar: "work",
    kind: "Career",
    summary: "Complete Curriculum Vitae with experience, systems, publications, open-source record, and source-matched downloads.",
    keywords: "cv curriculum vitae resume experience credentials",
    featured: 1,
  },
];

function buildIndex() {
  const seen = new Map();
  const add = (entry) => {
    const href = normHref(entry.href);
    const key = href.toLowerCase();
    const record = {
      t: cleanText(entry.title, 96),
      u: href,
      p: entry.pillar,
      k: cleanText(entry.kind || "Page", 28),
      s: cleanText(entry.summary || "", 156),
      q: cleanText(entry.keywords || "", 180).toLowerCase(),
      ...(entry.featured ? { f: 1 } : {}),
    };
    if (!record.t) return;
    if (seen.has(key)) {
      const prev = seen.get(key);
      // Merge extra keywords and keep featured flag or richer summary.
      if (record.f && !prev.f) prev.f = 1;
      if (record.s.length > prev.s.length && !prev.f) prev.s = record.s;
      if (record.q) {
        const toks = new Set((prev.q + " " + record.q).split(/\s+/).filter(Boolean));
        prev.q = [...toks].slice(0, 28).join(" ");
      }
      return;
    }
    seen.set(key, record);
  };

  // 1. Curated featured doors first
  for (const item of FEATURED) add(item);

  // 2. Datasets & Frontier lanes from architecture.json and frontier-14.json
  const arch = readJson("site-src/world/architecture.json");
  for (const ds of arch.datasets || []) {
    add({
      title: `${ds.id}: ${ds.name}`,
      href: "/architecture.html#datasets",
      pillar: "research",
      kind: "Dataset",
      summary: `${ds.observed}. ${ds.what}`,
      keywords: `${ds.id} ${ds.platformLabel} dataset benchmark oracle ${ds.oracle}`,
    });
  }
  if (existsSync(path.join(site, "site-src/world/frontier-14.json"))) {
    const frontier = readJson("site-src/world/frontier-14.json");
    for (const lane of frontier.lanes || []) {
      add({
        title: `Lane ${lane.lane_id}: ${lane.title}`,
        href: `/architecture.html#frontier`,
        pillar: "research",
        kind: "Frontier Lane",
        summary: `${lane.flagship}: ${lane.observed_baseline}`,
        keywords: `${lane.slug} ${lane.flagship} ${(lane.competitors || []).slice(0, 6).join(" ")}`,
      });
    }
  }

  // 3. Body of Work (45 documented systems, tools, packages, games, labs)
  if (existsSync(path.join(site, "site-src/world/body-of-work.json"))) {
    const bow = readJson("site-src/world/body-of-work.json");
    for (const item of bow.items || []) {
      const siteLink = (item.links || []).find(([u]) => u && u.startsWith("/"));
      const href = siteLink ? siteLink[0] : `/architecture.html#body-of-work`;
      const pillar =
        item.category === "games" || item.category === "interactive"
          ? "demos"
          : item.category === "research"
            ? "research"
            : "platforms";
      add({
        title: item.name,
        href,
        pillar,
        kind: item.categoryLabel || "Tool",
        summary: item.summary,
        keywords: `${item.id} ${item.flagship || ""} ${item.lang || ""} ${item.status || ""}`,
      });
    }
  }

  // 4. All routes from system/routes.js
  for (const family of ROUTE_REGISTRY.families || []) {
    for (const route of family.routes || []) {
      if (!route.href || route.href.startsWith("http")) continue;
      const pillar = classifyRoute(family.label, route.href);
      add({
        title: route.label,
        href: route.href,
        pillar,
        kind: route.maturity ? route.maturity : family.label,
        summary: route.summary || "",
        keywords: `${family.label} ${(route.aliases || []).join(" ")}`,
      });
    }
  }

  // 5. Publications index (essays, investigations, briefings, dossiers)
  if (existsSync(path.join(site, "publications/data/index.json"))) {
    const pub = readJson("publications/data/index.json");
    for (const rec of [...(pub.records || []), ...(pub.listings || [])]) {
      if (!rec.route) continue;
      add({
        title: rec.title,
        href: rec.route,
        pillar: "research",
        kind: rec.kind || "Writing",
        summary: rec.summary || `${rec.kind || "Publication"} (${rec.published_at || "2026"}) in ${rec.collection || "writing"}.`,
        keywords: `${rec.id || ""} ${rec.collection || ""} ${rec.category || ""} ${rec.form || ""}`,
      });
    }
  }

  // 6. Laboratory findings from findings/pages.json
  if (existsSync(path.join(site, "findings/pages.json"))) {
    const findings = readJson("findings/pages.json");
    for (const p of findings.pages || []) {
      if (!p.path || p.redirect || !p.indexable || p.path === "findings/") continue;
      add({
        title: titleFromFindingPath(p.path, p.id),
        href: p.path,
        pillar: "research",
        kind: p.id ? `Finding (${p.tier || "Lab"})` : "Findings",
        summary: p.id
          ? `Recorded laboratory finding ${p.id}${p.standing && p.standing !== "none" ? ` (${p.standing})` : ""} with reproducible data and accessible curve notes.`
          : "Glossary and guide to the laboratory findings ledger.",
        keywords: `${p.id || ""} finding laboratory tier ${p.tier || ""} ${p.standing || ""}`,
      });
    }
  }

  const items = [...seen.values()];
  const payload = {
    version: 1,
    generated_from: "scripts/build-search-index.mjs",
    pillars: PILLARS,
    count: items.length,
    items,
  };
  const json = JSON.stringify(payload, null, 2) + "\n";

  // Hygiene self-check: zero em dashes, zero local paths, zero retired names.
  if (/\u2014/.test(json)) throw new Error("search-index: em dash detected in generated JSON");
  if (/[A-Z]:\\\\/.test(json)) throw new Error("search-index: local Windows path detected in generated JSON");
  if (/zentropy/i.test(json)) throw new Error("search-index: retired name detected in generated JSON");
  return { payload, json };
}

const { payload, json } = buildIndex();
const outPath = path.join(site, "system/search-index.json");
if (CHECK) {
  const onDisk = existsSync(outPath) ? readFileSync(outPath, "utf8").replace(/\r\n/g, "\n") : null;
  if (onDisk !== json) {
    console.error("system/search-index.json differs from scripts/build-search-index.mjs; rerun node scripts/build-search-index.mjs");
    process.exit(1);
  }
  console.log(`checked system/search-index.json (${payload.count} entries across ${PILLARS.length} pillars)`);
} else {
  writeFileSync(outPath, json, "utf8");
  console.log(`built system/search-index.json (${payload.count} entries across ${PILLARS.length} pillars)`);
}
