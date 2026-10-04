"""Static README badges as committed SVG, for repositories whose README may show only its own files.

    python -m tools.repo_art.badges OUT_DIR label=value [label=value ...]

Each badge is a two-part flat label in the header's colours (ink on ink-dark), with
text outlined from Conso, so it renders the same everywhere and needs no service.
A static badge does not update itself: put the date in the value when the fact can change.
"""

from __future__ import annotations

import sys
from pathlib import Path

from tools.repo_art.svg import escape, num
from tools.repo_art.type import measure, text_path

H, SIZE, PAD = 20.0, 11.0, 7.0
DARK, INK, LIGHT = "#1a1712", "#e6e1d6", "#e6e1d6"


def badge(label: str, value: str) -> str:
    lw = measure(label, "mono-regular", SIZE, 0.02) + PAD * 2
    vw = measure(value, "mono-medium", SIZE, 0.02) + PAD * 2
    w = lw + vw
    body = (f'<rect width="{num(lw)}" height="{num(H)}" fill="{DARK}"/>'
            f'<rect x="{num(lw)}" width="{num(vw)}" height="{num(H)}" fill="{INK}"/>'
            + text_path(label, "mono-regular", SIZE, PAD, 14, tracking=0.02, fill=LIGHT)
            + text_path(value, "mono-medium", SIZE, lw + PAD, 14, tracking=0.02, fill=DARK))
    title = f"{label}: {value}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(w)} {num(H)}" width="{num(w)}" '
            f'height="{num(H)}" role="img" aria-label="{escape(title)}"><title>{escape(title)}</title>'
            f'{body}</svg>\n')


def main(argv: list[str]) -> int:
    out = Path(argv[0])
    out.mkdir(parents=True, exist_ok=True)
    for pair in argv[1:]:
        label, value = pair.split("=", 1)
        name = label.lower().replace(" ", "-") + ".svg"
        (out / name).write_bytes(badge(label, value).encode("utf-8"))
        print(out / name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
