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


def test_home_source_uses_the_approved_zentropy_identity() -> None:
    source = (ROOT / "home" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "zentropyLabs" in source
    assert "/brand/zentropy-logo.png" in source
    assert "Zentropy Labs" in source
    assert "<GroundField />" in source
    assert "<LogoField" not in source
    assert "<Emphasis" not in source
    assert "cursor-field.js" not in source
    assert (ROOT / "brand" / "zentropy-logo.png").is_file()
    assert (ROOT / "brand" / "ZentropyDisplay.ttf").is_file()
    for width in (640, 960, 1280, 1600):
        assert f"zentropy-logo-{width}.webp" in source
        assert (ROOT / "brand" / f"zentropy-logo-{width}.webp").is_file()
    assert 'sizes="(max-width: 980px) 100vw, 52vw"' in source

    css = (ROOT / "home" / "src" / "App.css").read_text(encoding="utf-8")
    hero_buttons = re.search(r"\.hero \.btn\s*\{(?P<body>[^}]*)\}", css)
    assert hero_buttons
    assert "border-radius: 0" in hero_buttons.group("body")
    assert "animation: none" in hero_buttons.group("body")

    brand = re.search(r"\.brand\s*\{(?P<body>[^}]*)\}", css)
    assert brand
    assert "min-block-size: 44px" in brand.group("body")
    assert 'aria-label="zentropyLabs / Project Telos — home"' in source
    assert "@media (max-width: 1040px)" in css


def test_home_gpu_art_is_desktop_only_and_the_mobile_hero_is_static() -> None:
    field = (ROOT / "home" / "src" / "GroundField.tsx").read_text(encoding="utf-8")
    capability = (ROOT / "home" / "src" / "visual-capability.ts").read_text(encoding="utf-8")

    assert "shouldUseDesktopGpuArt" in field
    assert "shouldUseDesktopGpuArt" in capability
    assert "(pointer: fine)" in capability
    assert "(min-width: 900px)" in capability
    assert "prefers-reduced-motion: reduce" in capability
    assert 'typeof window.matchMedia !== "function"' in field
    assert "query.addListener(refresh)" in field
    assert "zentropy-logo.png" not in field
    assert 'principle: "zentropy"' in field
    assert "wander: false" in field
    assert "hero: false" in field
    assert '"/system/field-ground.js?v=20260718-zentropy"' in field
    assert 'addEventListener("change", refresh)' in field
    assert "zentropy:" in (ROOT / "system" / "field-ground.js").read_text(encoding="utf-8")


def test_legacy_shared_field_does_not_mount_over_the_zentropy_home() -> None:
    shared_home_art = (ROOT / "system" / "home-art.js").read_text(encoding="utf-8")
    navigation = (ROOT / "system" / "nav.js").read_text(encoding="utf-8")

    assert "mountGenerativeField" not in shared_home_art
    assert "home-generative-field" not in shared_home_art
    assert 'data-home-shell="react"' in (ROOT / "home" / "index.html").read_text(encoding="utf-8")
    assert '"/system/home-art" + ".js?v=20260718-zentropy"' in (ROOT / "home" / "index.html").read_text(encoding="utf-8")
    assert '"./nav.js?v=20260718-zentropy"' in shared_home_art
    assert "homeShell !== \"react\"" in navigation


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
    assert "brand/zentropy-logo.png" in template


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
        "<title>zentropyLabs · Project Telos</title>",
        '<meta property="og:title" content="zentropyLabs · Project Telos" />',
        '<link rel="canonical" href="https://harperz9.github.io/" />',
        '<meta property="og:image" content="https://harperz9.github.io/brand/zentropy-logo.png" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:image" content="https://harperz9.github.io/brand/zentropy-logo.png" />',
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
