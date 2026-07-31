from __future__ import annotations

import argparse
import math
from pathlib import Path

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont


CONSTRUCTION = "readable-outline-derivation"
FONT_VERSION = "0.5.0"
BUILD_ID = "2026-07-09.5"
SOURCE_FONT = Path("system/fonts/kilon.woff2")

FAMILY_NAME = "Telos Display"
STYLE_NAME = "Regular"
FULL_NAME = "Telos Display"
POSTSCRIPT_NAME = "TelosDisplay-Regular"


NAME_IDS_TO_REPLACE = {1, 2, 3, 4, 5, 6, 16, 17}


def font_source(root: Path) -> Path:
    source = root / SOURCE_FONT
    if not source.is_file():
        raise FileNotFoundError(source)
    return source


def set_name(font: TTFont, name_id: int, value: str) -> None:
    name_table = font["name"]
    for platform_id, encoding_id, language_id in (
        (3, 1, 0x409),  # Windows, Unicode BMP, en-US
        (1, 0, 0),  # Macintosh, Roman
    ):
        name_table.setName(value, name_id, platform_id, encoding_id, language_id)


def rewrite_names(font: TTFont) -> None:
    name_table = font["name"]
    name_table.names = [
        record for record in name_table.names if record.nameID not in NAME_IDS_TO_REPLACE
    ]
    set_name(font, 1, FAMILY_NAME)
    set_name(font, 2, STYLE_NAME)
    set_name(font, 3, f"{FAMILY_NAME} {STYLE_NAME} {BUILD_ID}")
    set_name(font, 4, FULL_NAME)
    set_name(font, 5, f"Version {FONT_VERSION}")
    set_name(font, 6, POSTSCRIPT_NAME)
    set_name(font, 16, FAMILY_NAME)
    set_name(font, 17, STYLE_NAME)


def transform_simple_glyphs(font: TTFont) -> None:
    glyf = font["glyf"]
    hmtx = font["hmtx"].metrics

    for glyph_name in font.getGlyphOrder():
        glyph = glyf[glyph_name]
        if glyph_name == ".notdef" or glyph.isComposite() or glyph.numberOfContours <= 0:
            continue
        if not hasattr(glyph, "coordinates"):
            continue

        advance_width = hmtx.get(glyph_name, (font["head"].unitsPerEm, 0))[0]
        center_x = advance_width / 2
        new_points = []

        for index, (x, y) in enumerate(glyph.coordinates):
            # Small enough to preserve readability, visible enough to make the
            # generated face a real derivative rather than a renamed copy.
            slant = (y - font["head"].unitsPerEm * 0.48) * 0.018
            breathing = math.sin((index * 1.618 + y * 0.009 + advance_width * 0.001)) * 4.0
            narrowed = center_x + (x - center_x) * 0.988
            new_points.append((round(narrowed + slant + breathing), round(y)))

        glyph.coordinates = type(glyph.coordinates)(new_points)
        glyph.recalcBounds(glyf)


def add_lower_l_terminal(font: TTFont) -> None:
    cmap = font.getBestCmap()
    glyph_name = cmap.get(ord("l"))
    if glyph_name is None:
        return

    glyf = font["glyf"]
    hmtx = font["hmtx"].metrics
    advance_width = hmtx[glyph_name][0]
    glyph = glyf[glyph_name]
    pen = TTGlyphPen(None)
    glyph.draw(pen, glyf)

    x0 = round(advance_width * 0.44)
    x1 = round(advance_width * 0.88)
    y0 = 20
    y1 = 172
    r = 44
    pen.moveTo((x0, y0))
    pen.lineTo((x1 - r, y0))
    pen.qCurveTo((x1, y0), (x1, y0 + r))
    pen.lineTo((x1, y1 - r))
    pen.qCurveTo((x1, y1), (x1 - r, y1))
    pen.lineTo((x0, y1))
    pen.closePath()
    glyf[glyph_name] = pen.glyph()
    glyf[glyph_name].recalcBounds(glyf)


def tune_metrics(font: TTFont) -> None:
    os2 = font["OS/2"]
    os2.usWeightClass = 760
    os2.usWidthClass = 5
    if hasattr(os2, "sxHeight"):
        os2.sxHeight = max(getattr(os2, "sxHeight", 0), 1040)
    if hasattr(os2, "sCapHeight"):
        os2.sCapHeight = max(getattr(os2, "sCapHeight", 0), 1460)

    hhea = font["hhea"]
    hhea.lineGap = max(hhea.lineGap, 80)
    os2.sTypoLineGap = max(os2.sTypoLineGap, 80)

    post = font["post"]
    post.italicAngle = 0


def build_font(out_dir: Path, *, root: Path | None = None) -> tuple[Path, Path]:
    root = Path.cwd() if root is None else root
    out_dir.mkdir(parents=True, exist_ok=True)

    font = TTFont(font_source(root))
    transform_simple_glyphs(font)
    add_lower_l_terminal(font)
    rewrite_names(font)
    tune_metrics(font)

    ttf_path = out_dir / "telos-display.ttf"
    woff2_path = out_dir / "telos-display.woff2"

    font.flavor = None
    font.save(ttf_path)

    web_font = TTFont(ttf_path)
    web_font.flavor = "woff2"
    web_font.save(woff2_path)
    return ttf_path, woff2_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the generated Project Telos display face.")
    parser.add_argument("--out-dir", type=Path, default=Path("system/fonts"))
    args = parser.parse_args()
    ttf_path, woff2_path = build_font(args.out_dir)
    print(f"wrote {ttf_path}")
    print(f"wrote {woff2_path}")


if __name__ == "__main__":
    main()
