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


def test_generated_home_contains_the_marketing_funnel() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    match = re.search(r'src="(/assets/index-[^"]+\.js)"', html)
    assert match, "generated home must reference its Vite bundle"
    bundle = (ROOT / match.group(1).lstrip("/")).read_text(encoding="utf-8")
    for value in (
        "Recorded workflows",
        "Available for paid work",
        "/media/demos/index/index-demo-poster.png",
        "/demonstrations.html",
    ):
        assert value in bundle
