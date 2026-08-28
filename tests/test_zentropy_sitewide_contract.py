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


def declarations(css: str, selector: str) -> dict[str, str]:
    match = re.search(re.escape(selector) + r"\s*\{(?P<body>[^}]+)\}", css)
    assert match, f"{selector} rule missing"
    return {
        name.strip(): value.strip()
        for part in match.group("body").split(";")
        if ":" in part
        for name, value in [part.split(":", 1)]
    }


def media_block(css: str, query: str) -> str:
    match = re.search(r"@media\s*" + re.escape(query), css)
    assert match, f"{query} media block missing"
    open_brace = css.index("{", match.end())
    depth = 0
    for offset, character in enumerate(css[open_brace:], start=open_brace):
        if character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return css[open_brace + 1:offset]
    raise AssertionError(f"{query} media block is not closed")


def root_variables(css: str) -> dict[str, str]:
    match = re.search(r":root\s*\{(?P<body>[^}]+)\}", css)
    assert match, ":root rule missing"
    return {
        name: value
        for name, value in declarations(match.group(0), ":root").items()
        if name.startswith("--")
    }


def resolve_color(value: str, variables: dict[str, str]) -> str:
    value = value.strip()
    seen: set[str] = set()
    while value.startswith("var("):
        match = re.match(r"var\((--[\w-]+)\)", value)
        assert match, f"unsupported CSS variable value {value!r}"
        name = match.group(1)
        assert name not in seen, f"recursive CSS variable {name}"
        seen.add(name)
        value = variables[name].strip()
    if re.fullmatch(r"#[0-9a-fA-F]{3}", value):
        value = "#" + "".join(character * 2 for character in value[1:])
    assert re.fullmatch(r"#[0-9a-fA-F]{6}", value), f"{value!r} is not a hex colour"
    return value.lower()


def relative_luminance(hex_color: str) -> float:
    channels = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]

    def linear(channel: float) -> float:
        if channel <= 0.04045:
            return channel / 12.92
        return ((channel + 0.055) / 1.055) ** 2.4

    red, green, blue = [linear(channel) for channel in channels]
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(foreground: str, background: str) -> float:
    fg = relative_luminance(foreground)
    bg = relative_luminance(background)
    lighter, darker = max(fg, bg), min(fg, bg)
    return (lighter + 0.05) / (darker + 0.05)


def assert_aa_contrast(foreground: str, background: str, selector: str) -> None:
    ratio = contrast_ratio(foreground, background)
    assert ratio >= 4.5, f"{selector} contrast is {ratio:.2f}:1"


def test_shared_nav_renders_zentropy_brand_and_desktop_gpu_gate() -> None:
    nav = read("system/nav.js")

    assert "Zentropy Labs" in nav
    assert "zentropyLabs" not in nav
    assert "<span>TELOS</span>" not in nav
    assert "brand/zentropy-avatar.png" in nav
    assert "function shouldUseDesktopGpuArt" in nav
    assert '"(prefers-reduced-motion: reduce)"' in nav
    assert '"(pointer: fine)"' in nav
    assert '"(min-width: 900px)"' in nav
    assert "mountRouteArt" not in nav
    assert "getRouteArtMetadata" not in nav
    assert "buildRouteHeader" in nav
    assert "mountRouteHeader" in nav
    assert "route artifact" not in nav
    assert "Project Telos home" not in nav
    assert "function shouldMountAmbientField" in nav
    assert "shouldUseDesktopGpuArt(window)" in nav
    assert 'doc.querySelector(".frame")' in nav
    assert "route-header__path" in nav
    assert 'PRIMARY_ROUTES.map((item) => navLink(item, active, routePath, true)).join("")' in nav
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
        assert ".route-header" in css
        assert ".route-art" not in css
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


def test_figure_record_search_input_has_readable_contrast() -> None:
    css = read("system/figure.css")
    variables = root_variables(css)
    input_rule = declarations(css, ".figure-record-controls input")

    foreground = resolve_color(input_rule["color"], variables)
    background = resolve_color(input_rule["background"], variables)

    assert_aa_contrast(foreground, background, ".figure-record-controls input")


def test_figure_mobile_relation_cards_keep_readable_paper_contract() -> None:
    css = read("system/figure.css")
    variables = root_variables(css)
    mobile = media_block(css, "(max-width: 40rem)")
    assert ".figure-relation-cards { display: grid" in mobile

    figure_rule = declarations(css, ".evidence-figure")
    card_rule = declarations(css, ".figure-relation-card")
    dt_rule = declarations(css, ".figure-relation-card dt")

    background = resolve_color(card_rule["background"], variables)
    body_foreground = resolve_color(card_rule.get("color", figure_rule["color"]), variables)
    term_foreground = resolve_color(dt_rule["color"], variables)

    assert_aa_contrast(body_foreground, background, ".figure-relation-card")
    assert_aa_contrast(term_foreground, background, ".figure-relation-card dt")


def test_nav_forced_colors_route_header_gets_a_visible_border() -> None:
    css = read("system/nav.css")
    forced = media_block(css, "(forced-colors: active)")

    assert re.search(
        r"\.route-header\s*\{[^}]*border:1px solid CanvasText!important",
        forced,
    )


def test_route_headers_are_not_eyebrows_or_posters() -> None:
    nav = read("system/nav.js")

    assert "route-header__path" in nav
    assert "route-header__title" in nav
    assert "route-header__summary" in nav
    assert "hero-kicker" not in nav
    assert "eyebrow" not in nav
    assert "overline" not in nav
    assert "kicker" not in nav
    assert "figcaption" not in nav

    for rel in ("system/system.css", "system/doc.css", "system/nav.css"):
        css = read(rel)
        assert ".route-header" in css, rel
        assert ".route-art" not in css, rel
        assert "route artifact" not in css, rel


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
