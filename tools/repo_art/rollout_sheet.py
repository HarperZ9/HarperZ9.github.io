"""Review sheets for a roll-out render: heroes (dark and light) and marks at 16 and 512 px.

    python -m tools.repo_art.rollout_sheet RENDER_DIR OUT_PREFIX

Writes OUT_PREFIX-heroes-N.png (eight repositories a sheet) and OUT_PREFIX-marks.png.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from tools.repo_art.type import font_path


def build(src: Path, prefix: str) -> list[Path]:
    names = sorted(p.name for p in src.iterdir() if (p / "hero-dark.png").exists())
    font = ImageFont.truetype(str(font_path("mono-regular")), 16)
    outs = []
    for k in range(0, len(names), 8):
        group = names[k:k + 8]
        sheet = Image.new("RGB", (1600, 330 * len(group)), (58, 58, 58))
        d = ImageDraw.Draw(sheet)
        for i, n in enumerate(group):
            y = i * 330
            d.text((8, y + 4), n, fill=(240, 240, 240), font=font)
            for j, theme in enumerate(("dark", "light")):
                im = Image.open(src / n / f"hero-{theme}.png").convert("RGB").resize((790, 296), Image.LANCZOS)
                sheet.paste(im, (j * 805 + 5, y + 26))
        out = Path(f"{prefix}-heroes-{k // 8 + 1}.png")
        sheet.save(out)
        outs.append(out)
    cols = 10
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 160, rows * 200), (58, 58, 58))
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        x, y = (i % cols) * 160, (i // cols) * 200
        big = Image.open(src / n / "mark-full-tile-512.png").convert("RGB").resize((110, 110), Image.LANCZOS)
        small = Image.open(src / n / "mark-micro-tile-16.png").convert("RGB").resize((48, 48), Image.NEAREST)
        sheet.paste(big, (x + 5, y + 5))
        sheet.paste(small, (x + 112, y + 5))
        d.text((x + 5, y + 122), n[:19], fill=(240, 240, 240), font=font)
    out = Path(f"{prefix}-marks.png")
    sheet.save(out)
    outs.append(out)
    return outs


if __name__ == "__main__":
    for o in build(Path(sys.argv[1]), sys.argv[2]):
        print(o)
