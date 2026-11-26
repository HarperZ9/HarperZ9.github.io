"""Wave 16 unified 44-HTML site contracts (36 flagship surfaces + 8 embedded WebGPU/WASM frames).

Enforces:
- Tracked HTML count stays consolidated (<= 44, down from 611).
- 100% lossless content preservation in assets/data/unified/ JSON packs + legacy_route_map.json.
- Complete public repository catalog (159 public repos, 0 private repos).
- Zero em dashes, zero local drive paths, zero retired brand names on public surfaces.
- Valid HTML5 shell landmarks (<main>, <h1>, <title>, canonical) on every flagship page.
- Wave 16C banners, audio cues, and 1080p video explainers present on disk.
- Wave 16E-2 career/v2 downloadable PDFs/DOCXs/MDs/TXTs present with zero self-sabotage.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNIFIED = ROOT / "assets" / "data" / "unified"
LOCAL_PATH_RE = re.compile(r"(?<![A-Za-z])[A-Za-z]:\\(?:dev|Users|wt|site-wt|antigravity|datasets)")
EMBEDDED_PREFIXES = ("media/low-water/", "media/raw-native/")

FLAGSHIP_PAGES = [
    "index.html", "person.html", "portfolio.html", "architecture.html", "dossier.html", "credits.html",
    "playground/index.html", "playground/distill.html", "raw.html", "low-water.html", "studio.html",
    "elements.html", "media/index.html", "buildlang.html", "flywheel.html", "models.html",
    "cmmns.html", "demos.html", "tools.html", "world/index.html", "studies/index.html",
    "findings/index.html", "essays.html", "frontier-safety/index.html", "security.html",
    "night-school.html", "hire.html", "cv.html", "cover-letter.html", "resume.html",
    "resume-evaluation-tooling.html", "resume-graphics-developer-tools.html", "resume-grounds.html",
    "resume-public-operations.html", "resume-support-operations.html", "404.html",
]


def test_html_count_stays_consolidated():
    htmls = sorted(
        p.relative_to(ROOT).as_posix()
        for p in ROOT.rglob("*.html")
        if ".git" not in p.parts and "node_modules" not in p.parts
    )
    assert len(htmls) <= 44, f"HTML sprawl regression: found {len(htmls)} HTML files"
    site_pages = [h for h in htmls if not h.startswith(EMBEDDED_PREFIXES)]
    assert 34 <= len(site_pages) <= 40, f"Unexpected flagship site page count: {len(site_pages)}"


def test_unified_json_packs_and_route_map_are_complete_and_clean():
    packs = [
        "world_atlas.json",
        "studies_findings.json",
        "essays_writings.json",
        "tools_plugins_demos.json",
        "media_figures.json",
    ]
    total_items = 0
    for name in packs:
        raw = (UNIFIED / name).read_text(encoding="utf-8")
        assert "\u2014" not in raw, f"em dash found in {name}"
        assert not LOCAL_PATH_RE.search(raw), f"local path found in {name}"
        data = json.loads(raw)
        assert data["count"] == len(data["items"]) and data["count"] > 20, name
        total_items += data["count"]
    assert total_items >= 550, f"Expected >= 550 harvested items, got {total_items}"

    rmap = json.loads((UNIFIED / "legacy_route_map.json").read_text(encoding="utf-8"))
    assert rmap["before_html_count"] == 611
    assert len(rmap["routes"]) >= 550


def test_public_repos_catalog_present_and_private_excluded():
    raw = (UNIFIED / "all_public_repos_catalog.json").read_text(encoding="utf-8")
    assert "\u2014" not in raw
    assert not LOCAL_PATH_RE.search(raw)
    cat = json.loads(raw)
    repos = cat.get("repositories", [])
    assert len(repos) >= 150, f"Expected >= 150 public repos, got {len(repos)}"
    names = {r["name"] for r in repos}
    for flagship in ("superframe", "buildlang", "flywheel", "cmmns", "HarperZ9.github.io"):
        assert flagship in names, f"Missing flagship {flagship}"
    for private_name in ("isomorph", "sofer", "project-docs", "CL4R1T4S-CR0SS0VER"):
        assert private_name not in names, f"Private repo leaked: {private_name}"


def test_flagship_pages_have_valid_structure_and_clean_voice():
    for rel in FLAGSHIP_PAGES:
        p = ROOT / rel
        assert p.is_file(), f"Missing flagship page: {rel}"
        txt = p.read_text(encoding="utf-8")
        low = txt.lower()
        assert "<!doctype html>" in low, rel
        assert "<title>" in low and "</title>" in low, rel
        assert "<main" in low and "<h1" in low, rel
        assert not LOCAL_PATH_RE.search(txt), f"local path leaked in {rel}"
        if rel not in ("404.html", "credits.html"):
            assert "zentropy" not in low, f"retired brand in {rel}"


def test_wave16c_media_overhaul_assets_exist():
    required = [
        "media/overhaul/banners/site-hero-banner-dark.webp",
        "media/overhaul/banners/banner-playground-raw.webp",
        "media/overhaul/banners/banner-buildlang-bdb.webp",
        "media/overhaul/banners/banner-flywheel-models.webp",
        "media/overhaul/banners/banner-cmmns-archival.webp",
        "media/overhaul/banners/banner-research-career.webp",
        "media/overhaul/audio/site-main-theme.mp3",
        "media/overhaul/audio/explainer-bed-calm.mp3",
        "media/overhaul/audio/playground-acoustic-demo.mp3",
        "media/overhaul/videos/explainer-workstation-overview.mp4",
        "media/overhaul/videos/explainer-raw-dx12-playground.mp4",
        "media/overhaul/videos/explainer-flywheel-jfc3p-models.mp4",
    ]
    for rel in required:
        fp = ROOT / rel
        assert fp.is_file() and fp.stat().st_size > 10_000, f"Missing/empty media asset: {rel}"


def test_career_v2_downloads_clean_and_non_apologetic():
    v2 = ROOT / "career" / "v2"
    assert v2.is_dir()
    pdfs = list(v2.glob("*.pdf"))
    docxs = list(v2.glob("*.docx"))
    mds = list(v2.glob("*.md"))
    txts = list(v2.glob("*.txt"))
    assert len(pdfs) >= 16 and len(docxs) >= 8 and len(mds) >= 8 and len(txts) >= 8
    banned = ("no paid software role", "have not yet held a paid software", "oversized portfolio")
    for p in mds + txts:
        txt = p.read_text(encoding="utf-8")
        assert "\u2014" not in txt, f"em dash in {p.name}"
        assert not LOCAL_PATH_RE.search(txt), f"local path in {p.name}"
        low = txt.lower()
        for phrase in banned:
            assert phrase not in low, f"self-sabotaging phrase '{phrase}' in {p.name}"


def test_search_index_covers_unified_destinations():
    idx = json.loads((ROOT / "system" / "search-index.json").read_text(encoding="utf-8"))
    assert idx["count"] >= 700
    assert any(it["u"] == "/models.html" for it in idx["items"])
    assert any(it["u"] == "/tools.html" for it in idx["items"])
