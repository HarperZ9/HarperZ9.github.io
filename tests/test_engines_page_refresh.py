"""Contracts for the identity-first Engines route."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "overview.html"
STYLES = ROOT / "system" / "engines.css"
SYSTEMS = ROOT / "system" / "systems.json"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def systems_by_id() -> dict[str, dict]:
    payload = json.loads(read(SYSTEMS))
    return {record["id"]: record for record in payload["systems"]}


def test_engines_page_is_an_identity_first_capability_map() -> None:
    page = read(PAGE)

    assert "Zain Dana Harper" in page
    assert "Zentropy Labs" in page
    assert page.index("Zentropy Labs") < page.index("Flywheel")
    assert '<body class="inner-clean engines-page">' in page
    assert 'href="system/engines.css?v=20260828"' in page
    assert 'class="engine-rail"' in page
    assert 'aria-labelledby="engine-rail-title"' in page
    assert 'class="engine-rail__fallback"' in page

    for stale in (
        "Project Telos",
        "The fourteen engines",
        "Built as a field guide, not a funnel",
        'class="eyebrow"',
        'class="scenarios',
        'class="scenario',
    ):
        assert stale not in page


def test_engines_page_routes_to_core_retro_proof_and_work() -> None:
    page = read(PAGE)

    required_routes = (
        "flywheel.html",
        "retro.html",
        "engine-revival.html",
        "brender-archival.html",
        "figures/system-capability-map.html",
        "figures/verification-capability-map.html",
        "demonstrations.html",
        "catalog.html",
        "hire.html",
    )
    for route in required_routes:
        assert f'href="{route}"' in page, route

    for label in (
        "Flywheel",
        "Retro Engine",
        "Engine Revival",
        "BRender Archival",
        "Preserve",
        "Verify",
        "Play",
        "Reuse",
    ):
        assert label in page


def test_engines_page_release_facts_match_the_system_registry() -> None:
    page = read(PAGE)
    systems = systems_by_id()

    for system_id in (
        "flywheel",
        "index",
        "gather",
        "forum",
        "crucible",
        "relay",
        "plexus",
        "mneme",
        "studio-engine",
        "retro-engine",
        "engine-revival",
        "brender-archival",
    ):
        record = systems[system_id]
        assert record["href"] in page, system_id
        assert record["purpose"] in page, system_id
        assert f'data-system-id="{system_id}"' in page, system_id

    flywheel_evidence = systems["flywheel"]["evidence"][0]
    assert flywheel_evidence["label"] in page
    assert flywheel_evidence["href"] in page
    assert systems["flywheel"]["lastVerified"] in page


def test_engines_styles_use_a_readable_rail_not_a_dashboard_card_grid() -> None:
    css = read(STYLES)

    for selector in (
        ".engines-intro",
        ".engine-rail",
        ".engine-rail__track",
        ".engine-family",
        ".retro-transfer",
        ".engines-proof-list",
    ):
        assert selector in css

    for banned in (
        "text-transform:uppercase",
        "backdrop-filter",
        "box-shadow",
        "conic-gradient",
        "border-left:2px",
        "border-left:3px",
        "border-left:4px",
    ):
        assert banned not in css

    assert "@media (max-width: 760px)" in css
    assert "@media (forced-colors: active)" in css
    assert "@media print" in css
    assert re.search(r"\.engines-release h3\s*\{[^}]*color:\s*var\(--ink-paper\)", css, re.S)
    assert not re.search(r"font-size:\s*clamp\([^)]*,\s*[^,]+,\s*(?:[7-9]|\d{2,})rem", css)
