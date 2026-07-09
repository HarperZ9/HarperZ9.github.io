from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "tools" / "fonts" / "build_telos_display.py"

spec = importlib.util.spec_from_file_location("build_telos_display", BUILDER)
assert spec and spec.loader
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def build_tmp_font(tmp_path: Path) -> TTFont:
    out_dir = tmp_path / "fonts"
    subprocess.run(
        [sys.executable, str(BUILDER), "--out-dir", str(out_dir)],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return TTFont(out_dir / "telos-display.ttf")


def glyph_signature(font: TTFont, char: str) -> tuple:
    glyph_name = font.getBestCmap()[ord(char)]
    glyph = font["glyf"][glyph_name]
    return (
        tuple(glyph.endPtsOfContours),
        tuple(tuple(point) for point in glyph.coordinates),
    )


def glyph_width(font: TTFont, char: str) -> int:
    glyph_name = font.getBestCmap()[ord(char)]
    return font["hmtx"].metrics[glyph_name][0]


def test_telos_display_builder_emits_readable_ttf_and_woff2(tmp_path: Path) -> None:
    out_dir = tmp_path / "fonts"

    subprocess.run(
        [sys.executable, str(BUILDER), "--out-dir", str(out_dir)],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )

    ttf_path = out_dir / "telos-display.ttf"
    woff2_path = out_dir / "telos-display.woff2"

    assert ttf_path.is_file()
    assert woff2_path.is_file()
    assert ttf_path.stat().st_size > 18_000
    assert woff2_path.stat().st_size > 10_000

    font = TTFont(ttf_path)
    names = {
        record.toUnicode()
        for record in font["name"].names
        if record.nameID in {1, 2, 4, 5, 6}
    }
    assert "Telos Display" in names
    assert "Regular" in names
    assert "TelosDisplay-Regular" in names
    assert "Version 0.5.0" in names
    assert font["head"].unitsPerEm == 2048
    assert font["OS/2"].sTypoAscender > 1400
    assert font["OS/2"].sTypoDescender < -300

    cmap = font.getBestCmap()
    required = "TELOSSystemsmodelsgraphicsresearch0123456789.,:/+-&()[]?!"
    missing = [char for char in required if ord(char) not in cmap]
    assert missing == []


def test_committed_telos_display_assets_are_loadable() -> None:
    for path in (
        ROOT / "system" / "fonts" / "telos-display.ttf",
        ROOT / "system" / "fonts" / "telos-display.woff2",
    ):
        assert path.is_file()
        assert path.stat().st_size > 10_000
        font = TTFont(path)
        assert font["name"].getDebugName(1) == "Telos Display"
        assert font["name"].getDebugName(5) == "Version 0.5.0"


def test_display_face_is_readable_outline_derivation_not_segment_recipe() -> None:
    assert builder.CONSTRUCTION == "readable-outline-derivation"
    assert builder.SOURCE_FONT.name == "kilon.woff2"
    assert builder.FONT_VERSION == "0.5.0"
    assert not hasattr(builder, "PATTERNS")
    assert not hasattr(builder, "SOFT_STROKES")


def test_display_face_preserves_legible_mixed_case_spacing(tmp_path: Path) -> None:
    font = build_tmp_font(tmp_path)

    assert glyph_width(font, "i") < glyph_width(font, "n")
    assert glyph_width(font, "l") < glyph_width(font, "o")
    assert glyph_width(font, "W") > glyph_width(font, "I")
    assert glyph_width(font, "T") >= glyph_width(font, "e")


def test_display_face_has_real_letter_outlines(tmp_path: Path) -> None:
    font = build_tmp_font(tmp_path)

    for char in "TelosDisplay":
        glyph_name = font.getBestCmap()[ord(char)]
        glyph = font["glyf"][glyph_name]
        assert glyph.numberOfContours >= 1, char
        assert len(glyph.coordinates) >= 4, char

    for char in "eosplay":
        glyph_name = font.getBestCmap()[ord(char)]
        glyph = font["glyf"][glyph_name]
        assert any(not (flag & 1) for flag in glyph.flags), char


def test_generated_face_is_not_identical_to_source_kilon(tmp_path: Path) -> None:
    generated = build_tmp_font(tmp_path)
    source = TTFont(ROOT / builder.SOURCE_FONT)

    for char in "Telos58":
        assert glyph_signature(generated, char) != glyph_signature(source, char)


def test_display_face_distinguishes_common_lookalikes(tmp_path: Path) -> None:
    font = build_tmp_font(tmp_path)

    for left, right in (("S", "5"), ("B", "8"), ("O", "0"), ("I", "l")):
        assert glyph_signature(font, left) != glyph_signature(font, right)
