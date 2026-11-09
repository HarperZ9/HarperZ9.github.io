"""Cut-paper covers: a page with no render of its own gets a drawing in flat colour with real depth.

Six families, one per kind of page. Each is built from the same few parts (disc, bar, sheet, arc)
in solid colour, laid over one another, and each layer casts a soft shadow on the layers under it.
Size carries distance: a small part reads as far away. The parts run off the right, top or bottom
of the card, so nothing is boxed in, and the left of the card stays empty for the title.

Category is carried by the shape. Hubs and essays take their family's lead colour one time in two;
lessons and film notes take the five bright colours in turn, so two neighbours never share one. How many
parts a drawing has comes from the page's own words; the colours, the angle and the placing come from
its slug, so two pages of one family never share a picture. Tool and room pages get a drawing of
their own subject (tool_covers).

Reference, transformed and never reproduced: the Eames House of Cards and Hang-It-All (1952, 1953),
Giovanni Pintori's Olivetti posters (1949 to 1962), Bruno Munari's cut-paper books, Enzo Mari's
flat silhouettes, Massimo Vignelli's grids. The family structures still follow Runge's colour
sphere and Chevreul's chromatic circle, which credits.html names.

Pure functions: (family, slug, uid, words) in, SVG text out.
"""

from __future__ import annotations

import math
import random

from .page_motifs import seed_of
from .paper import BRIGHT, H, SWATCH, W, bar, cover_defs, disc, lift, mix, others, sector  # noqa: F401
from .svg import num
from .tool_covers import tool_cover

LEAD = {"map": "yellow", "plot": "green", "frames": "red", "column": "cream", "strip": "blue"}


def size_of(words: str, low: int, high: int) -> int:
    """A count the page's own words decide: longer titles and summaries give more parts."""
    return low + len(words.split()) % (high - low + 1)


def lead_of(rng: random.Random, family: str) -> str:
    """The family colour one time in two, else another bright one the slug picks."""
    return LEAD[family] if rng.random() < 0.5 else rng.choice([c for c in BRIGHT if c != LEAD[family]])


DEALT = ("plot", "strip")  # families whose pages take the five brights in turn, so neighbours differ in colour


def dealt(pages: list[tuple[str, str]]) -> dict[str, str]:
    """A lead colour for each (slug, family) page of a DEALT family: the family colour first, then the other
    brights in turn, in slug order."""
    seen: dict[str, int] = {}
    out = {}
    for slug, family in sorted(pages):
        if family in DEALT:
            out[slug] = BRIGHT[(BRIGHT.index(LEAD[family]) + seen.get(family, 0)) % len(BRIGHT)]
            seen[family] = seen.get(family, 0) + 1
    return out


def wheel(rng: random.Random, uid: str, lead: str, words: str = "") -> str:
    """Hub pages: a ring of steps, one for each few words of the page's title, one or two drawn out of the ring."""
    n, cx, cy = size_of(words, 7, 14), 965 + rng.uniform(-35, 35), 315 + rng.uniform(-45, 45)
    r0, r1 = rng.uniform(70, 150), rng.uniform(236, 276)
    order = [SWATCH[lead]] + others(rng, lead, 4)
    if (few := rng.choice((0, 0, 1, 2))):  # one wheel in two keeps to its lead and one or two more colours
        order = [order[0], mix(order[0], SWATCH["black"], 0.42), order[1] if few == 2 else order[0], mix(order[0], SWATCH["black"], 0.2), order[2]]
    out_at, start, step = set(rng.sample(range(n), rng.choice((1, 1, 2)))), rng.uniform(0, 360), 360 / n
    stride = rng.choice((1, 2, 3))
    ring_, pulled = "", ""
    for i in range(n):
        a0 = start + i * step + 1.6
        if i in out_at:
            pulled += sector(cx, cy, r0 + 34, r1 + 34, a0, a0 + step - 3.2, SWATCH["cream"])
        else:
            ring_ += sector(cx, cy, r0, r1, a0, a0 + step - 3.2, order[i * stride % 5] if n % 5 else order[i * stride % 4])
    return lift(uid, ring_, 1) + lift(uid, pulled, 3) + lift(uid, disc(cx, cy, r0 * 0.5, order[2]), 2)


