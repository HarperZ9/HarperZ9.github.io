"""Contracts for the site-wide ZentropyLabs static shell."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SHARED_STYLE_SHEETS = (
    "system/system.css",
    "system/doc.css",
    "system/nav.css",
    "system/figure.css",
)
PLATE_STYLE_SHEETS = (
    "system/system.css",
    "system/doc.css",
    "system/figure.css",
)
SHARED_VISUAL_TOKENS = (
    '--font-sans:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '--font-mono:"Conso","JetBrains Mono",ui-monospace,"SFMono-Regular",monospace;',
    "--ground-instrument:#070406;",
    "--ground-paper:#f2efe6;",
    "--ink-paper:#111014;",
)


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
    assert 'PRIMARY_ROUTES.map((item) => navLink(item, active, locationPath, true)).join("")' in nav
    assert 'SECONDARY_GROUPS.map((group) => menuGroup(' in nav
    assert 'classList.contains("studio-page")' in nav
    assert 'import("./generative-field.js")' in nav
    assert 'import("./cursor-field.js")' in nav


def test_shared_styles_define_zentropy_material_system() -> None:
    system_css = read("system/system.css")
    doc_css = read("system/doc.css")

    for rel in SHARED_STYLE_SHEETS:
        css = read(rel)
        assert "ZentropyDisplay" not in css, rel
        for token in SHARED_VISUAL_TOKENS:
            assert token in css, f"{rel} missing {token}"
        assert "var(--font-sans)" in css, f"{rel} must route prose/display through --font-sans"
        assert "var(--font-mono)" in css, f"{rel} must route mono/data/code through --font-mono"

    for css in (system_css, doc_css):
        assert "#070406" in css
        assert "#eaf5f6" in css
        assert "#94afb4" in css
        assert "#678188" in css
        assert "#8ee3f2" in css
        assert "#c86a44" in css
        assert "#1e0f14" in css
        assert ".route-art" in css
        assert "@media (max-width:760px)" in css or "@media (max-width: 760px)" in css
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
    assert ".inner-clean h1 .g" in system_css
    assert "color:var(--zentropy-rust)" in system_css
    assert "Telos Display retired" not in system_css
    assert "Telos Display retired" not in doc_css
    assert "Kilon retired" not in doc_css


def test_shared_styles_define_paper_data_surfaces() -> None:
    for rel in PLATE_STYLE_SHEETS:
        css = read(rel)
        data_plate = re.search(r"\.data-plate\s*\{(?P<body>[^}]+)\}", css)
        assert data_plate, f"{rel} must define .data-plate"
        assert "background:var(--ground-paper)" in data_plate.group("body"), rel
        assert "color:var(--ink-paper)" in data_plate.group("body"), rel

        ledger = re.search(r"\.evidence-ledger\s*\{(?P<body>[^}]+)\}", css)
        assert ledger, f"{rel} must define .evidence-ledger"
        ledger_body = ledger.group("body")
        assert "background:var(--ground-paper)" in ledger_body, rel
        assert "color:var(--ink-paper)" in ledger_body, rel
        assert "font-family:var(--font-mono)" in ledger_body, rel
        assert re.search(r"border(?:-block|-color)?:1px solid", ledger_body), rel


def test_data_surfaces_survive_forced_colors() -> None:
    for rel in PLATE_STYLE_SHEETS:
        css = read(rel)
        forced = re.search(
            r"@media\s*\(forced-colors:\s*active\)\s*\{(?P<body>.*?)\n\}",
            css,
            re.DOTALL,
        )
        assert forced, f"{rel} must define forced-colors rules"
        body = forced.group("body")
        assert ".data-plate" in body and ".evidence-ledger" in body, rel
        assert "background:Canvas!important" in body, rel
        assert "border-color:CanvasText!important" in body, rel


def test_narrow_mobile_nav_does_not_overlap_the_wordmark() -> None:
    """A fixed menu trigger must not cover the brand at phone widths."""
    system_css = read("system/system.css")
    doc_css = read("system/doc.css")

    for css in (system_css, doc_css):
        narrow_mobile = re.search(
            r"@media\s*\(max-width:\s*430px\)\s*\{(?P<body>.*?)\n\}",
            css,
            re.DOTALL,
        )
        assert narrow_mobile, "shared navigation needs a narrow-phone breakpoint"
        body = narrow_mobile.group("body")
        assert re.search(
            r"\.site-nav \.sn-home \.sn-brand-word\s*\{[^}]*display:none!important",
            body,
        )
        assert re.search(r"\.site-nav > \.sn-more\s*\{[^}]*right:1rem", body)


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
