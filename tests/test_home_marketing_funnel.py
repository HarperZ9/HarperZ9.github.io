"""Contracts for the evidence-led portfolio home funnel."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_home_source_uses_the_verified_fourteen_engine_roster() -> None:
    source = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    match = re.search(r"const ENGINES: Engine\[\] = \[(?P<body>.*?)\n\];", source, re.S)
    assert match, "home source must define the engine roster"
    assert re.findall(r'name: "([^"]+)"', match.group("body")) == [
        "flywheel",
        "telos",
        "index",
        "gather",
        "forum",
        "crucible",
        "emet",
        "buildlang",
        "learn",
        "relay",
        "plexus",
        "mneme",
        "studio-engine",
        "build color",
    ]
    assert "Fourteen engines" in source
    assert "Flywheel thesis" in source
    assert 'name: "calibrate pro"' not in source.lower()


def test_home_source_preserves_the_living_shader_identity() -> None:
    source = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    for value in (
        "<GroundField />",
        "<LogoField />",
        "<Emphasis",
        "/system/cursor-field.js",
    ):
        assert value in source
    for filename in ("GroundField.tsx", "LogoField.tsx", "Emphasis.tsx"):
        assert (ROOT / "home" / "src" / filename).is_file()


def test_home_source_mirror_matches_current_maturity_and_design_positioning() -> None:
    source = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    template = (ROOT / "home" / "index.html").read_text(encoding="utf-8")

    for value in (
        "Telos 0.2.0",
        "Plexus 0.2.0",
        "AI-assisted design workflows",
        "Poster design and composition",
        "native rendering",
        "neural-network media",
        "/studio.html?source=poster",
    ):
        assert value in source

    assert "Plexus 0.1.0" not in source
    assert "poster design" in template
    assert "img/og/portfolio-home.png" in template


def test_home_source_names_current_recorded_workflows() -> None:
    source = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    for value in (
        "Index 2.9.0",
        "Gather 1.6.1",
        "Forum 1.13.0",
        "Crucible 1.2.0",
        "/demo-index.html",
        "/demo-gather.html",
        "/demo-forum.html",
        "/demo-crucible.html",
        "/demonstrations.html",
        "Recorded workflows",
        "Available for paid work",
    ):
        assert value in source


def test_home_uses_native_demo_posters() -> None:
    source = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    for value in (
        "/media/demos/index/index-demo-poster.png",
        "/media/demos/gather/gather-workflow-short-poster.png",
        "/media/demos/forum/forum-demo-short-poster.png",
        "/media/demos/crucible/crucible-workflow-short-poster.png",
    ):
        assert value in source


def test_recorded_workflow_layout_has_mobile_and_reduced_motion_rules() -> None:
    css = (ROOT / "home" / "src" / "App.css").read_text(encoding="utf-8")
    assert ".recorded-list" in css
    assert ".recorded-shot" in css
    assert "prefers-reduced-motion: reduce" in css
    assert "@media (max-width: 760px)" in css


def test_home_hero_display_size_is_capped_at_six_rem() -> None:
    css = (ROOT / "home" / "src" / "App.css").read_text(encoding="utf-8")
    match = re.search(r"\.hero-title\s*\{(?P<body>[^}]*)\}", css)
    assert match, "home stylesheet must define the hero title"
    rule = match.group("body")
    assert "var(--step-5)" not in rule
    cap = re.search(r"font-size:\s*clamp\([^;]+,\s*([0-9.]+)rem\)\s*;", rule)
    assert cap
    assert float(cap.group(1)) <= 6


def test_generated_output_preserves_current_social_metadata() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    expected_metadata = (
        "<title>Project Telos: Fourteen engines, one Flywheel thesis</title>",
        '<meta property="og:title" content="Project Telos: Fourteen engines, one Flywheel thesis" />',
        '<link rel="canonical" href="https://harperz9.github.io/" />',
        '<meta property="og:image" content="https://harperz9.github.io/img/og/portfolio-home.png" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:image" content="https://harperz9.github.io/img/og/portfolio-home.png" />',
    )
    for value in expected_metadata:
        assert value in html

    assert (ROOT / "img" / "og" / "portfolio-home.png").is_file()
    assert "img/og/telos.png" not in html


def test_generated_bundle_contains_all_recorded_workflows() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    match = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
    assert match, "generated home must reference its Vite bundle"
    bundle = (ROOT / match.group(1).lstrip("/")).read_text(encoding="utf-8")
    for value in (
        "Recorded workflows",
        "Available for paid work",
        "Fourteen engines",
        "Flywheel thesis",
        "Build Color 1.0.2",
        "/system/cursor-field.js",
        "Index 2.9.0",
        "Gather 1.6.1",
        "Forum 1.13.0",
        "Crucible 1.2.0",
        "/demo-index.html",
        "/demo-gather.html",
        "/demo-forum.html",
        "/demo-crucible.html",
        "/media/demos/index/index-demo-poster.png",
        "/media/demos/gather/gather-workflow-short-poster.png",
        "/media/demos/forum/forum-demo-short-poster.png",
        "/media/demos/crucible/crucible-workflow-short-poster.png",
        "/demonstrations.html",
    ):
        assert value in bundle
    assert "calibrate pro" not in bundle.lower()