CURVES = (lambda t, k: t ** k, lambda t, k: 1 - t ** k, lambda t, k: math.sin(math.pi * t) ** (k / 2),
          lambda t, k: (math.floor(t * 3.01) / 3) ** (k / 2), lambda t, k: 0.5 + 0.5 * math.sin(k * 3 * t))


def plot(rng: random.Random, uid: str, lead: str, words: str = "") -> str:
    """Lessons and findings: columns rising off the foot of the card in one of five curves, a line across
    them and one point marked. The page's words set how many columns."""
    a, b = others(rng, lead, 2)
    n, curve, bend, rise = size_of(words, 4, 9), rng.choice(CURVES), rng.uniform(1.3, 2.3), rng.uniform(0.75, 1.0)
    pitch = 540 / n
    tops = [480 - 340 * rise * curve(i / (n - 1), bend) + rng.uniform(-12, 12) for i in range(n)]
    cols = "".join(bar(650 + i * pitch, tops[i], pitch * 0.74, H - tops[i] + 20, mix(SWATCH[lead], SWATCH["black"], 0.42 * (1 - i / n)))
                   for i in range(n))
    k = rng.randrange(1, n - 1)
    pts = [(650 + i * pitch + pitch * 0.37, tops[i] - 62) for i in range(n)]
    line = (f'<path d="M{" L".join(f"{num(x)} {num(y)}" for x, y in pts)}" stroke="{SWATCH["cream"]}" stroke-width="9" '
            f'stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
    return (lift(uid, cols, 1) + lift(uid, line, 2) + lift(uid, disc(pts[k][0], pts[k][1], 34, a), 3)
            + lift(uid, disc(700 + rng.uniform(0, 420), 70 + rng.uniform(0, 30), 15, b), 1))


def frames(rng: random.Random, uid: str, lead: str, words: str = "") -> str:
    """Archive objects and films: five cards fanned in a row, a ball crossing them, one card in a second colour."""
    a = others(rng, lead, 1)[0]
    hot, lean = rng.randrange(1, 4), rng.uniform(-4, 4)
    out = ""
    for i in range(5):
        x, y, turn = 640 + i * 108, 196 + 26 * math.sin(i * 1.1 + lean), lean + (i - 2) * 7.5
        fill = a if i == hot else mix(SWATCH[lead], SWATCH["black"], 0.36 - 0.09 * i if i < 4 else 0.0)
        t = i / 4
        ball = disc(x + 82, y + 40 + 150 * (2 * t - 1) ** 2, 19, SWATCH["black"] if i == hot else SWATCH["cream"])
        out += lift(uid, f'<g transform="rotate({num(turn)} {num(x + 82)} {num(y + 120)})">'
                    + bar(x, y, 164, 240, fill, rx=9) + ball + "</g>", 2)
    return out


def column(rng: random.Random, uid: str, lead: str, words: str = "") -> str:
    """Essays: two to four sheets of paper laid one over another, lines of text as bars, one line in colour.
    The page's words set how many lines the top sheet carries; the slug sets which way the sheets lean."""
    under = others(rng, "pink" if lead == "cream" else lead, 3)
    sheets, side, turn = rng.choice((2, 3, 3, 4)), rng.choice((-1, 1)), rng.uniform(3, 9)
    n, hot, x0 = size_of(words, 4, 9), 0, 700 + rng.uniform(-30, 40)
    hot, pitch = rng.randrange(n), 440 / n
    back = "".join(lift(uid, bar(x0 + 40 * (sheets - 1 - i), 80 + 14 * i, 360, 660, under[i] if i % 2 == 0 else mix(under[i], SWATCH["black"], 0.4),
                                 turn=side * (turn + 5 * (sheets - 1 - i))), 1 + min(i, 1)) for i in range(sheets - 1))
    lines = "".join(bar(x0 + 40, 196 + i * pitch, (300, 262, 288, 214, 296, 250, 280)[(i + hot) % 7], min(17, pitch * 0.34),
                        under[0] if i == hot else mix(SWATCH["cream"], SWATCH["black"], 0.72)) for i in range(n))
    top = f'<g transform="rotate({num(side * (turn - 6))} {num(x0 + 180)} 420)">' + bar(x0, 124, 372, 660, SWATCH["cream"]) + lines + "</g>"
    return back + lift(uid, top, 3)


def strip(rng: random.Random, uid: str, lead: str, words: str = "") -> str:
    """Film notes: a strip of film crossing a lamp, one frame lit. The strip leans either way, and the page's
    words set how many frames show."""
    a, b = others(rng, lead, 2)
    turn, n = rng.uniform(16, 36) * rng.choice((-1, 1)), size_of(words, 3, 6)
    hot, wide = rng.randrange(0, n - 1), 860 / n
    lamp = disc(960 + rng.uniform(-110, 90), 300 + rng.uniform(-110, 90), rng.uniform(150, 210), rng.choice((SWATCH["cream"], b)))
    film = bar(520, 250, 940, 190, SWATCH[lead])
    for i in range(19):
        film += bar(536 + i * 50, 262, 24, 17, SWATCH["black"], rx=4) + bar(536 + i * 50, 411, 24, 17, SWATCH["black"], rx=4)
    for i in range(n):
        film += bar(560 + i * wide, 294, wide - 22, 102, a if i == hot else mix(SWATCH[lead], SWATCH["black"], 0.55), rx=5)
    return (lift(uid, lamp, 1) + lift(uid, f'<g transform="rotate({num(turn)} 940 330)">{film}</g>', 3)
            + lift(uid, disc(700 + rng.uniform(0, 400), 90 + rng.uniform(0, 40) if turn < 0 else 520 + rng.uniform(0, 40), 26, b if lamp.endswith(SWATCH["cream"] + '"/>') else SWATCH["cream"]), 2))


FAMILIES = {"map": wheel, "plot": plot, "frames": frames, "column": column, "strip": strip}
ALT = {
    "map": "A ring of coloured steps, with one or two cream steps drawn out of the ring and casting a shadow on it.",
    "plot": "Columns rise from the foot of the card, a cream line runs across their tops and a coloured disc marks one point on it.",
    "frames": "Five cards fanned in a row, each with a ball a little further along its path, one card in a second colour.",
    "column": "Sheets of paper laid one over another, the top one cream with lines of text as dark bars and one line in colour.",
    "strip": "A strip of film crosses a round lamp at an angle, with one frame lit in a second colour.",
}


def cover_svg(family: str, slug: str, uid: str, ground: str, words: str = "", shape: str | None = None,
              lead: str | None = None) -> tuple[str, str]:
    """(defs, body) for one page's cover. The ground lifts a little to the right, so a shadow shows on it.
    A tool or room page gets the drawing its own `words` pick (tool_covers); `shape` forces one, and `lead`
    is the colour dealt to it among the pages that share its drawing."""
    rng = random.Random(seed_of(slug))
    defs = cover_defs(uid) + (f'<linearGradient id="{uid}-lift" x1="0" y1="0" x2="1" y2="0"><stop offset="0.4" stop-color="{ground}"/>'
                              f'<stop offset="1" stop-color="{mix(ground, "#3a3c4a", 0.55)}"/></linearGradient>')
    if family == "contours":
        art = tool_cover(slug, words, uid, shape, lead)[1]
    else:
        picked = lead_of(rng, family)
        art = FAMILIES[family](rng, uid, lead or picked, words)
    return defs, f'<rect width="{W}" height="{H}" fill="url(#{uid}-lift)"/>' + art
