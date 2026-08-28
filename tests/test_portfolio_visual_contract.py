"""Visual and static fallback contracts for the React homepage."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HOME_INDEX = ROOT / "home" / "index.html"
APP = ROOT / "home" / "src" / "App.tsx"
APP_CSS = ROOT / "home" / "src" / "App.css"
INDEX_CSS = ROOT / "home" / "src" / "index.css"

EM_DASH = "—"
EN_DASH = "–"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def deployed_assets() -> tuple[Path, Path]:
    src = read(INDEX)
    js_match = re.search(r'src="/(?P<asset>assets/index-[\w-]+\.js)"', src)
    css_match = re.search(r'href="/(?P<asset>assets/index-[\w-]+\.css)"', src)
    assert js_match, "deployed homepage must reference one hashed JavaScript bundle"
    assert css_match, "deployed homepage must reference one hashed CSS bundle"
    return ROOT / js_match.group("asset"), ROOT / css_match.group("asset")


def test_home_loads_the_react_shell_and_shared_readable_floor() -> None:
    for path in (INDEX, HOME_INDEX):
        src = read(path)
        assert 'data-home-shell="react"' in src
        assert '<div id="root"></div>' in src
        assert "home-readable.css" in src
        assert "styles.css" not in src


def test_noscript_fallback_is_a_complete_identity_first_front_door() -> None:
    src = read(HOME_INDEX)
    assert "<noscript>" in src
    for value in (
        "Zain Dana Harper",
        "Zentropy Labs",
        "Systems engineering, security tooling, graphics, and public research.",
        "Featured platform: Flywheel",
        "Evidence board",
        "Capability constellation",
        "Representative work",
        "Current research",
        "Retro Systems Lab",
        "Security boundary",
        "Hiring and collaboration",
    ):
        assert value in src

    assert "Flywheel is the primary public system" not in src
    assert "route -> verify -> receipt -> reuse" not in src.lower()
    assert "fourteen independently published verification systems" not in src.lower()


def test_home_source_and_styles_have_no_decorative_home_lead_ins() -> None:
    combined = "\n".join(read(path) for path in (HOME_INDEX, APP, APP_CSS, INDEX_CSS))

    for value in (
        "hero-kicker",
        ".kicker",
        "section-kicker",
        "section-label",
        "eyebrow",
        "overline",
        "orientation / artifact",
        "viewport-vignette",
        "ground-field",
        "row-index",
    ):
        assert value not in combined

    assert "ZentropyDisplay" not in combined
    assert "Project Telos" not in combined
    assert "brand-wordmark" not in combined
    assert "brand-route" not in combined
    assert "radial-gradient" not in combined


def test_home_visual_system_uses_evidence_plates_not_floating_dashboards() -> None:
    css = read(APP_CSS)

    assert ".identity-art" in css
    assert ".data-plate" in css
    assert ".evidence-table" in css
    assert ".visualization-diagram" in css
    assert ".node-constellation" in css
    assert ".flow-line" in css
    assert ".hero-card" not in css
    assert ".release-card" not in css
    assert ".workflow" not in css
    assert "conic-gradient" not in css


def test_deployed_bundle_matches_the_new_front_door_after_build() -> None:
    js_path, css_path = deployed_assets()
    bundle = read(js_path)
    css = read(css_path)

    for value in (
        "Zain Dana Harper",
        "Zentropy Labs is the workshop behind Flywheel and the wider body of work.",
        "Capability constellation",
        "Retro Systems Lab",
        "Security boundary",
        "Hiring and collaboration",
    ):
        assert value in bundle

    for stale in ("hero-kicker", "Recorded workflows", "Try four browser-native checks", "Project Telos"):
        assert stale not in bundle

    assert "data-plate" in css
    assert "visualization-diagram" in css
    assert "hero-kicker" not in css


def test_no_em_or_en_dashes_in_home_sources_and_deployed_assets() -> None:
    paths = [HOME_INDEX, APP, APP_CSS, INDEX_CSS, INDEX]
    paths.extend(deployed_assets())
    for path in paths:
        text = read(path)
        assert EM_DASH not in text, f"em-dash in {path.name}"
        assert EN_DASH not in text, f"en-dash in {path.name}"
