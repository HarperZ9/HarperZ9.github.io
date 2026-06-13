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


def test_pastel_olive_depth_layer_is_present() -> None:
    source = page_source()

    assert "--olive-wash:#c9d6a3" in source
    assert "--olive-mist:#eef3da" in source
    assert "rgba(201,214,163" in source
    assert ".bg{display:block" in source


def test_glass_material_is_more_pronounced() -> None:
    source = page_source()

    assert "--glass-blur:saturate(170%) blur(30px)" in source
    assert "--glass-edge:" in source
    assert "--glass-depth:" in source
    assert "box-shadow:var(--glass-shadow), var(--glass-depth)" in source
