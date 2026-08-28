"""Contracts for the public-safe private capability pages."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CAPABILITY_ROUTES = (
    "array.html",
    "seed.html",
    "sofer.html",
    "isomorph.html",
    "bounds.html",
    "kun.html",
    "aeterna.html",
)
FORBIDDEN_PUBLIC_MARKERS = (
    re.compile(r"(?i)(?<![a-z0-9])[a-z]:[/\\]+(?:users|dev|program files)[/\\]+"),
    re.compile(r"(?i)file:///(?:[a-z]:[/\\]+|users/|home/)"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bghp_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}"),
)


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def route_registry() -> dict[str, object]:
    source = read("system/routes.js")
    match = re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', source)
    assert match, "generated route registry JSON is missing"
    return json.loads(json.loads(match.group(1)))


def system_registry() -> dict[str, object]:
    return json.loads(read("system/systems.json"))


def test_private_capability_pages_exist_and_publish_only_boundary_level_copy() -> None:
    for route in CAPABILITY_ROUTES:
        source = read(route)
        slug = route.removesuffix(".html")
        assert f'data-capability-page="{slug}"' in source
        assert f'<link rel="canonical" href="https://harperz9.github.io/{route}">' in source
        assert "system/nav.js?v=20260828-site-design" in source
        assert "system/private-capability.css?v=20260828-site-design" in source
        assert '<svg role="img"' in source
        assert "aria-labelledby=" in source
        assert "<figcaption>" in source
        assert "controlled" in source.lower()
        assert "boundary" in source.lower()
        assert "private" in source.lower()
        for marker in FORBIDDEN_PUBLIC_MARKERS:
            assert not marker.search(source), f"{route} contains {marker.pattern}"


def test_controlled_material_boundary_is_explicit_on_ai_red_team_and_campaign_pages() -> None:
    isomorph = read("isomorph.html")
    for phrase in (
        "No live jailbreak corpora",
        "bypass payloads",
        "exploit chains",
        "target-specific techniques",
        "provider-specific recipes",
        "approved private or embargoed",
    ):
        assert phrase in isomorph

    array = read("array.html")
    for phrase in (
        "Targets, payloads, credentials",
        "exploit chains",
        "engagement findings are not published",
        "approved private or embargoed recipient channel",
    ):
        assert phrase in array


def test_access_recovery_and_graphics_pages_do_not_publish_unsafe_instructions() -> None:
    kun = read("kun.html")
    for phrase in (
        "No raw credentials",
        "credential recovery instructions",
        "No credential recovery instructions are published",
        "No bypass guidance",
    ):
        assert phrase in kun

    aeterna = read("aeterna.html")
    for phrase in (
        "No anti-cheat, bypass, or target-specific instructions",
        "No unauthorized instrumentation",
        "omits loader details",
    ):
        assert phrase in aeterna


def test_capability_routes_are_visible_from_navigation_catalog_and_sitemap() -> None:
    registry = route_registry()
    security_routes = {
        route["href"]
        for family in registry["families"]
        if family["label"] == "Security"
        for route in family["routes"]
    }
    assert set(CAPABILITY_ROUTES) <= security_routes

    sitemap = read("sitemap.xml")
    security = read("security.html")
    practice = read("private-practice.html")
    catalog = read("catalog.html")
    for route in CAPABILITY_ROUTES:
        assert f"https://harperz9.github.io/{route}" in sitemap
        assert f'href="{route}"' in security
        assert f'href="{route}"' in practice
        assert f'href="{route}"' in catalog


def test_system_registry_has_individual_controlled_private_records() -> None:
    registry = system_registry()
    records = {record["id"]: record for record in registry["systems"]}
    assert set(route.removesuffix(".html") for route in CAPABILITY_ROUTES) <= set(records)
    for route in CAPABILITY_ROUTES:
        slug = route.removesuffix(".html")
        record = records[slug]
        assert record["href"] == route
        assert record["sourceHref"] is None
        assert record["maturity"] == "controlled-private"
        assert record["accessMode"] == "request"
        assert record["primaryDomain"] == "security-privacy"
        assert "written" in record["boundary"].lower() or slug in {"kun", "aeterna", "bounds", "isomorph"}
        assert record["evidence"][0]["href"] == f"https://harperz9.github.io/{route}"


def test_private_practice_constellation_includes_visual_and_nonvisual_fallbacks() -> None:
    source = read("private-practice.html")
    assert '<svg role="img" aria-labelledby="practice-map-title practice-map-desc"' in source
    assert "The constellation is an intake map, not an operational diagram." in source
    for label in ("Array", "Seed", "Sofer", "Isomorph", "Bounds", "Kun", "Aeterna", "ORCA", "Gate"):
        assert label in source
