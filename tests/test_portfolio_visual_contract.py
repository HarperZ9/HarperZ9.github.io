"""Structural contract for the home as it ships now: the React shell.

This replaces the previous contract, which pinned the white-ceramic static
home (system/home.css, the Ribbon Field hero wired in index.html, the dex
rail, the five-flagship sections). The home moved to a built React shell
(data-home-shell="react", a hashed asset bundle, a full static noscript
fallback), so those assertions described a retired surface and had been
failing since the cutover. Same repair discipline as the last replacement:
pin what actually ships, keep the accessibility and honesty floors, and keep
the em-dash gate.

App-rendered structure (nav, skip link, section rail) cannot be asserted by
static grep; the noscript fallback is the static floor this file guards.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_CSS = ROOT / "system" / "home.css"
RIBBON = ROOT / "system" / "ribbon-field.js"
SCROLL = ROOT / "system" / "home-scroll.js"

EM_DASH = "—"
EN_DASH = "–"


def index_source() -> str:
    return INDEX.read_text(encoding="utf-8")


def test_home_loads_the_react_shell() -> None:
    src = index_source()
    assert 'data-home-shell="react"' in src
    assert '<div id="root"></div>' in src
    assert re.search(r'src="/assets/index-[\w-]+\.js"', src), "hashed app bundle missing"
    assert "home-readable.css" in src
    assert "styles.css" not in src   # the pre-Telos consulting stylesheet stays gone


def test_noscript_fallback_is_a_complete_front_door() -> None:
    src = index_source()
    assert "<noscript>" in src
    assert "One workshop, from making to proving." in src
    for href in ("retro.html", "studio.html", "gallery.html", "overview.html", "demo-index.html",
                 "research.html", "publications.html", "writing.html", "guide.html", "catalog.html", "cv.html"):
        assert f'href="{href}"' in src, f"noscript fallback lost {href}"


def test_noscript_spans_the_ecosystem() -> None:
    """The static fallback showcases the whole span, from the making end (the
    retro engine, the generative studio) to the proving end, and keeps the
    honest register: a run seals into a receipt you can re-check offline."""
    src = index_source().lower()
    assert "fourteen connected engines" in src
    assert "retro engine" in src           # the making end is named
    assert "generative studio" in src
    assert "receipt" in src                # the proving end: a re-checkable receipt


def test_white_ceramic_tokens_are_defined() -> None:
    css = HOME_CSS.read_text(encoding="utf-8")
    assert "--paper:#f4f3ef" in css
    assert "--ink:#0b0c0e" in css
    assert "--iris:" in css
    assert "background:var(--paper)" in css


def test_ribbon_field_is_failsafe_and_transparent() -> None:
    js = RIBBON.read_text(encoding="utf-8")
    assert "premultipliedAlpha: true" in js
    assert 'canvas.style.display = "none"' in js
    assert "prefers-reduced-motion" in js


def test_no_em_or_en_dashes_in_home_and_system() -> None:
    for path in (INDEX, HOME_CSS, RIBBON, SCROLL):
        text = path.read_text(encoding="utf-8")
        assert EM_DASH not in text, f"em-dash in {path.name}"
        assert EN_DASH not in text, f"en-dash in {path.name}"
