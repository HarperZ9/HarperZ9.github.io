"""Visual and structural contract for the Project Telos public site.

The home is now a built Vite/React surface. Older tests asserted the pre-Vite
static home (system/home.css, #site-nav, #ribbon-canvas, .dex). This file pins
the contract that actually ships now:

  - the Vite shell in index.html and hashed assets in assets/
  - the dark spectrum design tokens and live browser-rendered hero
  - the React-rendered accessibility floor (skip link, main landmark, focus)
  - the home content and the MATCH / DRIFT / UNVERIFIABLE thesis
  - zero em/en dashes across the home shell and shipped home bundle

The dead-link crawl in tests/linkcheck.mjs remains the link gate. Per-page
contracts for warden.html, emet.html, and the sample pages are intentionally out
of scope here; the home contract does not police other pages.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
RIBBON = ROOT / "system" / "ribbon-field.js"
SCROLL = ROOT / "system" / "home-scroll.js"
ALEPH = ROOT / "aleph.html"
ORCA = ROOT / "orca.html"
ALEPH_HERO = ROOT / "img" / "private-line" / "aleph-hero.svg"
OVERVIEW = ROOT / "overview.html"
CATALOG = ROOT / "catalog.html"

EM_DASH = "\u2014"
EN_DASH = "\u2013"


def index_source() -> str:
    return INDEX.read_text(encoding="utf-8")


def asset_path(pattern: str) -> Path:
    match = re.search(pattern, index_source())
    assert match, f"missing asset pattern: {pattern}"
    path = ROOT / match.group(1).lstrip("/")
    assert path.is_file(), path
    return path


def app_js_path() -> Path:
    return asset_path(r'<script type="module" crossorigin src="([^"]+\.js)"')


def app_css_path() -> Path:
    return asset_path(r'<link rel="stylesheet" crossorigin href="([^"]+\.css)"')


def app_source() -> str:
    return app_js_path().read_text(encoding="utf-8")


def css_source() -> str:
    return app_css_path().read_text(encoding="utf-8")


def test_home_loads_the_vite_spectrum_shell_not_the_old_one() -> None:
    src = index_source()
    assert '<div id="root"></div>' in src
    assert 'type="module" crossorigin src="/assets/index-' in src
    assert 'rel="stylesheet" crossorigin href="/assets/index-' in src
    assert 'name="color-scheme" content="dark"' in src
    assert 'content="#14041b"' in src
    assert "Project Telos" in src
    assert "styles.css" not in src
    assert "system/home.css" not in src


def test_dark_spectrum_tokens_are_defined() -> None:
    css = css_source()
    for token in ("--void:", "--surface:", "--signal:", "--match:", "--drift:", "--unverif:"):
        assert token in css
    assert "background:var(--void)" in css
    assert ".spectrum-word{" in css


def test_live_spectrum_hero_is_wired() -> None:
    app = app_source()
    css = css_source()
    assert "className:`hero-canvas-wrap`" in app
    assert "className:`hero-canvas`" in app
    assert "flow field traced by ~2,400 particles" in app
    assert "drawn in your browser" in app
    assert ".hero-canvas{" in css


def test_ribbon_field_is_failsafe_and_transparent() -> None:
    js = RIBBON.read_text(encoding="utf-8")
    # transparent premultiplied output so the page ceramic composites through
    assert "premultipliedAlpha: true" in js
    # fail-safe: a missing or broken context hides the canvas (CSS fallback shows)
    assert 'canvas.style.display = "none"' in js
    # honors reduced motion with a single settled frame
    assert "prefers-reduced-motion" in js


def test_accessibility_floor_is_preserved() -> None:
    app = app_source()
    css = css_source()
    assert "className:`skip-link`" in app
    assert "href:`#main`" in app
    assert "id:`main`" in app
    assert ".skip-link{" in css
    assert ".visually-hidden{" in css
    assert ":focus-visible{" in css


def test_nav_contract_is_intact() -> None:
    app = app_source()
    css = css_source()
    assert "className:`topnav`" in app
    assert '"aria-label":`Primary`' in app
    for href in ("#engines", "#demonstrate", "#research", "#range", "#work"):
        assert f"href:`{href}`" in app
    assert "https://github.com/HarperZ9" in app
    assert ".topnav{" in css
    assert ".topnav-links{" in css


def test_home_sections_are_present() -> None:
    app = app_source()
    css = css_source()
    for section_id in ("engines", "demonstrate", "cases", "research", "range", "work"):
        assert f"id:`{section_id}`" in app
    for css_class in (".engines{", ".demos{", ".cases{", ".papers{", ".range-grid{", ".work-wrap{"):
        assert css_class in css


def test_home_thesis_and_messaging_preserved() -> None:
    src = app_source()
    assert "Build with" in src
    assert "a model." in src
    assert "Peer into" in src
    assert "the frontier." in src
    assert "Telos is the looking glass" in src
    assert "The view comes first." in src
    assert "every step can be re-checked from outside" in src
    assert "Build it to be checked" in src
    assert "or do not ship it." in src
    for verdict in ("MATCH", "DRIFT", "UNVERIFIABLE"):
        assert verdict in src


def test_eight_public_engines_equal_standing() -> None:
    src = app_source()
    for name, role in (
        ("telos", "perceive & make"),
        ("index", "map & verify"),
        ("gather", "intake & witness"),
        ("forum", "orchestrate"),
        ("crucible", "judge"),
        ("emet", "witness"),
        ("buildlang", "author"),
        ("learn", "learning aid + credential provenance"),
    ):
        assert f"name:`{name}`" in src
        assert f"role:`{role}`" in src
    for href in (
        "https://github.com/HarperZ9/telos",
        "https://pypi.org/project/index-graph/",
        "https://pypi.org/project/gather-engine/",
        "https://github.com/HarperZ9/forum",
        "https://github.com/HarperZ9/crucible",
        "https://github.com/HarperZ9/emet",
        "https://github.com/HarperZ9/buildlang",
        "https://github.com/HarperZ9/learn",
    ):
        assert f"href:`{href}`" in src


def test_research_and_work_sections_keep_public_proof_line() -> None:
    src = app_source()
    assert "Six papers." in src
    assert "One bet." in src
    assert "verdict lattice" in src
    assert "never " in src
    assert "trusted" in src
    assert "0009-0001-7175-5393" in src
    assert "Hire the range," in src
    assert "verify the rigor." in src
    assert "Self-taught systems engineer" in src
    assert "every page links to its own source" in src


def test_aleph_page_presents_private_line_platform_contract() -> None:
    src = ALEPH.read_text(encoding="utf-8")
    hero = ALEPH_HERO.read_text(encoding="utf-8")
    assert ALEPH_HERO.is_file()
    assert "<title>Gate: private-line release gate for Project Telos</title>" in src
    assert 'content="Gate: private-line release gate for Project Telos"' in src
    assert "Project Telos private-line platform" in src
    assert "One release gate. Six working tools." in src
    assert "img/private-line/aleph-hero.svg" in src
    for term in ("Gate", "Runtime", "Vault", "Boundary", "Lab", "Ledger"):
        assert term in src
    for proof in ("presentation readiness", "release_verdict: MATCH", "4/4 docs", "3/3 brand"):
        assert proof in src
    assert "Public now: Gate, Runtime, Vault, and Boundary" in src
    assert "Private until split: Lab (Seed) and Ledger (Sofer)" in src
    assert "Break your model on purpose" not in src
    assert "Gate Project Telos hero" in hero
    assert ">GATE<" in hero
    assert ">ALEPH<" not in hero


def test_runtime_page_presents_runtime_as_product_name() -> None:
    src = ORCA.read_text(encoding="utf-8")
    assert "<title>Runtime: the accountable way to run an assessment</title>" in src
    assert 'content="Runtime: the accountable way to run an assessment"' in src
    assert 'name="color-scheme" content="light"' in src
    assert 'name="theme-color" content="#f4f3ef"' in src
    assert "Runtime is the Project Telos local-first operator runtime housed in ORCA" in src
    assert '<span translate="no">Runtime</span> &middot; the accountable assessment runner' in src
    assert '<span translate="no">Runtime</span> / ORCA' in src
    for proof in ("v1.0.0", "361", "local-only", "metadata-only", "5 files"):
        assert proof in src
    assert "Status</span>: public repo for release-safe docs and runtime contract; private operator material stays local" in src


def test_overview_and_catalog_use_product_names_before_repo_aliases() -> None:
    overview = OVERVIEW.read_text(encoding="utf-8")
    catalog = CATALOG.read_text(encoding="utf-8")
    for src in (overview, catalog):
        assert 'name="color-scheme" content="light"' in src
        assert 'name="theme-color" content="#f4f3ef"' in src
        assert "Eight public engines" in src
        for term in ("Gate", "Runtime", "Vault", "Boundary", "Lab", "Ledger"):
            assert term in src
    assert "Gate, Runtime, Vault, and Boundary" in overview
    assert "Gate, Runtime, Vault, and Boundary" in catalog
    assert "Aleph, ORCA, Kun, and behavior-transform" not in overview
    assert "Aleph, ORCA, Kun, and behavior-transform" not in catalog


def test_no_em_or_en_dashes_in_home_and_system() -> None:
    for path in (INDEX, app_js_path(), app_css_path(), RIBBON, SCROLL):
        text = path.read_text(encoding="utf-8")
        assert EM_DASH not in text, f"em-dash in {path.name}"
        assert EN_DASH not in text, f"en-dash in {path.name}"
