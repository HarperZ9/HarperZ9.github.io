"""Build the review contact sheet from a render folder.

    python -m tools.repo_art.sheet RENDER_DIR OUT.png

Per repository: hero (dark and light), social preview, the hero at README thumbnail
width on GitHub's dark and light page colours, and the mark at 16, 32 and 512 px in
both themes plus a lockup. Page cards run along the bottom.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from tools.repo_art.type import font_path

GH_DARK, GH_LIGHT, SHEET = (13, 17, 23), (255, 255, 255), (58, 58, 58)
HERE = Path(__file__).resolve().parent


def fit(im: Image.Image, w: int) -> Image.Image:
    im = im.convert("RGBA")
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def on(bg, im: Image.Image, pad: int = 10) -> Image.Image:
    tile = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), bg + (255,))
    tile.alpha_composite(im, (pad, pad))
    return tile


def build(src: Path, out: Path) -> None:
    repos = list(json.loads((HERE / "repos.json").read_text("utf-8"))["repos"])
    font = ImageFont.truetype(str(font_path("mono-regular")), 18)
    row_h, W = 430, 3260
    cards = sorted((src / "cards").glob("*.jpg"))
    H = 70 + row_h * len(repos) + (440 if cards else 0)
    sheet = Image.new("RGBA", (W, H), SHEET + (255,))
    d = ImageDraw.Draw(sheet)
    d.text((24, 22), "Pilot: README hero (dark, light), social preview, README thumbnail on GitHub dark and light, "
           "marks at 16 / 32 / 512 px, lockup", fill=(230, 230, 230), font=font)
    for i, n in enumerate(repos):
        y = 70 + i * row_h
        d.text((24, y), n, fill=(255, 255, 255), font=font)
        y += 28
        sheet.alpha_composite(fit(Image.open(src / n / "hero-dark.png"), 1000), (24, y))
        sheet.alpha_composite(fit(Image.open(src / n / "hero-light.png"), 1000), (1040, y))
        sheet.alpha_composite(fit(Image.open(src / n / "social-dark.png"), 480), (2056, y))
        hero = Image.open(src / n / "hero-dark.png")
        sheet.alpha_composite(on(GH_DARK, fit(hero, 230)), (2056, y + 252))
        sheet.alpha_composite(on(GH_LIGHT, fit(Image.open(src / n / "hero-light.png"), 230)), (2306, y + 252))
        x = 2560
        for size in (16, 32):
            m = Image.open(src / n / f"mark-micro-tile-{size}.png").convert("RGBA")
            sheet.alpha_composite(on(GH_LIGHT, m, 6), (x, y))
            sheet.alpha_composite(on(GH_DARK, m, 6), (x, y + 50))
            big = m.resize((size * 4, size * 4), Image.NEAREST)
            sheet.alpha_composite(big, (x + 50, y))
            x += 50 + size * 4 + 16
        sheet.alpha_composite(fit(Image.open(src / n / "mark-full-tile-512.png"), 150), (x, y))
        lm = fit(Image.open(src / n / "mark-full-light-512.png"), 110)
        dm = fit(Image.open(src / n / "mark-full-dark-512.png"), 110)
        sheet.alpha_composite(on(GH_LIGHT, lm), (2560, y + 140))
        sheet.alpha_composite(on(GH_DARK, dm), (2700, y + 140))
        lock = Image.open(src / n / "lockup-horizontal-light.png")
        sheet.alpha_composite(on(GH_LIGHT, fit(lock, 300)), (2840, y + 140))
        lockd = Image.open(src / n / "lockup-stacked-dark.png")
        sheet.alpha_composite(on(GH_DARK, fit(lockd, 110)), (2840, y + 240))
    y = 70 + row_h * len(repos)
    for k, c in enumerate(cards):
        sheet.alpha_composite(fit(Image.open(c), 780), (24 + k * 800, y + 10))
    sheet.convert("RGB").save(out, optimize=True)


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]))
