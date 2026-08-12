"""Content contract for The Loom: the image-to-cloth crossover surface.

Pins what ships: the page exists and is reachable (nav, sitemap), the lede
says honestly what the WIF export is, the engine modules are versioned in,
and the no-dash rule holds on every loom surface.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "loom.html"
CONTROLLER = ROOT / "system" / "loom-studio.js"
ENGINE = ROOT / "system" / "weave-engine.js"
NAV = ROOT / "system" / "nav.js"
SITEMAP = ROOT / "sitemap.xml"

EM_DASH = "—"
EN_DASH = "–"


def test_loom_page_and_modules_exist() -> None:
    for path in (PAGE, CONTROLLER, ENGINE):
        assert path.is_file(), path


def test_loom_page_contract() -> None:
    page = PAGE.read_text(encoding="utf-8")
    assert "<title>The Loom &middot; Zain Dana Harper</title>" in page
    assert '<link rel="canonical" href="https://harperz9.github.io/loom.html">' in page
    assert "threading, tie-up, and treadling" in page
    assert "WIF" in page
    assert "Nothing is uploaded." in page
    assert 'src="system/loom-studio.js?v=' in page


def test_loom_is_reachable() -> None:
    nav = NAV.read_text(encoding="utf-8")
    assert '["The Loom", "loom.html", "loom"]' in nav
    sitemap = SITEMAP.read_text(encoding="utf-8")
    assert "https://harperz9.github.io/loom.html" in sitemap
    assert "https://harperz9.github.io/retro.html" in sitemap


def test_loom_surfaces_carry_no_dashes() -> None:
    for path in (PAGE, CONTROLLER, ENGINE):
        text = path.read_text(encoding="utf-8")
        assert EM_DASH not in text, f"em-dash in {path.name}"
        assert EN_DASH not in text, f"en-dash in {path.name}"
