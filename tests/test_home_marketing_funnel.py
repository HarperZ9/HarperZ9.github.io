"""Contracts for the product-first Zentropy Labs homepage."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HOME_SOURCE = ROOT / "home" / "src" / "App.tsx"
HOME_CSS = ROOT / "home" / "src" / "App.css"
HOME_INDEX = ROOT / "home" / "index.html"
SYSTEMS = ROOT / "system" / "systems.json"
CANONICAL_META_DESCRIPTION = (
    "Zentropy Labs is a product studio by Zain Dana Harper. Explore products first, "
    "then hiring routes, evidence, and research records."
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def normalized(text: str) -> str:
    return " ".join(text.split())


def main_component_order(source: str) -> list[str]:
    main = re.search(r'<main id="main">(?P<body>.*?)</main>', source, re.S)
    assert main, "home main order must remain inspectable"
    return re.findall(r"<([A-Z][A-Za-z0-9]*)\s*/>", main.group("body"))


def section(source: str, start_id: str, end_id: str) -> str:
    return source.split(f'id="{start_id}"', 1)[1].split(f'id="{end_id}"', 1)[0]


def array_items(source: str, array_name: str) -> list[str]:
    match = re.search(
        rf"const {array_name} = \[(?P<body>.*?)\](?:\.filter\([^;]+\))?;",
        source,
        re.S,
    )
    assert match, array_name
    return re.findall(r'"([^"]+)"', match.group("body"))


def test_home_places_products_and_hiring_before_supporting_evidence() -> None:
    source = read(HOME_SOURCE)
    hero = section(source, "identity", "products")

    assert "Zentropy Labs" in hero
    assert "Zain Dana Harper is the builder behind Zentropy Labs." in hero
    assert "Product studio, systems engineering, graphics, security tooling, and public research." in hero
    assert '<a className="btn solid" href="#products">Explore products</a>' in hero
    assert main_component_order(source) == [
        "IdentityHero",
        "ProductSelection",
        "FeaturedFlywheel",
        "HiringRoutes",
        "EvidenceBoard",
        "CapabilityOverview",
        "CurrentResearch",
        "RetroSystemsLab",
        "SecurityBoundary",
    ]


def test_home_defines_each_displayed_product_once_with_concrete_facts() -> None:
    source = read(HOME_SOURCE)
    records = {record["id"]: record for record in json.loads(read(SYSTEMS))["systems"]}
    representative_ids = array_items(source, "REPRESENTATIVE_IDS")
    graphics_ids = array_items(source, "GRAPHICS_IDS")

    products = section(source, "products", "flywheel")
    flywheel = section(source, "flywheel", "hiring-collaboration")
    graphics = section(source, "retro-systems-lab", "security-boundary")

    assert "flywheel" not in representative_ids
    assert products.count("{system.purpose}") == 1
    assert flywheel.count("{FLYWHEEL.purpose}") == 1
    assert graphics.count("{system.purpose}") == 1
    assert "says what the product does once" in products
    assert "<dt>Type</dt>" in source
    assert "<dt>State</dt>" in source
    assert "<dt>Verified</dt>" in source
    assert "<dt>Evidence</dt>" in source
    assert "architectureRole" not in source

    assert set(representative_ids) == {
        "index", "gather", "buildlang", "phantom", "accountable-surface"
    }
    assert set(graphics_ids) == {
        "raw", "skyrimbridge", "truth-enb", "elder-enb", "enb-runtime-core",
        "studio-engine", "retro-engine", "engine-revival", "brender-archival",
    }
    for system_id in representative_ids + graphics_ids + ["flywheel"]:
        assert records[system_id]["purpose"].strip(), system_id
        assert records[system_id]["productType"].strip(), system_id
        assert records[system_id]["inputs"], system_id
        assert records[system_id]["outputs"], system_id


def test_home_uses_checked_in_route_registry_and_evidence_projection() -> None:
    source = read(HOME_SOURCE)

    assert 'from "./site-routes"' in source
    assert 'from "./system-registry"' in source
    assert 'from "../site/evidence-stream.json?raw"' in source
    assert 'derivedFrom: "harperz9-systems/v4"' in source
    assert "PRIMARY_ROUTES.map" in source
    assert "SECONDARY_GROUPS.flatMap" in source
    assert "routeFamily(route.href)" in source


def test_home_uses_real_figures_with_units_and_limitations() -> None:
    source = read(HOME_SOURCE)
    css = read(HOME_CSS)

    for route in (
        "/analytics/model-pass-at-1-comparison.html",
        "/analytics/current-cross-harness-pilot.html",
        "/figures/recovered-actions-by-day.svg",
        "/figures/recovered-actions-by-day.json",
        "/figures/motive-sample-nonexclusive.svg",
        "/figures/motive-sample-nonexclusive.json",
    ):
        assert route in source

    assert "Same task set and harness" in source
    assert "4/4 receipts verified" in source
    assert "Unit: recovered logged actions" in source
    assert "Categories overlap" in source
    assert "What this does not prove" in source
    assert "Capability families remain navigation labels, not diagrams" in source
    assert "<table" in source
    assert "<caption>" in source
    assert '<th scope="row">' in source
    assert "data-plate" in css
    assert "evidence-table" in css
    assert "evidence-figure-grid" in css


def test_home_metadata_and_noscript_follow_the_same_product_funnel() -> None:
    template = read(HOME_INDEX)
    head = template.split("</head>", 1)[0]
    fallback = template.split("<noscript>", 1)[1].split("</noscript>", 1)[0]

    for value in (
        "<title>Zentropy Labs | Products by Zain Dana Harper</title>",
        f'<meta name="description" content="{CANONICAL_META_DESCRIPTION}" />',
        f'<meta property="og:description" content="{CANONICAL_META_DESCRIPTION}" />',
        f'<meta name="twitter:description" content="{CANONICAL_META_DESCRIPTION}" />',
    ):
        assert value in head

    for value in (
        "Zentropy Labs is a product studio and public brand built by Zain Dana Harper.",
        "Products to start with",
        "Featured platform: Flywheel",
        "Hiring, contracting, and collaboration",
        "Evidence board",
        "Measured evidence",
        "Current research",
    ):
        assert value in fallback

    assert fallback.index("Products to start with") < fallback.index("Featured platform: Flywheel")
    assert fallback.index("Featured platform: Flywheel") < fallback.index("Hiring, contracting, and collaboration")
    assert fallback.index("Hiring, contracting, and collaboration") < fallback.index("Evidence board")
    assert "workshop behind Flywheel" not in fallback


def test_home_visual_and_accessibility_floor_is_responsive() -> None:
    css = read(HOME_CSS)
    index_css = read(ROOT / "home" / "src" / "index.css")

    title = re.search(r"\.hero-title\s*\{(?P<body>[^}]*)\}", css)
    art = re.search(r"\.identity-art\s+img\s*\{(?P<body>[^}]*)\}", css)
    assert title and "clamp(3rem, 6vw, 5.25rem)" in title.group("body")
    assert art and "object-fit:contain" in normalized(art.group("body"))
    assert "@media (forced-colors: active)" in css
    assert "@media (prefers-reduced-motion: reduce)" in css
    assert "@media (max-width: 760px)" in css
    assert "overflow-x: clip" in index_css
    assert "min-height:44px" in normalized(css)
    assert "max-width:min(22rem, calc(100vw - 1.5rem))" in normalized(css)


def test_home_avoids_retired_jargon_and_false_hierarchy() -> None:
    source = read(HOME_SOURCE)
    for retired in (
        "orientation / artifact / claim / proof / route",
        "Route->Verify->Receipt->Reuse",
        "The fourteen engines",
        "Flywheel is the primary public system",
        "Aeterna",
        "hero-kicker",
        "section-kicker",
        "eyebrow",
    ):
        assert retired not in source
