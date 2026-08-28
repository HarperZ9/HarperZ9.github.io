"""Contracts for the Zain and Zentropy Labs homepage funnel."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HOME_SOURCE = ROOT / "home" / "src" / "App.tsx"
HOME_CSS = ROOT / "home" / "src" / "App.css"
HOME_INDEX = ROOT / "home" / "index.html"
SYSTEMS = ROOT / "system" / "systems.json"
FEED = ROOT / "feed.json"
RETRO = ROOT / "media" / "retro-systems-lab" / "evidence-manifest.json"

SECTION_SEQUENCE = [
    "identity",
    "flywheel",
    "evidence",
    "evidence-figures",
    "representative",
    "research",
    "retro-systems-lab",
    "security-boundary",
    "hiring-collaboration",
]

PROHIBITED_HOME_PATTERNS = (
    "orientation / artifact / claim / proof / route",
    "Recorded workflows",
    "Try four browser-native checks",
    "hero-kicker",
    "section-kicker",
    "section-label",
    "eyebrow",
    "overline",
    "kicker",
    "pseudo-dashboard",
    "viewport-vignette",
    "ground-field",
    "row-index",
    "Project Telos",
    "Fourteen systems",
    "route -> verify -> receipt -> reuse",
    "Route→Verify",
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def normalized(text: str) -> str:
    return " ".join(text.split())


def test_home_source_uses_identity_first_section_sequence() -> None:
    source = read(HOME_SOURCE)
    positions = []
    for section_id in SECTION_SEQUENCE:
        needle = f'id="{section_id}"'
        assert needle in source, f"homepage lost section {section_id}"
        positions.append(source.index(needle))

    assert positions == sorted(positions), "homepage sections must follow the adopted sequence"
    hero_lines = re.findall(
        r'<(?:h1|p) className="[^"]*hero[^"]*"[^>]*>(?P<text>.*?)</(?:h1|p)>',
        source,
        re.S,
    )
    assert hero_lines[:3] == [
        "Zain Dana Harper",
        "Systems engineering, security tooling, graphics, and public research.",
        "Zentropy Labs is the workshop behind Flywheel and the wider body of work.",
    ]
    assert "Systems Engineer | AI Evaluation, Developer Tools, and Technical Operations" not in source
    assert 'href="#evidence-figures"' in source
    assert ">Explore the work" in source
    assert 'href="/hire.html"' in source
    assert ">Hire or collaborate" in source


def test_home_source_removes_template_tropes_and_home_lead_ins() -> None:
    source = read(HOME_SOURCE)
    css = read(HOME_CSS)
    combined = f"{source}\n{css}"

    for pattern in PROHIBITED_HOME_PATTERNS:
        assert pattern not in combined, f"homepage still contains {pattern!r}"

    assert "const ENGINES" not in source
    assert "RECORDED_WORKFLOWS" not in source
    assert "GateDemo" not in source
    assert "ProofPacket" not in source
    assert "WitnessedIndependence" not in source
    assert "EmetWitness" not in source
    assert "Picker" not in source
    assert "GroundField" not in source
    assert "ZentropyDisplay" not in combined
    assert "radial-gradient" not in combined
    assert "padStart(2" not in source
    assert ".card-grid" not in css
    assert ".dashboard" not in css


def test_home_uses_checked_in_registry_feed_and_retro_manifest() -> None:
    source = read(HOME_SOURCE)
    systems = json.loads(read(SYSTEMS))
    feed = json.loads(read(FEED))
    retro = json.loads(read(RETRO))

    assert 'from "../../system/systems.json"' in source
    assert 'from "../../feed.json"' in source
    assert 'from "../../media/retro-systems-lab/evidence-manifest.json"' in source

    primary = [
        system["id"]
        for system in systems["systems"]
        if system.get("architectureRole") == "primary-platform"
    ]
    assert primary == ["flywheel"]
    assert systems["systems"][0]["id"] == "flywheel"
    assert 'architectureRole === "primary-platform"' in source
    assert "featuredPlatform.entryCommand" in source
    assert systems["systems"][0]["entryCommand"] == "pip install flywheel-verify; flywheel up"

    assert feed["items"][0]["url"] == "https://harperz9.github.io/briefings/2026-08-26-openai-hugging-face-incident/"
    assert "currentBriefing.url" in source
    assert "hierarchy" not in retro
    for system_id in (
        "raw",
        "skyrimbridge",
        "truth-enb",
        "elder-enb",
        "enb-runtime-core",
        "studio-engine",
        "retro-engine",
        "engine-revival",
        "brender-archival",
    ):
        assert f'"{system_id}"' in source
    assert ".map(requireSystem)" in source
    assert "retroManifest.brenderArchival.nativeCTestTargets" in source
    for value in ("interactive browser studio", "archive and revival tooling", "focused BRender restoration lab"):
        assert value in json.dumps(retro)


def test_home_uses_real_research_figures_and_primary_subject_navigation() -> None:
    source = read(HOME_SOURCE)
    systems = json.loads(read(SYSTEMS))
    assert "Measured evidence" in source
    assert "/figures/recovered-actions-by-day.svg" in source
    assert "/figures/recovered-actions-by-day.json" in source
    assert "/figures/motive-sample-nonexclusive.svg" in source
    assert "/figures/motive-sample-nonexclusive.json" in source
    assert "Decorative capability charts are not used as evidence" in source
    assert "capabilityRelations" not in source
    assert "relationship-map" not in source
    assert "/analytics/current-cross-harness-pilot.svg" in source
    assert "/analytics/current-cross-harness-pilot.html" in source
    assert "integration-failure profile" in source.lower()
    assert "0 valid comparable task outcomes" in source
    assert 'src="/analytics/exploratory-stack-comparison.svg"' not in source
    assert 'src="/analytics/model-pass-at-1-comparison.svg"' not in source
    assert "Historical benchmark archive" in source
    assert 'href="/analytics/exploratory-stack-comparison.html"' in source
    assert 'href="/analytics/model-pass-at-1-comparison.html"' in source
    assert "CAPABILITY_FAMILY_IDS" in source
    assert "system.primaryDomain === familyId" in source
    assert [domain["label"] for domain in systems["domains"]] == [
        "Agent systems",
        "Evaluation and verification",
        "Security and privacy",
        "Developer infrastructure",
        "Graphics and media",
        "Research and education",
    ]

    assert "Distinct private operational systems" in source
    assert "live bypass" not in source.lower()
    assert "exploit chain" not in source.lower()
    assert "target-specific" not in source.lower()


def test_home_evidence_board_contains_accessible_data_visualization_primitives() -> None:
    source = read(HOME_SOURCE)
    css = read(HOME_CSS)

    assert "Evidence board" in source
    assert "<table" in source
    assert "<caption>" in source
    assert '<th scope="row">' in source
    assert "research-figure-image" in source
    assert "data-plate" in css
    assert "evidence-table" in css
    assert "evidence-figure-grid" in css
    assert "What this does not prove" in source
    assert "no color-only" in normalized(source).lower()


def test_home_metadata_and_noscript_mirror_follow_the_same_front_door() -> None:
    template = read(HOME_INDEX)
    expected = (
        "Zain Dana Harper and Zentropy Labs: systems engineering, security tooling, "
        "graphics, public research, Flywheel, and hiring routes."
    )
    assert len(expected) <= 158
    assert f'<meta name="description" content="{expected}" />' in template
    assert f'<meta property="og:description" content="{expected}" />' in template
    assert f'<meta name="twitter:description" content="{expected}" />' in template

    noscript = re.search(r"<noscript>(?P<body>.*?)</noscript>", template, re.S)
    assert noscript, "home template must carry a no-JS fallback"
    fallback = noscript.group("body")
    for value in (
        "Zain Dana Harper",
        "Systems engineering, security tooling, graphics, and public research.",
        "Zentropy Labs is the workshop behind Flywheel and the wider body of work.",
        "Explore the work",
        "Hire or collaborate",
        "Featured platform: Flywheel",
        "Evidence board",
        "Measured evidence",
        "Graphics, engines, and preservation",
        "Security boundary",
        "Hiring and collaboration",
    ):
        assert value in fallback

    for href in (
        "/hire.html",
        "/resume.html",
        "/flywheel.html",
        "/catalog.html",
        "/retro.html",
        "/security.html",
        "/briefings/2026-08-26-openai-hugging-face-incident/",
        "https://github.com/HarperZ9",
    ):
        assert f'href="{href}"' in fallback


def test_home_hero_display_and_visual_system_are_restrained() -> None:
    css = read(HOME_CSS)
    title = re.search(r"\.hero-title\s*\{(?P<body>[^}]*)\}", css)
    assert title, "home stylesheet must define the hero title"
    body = title.group("body")
    assert "clamp(3rem, 6vw, 5.25rem)" in body
    assert "7.40rem" not in body
    assert "text-transform: none" in body
    art_image = re.search(r"\.identity-art\s+img\s*\{(?P<body>[^}]*)\}", css)
    assert art_image, "home stylesheet must define contained identity artwork"
    art_body = art_image.group("body")
    assert re.search(r"object-fit\s*:\s*contain", art_body)
    assert not re.search(r"object-fit\s*:\s*cover", art_body)

    assert "@media (forced-colors: active)" in css
    assert "@media (prefers-reduced-motion: reduce)" in css
    assert "@media (max-width: 760px)" in css
    assert "overflow-x: clip" in read(ROOT / "home" / "src" / "index.css")


def test_home_and_static_routes_share_the_same_primary_navigation_spine() -> None:
    source = read(HOME_SOURCE)
    topnav = re.search(
        r'<div className="topnav-links">(?P<body>.*?)</div>',
        source,
        re.S,
    )
    assert topnav
    labels = re.findall(r'<a [^>]*>([^<]+)</a>', topnav.group("body"))
    assert labels == [
        "Hire / work",
        "Systems",
        "Research",
        "The Studio",
        "Gallery",
        "Retro Engine",
        "GitHub",
    ]


def test_home_mobile_menu_reuses_primary_routes_without_narrow_viewport_overflow() -> None:
    source = read(HOME_SOURCE)
    css = read(HOME_CSS)
    desktop = re.search(r'<div className="topnav-links">(?P<body>.*?)</div>', source, re.S)
    mobile = re.search(
        r'<details className="home-menu">(?P<body>.*?)</details>',
        source,
        re.S,
    )
    assert desktop and mobile
    assert "<summary>Menu</summary>" in mobile.group("body")
    desktop_routes = re.findall(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', desktop.group("body"))
    mobile_routes = re.findall(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', mobile.group("body"))
    assert mobile_routes == desktop_routes

    base_menu = re.search(r"\.home-menu\s*\{(?P<body>[^}]*)\}", css)
    mobile_css = css.split("@media (max-width: 760px){", 1)[1].split("@media (max-width: 520px){", 1)[0]
    mobile_links = re.search(r"\.topnav-links\s*\{(?P<body>[^}]*)\}", mobile_css)
    mobile_menu = re.search(r"\.home-menu\s*\{(?P<body>[^}]*)\}", mobile_css)
    assert base_menu and "display:none" in normalized(base_menu.group("body"))
    assert mobile_links and "display:none" in normalized(mobile_links.group("body"))
    assert mobile_menu and "display:block" in normalized(mobile_menu.group("body"))
    assert css.count("min-height:44px") >= 2
    assert "max-width:min(22rem, calc(100vw - 1.5rem))" in normalized(css)
