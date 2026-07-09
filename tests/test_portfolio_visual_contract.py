"""Visual and structural contract for the Project Telos public site.

The home is now a built Vite/React surface. Older tests asserted the pre-Vite
static home (system/home.css, #site-nav, #ribbon-canvas, .dex). This file pins
the contract that actually ships now:

  - the Vite shell in index.html and hashed assets in assets/
  - the dark spectrum design tokens and live browser-rendered hero
  - the React-rendered accessibility floor (skip link, main landmark, focus)
  - the broad workshop thesis now used by the home surface
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
SYSTEM_CSS = ROOT / "system" / "system.css"
DOC_CSS = ROOT / "system" / "doc.css"
GENERATIVE_FIELD = ROOT / "system" / "generative-field.js"
HOME_ART = ROOT / "system" / "home-art.js"
HOME_READABLE = ROOT / "system" / "home-readable.css"
TYPEFACE = ROOT / "typeface.html"
ALEPH = ROOT / "aleph.html"
ORCA = ROOT / "orca.html"
ALEPH_HERO = ROOT / "img" / "private-line" / "aleph-hero.svg"
OVERVIEW = ROOT / "overview.html"
CATALOG = ROOT / "catalog.html"
STUDIO = ROOT / "studio.html"

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


def system_css_source() -> str:
    return SYSTEM_CSS.read_text(encoding="utf-8")


def home_readable_source() -> str:
    return HOME_READABLE.read_text(encoding="utf-8")


def doc_css_source() -> str:
    return DOC_CSS.read_text(encoding="utf-8")


def test_home_loads_the_vite_spectrum_shell_not_the_old_one() -> None:
    src = index_source()
    assert '<div id="root"></div>' in src
    assert 'type="module" crossorigin src="/assets/index-' in src
    assert 'rel="stylesheet" crossorigin href="/assets/index-' in src
    assert 'href="/system/home-readable.css?v=20260709m"' in src
    assert 'name="color-scheme" content="dark"' in src
    assert 'content="#14041b"' in src
    assert "Project Telos" in src
    assert "styles.css" not in src
    assert "system/home.css" not in src


def test_dark_spectrum_tokens_are_defined() -> None:
    css = css_source()
    home_css = home_readable_source()
    for token in ("--void:", "--surface:", "--signal:", "--match:", "--drift:", "--unverif:"):
        assert token in css
    assert "background:var(--void)" in css
    assert ".spectrum-word{" in css
    assert '@font-face{font-family:"Telos Display"' in css
    assert '--font-brand:"Telos Display","Kilon",system-ui,sans-serif' in css
    assert '--font-display:"Kilon",system-ui,sans-serif' in css
    assert ".hero-title{" in home_css
    assert "font-family:var(--font-body)" in home_css
    assert ".brand," in home_css
    assert "#gl.generative-field-canvas" in home_css
    assert "#motes.generative-motes-canvas" in home_css
    assert "body.home-generative-field::before" in home_css
    assert "-webkit-background-clip:text" not in css
    assert "-webkit-text-fill-color:transparent" not in css


def test_shared_pages_use_the_generative_dark_cascade() -> None:
    css = system_css_source()
    assert "GENERATIVE DARK CASCADE (2026-07-09)" in css
    assert '@font-face{font-family:"Telos Display"' in css
    assert '--brand-display:"Telos Display","Kilon",-apple-system' in css
    assert '--display:"Kilon",-apple-system' in css
    assert "font-family:var(--brand-display)" in css
    assert "generative-field-canvas" in css
    assert "generative-motes-canvas" in css
    assert "color-scheme:dark" in css
    assert "--paper:#14041b" in css
    for token in ("--faint:", "--match:", "--drift:", "--unverif:"):
        assert token in css
    assert ".site-nav .sn-more:not([open]) .sn-more-list{display:none}" in css
    assert ".site-nav .sn-menu-primary" in css
    assert "max-height:calc(100dvh - 5rem)" in css
    assert ".btn:focus-visible" in css


def test_document_pages_use_the_generative_document_cascade() -> None:
    css = doc_css_source()
    assert "GENERATIVE DOCUMENT CASCADE (2026-07-09)" in css
    assert '@font-face{font-family:"Telos Display"' in css
    assert '--brand-display:"Telos Display","Kilon",-apple-system' in css
    assert '--display:"Kilon",-apple-system' in css
    assert "generative-field-canvas" in css
    assert "generative-motes-canvas" in css
    assert ".site-nav" in css
    assert ".sn-links" in css
    assert ".sn-more-list" in css
    assert "overflow-wrap:anywhere" in css
    assert "text-transform:none;color:var(--ink)" in css
    assert ".site-nav .sn-links > a{\n    display:none;" in css
    assert "color-scheme:dark" in css
    assert ".site-nav .sn-more:not([open]) .sn-more-list{display:none}" in css
    assert ".site-nav .sn-menu-primary" in css
    assert "max-height:calc(100dvh - 5rem)" in css
    assert ".docnav a:focus-visible" in css


def test_shared_pages_synthesize_art_through_the_engine_not_copied_assets() -> None:
    js = GENERATIVE_FIELD.read_text(encoding="utf-8")
    assert 'createElement("canvas")' in js
    assert '"gl"' in js
    assert '"motes"' in js
    assert 'getContext("2d"' in js
    assert "requestAnimationFrame" in js
    assert "hashRoute" in js
    assert "routePalette" in js
    assert "drawOrbitField" in js
    assert "drawContourRidges" in js
    assert "drawCrystalFragments" in js
    assert "orderedDither" in js
    assert "metaballPotential" in js
    assert "drawMetaballWashes" in js
    assert "metaballGradient" in js
    assert "drawMetaballContourBands" in js
    assert "drawAsciiMetaballField" in js
    assert "drawFluidCurl" in js
    assert "drawPointerWake" in js
    assert "drawDitheredPosterVeil" in js
    assert "drawHydraTiles" in js
    assert "drawLampSymmetry" in js
    assert "drawInteractionShockwaves" in js
    assert "lastInteraction" in js
    assert "addPulse" in js
    assert "prefers-reduced-motion" in js
    combined = system_css_source() + doc_css_source() + js
    for copied in ("ca-diffusion-signal.webp", "hydra-grid.webp", "automata-rug.webp"):
        assert copied not in combined


def test_typeface_specimen_is_a_connected_public_surface() -> None:
    nav = (ROOT / "system" / "nav.js").read_text(encoding="utf-8")
    page = TYPEFACE.read_text(encoding="utf-8")
    css = system_css_source()

    assert TYPEFACE.is_file()
    assert '["Typeface", "typeface.html", "typeface"]' in nav
    assert "TYPEFACE" in page
    assert "Telos Display" in page
    assert "Version 0.5" in page
    assert "readable generated-outline" in page
    assert "Synthesis, not sampling." in page
    assert "lowercase terminal" in page
    assert "ABCDEFGHIJKLMNOPQRSTUVWXYZ" in page
    assert "0123456789" in page
    assert "type-specimen" in page
    assert "typeface-field" in page
    assert "system/nav.js" in page
    assert ".type-specimen" in css
    assert ".type-mark" in css
    assert ".synthesis-row" in css
    assert ".glyph-grid" in css
    assert ".typeface-field" in css


def test_studio_is_media_first_not_certificate_first() -> None:
    studio = STUDIO.read_text(encoding="utf-8")
    css = system_css_source()

    assert 'class="studio-app studio-media-first"' in studio
    assert 'class="source-menu studio-mode-strip"' in studio
    assert 'class="studio-viewport studio-primary-stage"' in studio
    assert 'class="studio-panel studio-perception-panel"' in studio
    assert 'class="studio-receipts"' in studio
    assert studio.index('id="sc-meters"') < studio.index('id="sc-certificate"')
    assert studio.index('id="sc-certificate"') < studio.index('id="project-telos-features"')
    assert "What the model sees" not in studio
    assert "Live Perception" in studio
    assert 'class="studio-render-console"' in studio
    assert 'data-studio-console-source="showcase"' in studio
    assert 'data-studio-console-source="byo"' in studio
    assert ".studio-media-first" in css
    assert ".studio-render-console" in css
    assert ".studio-console-stage" in css
    assert "resize:vertical" in css
    assert ".studio-receipts[open]" in css
    assert "grid-template-columns:minmax(12rem,18rem) minmax(0,1fr) minmax(18rem,24rem)" in css
    assert ".studio-primary-stage .viewport-stage" in css
    assert ".studio-chat-drawer.minimized .chat-dock-body" in css
    assert "@media (max-width:899.98px)" in css


def test_live_spectrum_hero_is_wired() -> None:
    app = app_source()
    css = css_source()
    index = index_source()
    assert "className:`hero-canvas-wrap`" in app
    assert "className:`hero-canvas`" in app
    assert "flow field traced by ~2,400 particles" in app
    assert "drawn in your browser" in app
    assert ".hero-canvas{" in css
    assert 'src="/system/home-art.js?v=20260709m"' in index
    assert 'href="/system/home-readable.css?v=20260709m"' in index
    home_art = HOME_ART.read_text(encoding="utf-8")
    assert "home-generative-field" in home_art
    assert "./generative-field.js" in home_art
    # One field owns the hero: the bundle flow-field. The shared generative
    # field stays a fixed page background and is never re-parented into .hero.
    assert "placeFieldInHero" not in home_art
    assert "home-fluid-canvas" not in home_art
    assert "upgradeHomeMenu" in home_art
    assert "ensureEngineConsole" not in home_art
    assert "data-engine-mode-button" not in home_art
    assert "normalizeHomeFormFields" in home_art
    assert "repairHeroCopy" in home_art
    assert "Tools for local AI" in home_art
    assert "Open a demo, inspect an engine, or start a project." in home_art
    assert "fonts.googleapis.com" not in index
    assert "fonts.gstatic.com" not in index


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


def test_home_uses_clear_first_viewport_messaging() -> None:
    app = app_source()
    home_art = HOME_ART.read_text(encoding="utf-8")
    css = home_readable_source()
    assert "Project Telos is a public workshop" in app
    assert "Tools for local AI" in home_art
    assert "codebase maps" in home_art
    assert "compiler tools" in home_art
    assert "graphics systems" in home_art
    assert "Open a demo, inspect an engine, or start a project." in home_art
    assert "The field is live, but the text comes first." in home_art
    assert "Common first moves" in home_art
    assert "run a live demo" in home_art
    assert "inspect an engine" in home_art
    assert "read a paper" in home_art
    assert "start a work thread" in home_art
    assert "removeResearchLaneReadout" in home_art
    assert "repairSectionKickers" in home_art
    assert ".home-menu{" in css
    assert ".home-menu-list" in css
    assert ".home-engine-console" not in css
    assert ".home-console-stage" not in css
    assert "resize:horizontal" not in css
    assert "Engine room" in home_art
    assert "Live demos" in home_art
    assert "Start here" not in home_art
    assert "8 engines" not in home_art
    assert "available for work" not in home_art
    assert ".topnav-links{\n    display:none !important;" in css
    assert "width:calc(100vw - (var(--shell) * 2));" in css
    assert ".kicker::before{\n  display:none;" in css
    for retired in (
        "Build with",
        "a model.",
        "Peer into",
        "the frontier.",
        "Telos is the looking glass",
        "The view comes first.",
        "every step can be re-checked from outside",
        "Build it to be checked",
        "or do not ship it.",
        "Hire the range,",
        "verify the rigor.",
        "The accountability line is the current focus",
    ):
        assert retired not in app
        assert retired not in home_art


def test_eight_public_engines_equal_standing() -> None:
    src = app_source()
    for name, role in (
        ("telos", "perceive & make"),
        ("index", "map workspaces"),
        ("gather", "intake & capture"),
        ("forum", "orchestrate"),
        ("crucible", "judge"),
        ("emet", "byte integrity"),
        ("buildlang", "author"),
        ("learn", "learning aid + course engine"),
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


def test_research_and_work_sections_keep_range_first_line() -> None:
    src = app_source()
    home_art = HOME_ART.read_text(encoding="utf-8")
    assert "Six papers," in src
    assert "many doors." in src
    assert "public lanes" in src
    assert "start anywhere" in src
    assert 'querySelector(\'.readout[aria-label="public lanes"]\')' in home_art
    assert "0009-0001-7175-5393" in src
    assert "Bring the knot," in src
    assert "make it tangible." in src
    assert "Self-taught systems engineer" in src
    assert "unusual technical scope" in src
    assert "systems, models, graphics, research, and web surfaces" in src


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
    assert "<title>Runtime: local-first operator workbench</title>" in src
    assert 'content="Runtime: local-first operator workbench"' in src
    assert 'name="color-scheme" content="dark"' in src
    assert 'name="theme-color" content="#14041b"' in src
    assert "Runtime is the Project Telos local-first operator workbench housed in ORCA" in src
    assert '<span translate="no">Runtime</span> &middot; local-first operator workbench' in src
    assert '<span translate="no">Runtime</span> / ORCA' in src
    for proof in ("v1.0.0", "361", "local-only", "metadata-only", "5 files"):
        assert proof in src
    assert "Status</span>: public repo for release-safe docs and runtime contract; private operator material stays local" in src
    assert "accountable assessment runner" not in src


def test_overview_and_catalog_use_product_names_before_repo_aliases() -> None:
    overview = OVERVIEW.read_text(encoding="utf-8")
    catalog = CATALOG.read_text(encoding="utf-8")
    for src in (overview, catalog):
        assert 'name="color-scheme" content="dark"' in src
        assert 'name="theme-color" content="#14041b"' in src
        for term in ("Gate", "Runtime", "Vault", "Boundary", "Lab", "Ledger"):
            assert term in src
    assert "Everything below is part of the public map" in overview
    assert "Different doors, one workshop" in overview
    assert "Gate, Runtime, Vault, and Boundary" in catalog
    assert "Aleph, ORCA, Kun, and behavior-transform" not in overview
    assert "Aleph, ORCA, Kun, and behavior-transform" not in catalog


def test_no_em_or_en_dashes_in_home_and_system() -> None:
    for path in (INDEX, app_js_path(), app_css_path(), HOME_READABLE, HOME_ART, RIBBON, SCROLL):
        text = path.read_text(encoding="utf-8")
        assert EM_DASH not in text, f"em-dash in {path.name}"
        assert EN_DASH not in text, f"en-dash in {path.name}"
