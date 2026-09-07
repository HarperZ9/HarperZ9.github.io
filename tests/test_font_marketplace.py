"""Public font marketplace boundary contracts."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "fonts.html"
CSS = ROOT / "system" / "font-marketplace.css"
JS = ROOT / "system" / "font-specimen.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def section(source: str, section_id: str) -> str:
    match = re.search(
        rf'<section\b[^>]*\bid="{re.escape(section_id)}"[^>]*>.*?</section>',
        source,
        re.DOTALL,
    )
    assert match, f"{section_id} section missing"
    return match.group(0)


def test_fonts_page_publishes_an_empty_marketplace_without_checkout_claims() -> None:
    assert PAGE.is_file(), "fonts.html must be the public Fonts destination"
    assert CSS.is_file(), "font marketplace styles must live in system/"
    assert JS.is_file(), "interactive specimen script must live in system/"

    source = read(PAGE)
    assert '<body class="inner-clean font-marketplace-page"' in source
    assert 'data-font-catalog-state="empty"' in source
    assert 'data-commerce-enabled="false"' in source
    assert 'href="system/font-marketplace.css' in source
    assert 'src="system/font-specimen.js' in source
    assert 'href="typeface.html"' in source
    assert 'href="#font-lab"' in source
    assert 'href="mailto:zaindharper@gmail.com?subject=Font%20licensing%20enquiry"' in source
    assert "Type with a point of view." in source
    assert "Original typefaces for clear reading and expressive headlines. Our first families are in development." in source
    assert source.count("No fonts are available to purchase yet.") == 1
    fallback = source.split("<noscript>", 1)[1].split("</noscript>", 1)[0]
    for href in ("flywheel.html", "bulletin.html", "typeface.html"):
        assert f'href="{href}"' in fallback

    forbidden_text = (
        "buy now",
        "add to cart",
        "checkout",
        "stripe",
        "sku",
        "preorder",
        "subscribe for updates",
        "notify me",
        "download font",
    )
    lowered = source.lower()
    for phrase in forbidden_text:
        assert phrase not in lowered, f"fonts.html must not contain {phrase!r}"
    for heavy_phrase in (
        "public boundary",
        "what must be true",
        "Catalog status.",
        "Nothing is available to license from this page today.",
    ):
        assert heavy_phrase not in source
    assert not re.search(r"(?:\$|USD\s*)\d", source, re.IGNORECASE)


def test_fonts_page_keeps_public_site_faces_out_of_retail_inventory() -> None:
    source = read(PAGE)
    current_type = section(source, "current-type")
    catalog_notice = re.search(
        r'<p\b[^>]*\bid="font-catalog"[^>]*>(.*?)</p>',
        source,
        re.DOTALL,
    )
    assert catalog_notice, "font-catalog notice missing"

    assert "Hanken Grotesk" in current_type
    assert "Conso" in current_type
    assert "Hanken Grotesk" not in catalog_notice.group(1)
    assert "Conso" not in catalog_notice.group(1)
    assert "existing bundled typefaces, not catalog products" in source


def test_font_marketplace_does_not_publish_private_or_derived_font_assets() -> None:
    source = read(PAGE)
    styles = read(CSS)
    combined = f"{source}\n{styles}".lower()

    for private_marker in (
        "kilon",
        "telos-display",
        "tools/fonts/",
        "font-commerce-backend",
        "private font",
        "master",
        ".ttf",
    ):
        assert private_marker not in combined, private_marker
    assert "@font-face" not in styles


def test_fonts_page_names_release_gate_without_promising_a_notification_service() -> None:
    source = read(PAGE)
    lowered = source.lower()

    assert '<details class="font-details">' in source
    assert "<summary>Release and licensing details</summary>" in source
    for required in (
        "reviewed license",
        "public specimen",
        "release artifact",
        "sale-ready",
    ):
        assert required in lowered

    assert "waiting list" not in lowered
    assert "newsletter" not in lowered
    assert "notify" not in lowered


def test_interactive_specimen_is_public_static_and_progressive() -> None:
    source = read(PAGE)
    script = read(JS)

    lab = section(source, "font-lab")
    assert 'data-font-specimen' in lab
    assert 'data-font-specimen-controls hidden' in lab
    assert '<noscript>' in lab
    assert 'id="font-specimen-text"' in lab
    assert 'id="font-specimen-family"' in lab
    assert 'id="font-specimen-size"' in lab
    assert 'id="font-specimen-line"' in lab
    assert 'id="font-specimen-track"' in lab
    assert 'data-font-specimen-preview' in lab
    assert 'type="reset"' in lab
    assert 'Hanken Grotesk' in lab
    assert 'Conso' in lab

    for private_marker in (
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "sendBeacon",
        "fetch(",
        "XMLHttpRequest",
    ):
        assert private_marker not in script
    assert "document.cookie" not in script
    assert "font-commerce" not in script.lower()
