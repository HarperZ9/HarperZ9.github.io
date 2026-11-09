"""Cut-paper covers: a page with no render of its own gets a drawing in flat colour with real depth.

Six families, one per kind of page. Each is built from the same few parts (disc, bar, sheet, arc)
in solid colour, laid over one another, and each layer casts a soft shadow on the layers under it.
Size carries distance: a small part reads as far away. The parts run off the right, top or bottom
of the card, so nothing is boxed in, and the left of the card stays empty for the title.

Category is carried twice, by the lead colour and by the shape. The second colour, the angle and
the placing come from the page's own slug, so two pages of one family never share a picture.

Reference, transformed and never reproduced: the Eames House of Cards and Hang-It-All (1952, 1953),
Giovanni Pintori's Olivetti posters (1949 to 1962), Bruno Munari's cut-paper books, Enzo Mari's
flat silhouettes, Massimo Vignelli's grids. The family structures still follow Runge's colour
sphere and Chevreul's chromatic circle, which credits.html names.

Pure functions: (family, slug, uid) in, SVG text out.
"""

from __future__ import annotations

import math
import random

from .page_motifs import seed_of
from .svg import num

W, H = 1200, 630
SWATCH = {"pink": "#ff4f8b", "red": "#e8392c", "yellow": "#ffd03b", "green": "#19a862", "blue": "#2f6dff",
          "cream": "#efe6d2", "black": "#0b0b0e"}
LEAD = {"contours": "pink", "map": "yellow", "plot": "green", "frames": "red", "column": "cream", "strip": "blue"}
BRIGHT = ("pink", "red", "yellow", "green", "blue")


def mix(a: str, b: str, t: float) -> str:
    """Colour `a` moved the share `t` towards `b`."""
    ca, cb = ([int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in (a, b))
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(ca, cb))


def lift(uid: str, body: str, near: int = 2) -> str:
    """One layer, with the shadow it casts on what lies under it. `near` 1 to 3: how far it floats."""
    return f'<g filter="url(#{uid}-sh{near})">{body}</g>'


def disc(cx, cy, r, fill: str) -> str:
    return f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}" fill="{fill}"/>'


def bar(x, y, w, h, fill: str, turn: float = 0.0, rx: float = 0.0) -> str:
    spin = f' transform="rotate({num(turn)} {num(x + w / 2)} {num(y + h / 2)})"' if turn else ""
    return f'<rect x="{num(x)}" y="{num(y)}" width="{num(w)}" height="{num(h)}" rx="{num(rx)}" fill="{fill}"{spin}/>'


def sector(cx, cy, r0, r1, a0, a1, fill: str) -> str:
    """A piece of a ring between two radii and two angles (degrees, clockwise from the top)."""
    def at(r, a):
        return f"{num(cx + r * math.sin(math.radians(a)))} {num(cy - r * math.cos(math.radians(a)))}"
    big = 1 if a1 - a0 > 180 else 0
    return (f'<path d="M{at(r0, a0)} L{at(r1, a0)} A{num(r1)} {num(r1)} 0 {big} 1 {at(r1, a1)} L{at(r0, a1)} '
            f'A{num(r0)} {num(r0)} 0 {big} 0 {at(r0, a0)}Z" fill="{fill}"/>')


def others(rng: random.Random, lead: str, n: int) -> list[str]:
    """`n` bright colours other than the lead, in an order the page's slug decides."""
    pool = [c for c in BRIGHT if c != lead]
    rng.shuffle(pool)
    return [SWATCH[c] for c in pool[:n]]


def globe(rng: random.Random, uid: str, lead: str) -> str:
    """Tool pages: a banded ball that runs off the card, with two smaller balls at two distances."""
    a, b = others(rng, lead, 2)
    cx, cy, r, turn = 960 + rng.uniform(-30, 30), 330 + rng.uniform(-30, 30), 262, rng.uniform(-38, -12)
    bands = "".join(bar(cx - r, cy - r + i * r / 3.5, 2 * r, r / 7, mix(SWATCH[lead], SWATCH["black"], 0.3))
                    for i in range(1, 7))
    ball = (f'<clipPath id="{uid}-ball"><circle cx="{num(cx)}" cy="{num(cy)}" r="{r}"/></clipPath>' + disc(cx, cy, r, SWATCH[lead])
            + f'<g clip-path="url(#{uid}-ball)"><g transform="rotate({num(turn)} {num(cx)} {num(cy)})">{bands}</g></g>')
    ang = math.radians(rng.uniform(200, 250))
    mx, my = cx + (r - 20) * math.cos(ang), cy - (r - 20) * math.sin(ang)
    far = math.radians(rng.uniform(100, 140))
    return (lift(uid, ball, 1) + lift(uid, disc(mx, my, 74, a), 3)
            + lift(uid, disc(cx + (r - 90) * math.cos(far), cy - (r - 90) * math.sin(far), 22, b), 2))


def wheel(rng: random.Random, uid: str, lead: str) -> str:
    """Hub pages: a ring of twelve steps in five colours, one step drawn out of the ring."""
    cx, cy, r0, r1 = 965, 315, 118, 268
    order = [SWATCH[lead]] + others(rng, lead, 4)
    out_at, start = rng.randrange(12), rng.uniform(0, 30)
    ring, pulled = "", ""
    for i in range(12):
        a0 = start + i * 30 + 1.6
        if i == out_at:
            pulled = sector(cx, cy, r0 + 34, r1 + 34, a0, a0 + 26.8, SWATCH["cream"])
        else:
            ring += sector(cx, cy, r0, r1, a0, a0 + 26.8, order[i % 5])
    return lift(uid, ring, 1) + lift(uid, pulled, 3) + lift(uid, disc(cx, cy, 58, order[2]), 2)


