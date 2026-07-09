from __future__ import annotations

import subprocess
import sys
import importlib.util
from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "tools" / "fonts" / "build_telos_display.py"

spec = importlib.util.spec_from_file_location("build_telos_display", BUILDER)
assert spec and spec.loader
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_telos_display_builder_emits_real_ttf_and_woff2(tmp_path: Path) -> None:
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
    assert ttf_path.stat().st_size > 6_000
    assert woff2_path.stat().st_size > 2_000

    font = TTFont(ttf_path)
    names = {
        record.toUnicode()
        for record in font["name"].names
        if record.nameID in {1, 2, 4, 6}
    }
    assert "Telos Display" in names
    assert "Regular" in names
    assert "TelosDisplay-Regular" in names
    assert font["head"].unitsPerEm == 1000
    assert font["OS/2"].sTypoAscender >= 820
    assert font["OS/2"].sTypoDescender <= -180

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
        assert path.stat().st_size > 2_000
        font = TTFont(path)
        assert font["name"].getDebugName(1) == "Telos Display"


def glyph_signature(font: TTFont, char: str) -> tuple:
    glyph_name = font.getBestCmap()[ord(char)]
    glyph = font["glyf"][glyph_name]
    return (
        tuple(glyph.endPtsOfContours),
        tuple(tuple(point) for point in glyph.coordinates),
    )


def test_display_face_distinguishes_common_lookalikes(tmp_path: Path) -> None:
    assert builder.CONSTRUCTION == "soft-technical-contour"
    assert builder.STROKE <= 92
    assert builder.CORNER_RADIUS >= 30
    assert {"curve_s", "five_open_stem", "b_bowl_soft", "eight_waist"}.issubset(
        set(builder.SOFT_STROKES)
    )

    out_dir = tmp_path / "fonts"
    subprocess.run(
        [sys.executable, str(BUILDER), "--out-dir", str(out_dir)],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    font = TTFont(out_dir / "telos-display.ttf")

    for left, right in (("S", "5"), ("B", "8")):
        assert glyph_signature(font, left) != glyph_signature(font, right)


def glyph_has_curves(font: TTFont, char: str) -> bool:
    glyph_name = font.getBestCmap()[ord(char)]
    glyph = font["glyf"][glyph_name]
    return any(not (flag & 1) for flag in glyph.flags)


def test_display_face_uses_curved_soft_outlines(tmp_path: Path) -> None:
    out_dir = tmp_path / "fonts"
    subprocess.run(
        [sys.executable, str(BUILDER), "--out-dir", str(out_dir)],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    font = TTFont(out_dir / "telos-display.ttf")

    for char in "TelosGR8":
        assert glyph_has_curves(font, char), char


def test_lowercase_display_forms_are_native_not_scaled_uppercase() -> None:
    assert builder.profile_for_char("a") == "lowercase-native"
    assert builder.profile_for_char("e") == "lowercase-native"
    assert builder.profile_for_char("T") == "uppercase-recipe"
    assert "lc_a_bowl" in builder.shapes_for_char("a")
    assert "lc_e_crossbar" in builder.shapes_for_char("e")
    assert len(builder.shapes_for_char("s")) < len(builder.shapes_for_char("S"))
    assert builder.shapes_for_char("a") != builder.shapes_for_char("A")


def test_old_stencil_recipe_names_are_retired() -> None:
    retired = {
        "s_spine",
        "five_stem",
        "b_bowl_join",
        "eight_neck",
        "cut_top_left",
        "cut_bottom_right",
    }
    shape_names = set(builder.SOFT_STROKES)
    recipe_names = {
        shape
        for recipe in list(builder.PATTERNS.values()) + list(builder.LOWERCASE_PATTERNS.values())
        for shape in recipe
        if isinstance(shape, str)
    }
    assert shape_names.isdisjoint(retired)
    assert recipe_names.isdisjoint(retired)


def test_spacing_is_not_monospaced_for_lowercase_and_wide_forms() -> None:
    assert builder.glyph_advance("i") < builder.glyph_advance("n")
    assert builder.glyph_advance("m") > builder.glyph_advance("n")
    assert builder.glyph_advance("W") > builder.glyph_advance("I")


def test_display_face_metadata_marks_the_refined_build(tmp_path: Path) -> None:
    out_dir = tmp_path / "fonts"
    subprocess.run(
        [sys.executable, str(BUILDER), "--out-dir", str(out_dir)],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    font = TTFont(out_dir / "telos-display.ttf")

    assert font["name"].getDebugName(5) == "Version 0.4.0"
