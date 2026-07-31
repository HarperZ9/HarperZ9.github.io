"""Contracts for the site-wide ZentropyLabs static shell."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_shared_nav_renders_zentropy_brand_and_desktop_gpu_gate() -> None:
    nav = read("system/nav.js")

    assert "zentropyLabs" in nav
    assert "<span>TELOS</span>" not in nav
    assert "brand/zentropy-avatar.png" in nav
    assert "function shouldUseDesktopGpuArt" in nav
    assert '"(prefers-reduced-motion: reduce)"' in nav
    assert '"(pointer: fine)"' in nav
    assert '"(min-width: 900px)"' in nav
    assert "mountRouteArt" in nav
    assert "getRouteArtMetadata" in nav
    assert "function shouldMountAmbientField" in nav
    assert "shouldUseDesktopGpuArt(window)" in nav
    assert 'doc.querySelector(".frame")' in nav
    assert 'insertAdjacentElement("beforebegin", figure)' in nav
    assert re.search(
        r'PRIMARY\.map\(\(item\) => navLink\(item, active\)\)\.join\(""\)\s*\+\s*`</nav>`\s*\+\s*`<details class="sn-more"',
        nav,
    )
    assert 'classList.contains("studio-page")' in nav
    assert 'import("./generative-field.js")' in nav
    assert 'import("./cursor-field.js")' in nav


def test_shared_styles_define_zentropy_material_system() -> None:
    system_css = read("system/system.css")
    doc_css = read("system/doc.css")

    for css in (system_css, doc_css):
        assert 'font-family:"ZentropyDisplay"' in css
        assert '--brand-display:"ZentropyDisplay"' in css
        assert "#070406" in css
        assert "#eaf5f6" in css
        assert "#94afb4" in css
        assert "#678188" in css
        assert "#8ee3f2" in css
        assert "#c86a44" in css
        assert "#1e0f14" in css
        assert ".route-art" in css
        assert "@media (max-width:760px)" in css or "@media (max-width: 760px)" in css

    assert ".inner-clean h1 .g" in system_css
    assert "color:var(--zentropy-rust)" in system_css
    for css in (system_css, doc_css):
        assert ".site-nav .sn-more summary::before" in css
        assert 'content:"Menu"' in css
        assert "visibility:visible" in css
        assert ".site-nav .sn-links{" in css
        assert "display:block" in css
        assert "min-width:max-content" in css
        assert not re.search(r"\.site-nav \.sn-links\s*\{[^}]*display:contents", css)
        assert re.search(r"\.site-nav \.sn-links\s*\{[^}]*display:none", css)
        assert ".site-nav > .sn-more" in css
        assert "position:fixed!important" in css
    assert "Telos Display retired" not in system_css
    assert "Telos Display retired" not in doc_css
    assert "Kilon retired" not in doc_css


def test_current_zentropy_assets_are_shipped() -> None:
    expected_assets = {
        "brand/zentropy-avatar.png": 450_000,
        "brand/ZentropyDisplay.ttf": 50_000,
        "img/og/portfolio-home.png": 550_000,
        "img/og/forum.png": 560_000,
        "img/og/gather.png": 560_000,
        "img/og/telos.png": 560_000,
        "img/og/profile.png": 560_000,
    }

    for rel, minimum_size in expected_assets.items():
        path = ROOT / rel
        assert path.is_file(), rel
        assert path.stat().st_size >= minimum_size, rel


def test_representative_pages_keep_route_art_metadata() -> None:
    pages = (
        "overview.html",
        "catalog.html",
        "research.html",
        "writing.html",
        "forum.html",
        "gather.html",
    )

    for page in pages:
        html = read(page)
        match = re.search(
            r'<meta property="og:image" content="https://harperz9.github.io/([^"]+)"',
            html,
        )
        assert match, f"{page} must expose og:image metadata"
        assert (ROOT / match.group(1)).is_file(), f"{page} og:image target must exist"
        assert '<meta property="og:image:alt"' in html
