from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse


ROOT = Path(__file__).resolve().parents[2]

REQUIRED_ROUTES = (
    "index.html",
    "flywheel.html",
    "catalog.html",
    "security.html",
    "private-practice.html",
    "phantom.html",
    "accountable-surface.html",
    "systems/behavior-transform.html",
    "retro.html",
    "engine-revival.html",
    "brender-archival.html",
    "publications.html",
    "briefings/index.html",
    "briefings/2026-08-26-openai-hugging-face-incident/index.html",
    "figures/system-capability-map.html",
    "figures/security-capability-map.html",
    "figures/verification-capability-map.html",
    "figures/graphics-retro-capability-map.html",
)

REQUIRED_SYSTEMS = {
    "flywheel",
    "index",
    "gather",
    "forum",
    "crucible",
    "emet",
    "phantom",
    "behavior-transform",
    "authorized-private-practice",
    "accountable-surface",
    "proof-surface",
    "retro-engine",
    "engine-revival",
    "brender-archival",
}

INCIDENT_FIGURES = {
    "recovered-actions-by-day",
    "incident-multilane-timeline",
    "source-scope-matrix",
    "task-overrepresentation",
    "motive-sample-nonexclusive",
    "control-boundary-flow",
    "claim-provenance-panel",
}

PUBLIC_SCAN_ROOTS = (
    "index.html",
    "flywheel.html",
    "catalog.html",
    "security.html",
    "private-practice.html",
    "phantom.html",
    "accountable-surface.html",
    "systems",
    "system",
    "figures",
    "briefings",
    "media/retro-systems-lab",
    "security-tools.json",
    "sitemap.xml",
    "feed.xml",
    "feed.json",
    "robots.txt",
)

