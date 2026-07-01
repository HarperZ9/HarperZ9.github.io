"""Visual and structural contract for the white-sculptural Project Telos home.

This replaces the previous contract, which asserted the pre-Telos "Harper
Advocates" consulting design (styles.css, --bg-mid, .wrow, and that page's copy).
That design no longer exists on the home, so those assertions were stale and
already failing. This file pins the design that actually ships now:

  - the white-ceramic design system in system/home.css
  - the live Ribbon Field hero (system/ribbon-field.js) and its fail-safe
  - the preserved structure and accessibility floor (nav contract, skip link,
    landmarks) that the redesign keeps from telos.css
  - the home content and the MATCH / DRIFT / UNVERIFIABLE thesis
  - zero em-dashes across the home and its system files

The dead-link crawl in tests/linkcheck.mjs remains the link gate. Per-page
contracts for warden.html, emet.html, and the sample pages are intentionally out
of scope here; the home contract does not police other pages.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_CSS = ROOT / "system" / "home.css"
RIBBON = ROOT / "system" / "ribbon-field.js"
SCROLL = ROOT / "system" / "home-scroll.js"
ALEPH = ROOT / "aleph.html"
ALEPH_HERO = ROOT / "img" / "private-line" / "aleph-hero.svg"

EM_DASH = "—"
EN_DASH = "–"


def index_source() -> str:
    return INDEX.read_text(encoding="utf-8")


def css_source() -> str:
    return HOME_CSS.read_text(encoding="utf-8")


def test_home_loads_the_white_system_not_the_old_one() -> None:
    src = index_source()
    assert 'href="system/home.css' in src
    assert "styles.css" not in src          # the old dark/consulting stylesheet is gone
    assert 'name="color-scheme" content="light"' in src
    assert 'content="#f4f3ef"' in src        # ceramic theme-color


def test_white_ceramic_tokens_are_defined() -> None:
    css = css_source()
    assert "--paper:#f4f3ef" in css          # warm near-white ground, not #fff
    assert "--ink:#0b0c0e" in css
    assert "--iris:" in css                   # the single restrained accent
    assert "background:var(--paper)" in css


def test_ribbon_field_hero_is_wired() -> None:
    src = index_source()
    assert '<canvas id="ribbon-canvas"' in src
    assert "system/ribbon-field.js" in src
    assert "system/home-scroll.js" in src
    assert "#ribbon-canvas" in css_source()


def test_ribbon_field_is_failsafe_and_transparent() -> None:
    js = RIBBON.read_text(encoding="utf-8")
    # transparent premultiplied output so the page ceramic composites through
    assert "premultipliedAlpha: true" in js
    # fail-safe: a missing or broken context hides the canvas (CSS fallback shows)
    assert 'canvas.style.display = "none"' in js
    # honors reduced motion with a single settled frame
    assert "prefers-reduced-motion" in js


def test_accessibility_floor_is_preserved() -> None:
    src = index_source()
    assert 'class="skip-link" href="#main"' in src
    assert '<main id="main">' in src
    assert ".skip-link{" in css_source()
    assert "visually-hidden" in src
    assert ":focus-visible{" in css_source()


def test_nav_contract_is_intact() -> None:
    src = index_source()
    # nav.js mounts into this node; the noscript fallback mirrors it
    assert '<div id="site-nav" class="site-nav">' in src
    assert "system/nav.js" in src
    assert "<noscript>" in src
    assert '<a class="sn-home" href="index.html"' in src


def test_section_index_rail_present() -> None:
    src = index_source()
    assert 'class="dex"' in src
    for label in ("Thesis", "Engines", "Range", "Work", "Floor"):
        assert label in src
    assert ".dex{" in css_source()


def test_home_thesis_and_messaging_preserved() -> None:
    src = index_source()
    assert "Build with a model." in src
    assert "Take nothing on faith." in src
    assert "from outside the thing making the claim" in src
    assert "Eight engines, equal standing." in src
    assert "Looking verified is not the same as being verifiable." in src
    assert "Build it to be checked, or do not ship it." in src
    for verdict in ("MATCH", "DRIFT", "UNVERIFIABLE"):
        assert verdict in src


def test_five_flagships_equal_standing() -> None:
    src = index_source()
    # robust to extra attributes (e.g. translate="no" on brand names)
    for fid, name in (
        ("flag-gather", ">gather<"),
        ("flag-index", ">index<"),
        ("flag-forum", ">forum<"),
        ("flag-crucible", ">crucible<"),
        ("flag-engine", ">the telos engine<"),
        ("flag-learn", ">learn<"),
    ):
        assert f'id="{fid}"' in src
        assert name in src
    # links to each flagship page
    for href in ("gather.html", "index-graph.html", "forum.html", "crucible.html", "studio.html", "learn.html"):
        assert f'href="{href}"' in src


def test_public_safe_private_line_is_listed_on_home() -> None:
    src = index_source()
    assert "Private-line flagships, public where safe." in src
    for repo in ("HarperZ9/aleph", "HarperZ9/orca", "HarperZ9/kun", "HarperZ9/behavior-transform.io"):
        assert repo in src
    for name in ("Gate", "Runtime", "Vault", "Boundary", "Lab", "Ledger"):
        assert name in src
    assert "Lab and Ledger remain private/proprietary" in src


def test_aleph_page_presents_private_line_platform_contract() -> None:
    src = ALEPH.read_text(encoding="utf-8")
    assert ALEPH_HERO.is_file()
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


def test_no_em_or_en_dashes_in_home_and_system() -> None:
    for path in (INDEX, HOME_CSS, RIBBON, SCROLL):
        text = path.read_text(encoding="utf-8")
        assert EM_DASH not in text, f"em-dash in {path.name}"
        assert EN_DASH not in text, f"en-dash in {path.name}"
