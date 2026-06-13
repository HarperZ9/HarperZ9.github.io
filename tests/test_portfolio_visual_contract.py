from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
STYLES = ROOT / "styles.css"


def page_source() -> str:
    return INDEX.read_text(encoding="utf-8") + "\n" + STYLES.read_text(encoding="utf-8")


def test_portfolio_keeps_clean_white_backdrop() -> None:
    source = page_source()

    assert "--bg-mid:#ffffff" in source
    assert "body{background:#ffffff" in source


def test_grain_and_bloom_are_visible_not_disabled() -> None:
    source = page_source()

    assert ".grain{position:fixed" in source
    assert ".bloom{position:fixed" in source
    assert not re.search(r"\.bg,\s*\.sun,\s*\.grain,\s*\.bloom\{display:none\s*!important", source)
    assert "mix-blend-mode:multiply" in source


def test_glass_containers_have_active_frosted_material() -> None:
    source = page_source()

    assert "backdrop-filter:var(--glass-blur)" in source
    assert "box-shadow:var(--glass-shadow)" in source
    assert not re.search(r"\.glass\{[^}]*backdrop-filter:none", source)
    assert not re.search(r"\.glass\{[^}]*box-shadow:none", source)


def test_work_rows_receive_glass_treatment() -> None:
    source = page_source()

    assert '<article class="wrow glass">' in source
    assert ".wrow.glass" in source


def test_live_frontend_surfaces_are_listed() -> None:
    source = page_source()

    assert "Harper Advocates" in source
    assert "Harper Compliance" in source
    assert "https://harperadvocates.com" in source
    assert "https://harpercompliance.llc" in source
    assert "Live frontend surfaces" in source
    assert "private GitHub repos" in source


def test_accessible_navigation_and_page_landmarks() -> None:
    source = page_source()

    assert 'class="skip-link" href="#main"' in source
    assert '<nav aria-label="Primary">' in source
    assert '<main id="main">' in source
    assert 'aria-label="656 passing compiler tests"' in source


def test_portfolio_uses_receipts_not_sales_posture() -> None:
    source = page_source()

    assert "Working systems with receipts" in source
    assert "Current state" in source
    assert "label maturity honestly" in source
    assert "Small proof-surface review" in source
    for stale_phrase in [
        "Current paid wedge",
        "behind the wedge",
        "High-leverage tools",
        "Day delivery",
        "prompt-and-pray",
        "conducting an orchestra",
    ]:
        assert stale_phrase not in source


def test_typography_matches_refined_quanta_system() -> None:
    source = page_source()

    assert "Archivo" in source
    assert "Manrope" in source
    assert "JetBrains Mono" in source
    assert "--shell:1160px" in source
    assert "font-size:clamp" not in source
    assert "letter-spacing:-" not in source


def test_pastel_orange_depth_layer_is_present() -> None:
    source = page_source()

    assert "--orange-wash:#f3c49f" in source
    assert "--orange-mist:#fff0e4" in source
    assert "rgba(243,196,159" in source
    assert "--olive-" not in source
    assert "rgba(201,214,163" not in source
    assert "rgba(238,243,218" not in source
    assert ".bg{display:block" in source


def test_glass_material_is_more_pronounced() -> None:
    source = page_source()

    assert "--glass-blur:saturate(170%) blur(30px)" in source
    assert "--glass-edge:" in source
    assert "--glass-depth:" in source
    assert "box-shadow:var(--glass-shadow), var(--glass-depth)" in source