SECRET_OR_OWNER_LOCAL_MARKERS = (
    re.compile(r"(?i)(?<![a-z0-9])[a-z]:[/\\]+(?:users|dev|program files)[/\\]+"),
    re.compile(r"(?i)file:///(?:[a-z]:[/\\]+|users/|home/)"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bghp_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
)

CONTROLLED_PUBLIC_FORBIDDEN = (
    "live jailbreak corpus",
    "exploit chain",
    "bypass payload",
    "target-specific technique",
    "credential value",
    "command sequence",
)


def _text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def _json(relative: str):
    return json.loads(_text(relative))


def _asset_paths(source: str) -> set[str]:
    return {
        urlparse(match.group(1)).path.lstrip("/")
        for match in re.finditer(r"""(?:src|href)=["'](/(?:assets|system|img)/[^"']+)["']""", source)
    }


def _resolve_internal_href(current: str, href: str) -> str | None:
    parsed = urlparse(href)
    if parsed.scheme in {"mailto", "tel"}:
        return None
    if parsed.scheme or parsed.netloc:
        return None
    if href.startswith("#"):
        return None
    joined = urljoin(current, href)
    path = urlparse(joined).path.lstrip("/")
    if not path or path.endswith("/"):
        path = f"{path}index.html"
    return path


def _scan_candidates() -> list[Path]:
    candidates: list[Path] = []
    for relative in PUBLIC_SCAN_ROOTS:
        path = ROOT / relative
        if path.is_file():
            candidates.append(path)
        elif path.is_dir():
            candidates.extend(
                item
                for item in path.rglob("*")
                if item.is_file()
                and item.suffix.lower() in {".html", ".json", ".js", ".css", ".svg", ".xml", ".txt", ".md"}
            )
    return sorted(set(candidates))


def test_required_live_routes_and_assets_exist() -> None:
    for route in REQUIRED_ROUTES:
        assert (ROOT / route).is_file(), route

    home = _text("index.html")
    assert "<title>Flywheel: model-neutral agent workbench and public evidence atlas</title>" in home
    assert "Flywheel is the primary public system" in home
    assert "Route -&gt; Verify -&gt; Receipt -&gt; Reuse" in home or "Route -> Verify -> Receipt -> Reuse" in home
    assert "Capability families" in home
    assert "Run, inspect, or verify" in home
    assert "Current briefing" in home

    for asset in _asset_paths(home):
        assert (ROOT / asset).is_file(), asset


def test_system_registry_keeps_flywheel_primary_and_private_security_bounded() -> None:
    registry = _json("system/systems.json")
    assert registry["schema"] == "harperz9-systems/v2"
    records = {record["id"]: record for record in registry["systems"]}
    assert REQUIRED_SYSTEMS <= set(records)

    primary = [record["id"] for record in records.values() if record["architectureRole"] == "primary-platform"]
    assert primary == ["flywheel"]
    assert records["flywheel"]["name"] == "Flywheel"
    assert records["flywheel"]["maturity"] == "shipped"
    assert records["flywheel"]["evidence"][0]["label"] == "Flywheel v0.3.10"
    assert {"engine-revival", "brender-archival", "retro-engine"} <= set(records["flywheel"]["related"])

    private = records["authorized-private-practice"]
    assert private["architectureRole"] == "controlled-private-constellation"
    assert private["sourceHref"] is None
    assert private["accessMode"] == "request"
    assert "Written authorization" in private["boundary"]
    assert "No private repository" in " ".join(private["limitations"])

    for record in records.values():
        href = record.get("href")
        if href:
            target = _resolve_internal_href("index.html", href)
            if target is not None:
                assert (ROOT / target).is_file(), (record["id"], href)


def test_security_surface_names_public_tools_without_shipping_private_methods() -> None:
    registry = _json("security-tools.json")
    assert registry["schema"] == "harperz9-security-tools/v2"
    records = {record["slug"]: record for record in registry["records"]}
    for slug in ("emet", "phantom", "behavior-transform", "accountable-surface", "authorized-private-practice"):
        assert slug in records

    public_security = "\n".join(
        _text(path)
        for path in ("security.html", "private-practice.html", "phantom.html", "accountable-surface.html")
    ).lower()
    assert "authorization boundary" in public_security
    assert "written authorization first" in public_security
    for forbidden in CONTROLLED_PUBLIC_FORBIDDEN:
        assert forbidden not in public_security


def test_incident_briefing_and_figures_are_published_with_receipts_and_fallbacks() -> None:
    publication = _json("briefings/2026-08-26-openai-hugging-face-incident/publication.json")
    assert publication["schema"] == "harperz9-briefing-publication/v1"
    assert publication["siteStatus"] == "built"
    assert publication["social"]["x"]["status"] == "prepared"
    assert publication["social"]["linkedin"]["status"] == "prepared"
    assert publication["social"]["x"]["postUrl"] is None
    assert publication["social"]["linkedin"]["postUrl"] is None

    claims = _json("briefings/2026-08-26-openai-hugging-face-incident/claims.json")
    sources = _json("briefings/2026-08-26-openai-hugging-face-incident/sources.json")
    figures = _json("briefings/2026-08-26-openai-hugging-face-incident/figures.json")
    assert len(claims["claims"]) >= 45
    assert len(sources["sources"]) >= 12
    assert {wrapper["id"] for wrapper in figures["figures"]} >= INCIDENT_FIGURES

    for figure_id in INCIDENT_FIGURES:
        svg = _text(f"figures/{figure_id}.svg")
        fallback = _text(f"figures/{figure_id}.html")
        companion = _json(f"figures/{figure_id}.json")
        assert '<svg role="img"' in svg
        assert "<title" in svg and "<desc" in svg
        assert '<figure class="evidence-figure"' in fallback
        assert 'class="figure-table' in fallback
        assert "What this figure does not prove" in fallback
        assert companion["renderer"] == "telos-figure/v1"
        assert companion["figure"]["sources"]


def test_route_registry_and_sitemap_cover_the_capability_constellation() -> None:
    routes = _text("system/routes.js")
    sitemap = _text("sitemap.xml")
    home = _text("index.html")
    for route in (
        "flywheel.html",
        "figures/system-capability-map.html",
        "figures/security-capability-map.html",
        "figures/verification-capability-map.html",
        "figures/graphics-retro-capability-map.html",
        "private-practice.html",
        "engine-revival.html",
        "brender-archival.html",
        "briefings/2026-08-26-openai-hugging-face-incident/",
    ):
        route_file = f"{route}index.html" if route.endswith("/") else route
        assert (ROOT / route_file).is_file(), route
        assert route in routes or route in home or f"https://harperz9.github.io/{route}" in sitemap


def test_changed_live_artifacts_do_not_expose_secret_or_owner_local_markers() -> None:
    findings: list[str] = []
    for path in _scan_candidates():
        text = path.read_bytes().decode("utf-8", errors="ignore")
        normalized = re.sub(r"\\{2,}", r"\\", text)
        if any(pattern.search(candidate) for pattern in SECRET_OR_OWNER_LOCAL_MARKERS for candidate in (text, normalized)):
            findings.append(path.relative_to(ROOT).as_posix())
    assert not findings, "\n".join(findings)
