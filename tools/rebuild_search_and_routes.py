#!/usr/bin/env python3
"""Rebuild system/search-index.json (for Ctrl+K / "/" Quick-Jump) and rewrite retired hrefs in system/routes.js."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNIFIED = ROOT / "assets" / "data" / "unified"


def clean(s: str, n: int = 160) -> str:
    s = re.sub(r"\s+", " ", str(s or "").replace("\u2014", " - ").replace("\u2013", "-")).strip()
    return s[:n]


def build_search_index() -> int:
    featured = [
        {"t": "Home (Front Door)", "u": "/", "p": "start", "k": "Hub", "s": "Front door to five flagships, local models, and live tools.", "q": "home start door", "f": 1},
        {"t": "Documented History (Zain Dana Harper)", "u": "/person.html", "p": "work", "k": "Profile", "s": "Engineering arc 2024-2026, core philosophy, craft, and five flagships.", "q": "person about bio history philosophy", "f": 1},
        {"t": "Five-Platform Architecture & Benchmarks", "u": "/architecture.html", "p": "start", "k": "Architecture", "s": "5 flagships, 7 datasets DS-01..DS-07, and verified benchmarks.", "q": "architecture benchmarks datasets", "f": 1},
        {"t": "Local Frontier Model Lab (JFC3P & NOH-4)", "u": "/models.html", "p": "platforms", "k": "Models", "s": "JFC3P-7B-Oracle Arm C 95.83%, NOH-4 reseating valve, Plato-Key, AVTR-4R.", "q": "models jfc3p noh4 rtx 4090 arm c", "f": 1},
        {"t": "The Playground (Superframe + RAW DX12)", "u": "/playground/", "p": "demos", "k": "Platform", "s": "Deterministic rendering, type forge, shaders, sound, and optics workbench.", "q": "playground superframe raw shaders sound", "f": 1},
        {"t": "RAW DX12 Native Renderer", "u": "/raw.html", "p": "platforms", "k": "Engine", "s": "Direct3D 12, Vulkan, WebGPU renderer and Skyrim/FO4/Starfield Wave 72.", "q": "raw dx12 vulkan webgpu renderer", "f": 1},
        {"t": "Low Water (3D Narrative Game)", "u": "/low-water.html", "p": "demos", "k": "Game", "s": "Five-era narrative game built directly on The Playground.", "q": "low water game", "f": 1},
        {"t": "Media, Artwork & 1080p Video Explainers", "u": "/media/", "p": "demos", "k": "Media", "s": "Smooth scroll-snap gallery of banners, mastered audio, and 1080p walkthroughs.", "q": "media video audio banners artwork gallery", "f": 1},
        {"t": "BuildLang 1.15.0 & BuildDB (qdb.exe)", "u": "/buildlang.html", "p": "platforms", "k": "Platform", "s": "Effect-typed Rust compiler, BuildDB paged store, and 115x-191x kernels.", "q": "buildlang buildc bdb qdb compiler", "f": 1},
        {"t": "The Flywheel & Articulate", "u": "/flywheel.html", "p": "platforms", "k": "Platform", "s": "Self-hosted AI workstation, engine-receipt/1, Gather, and Articulate.", "q": "flywheel receipts articulate gather", "f": 1},
        {"t": "The Commons (CMMNS 3.10.0)", "u": "/cmmns.html", "p": "platforms", "k": "Platform", "s": "Site-agnostic browser extension for provenance and local archival.", "q": "cmmns commons extension archival", "f": 1},
        {"t": "Interactive Tool Demos (8 Consolidated)", "u": "/demos.html", "p": "demos", "k": "Workbench", "s": "Flywheel, Gather, Crucible, Forum, Index, EMET, Articulate, Plexus.", "q": "demos flywheel gather crucible forum emet articulate plexus", "f": 1},
        {"t": "All 159 Public Repos, Tools & Plugins", "u": "/tools.html", "p": "platforms", "k": "Directory", "s": "Complete searchable directory of every public HarperZ9 repository and tool.", "q": "tools plugins repos catalog github", "f": 1},
        {"t": "World & Material Atlas", "u": "/world/", "p": "demos", "k": "Atlas", "s": "190 world nodes, exhibits, material studies, fonts, and ENB records.", "q": "world atlas map exhibits materials fonts", "f": 1},
        {"t": "Studies & Benchmarks", "u": "/studies/", "p": "research", "k": "Research", "s": "36 preregistered studies, analytics dashboards, and open datasets.", "q": "studies benchmarks analytics datasets", "f": 1},
        {"t": "Findings Ledger (with Honest Nulls)", "u": "/findings/", "p": "research", "k": "Findings", "s": "38 verified finding records with null controls kept in the denominator.", "q": "findings nulls evidence", "f": 1},
        {"t": "Essays, Papers & Zenodo DOIs", "u": "/essays.html", "p": "research", "k": "Writing", "s": "All essays, philosophy, research papers, DOIs, and Who Knew First.", "q": "essays writing papers doi publications", "f": 1},
        {"t": "Frontier Safety Archives & Briefings", "u": "/frontier-safety/", "p": "research", "k": "Safety", "s": "Dated frontier-safety snapshots, conclusions, and incident briefings.", "q": "frontier safety incident briefing", "f": 1},
        {"t": "Security & Purple-Team Assurance", "u": "/security.html", "p": "platforms", "k": "Security", "s": "Threat-informed defense hierarchy and accountable-surface controls.", "q": "security purple team assurance", "f": 1},
        {"t": "Night School (30 Interactive AI Labs)", "u": "/night-school.html", "p": "demos", "k": "School", "s": "30 interactive lessons from vectors to fused GPU attention kernels.", "q": "night school lessons labs", "f": 1},
        {"t": "Media & Fractal Studio", "u": "/studio.html", "p": "demos", "k": "Studio", "s": "Full interactive WebGL/Canvas2D studio, fractals, loom, and plotter.", "q": "studio fractal plotter loom webgl", "f": 1},
        {"t": "Element Bench", "u": "/elements.html", "p": "demos", "k": "Bench", "s": "Live physical-material element table and blend well.", "q": "elements bench swatches", "f": 1},
        {"t": "Hire & Career Hub (All 6 Formats)", "u": "/hire.html", "p": "work", "k": "Career", "s": "6 tailored 1-page resumes, multi-domain CV, and 4 cover letters in all 6 formats.", "q": "hire work resume cv cover letter", "f": 1},
        {"t": "Full Living Proof CV", "u": "/cv.html", "p": "work", "k": "Career", "s": "Multi-domain Living Proof CV (ATS PDF, BuildTeX Designed PDF, DOCX, TXT, MD).", "q": "cv curriculum vitae", "f": 1},
        {"t": "Cover Letters (4 Tracks)", "u": "/cover-letter.html", "p": "work", "k": "Career", "s": "Government & Policy, Urban Forestry, AI Eval & Systems, and University Fellowship.", "q": "cover letter", "f": 1},
        {"t": "Portfolio & 41 Merged Upstream PRs", "u": "/portfolio.html", "p": "work", "k": "Career", "s": "41 merged external pull requests across 34 repositories plus owned flagships.", "q": "portfolio prs contributions", "f": 1},
        {"t": "Evidence Dossier", "u": "/dossier.html", "p": "work", "k": "Career", "s": "Public evidence order and scope boundaries.", "q": "dossier evidence", "f": 1},
        {"t": "Credits", "u": "/credits.html", "p": "start", "k": "Credits", "s": "Type, archival plates, reference thumbnails, and sound credits.", "q": "credits license ofl", "f": 1},
    ]

    items = list(featured)
    seen = {x["u"] for x in items}
    pack_pillar = {
        "world_atlas.json": "demos",
        "studies_findings.json": "research",
        "essays_writings.json": "research",
        "tools_plugins_demos.json": "platforms",
        "media_figures.json": "demos",
    }
    for fname, pillar in pack_pillar.items():
        fp = UNIFIED / fname
        if not fp.exists():
            continue
        data = json.loads(fp.read_text(encoding="utf-8"))
        for it in data.get("items", []):
            u = str(it.get("target") or "").replace("/tools/#", "/tools.html#")
            if not u or u in seen:
                continue
            seen.add(u)
            items.append({
                "t": clean(it.get("title"), 90),
                "u": u,
                "p": pillar,
                "k": clean(it.get("category"), 24),
                "s": clean(it.get("description") or it.get("excerpt"), 150),
                "q": clean(f"{it.get('slug','')} {it.get('category','')} {it.get('old_path','')}", 120),
                "f": 0,
            })

    cat_fp = UNIFIED / "all_public_repos_catalog.json"
    if cat_fp.exists():
        cat = json.loads(cat_fp.read_text(encoding="utf-8"))
        for r in cat.get("repositories", []):
            slug = "repo-" + re.sub(r"[^a-z0-9]+", "-", str(r.get("name", "")).lower()).strip("-")
            u = f"/tools.html#{slug}"
            if u in seen:
                continue
            seen.add(u)
            items.append({
                "t": clean(r.get("name"), 80),
                "u": u,
                "p": "platforms",
                "k": f"repo ({r.get('status','active')})",
                "s": clean(r.get("description"), 150),
                "q": clean(f"{r.get('name','')} {r.get('category','')} {r.get('flagship_home','')}", 120),
                "f": 0,
            })

    out = {
        "schema": "search-index/2",
        "generated": "2026-11-26",
        "count": len(items),
        "items": items,
    }
    (ROOT / "system" / "search-index.json").write_text(
        json.dumps(out, ensure_ascii=True, separators=(",", ":")), encoding="utf-8"
    )
    return len(items)


def rewrite_routes_js() -> int:
    rmap = json.loads((UNIFIED / "legacy_route_map.json").read_text(encoding="utf-8"))["routes"]
    rjs = ROOT / "system" / "routes.js"
    raw = rjs.read_text(encoding="utf-8")
    m = re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', raw)
    if not m:
        return 0
    reg = json.loads(json.loads(m.group(1)))
    updated = 0
    for fam in reg.get("families", []):
        for r in fam.get("routes", []):
            href = r.get("href", "")
            base = href.split("#")[0].split("?")[0]
            cand = "/" + base.lstrip("/")
            if cand in rmap:
                r["href"] = rmap[cand].replace("/tools/#", "/tools.html#").lstrip("/")
                updated += 1
    new_json = json.dumps(json.dumps(reg, indent=2, ensure_ascii=True))
    new_raw = raw[: m.start(1)] + new_json + raw[m.end(1) :]
    rjs.write_text(new_raw, encoding="utf-8")
    return updated


def main() -> int:
    n_idx = build_search_index()
    n_routes = rewrite_routes_js()
    print(f"SEARCH_INDEX_ITEMS={n_idx} ROUTES_JS_UPDATED={n_routes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
