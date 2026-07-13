"""Contracts for the evidence-led portfolio home funnel."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


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
    assert re.search(r"font-size:\s*clamp\([^;]+,\s*6rem\)\s*;", rule)


def test_home_source_and_generated_output_preserve_social_metadata() -> None:
    title = "Project Telos - Tools for AI, code, graphics, and research"
    description = (
        "A public workshop for any-model workflows, codebase maps, compiler tools, "
        "graphics systems, generated media, and research infrastructure."
    )
    image = "https://harperz9.github.io/img/og/telos.png"
    expected_metadata = (
        f'<title>{title}</title>',
        f'<meta property="og:title" content="{title}" />',
        f'<meta property="og:description" content="{description}" />',
        '<link rel="canonical" href="https://harperz9.github.io/" />',
        f'<meta property="og:image" content="{image}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{title}" />',
        f'<meta name="twitter:description" content="{description}" />',
        f'<meta name="twitter:image" content="{image}" />',
    )
    for page in (ROOT / "home" / "index.html", ROOT / "index.html"):
        html = page.read_text(encoding="utf-8")
        for value in expected_metadata:
            assert value in html, f"{page} must preserve {value}"


def test_generated_bundle_contains_all_recorded_workflows() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    match = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
    assert match, "generated home must reference its Vite bundle"
    bundle = (ROOT / match.group(1).lstrip("/")).read_text(encoding="utf-8")
    for value in (
        "Recorded workflows",
        "Available for paid work",
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
