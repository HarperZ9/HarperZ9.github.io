"""Contracts for the site-wide ZentropyLabs static shell."""

from __future__ import annotations

import posixpath
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NON_DEPLOYABLE_HTML_DIRS = {
    "node_modules",
    "dist",
    ".worktrees",
    "_preview",
    "_drafts",
    "_redesign",
    "private",
    "protected",
    "secrets",
    "media",
}
DEFAULT_ASSET_REVISION = "20260902-creative-chassis"
READING_CASCADE_REVISION = "20260907-reading-completion"
REVIEWED_ASSET_REVISIONS = {
    "frontier-safety/frontier-safety-site.css": READING_CASCADE_REVISION,
    "frontier-safety/frontier-safety.css": READING_CASCADE_REVISION,
    "system/type-specimen.css": "20260907",
    "system/system.css": READING_CASCADE_REVISION,
    "system/doc.css": READING_CASCADE_REVISION,
    "system/publication-article.css": READING_CASCADE_REVISION,
    "system/figure.css": "20260906-figure-presentation",
    "system/report-editorial.css": "20260906",
    "system/instrument-editorial.css": "20260907-instrument-readable-floor",
    "system/demo-editorial.css": "20260906-demo-editorial",
}
READING_IMPORTING_STYLESHEETS = (
    "system/system.css",
    "system/doc.css",
    "system/publication-article.css",
)
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
FIGURE_CONTRAST_PAIRS = (
    (".evidence-figure", ".evidence-figure"),
    (".data-plate", ".data-plate"),
    (".evidence-ledger", ".evidence-ledger"),
    (".figure-record-controls input", ".figure-record-controls input"),
    (".figure-relation-card", ".figure-relation-card"),
    (".figure-relation-card dt", ".figure-relation-card"),
    (".publication-figure-page", ".publication-figure-page"),
    (".publication-figure-page .publication-thesis", ".publication-figure-page"),
    (".publication-figure-page .publication-evidence dt", ".publication-figure-page"),
    (".publication-figure-page .publication-evidence dd", ".publication-figure-page"),
    ('.publication-figure-page section[aria-label="Figure sources"]', ".publication-figure-page"),
)
FIGURE_FONT_ROLES = (
    ("body.figure-document", "Hanken Grotesk"),
    (".data-plate", "Hanken Grotesk"),
    (".publication-figure-page", "Hanken Grotesk"),
    (".evidence-ledger", "Conso"),
    (".figure-relation-card dt", "Conso"),
    (".figure-table caption", "Conso"),
    (".publication-figure-page .publication-figure-table caption", "Conso"),
    (".publication-figure-page .publication-evidence dt", "Conso"),
)


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def deployable_html_pages() -> list[Path]:
    tracked = subprocess.run(
        ["git", "ls-files", "--", "*.html"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    pages: list[Path] = []
    for rel in tracked.stdout.splitlines():
        relative = Path(rel)
        if any(part.startswith(".") or part in NON_DEPLOYABLE_HTML_DIRS for part in relative.parts):
            continue
        pages.append(ROOT / relative)
    return pages


def parse_declarations(body: str) -> dict[str, str]:
    return {
        name.strip(): value.strip()
        for part in body.split(";")
        if ":" in part
        for name, value in [part.split(":", 1)]
    }


def style_rules(css: str) -> list[tuple[str, str]]:
    rules: list[tuple[str, str]] = []
    position = 0
    while True:
        open_brace = css.find("{", position)
        if open_brace == -1:
            return rules

        selector = re.sub(r"/\*.*?\*/", "", css[position:open_brace], flags=re.DOTALL).strip()
        depth = 0
        close_brace = None
        for offset, character in enumerate(css[open_brace:], start=open_brace):
            if character == "{":
                depth += 1
            elif character == "}":
                depth -= 1
                if depth == 0:
                    close_brace = offset
                    break
        assert close_brace is not None, f"{selector} rule is not closed"

        if selector and not selector.startswith("@"):
            rules.append((selector, css[open_brace + 1:close_brace]))
        position = close_brace + 1


def declarations(css: str, selector: str) -> dict[str, str]:
    properties: dict[str, str] = {}
    for selector_group, body in style_rules(css):
        selectors = [part.strip() for part in selector_group.split(",")]
        if selector in selectors:
            properties.update(parse_declarations(body))
    assert properties, f"{selector} rule missing"
    return properties


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
        for name, value in parse_declarations(match.group("body")).items()
        if name.startswith("--")
    }


def scheme_variables(css: str, scheme: str) -> dict[str, str]:
    variables = root_variables(css)
    if scheme == "dark":
        dark = media_block(css, "(prefers-color-scheme: dark)")
        match = re.search(r":root\s*\{(?P<body>[^}]+)\}", dark)
        assert match, "dark :root rule missing"
        variables.update(
            {
                name: value
                for name, value in parse_declarations(match.group("body")).items()
                if name.startswith("--")
            }
        )
    return variables


def scheme_variable_sets(css: str) -> dict[str, dict[str, str]]:
    return {
        "light": scheme_variables(css, "light"),
        "dark": scheme_variables(css, "dark"),
    }


def resolve_value(value: str, variables: dict[str, str]) -> str:
    value = value.strip()
    seen: set[str] = set()
    while value.startswith("var("):
        match = re.match(r"var\(\s*(--[\w-]+)\s*(?:,[^)]+)?\)", value)
        assert match, f"unsupported CSS variable value {value!r}"
        name = match.group(1)
        assert name not in seen, f"recursive CSS variable {name}"
        assert name in variables, f"undefined CSS variable {name}"
        seen.add(name)
        value = variables[name].strip()
    return value


def resolve_color(value: str, variables: dict[str, str]) -> str:
    value = resolve_value(value, variables)
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


def assert_aa_contrast_across_schemes(
    css: str,
    foreground_selector: str,
    background_selector: str | None = None,
) -> None:
    foreground_rule = declarations(css, foreground_selector)
    background_rule = declarations(css, background_selector or foreground_selector)

    for scheme, variables in scheme_variable_sets(css).items():
        foreground = resolve_color(foreground_rule["color"], variables)
        background = resolve_color(background_rule["background"], variables)
        assert_aa_contrast(foreground, background, f"{foreground_selector} {scheme}")


def assert_font_role(css: str, selector: str, expected_family: str) -> None:
    font_value = declarations(css, selector)["font-family"]

    for scheme, variables in scheme_variable_sets(css).items():
        families = font_family_names(font_value, variables)
        assert expected_family in families, f"{selector} {scheme} resolved fonts {families!r}"


def font_family_names(value: str, variables: dict[str, str]) -> list[str]:
    resolved = resolve_value(value, variables)
    families: list[str] = []
    buffer: list[str] = []
    quote: str | None = None

    for character in resolved:
        if quote is not None:
            if character == quote:
                quote = None
            else:
                buffer.append(character)
        elif character in {'"', "'"}:
            quote = character
        elif character == ",":
            family = "".join(buffer).strip()
            if family:
                families.append(family)
            buffer = []
        else:
            buffer.append(character)

    assert quote is None, f"unterminated CSS font family quote in {resolved!r}"
    family = "".join(buffer).strip()
    if family:
        families.append(family)
    return families


def assert_figure_material_roles_and_contrast(css: str) -> None:
    assert "prefers-color-scheme: dark" in css
    for foreground_selector, background_selector in FIGURE_CONTRAST_PAIRS:
        assert_aa_contrast_across_schemes(css, foreground_selector, background_selector)
    for selector, expected_family in FIGURE_FONT_ROLES:
        assert_font_role(css, selector, expected_family)


def expected_asset_revision(relative: Path, target: str) -> str:
    raw_asset_path = target.split("?", 1)[0]
    asset_path = raw_asset_path.lstrip("/")
    if not raw_asset_path.startswith("/"):
        asset_path = posixpath.normpath(posixpath.join(posixpath.dirname(relative.as_posix()), raw_asset_path))

    return REVIEWED_ASSET_REVISIONS.get(asset_path, DEFAULT_ASSET_REVISION)


def assert_reviewed_asset_revision(relative: Path, target: str) -> None:
    revision = expected_asset_revision(relative, target)
    assert target.endswith(f"?v={revision}"), (
        relative.as_posix(),
        target,
        f"expected ?v={revision}",
    )


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
    figure_css = read("system/figure.css")

    for rel in SHARED_STYLE_SHEETS:
        css = read(rel)
        assert "ZentropyDisplay" not in css, rel
        if rel == "system/figure.css":
            assert_figure_material_roles_and_contrast(css)
        else:
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
    assert "ZentropyDisplay" not in figure_css


def test_shared_styles_define_paper_data_surfaces() -> None:
    for rel in PLATE_STYLE_SHEETS:
        css = read(rel)
        data_plate = re.search(r"\.data-plate\s*\{(?P<body>[^}]+)\}", css)
        assert data_plate, f"{rel} must define .data-plate"
        if rel == "system/figure.css":
            assert_aa_contrast_across_schemes(css, ".data-plate")
            assert_font_role(css, ".data-plate", "Hanken Grotesk")
        else:
            assert "background:var(--ground-paper)" in data_plate.group("body"), rel
            assert "color:var(--ink-paper)" in data_plate.group("body"), rel

        ledger = re.search(r"\.evidence-ledger\s*\{(?P<body>[^}]+)\}", css)
        assert ledger, f"{rel} must define .evidence-ledger"
        ledger_body = ledger.group("body")
        if rel == "system/figure.css":
            assert_aa_contrast_across_schemes(css, ".evidence-ledger")
            assert_font_role(css, ".evidence-ledger", "Conso")
        else:
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
    assert_aa_contrast_across_schemes(css, ".figure-record-controls input")


def test_figure_mobile_relation_cards_keep_readable_paper_contract() -> None:
    css = read("system/figure.css")
    mobile = media_block(css, "(max-width: 40rem)")
    assert ".figure-relation-cards { display: grid" in mobile

    figure_rule = declarations(css, ".evidence-figure")
    card_rule = declarations(css, ".figure-relation-card")
    dt_rule = declarations(css, ".figure-relation-card dt")

    for scheme, variables in scheme_variable_sets(css).items():
        background = resolve_color(card_rule["background"], variables)
        body_foreground = resolve_color(card_rule.get("color", figure_rule["color"]), variables)
        term_foreground = resolve_color(dt_rule["color"], variables)

        assert_aa_contrast(body_foreground, background, f".figure-relation-card {scheme}")
        assert_aa_contrast(term_foreground, background, f".figure-relation-card dt {scheme}")


def test_figure_contrast_negative_control_rejects_low_contrast() -> None:
    low_contrast_css = """
:root {
  --surface:#ffffff;
  --text:#777777;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface:#000000;
    --text:#777777;
  }
}
.bad-surface {
  background:var(--surface);
  color:var(--text);
}
"""
    error = None
    try:
        assert_aa_contrast_across_schemes(low_contrast_css, ".bad-surface")
    except AssertionError as exc:
        error = str(exc)

    assert error is not None
    assert ".bad-surface light contrast" in error


def test_figure_font_role_negative_control_rejects_partial_family_names() -> None:
    wrong_family_css = """
:root {
  --font-sans:"Fake Hanken Grotesk",sans-serif;
  --font-mono:"Consolas",monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --font-sans:"Fake Hanken Grotesk",sans-serif;
    --font-mono:"Consolas",monospace;
  }
}
.fake-sans {
  font-family:var(--font-sans);
}
.fake-mono {
  font-family:var(--font-mono);
}
"""

    errors = []
    for selector, expected_family in ((".fake-sans", "Hanken Grotesk"), (".fake-mono", "Conso")):
        try:
            assert_font_role(wrong_family_css, selector, expected_family)
        except AssertionError as exc:
            errors.append(str(exc))

    assert len(errors) == 2
    assert ".fake-sans light resolved fonts ['Fake Hanken Grotesk', 'sans-serif']" in errors[0]
    assert ".fake-mono light resolved fonts ['Consolas', 'monospace']" in errors[1]


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
    assert "sn-section" not in nav
    assert "Current section" not in nav
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
        assert ".sn-section" not in css, rel


def test_product_and_system_routes_do_not_repeat_decorative_eyebrows() -> None:
    decorative_routes = (
        "accountable-engine.html",
        "accountable-machines.html",
        "build-products.html",
        "coherence-membrane.html",
        "overview.html",
        "proof-surface.html",
        "provenance-sensorium.html",
        "toolkit.html",
        "typeface.html",
        "why.html",
    )
    for rel in decorative_routes:
        assert 'class="eyebrow"' not in read(rel), rel

    for rel in ("brender-archival.html", "engine-revival.html", "retro.html"):
        assert "retro-lab-kicker" not in read(rel), rel


def test_public_routes_reserve_micro_labels_for_semantic_context() -> None:
    for path in deployable_html_pages():
        source = path.read_text(encoding="utf-8")
        assert not re.search(r'class="[^"]*\beyebrow\b', source), path

    home_art = read("system/home-art.js")
    home_css = read("home/src/App.css")
    assert "home-menu-label" not in home_art
    assert ".home-menu-label" not in home_css

    system_css = read("system/system.css")
    bar_rule = re.search(r"\.bar\{(?P<body>[^}]*)\}", system_css)
    assert bar_rule
    assert "text-transform:uppercase" not in bar_rule.group("body")
    assert "letter-spacing:.22em" not in bar_rule.group("body")


def test_shared_frontend_assets_use_consistent_reviewed_cache_revisions() -> None:
    # A scoped stylesheet release must bust its cache on every consuming page
    # without rewriting unrelated assets and pages in other owners' work.
    for path in deployable_html_pages():
        relative = path.relative_to(ROOT)
        source = path.read_text(encoding="utf-8")
        for target in re.findall(r'(?:href|src)="([^"]+\.(?:css|js)(?:\?[^"]*)?)"', source):
            if target.startswith(("http://", "https://", "//")):
                continue
            if re.search(r"(?:^|/)assets/[^/?]+-[A-Za-z0-9_-]{8,}\.(?:css|js)$", target):
                continue
            assert_reviewed_asset_revision(relative, target)


def test_reading_cache_revision_reaches_importing_stylesheets_and_generators() -> None:
    expected_import = f'@import url("reading.css?v={READING_CASCADE_REVISION}");'
    for rel in READING_IMPORTING_STYLESHEETS:
        first_line = read(rel).splitlines()[0]
        assert first_line == expected_import, f"{rel} must refresh its reading.css import"

    expected_generator_urls = {
        "scripts/analytics-page.mjs": (
            f"../system/system.css?v={READING_CASCADE_REVISION}",
        ),
        "scripts/render-system-pages.mjs": (
            f"system/system.css?v={READING_CASCADE_REVISION}",
        ),
        "scripts/system-record-head.mjs": (
            f"/system/system.css?v={READING_CASCADE_REVISION}",
        ),
        "tools/build_publications.py": (
            f'ASSET_REVISION = "{READING_CASCADE_REVISION}"',
            'system/publication-article.css?v={ASSET_REVISION}',
        ),
        "tools/render_corpus.py": (
            f"system/doc.css?v={READING_CASCADE_REVISION}",
        ),
    }
    stale_parent_urls = (
        "system/system.css?v=20260902-creative-chassis",
        "/system/system.css?v=20260902-creative-chassis",
        "../system/system.css?v=20260902-creative-chassis",
        "system/doc.css?v=20260813-document",
        "system/doc.css?v=20260902-creative-chassis",
        "system/publication-article.css?v=20260905-article-reading",
        "../system/publication-article.css?v=20260905-article-reading",
    )

    for rel, expected_urls in expected_generator_urls.items():
        source = read(rel)
        for expected_url in expected_urls:
            assert expected_url in source, f"{rel} must emit {expected_url}"
        for stale_url in stale_parent_urls:
            assert stale_url not in source, f"{rel} still emits stale cache key {stale_url}"


def test_reading_cache_negative_control_rejects_stale_parent_revision() -> None:
    error = None
    try:
        assert_reviewed_asset_revision(
            Path("overview.html"),
            "system/system.css?v=20260902-creative-chassis",
        )
    except AssertionError as exc:
        error = str(exc)

    assert error is not None
    assert "system/system.css?v=20260902-creative-chassis" in error
    assert f"expected ?v={READING_CASCADE_REVISION}" in error


def test_asset_revision_negative_control_rejects_wrong_reviewed_revision() -> None:
    error = None
    try:
        assert_reviewed_asset_revision(
            Path("emet-sample.html"),
            "system/report-editorial.css?v=20260902-creative-chassis",
        )
    except AssertionError as exc:
        error = str(exc)

    assert error is not None
    assert "system/report-editorial.css?v=20260902-creative-chassis" in error
    assert "expected ?v=20260906" in error


def test_asset_revision_negative_control_rejects_impostor_reviewed_path() -> None:
    error = None
    try:
        assert_reviewed_asset_revision(
            Path("scratch/page.html"),
            "scratch/system/report-editorial.css?v=20260906",
        )
    except AssertionError as exc:
        error = str(exc)

    assert error is not None
    assert "scratch/system/report-editorial.css?v=20260906" in error
    assert "expected ?v=20260902-creative-chassis" in error


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
        "typeface.html",
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
