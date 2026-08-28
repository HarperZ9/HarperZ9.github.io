"""Union contracts for the capability/publication shared-surface release."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRESH_STAMP = "20260827-capability-publication"


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def route_registry() -> dict[str, object]:
    source = read("system/routes.js")
    match = re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', source)
    assert match, "generated route registry JSON is missing"
    return json.loads(json.loads(match.group(1)))


def test_route_registry_is_the_union_of_hiring_capability_and_legacy_routes() -> None:
    registry = route_registry()
    families = {family["label"]: family for family in registry["families"]}
    hrefs = {
        family: {route["href"] for route in data["routes"]}
        for family, data in families.items()
    }

    assert {"hire.html", "resume.html", "cv.html", "portfolio.html", "cover-letter.html"} <= hrefs["Work"]
    assert {
        "overview.html", "demonstrations.html", "systems/relay.html",
        "systems/plexus.html", "systems/mneme.html", "systems/studio-engine.html",
    } <= hrefs["Systems"]
    assert {
        "security.html", "security-toolkit.html", "phantom.html", "private-practice.html",
        "behavior-transform.html", "systems/behavior-transform.html", "emet.html",
    } <= hrefs["Security"]
    assert {
        "research.html", "writing.html", "publications.html", "frontier-safety.html",
        "models-propose-oracles-dispose.html", "briefings/index.html",
    } <= hrefs["Research"]
    assert {"studio.html", "gallery.html", "retro.html", "loom.html", "session-archive.html"} <= hrefs["Studio"]

    assert "systems/" in families["Systems"].get("prefixes", [])
    assert "security-" in families["Security"].get("prefixes", [])
    assert {"research-", "briefings/", "frontier-safety/"} <= set(families["Research"].get("prefixes", []))

    # An explicit route wins over a broad nested-family prefix. Behavior Transform
    # lives under /systems for compatibility, but belongs to the security family.
    source = read("system/routes.js")
    assert "for (const family of ROUTE_REGISTRY.families)" in source


def test_fresh_cache_stamp_covers_the_shared_navigation_chain() -> None:
    stamps = set()
    for page in ROOT.rglob("*.html"):
        for part in read(page.relative_to(ROOT).as_posix()).split("nav.js?v=")[1:]:
            stamps.add(part.split('"')[0].split("'")[0])
    assert stamps == {FRESH_STAMP}

    nav = read("system/nav.js")
    home_art = read("system/home-art.js")
    home_template = read("home/index.html")
    bundle = read("assets/index-B3zWbYkK.js")
    assert f'const ASSET_V = "{FRESH_STAMP}"' in nav
    assert f'./routes.js?v={FRESH_STAMP}' in nav
    assert f'./nav.js?v={FRESH_STAMP}' in home_art
    assert f'./routes.js?v={FRESH_STAMP}' in home_art
    assert f'/system/home-art" + ".js?v={FRESH_STAMP}' in home_template
    assert f'/system/home-art.js?v={FRESH_STAMP}' in bundle


def test_sitemap_keeps_legacy_routes_and_adds_capability_publication_routes() -> None:
    sitemap = read("sitemap.xml")
    for route in (
        "models-propose-oracles-dispose.html", "retro.html", "loom.html", "frontier-safety.html",
        "frontier-safety/archive/2026-08-24.html", "session-archive.html", "security-toolkit.html",
        "phantom.html", "private-practice.html", "briefings/",
        "briefings/2026-08-26-openai-hugging-face-incident/", "systems/relay.html",
        "systems/behavior-transform.html",
        "engine-revival.html", "brender-archival.html",
    ):
        assert f"https://harperz9.github.io/{route}" in sitemap, route


def test_publications_keeps_eight_doi_records_and_adds_the_briefing() -> None:
    publications = read("publications.html")
    assert len(set(re.findall(r"10\.5281/zenodo\.\d+", publications))) == 8
    assert 'href="/briefings/2026-08-26-openai-hugging-face-incident/"' in publications
    assert 'href="briefings/"' in publications
    assert 'href="feed.xml"' in publications
    assert 'href="feed.json"' in publications


def test_security_surfaces_keep_deep_detail_and_add_machine_readable_maturity() -> None:
    security = read("security.html")
    assert "written authorization" in security.lower()
    assert "Public security maturity index" in security
    assert 'href="security-tools.json"' in security
    for route in ("security-toolkit.html", "phantom.html", "emet.html", "private-practice.html"):
        assert f'href="{route}"' in security

    phantom = read("phantom.html")
    assert "v1.1.0" in phantom
    assert "Layer-2 path" in phantom
    assert "Layers 1 and 0 modeled but not shipped" in phantom
    assert 'href="security-tools.json"' in phantom

    emet = read("emet.html")
    assert "35/35 conformance" in emet
    assert "EMET v1.2.0" in emet
    assert "48/48" in emet
    assert "40/40" in emet
    assert "DeepEval" in emet
    assert 'href="security-tools.json"' in emet


def test_career_pages_keep_downloads_and_describe_the_committed_census() -> None:
    portfolio = read("portfolio.html")
    resume = read("resume.html")
    manifest = read("career/career-artifacts.json")
    assert 'href="career/Zain-Dana-Harper-Portfolio-Brief.pdf"' in portfolio
    assert 'href="career/Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.pdf"' in resume
    assert "Zain-Dana-Harper-Portfolio-Brief.pdf" in manifest
    assert "Zain-Dana-Harper-Resume-Support-Developer-Operations-QA.pdf" in manifest
    assert "Free Law Project" in portfolio
    assert "Free Law Project" in resume
    assert "read straight from the GitHub API" not in portfolio
    assert "come from the GitHub API" not in resume


def test_card_registry_is_a_union_and_the_template_honors_words_and_glyphs() -> None:
    cards = read("img/og/cards-data.js")
    template = read("img/og/_card.html")
    for key in (
        "phantom", "security-toolkit", "private-practice", "gallery", "retro", "loom",
        "publications", "security", "typeface", "why", "demo-flywheel",
    ):
        assert f'"{key}":' in cards
    assert "data.word||rhino(key)" in template
    assert 'id="glyph"' in template
    assert "data.showGlyph" in template


def test_mobile_navigation_regression_protection_remains_in_both_stylesheets() -> None:
    for relative in ("system/doc.css", "system/system.css"):
        css = read(relative)
        assert ".site-nav > .sn-more" in css
        assert "position:fixed!important" in css
