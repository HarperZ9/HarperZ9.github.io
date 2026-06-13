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