def plot(rng: random.Random, uid: str, lead: str) -> str:
    """Lessons and findings: columns rising off the foot of the card, a line across them, one point marked."""
    a, b = others(rng, lead, 2)
    rise, bend = rng.uniform(0.7, 1.0), rng.uniform(1.4, 2.2)
    tops = [470 - 330 * rise * (i / 5) ** bend + rng.uniform(-14, 14) for i in range(6)]
    cols = "".join(bar(660 + i * 88, tops[i], 66, H - tops[i] + 20, mix(SWATCH[lead], SWATCH["black"], 0.42 - 0.07 * i))
                   for i in range(6))
    k = rng.randrange(2, 5)
    x0, y0, x1, y1 = 640, tops[0] - 70, 1215, tops[5] - 96
    line = (f'<path d="M{x0} {num(y0)} L{x1} {num(y1)}" stroke="{SWATCH["cream"]}" stroke-width="9" '
            f'stroke-linecap="round" fill="none"/>')
    mx = 660 + k * 88 + 33
    return lift(uid, cols, 1) + lift(uid, line, 2) + lift(uid, disc(mx, y0 + (y1 - y0) * (mx - x0) / (x1 - x0), 34, a), 3) + \
        lift(uid, disc(700 + rng.uniform(0, 40), 120 + rng.uniform(0, 30), 15, b), 1)


def frames(rng: random.Random, uid: str, lead: str) -> str:
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


def column(rng: random.Random, uid: str, lead: str) -> str:
    """Essays: three sheets of paper laid one over another, lines of text as bars, one line in colour."""
    a, b = others(rng, lead, 2)
    turn, hot = rng.uniform(4, 9), rng.randrange(1, 6)
    back = bar(790, 60, 360, 640, b, turn=turn + 9)
    mid = bar(730, 96, 360, 640, mix(SWATCH[lead], SWATCH["black"], 0.3), turn=turn + 3)
    lines = "".join(bar(712, 206 + i * 58, (300, 262, 288, 214, 296, 250, 280)[(i + hot) % 7], 17,
                        a if i == hot else mix(SWATCH["cream"], SWATCH["black"], 0.72)) for i in range(8))
    top = f'<g transform="rotate({num(turn - 6)} 850 420)">' + bar(672, 134, 372, 640, SWATCH[lead]) + lines + "</g>"
    return lift(uid, back, 1) + lift(uid, mid, 2) + lift(uid, top, 3)


def strip(rng: random.Random, uid: str, lead: str) -> str:
    """Film notes: a strip of film crossing a lamp, one frame lit."""
    a, b = others(rng, lead, 2)
    turn, hot = rng.uniform(-34, -22), rng.randrange(0, 3)
    lamp = disc(1010 + rng.uniform(-30, 30), 250 + rng.uniform(-30, 30), 190, SWATCH["cream"])
    film = bar(560, 250, 900, 190, SWATCH[lead])
    for i in range(18):
        film += bar(576 + i * 50, 262, 24, 17, SWATCH["black"], rx=4) + bar(576 + i * 50, 411, 24, 17, SWATCH["black"], rx=4)
    for i in range(5):
        film += bar(590 + i * 172, 294, 150, 102, a if i == hot else mix(SWATCH[lead], SWATCH["black"], 0.55), rx=5)
    return (lift(uid, lamp, 1) + lift(uid, f'<g transform="rotate({num(turn)} 920 345)">{film}</g>', 3)
            + lift(uid, disc(700 + rng.uniform(0, 30), 110 + rng.uniform(0, 20), 26, b), 2))


FAMILIES = {"contours": globe, "map": wheel, "plot": plot, "frames": frames, "column": column, "strip": strip}
ALT = {
    "contours": "A large banded ball in flat colour runs off the right of the card, with two smaller balls near it, each casting a soft shadow.",
    "map": "A ring of twelve coloured steps, with one cream step drawn out of the ring and casting a shadow on it.",
    "plot": "Six columns rise from the foot of the card, a cream line crosses them and a coloured disc marks one point on it.",
    "frames": "Five cards fanned in a row, each with a ball a little further along its path, one card in a second colour.",
    "column": "Three sheets of paper laid one over another, with lines of text as dark bars and one line in colour.",
    "strip": "A strip of film crosses a round cream lamp at an angle, with one frame lit in a second colour.",
}


def cover_defs(uid: str) -> str:
    """Three shadows, for layers that float a little, more, and most above what they cover."""
    return "".join(f'<filter id="{uid}-sh{n}" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
                   f'<feDropShadow dx="{6 * n}" dy="{9 * n}" stdDeviation="{5 + 5 * n}" flood-color="#000" '
                   f'flood-opacity="{num(0.42 + 0.06 * n)}"/></filter>' for n in (1, 2, 3))


def cover_svg(family: str, slug: str, uid: str, ground: str) -> tuple[str, str]:
    """(defs, body) for one page's cover. The ground lifts a little to the right, so a shadow shows on it."""
    rng = random.Random(seed_of(slug))
    defs = cover_defs(uid) + (f'<linearGradient id="{uid}-lift" x1="0" y1="0" x2="1" y2="0"><stop offset="0.4" stop-color="{ground}"/>'
                              f'<stop offset="1" stop-color="{mix(ground, "#3a3c4a", 0.55)}"/></linearGradient>')
    return defs, f'<rect width="{W}" height="{H}" fill="url(#{uid}-lift)"/>' + FAMILIES[family](rng, uid, LEAD[family])
