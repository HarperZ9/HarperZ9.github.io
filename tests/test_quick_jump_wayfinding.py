"""Contracts for the global Ctrl+K Quick-Jump search, 5-pillar wayfinding,
Wave 1 live metric sync, and harvested bodied lettering technique."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_search_index_structure_and_hygiene() -> None:
    path = ROOT / "system/search-index.json"
    assert path.exists(), "system/search-index.json must be generated"
    raw = path.read_text(encoding="utf-8")
    assert "\u2014" not in raw, "em dash found in system/search-index.json"
    assert not re.search(r"[A-Z]:\\\\", raw), "local Windows path found in search-index.json"
    assert "zentropy" not in raw.lower(), "retired name found in search-index.json"

    data = json.loads(raw)
    pillar_ids = [p["id"] for p in data["pillars"]]
    assert pillar_ids == ["start", "platforms", "demos", "research", "work"]
    assert data["count"] == len(data["items"])
    assert data["count"] >= 150, f"expected >= 150 indexed routes, got {data['count']}"

    hrefs = {item["u"] for item in data["items"]}
    for required in (
        "/",
        "/architecture.html",
        "/site-index.html",
        "/playground/",
        "/buildlang.html",
        "/flywheel.html",
        "/cmmns.html",
        "/research.html",
        "/publications.html",
        "/hire.html",
        "/portfolio.html",
        "/cv.html",
    ):
        assert required in hrefs, f"missing core route {required} in search-index.json"

    featured = [item for item in data["items"] if item.get("f")]
    assert len(featured) >= 12
    assert {item["p"] for item in featured} == set(pillar_ids)


def test_quick_jump_wired_into_both_shells() -> None:
    world_shell = (ROOT / "world/ui/shell/shell.js").read_text(encoding="utf-8")
    classic_nav = (ROOT / "system/nav.js").read_text(encoding="utf-8")
    qj_js = (ROOT / "system/quick-jump.js").read_text(encoding="utf-8")
    qj_css = (ROOT / "system/quick-jump.css").read_text(encoding="utf-8")

    assert "quick-jump.js" in world_shell
    assert "quick-jump.js" in classic_nav
    assert "initQuickJump" in qj_js
    assert "mountWorldBreadcrumb" in qj_js
    assert 'key === "k"' in qj_js
    assert 'key === "/"' in qj_js
    assert "prefers-reduced-motion" in qj_css
    assert "forced-colors" in qj_css


def test_site_index_and_research_five_pillar_wayfinding() -> None:
    site_index = (ROOT / "site-index.html").read_text(encoding="utf-8")
    assert 'class="directory-wayfinding"' in site_index
    assert "data-qj-open" in site_index
    for label in ("Start", "Platforms &amp; Tools", "Interactive Demos", "Research &amp; Writing", "Work With Me / CV"):
        assert label in site_index, f"missing 5-pillar card {label} in site-index.html"

    research = (ROOT / "research.html").read_text(encoding="utf-8")
    assert "architecture.html#datasets" in research
    assert "architecture.html#frontier" in research


def test_harvested_bodied_lettering_technique_registered() -> None:
    bodied = ROOT / "world/lettering/lib/techniques/bodied.mjs"
    letter = (ROOT / "world/lettering/lib/letter.mjs").read_text(encoding="utf-8")
    assert bodied.exists(), "harvested bodied.mjs technique missing"
    assert "'bodied'" in letter and "'fourier'" in letter


def test_wave1_verified_metrics_synced_in_architecture() -> None:
    arch = (ROOT / "architecture.html").read_text(encoding="utf-8")
    for token in (
        "98/102",
        "0/500",
        "356.5x",
        "0.0096 ms",
        "96/96",
        "24/24",
        "0xc29d75356434a10a",
        "forbid(unsafe_code)",
        "JFC-3P",
        "70.83%",
        "0.000244",
        "88 live own",
        "99 archived",
        "64 dead bundles",
        "Aurora",
        "435,306",
        "Sovereign",
        "WARDEN",
        "2.62M+",
        "WF-07",
        "WF-08",
    ):
        assert token in arch, f"expected verified metric or lineage token {token!r} in architecture.html"
    assert "\u2014" not in arch, "em dash detected in architecture.html"


def test_security_hierarchy_and_toolkit_recognized_cleanly() -> None:
    for rel in ("security.html", "security-toolkit.html"):
        text = (ROOT / rel).read_text(encoding="utf-8")
        assert "\u2014" not in text, f"em dash found in {rel}"
        assert ("zen" + "tropy") not in text.lower(), f"retired name found in {rel}"
        assert not re.search(r"(?i)\boperators?\b", text), f"forbidden operator wording in {rel}"
        assert not re.search(r"[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)", text), f"local path in {rel}"
        for name in (
            "Sovereign",
            "WARDEN",
            "Sofer",
            "ORCA",
            "Array",
            "Bounds",
            "Isomorph",
            "Aleph",
            "Kun",
            "Phantom",
            "EMET",
            "Proof Surface",
            "Crucible",
            "Secret Redact IO",
            "Agent Hook Pack",
            "Repo Proof Index",
        ):
            assert name in text, f"missing security hierarchy tool {name!r} in {rel}"
