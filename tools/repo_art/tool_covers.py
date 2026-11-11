"""Subject diagrams for tool and room pages: one cut-paper drawing per subject, in the cover language.

The page's own words pick the drawing (TOPICS, first match on slug, title and summary), a number word in
the title sets how many parts it has, and the slug sets colour, angle and placing. So a page about a scale
gets a balance, a page about a lock gets a keyhole, and two pages that share a drawing still differ.

Pure functions: (slug, title, summary, uid) in, (drawing name, SVG text) out.
"""

from __future__ import annotations

import math
import random
import re

from .page_motifs import seed_of
from .paper import BRIGHT, bar, disc, inks, lift, mix, over, ring, sector
from .svg import num

NUMBER = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
TOPICS = (
    (r"balance|scale|weigh|verdict|dispose", "balance"), (r"lanes|labels|report|spine|articulate", "lanes"),
    (r"lock|verified|emet|witness|checking", "keyhole"), (r"powers|buildlang|builds|borrowed|conferred|why", "nest"),
    (r"road|tour|reach|growth", "road"), (r"grid|crowd|consensus|universe|we are here|lossy", "dots"),
    (r"flywheel|engine revival|cmmns", "spokes"), (r"groove|bukem|bedtime", "record"),
    (r"sound|hum|music|sung|stations|forecast", "meter"), (r"circle|eye", "rings"),
    (r"glass|water|palimpsest|looked|studio", "lens"), (r"hair|baron|test", "loop"),
    (r"vitae|resume|hire|work with|letter|terms|archiv", "fan"),
)
ALT = {
    "balance": "A cut-paper balance: a tilted beam on a post, a large disc on the low side and a small one on the high side.",
    "lanes": "Cut-paper lanes: parallel bars of different lengths at three heights, one in a second colour.",
    "keyhole": "A large flat disc with a black keyhole cut in it and a cream key lying across its edge.",
    "nest": "Squares of flat colour nested one inside another, each turned a little further than the last.",
    "road": "A winding road in flat colour runs up the card, with discs along it that shrink with distance.",
    "dots": "A field of flat discs in rows, a few of them raised and in a second colour.",
    "spokes": "A spoked wheel in flat colour runs off the card, with a small weight on its rim.",
    "record": "A record in flat colour with dark grooves, a cream wedge across them and an arm resting on it.",
    "meter": "A row of upright bars of different heights, like a sound level, one in a second colour.",
    "rings": "Two equal discs, one ringed by small discs and one by large discs that run off the card.",
    "lens": "Two flat discs overlap, and the overlap takes the colour the two inks print together.",
    "loop": "An open ring with a cream bar rising from one end off the card and a disc at the other end.",
    "fan": "Cards of flat colour fanned from one corner, one in a second colour.",
    "ball": "A large ball in flat colour runs off the right of the card, with smaller balls near it.",
}


def count(words: str, rng: random.Random, low: int, high: int) -> int:
    """How many parts: a number the page states, else one the slug decides."""
    said = [NUMBER[w] for w in re.findall(r"[a-z]+", words.lower()) if w in NUMBER]
    return max(low, min(high, said[0])) if said else rng.randint(low, high)


def balance(rng, uid, c, words):
    tilt = rng.uniform(9, 17) * rng.choice((-1, 1))
    px, py, arm = 930, 250, 240
    dx, dy = arm * math.cos(math.radians(tilt)), arm * math.sin(math.radians(tilt))
    heavy, light = (1, -1) if tilt > 0 else (-1, 1)
    pans = ""
    for side, r, fill in ((heavy, rng.uniform(78, 96), c["lead"]), (light, rng.uniform(34, 50), c["a"])):
        ex, ey = px + side * dx, py + side * dy
        pans += bar(ex - 3, ey, 6, 60 + r, c["cream"]) + disc(ex, ey + 60 + r, r, fill)
    return (lift(uid, bar(px - 13, py, 26, 420, c["dark"]), 1) + lift(uid, pans, 3)
            + lift(uid, bar(px - arm - 20, py - 10, 2 * arm + 40, 20, c["cream"], turn=tilt, rx=4) + disc(px, py, 22, c["b"]), 2))


def lanes(rng, uid, c, words):
    n, hot, turn = count(words, rng, 3, 7), 0, rng.uniform(-9, 9)
    hot, tall, out = rng.randrange(n), 420 / n, ""
    for i in range(n):
        x, y, long = 660 + rng.uniform(0, 90), 110 + i * tall, rng.uniform(260, 620)
        fill = c["a"] if i == hot else mix(c["lead"], c["black"], 0.5 * i / n)
        out += lift(uid, bar(x, y, long, tall * 0.62, fill, rx=tall * 0.31) + disc(x + tall * 0.31, y + tall * 0.31, tall * 0.17, c["black"]), 1 + i % 3)
    return f'<g transform="rotate({num(turn)} 930 315)">{out}</g>'


def keyhole(rng, uid, c, words):
    cx, cy, r, turn = 950 + rng.uniform(-30, 30), 300 + rng.uniform(-20, 20), rng.uniform(180, 240), rng.uniform(20, 56) * rng.choice((1, -0.6))
    hole = disc(cx, cy - 34, 50, c["black"]) + f'<path d="M{num(cx - 24)} {num(cy - 10)}L{num(cx + 24)} {num(cy - 10)}L{num(cx + 46)} {num(cy + 104)}L{num(cx - 46)} {num(cy + 104)}Z" fill="{c["black"]}"/>'
    teeth = "".join(bar(cx + 150 + i * 30, cy + 196, 16, 26 + 12 * ((i * 7 + int(r)) % 3), c["cream"]) for i in range(count(words, rng, 2, 4)))
    key = ring(cx + 10, cy + 186, 20, 46, c["cream"]) + bar(cx + 50, cy + 176, 210, 20, c["cream"]) + teeth
    return (lift(uid, disc(cx, cy, r, c["lead"]) + hole, 1) + lift(uid, f'<g transform="rotate({num(-turn)} {num(cx + 10)} {num(cy + 186)})">{key}</g>', 3)
            + lift(uid, disc(cx - r * 0.86, cy - r * 0.62, 26, c["a"]), 2))


def nest(rng, uid, c, words):
    n, step, size, out = count(words, rng, 4, 6), rng.uniform(8, 16) * rng.choice((-1, 1)), 470.0, ""
    fills = [c["dark"], c["lead"], c["a"], c["cream"], c["b"], c["black"]]
    rng.shuffle(fills)
    for i in range(n):
        out += lift(uid, bar(945 - size / 2, 315 - size / 2, size, size, fills[i % 6], turn=step * (i + 1.5)), 1 + min(i, 2))
        size *= 0.66
    return out


def road(rng, uid, c, words):
    n, lean = count(words, rng, 3, 7), rng.uniform(-60, 60)
    d = f"M{num(820 + lean)} 700 C{num(1180 + lean)} 520 {num(640 - lean)} 380 {num(930)} 240 S{num(1080 + lean)} 60 {num(1120)} -60"
    way = (f'<path d="{d}" stroke="{c["lead"]}" stroke-width="120" fill="none"/>'
           f'<path d="{d}" stroke="{c["cream"]}" stroke-width="7" stroke-dasharray="34 30" fill="none"/>')
    stones = ""
    for i in range(n):
        t = i / max(1, n - 1)
        stones += disc(1090 - 300 * abs(math.sin(2.4 * t + lean / 40)) + 160 * t, 560 - 500 * t, 44 - 30 * t, c["a"] if i % 2 else c["b"])
    return lift(uid, way, 1) + lift(uid, stones, 3)


def dots(rng, uid, c, words):
    n, turn, flat, up = count(words, rng, 1, 5), rng.uniform(-10, 10), "", ""
    cells = [(i, j) for i in range(6) for j in range(5)]
    hot = set(rng.sample(cells, n))
    gone = set(rng.sample([k for k in cells if k not in hot], rng.randint(0, 4)))
    for i, j in cells:
        x, y = 690 + i * 96, 96 + j * 96
        if (i, j) in hot:
            up += disc(x, y, 38, c["a"])
        elif (i, j) not in gone:
            flat += disc(x, y, 27, c["lead"] if (i + j) % 2 else c["dark"])
    return f'<g transform="rotate({num(turn)} 930 315)">' + lift(uid, flat, 1) + lift(uid, up, 3) + "</g>"


def spokes(rng, uid, c, words):
    n, cx, cy, start = count(words, rng, 3, 9), 960 + rng.uniform(-30, 30), 330 + rng.uniform(-30, 30), rng.uniform(0, 90)
    arms = "".join(bar(cx - 12, cy - 214, 24, 214, c["dark"], turn=0).replace("/>", f' transform="rotate({num(start + i * 360 / n)} {num(cx)} {num(cy)})"/>')
                   for i in range(n))
    at = math.radians(start + rng.uniform(20, 300))
    return (lift(uid, arms, 1) + lift(uid, ring(cx, cy, 204, 264, c["lead"]), 2) + lift(uid, disc(cx, cy, 58, c["a"]), 3)
            + lift(uid, disc(cx + 234 * math.sin(at), cy - 234 * math.cos(at), 40, c["b"]), 3))


def record(rng, uid, c, words):
    cx, cy, n, skip = 965 + rng.uniform(-30, 30), 335 + rng.uniform(-25, 25), count(words, rng, 3, 6), rng.uniform(190, 330)
    grooves = "".join(ring(cx, cy, 104 + i * 150 / n, 104 + i * 150 / n + 9, c["black"]) for i in range(n))
    plate = disc(cx, cy, 262, c["lead"]) + grooves + sector(cx, cy, 92, 262, skip, skip + rng.uniform(5, 13), c["cream"]) + disc(cx, cy, 84, c["a"]) + disc(cx, cy, 13, c["black"])
    arm = f'<g transform="rotate({num(rng.uniform(18, 34))} 1170 40)">' + bar(1160, 30, 20, 330, c["cream"], rx=8) + bar(1146, 330, 48, 70, c["b"], rx=6) + "</g>"
    return lift(uid, plate, 1) + lift(uid, arm, 3) + lift(uid, disc(1170, 40, 34, c["b"]), 2)


def meter(rng, uid, c, words):
    n, hot, out = count(words, rng, 7, 12), 0, ""
    hot, wide, wave = rng.randrange(1, n - 1), 520 / n, rng.uniform(0.5, 1.6)
    for i in range(n):
        tall = 90 + 380 * abs(math.sin(wave * i + rng.uniform(-0.3, 0.3)))
        fill = c["a"] if i == hot else mix(c["lead"], c["black"], 0.45 * abs(i - n / 2) / n)
        out += lift(uid, bar(660 + i * wide, 315 - tall / 2, wide * 0.6, tall, fill, rx=wide * 0.3), 1 + i % 3)
    return out + lift(uid, disc(660 + hot * wide + wide * 0.3, 60, 20, c["b"]), 2)


def rings(rng, uid, c, words):
    n, r, flip = count(words, rng, 6, 10), rng.uniform(44, 56), rng.choice((0, 1))
    (sx, sy), (bx, by) = ((790, 400), (1060, 250)) if flip else ((800, 200), (1050, 380))
    small = "".join(disc(sx + 96 * math.cos(2 * math.pi * i / n), sy + 96 * math.sin(2 * math.pi * i / n), 19, c["b"]) for i in range(n))
    big = "".join(disc(bx + 176 * math.cos(2 * math.pi * i / 5 + 0.3), by + 176 * math.sin(2 * math.pi * i / 5 + 0.3), 82, c["a"]) for i in range(5))
    return lift(uid, big, 1) + lift(uid, small, 2) + lift(uid, disc(sx, sy, r, c["lead"]) + disc(bx, by, r, c["lead"]), 3)


def lens(rng, uid, c, words):
    ax, ay, r, ang = 870 + rng.uniform(-20, 30), 300 + rng.uniform(-30, 30), rng.uniform(170, 200), rng.uniform(-0.6, 0.6)
    bx, by = ax + 1.05 * r * math.cos(ang), ay + 1.05 * r * math.sin(ang)
    clip = f'<clipPath id="{uid}-lens"><circle cx="{num(ax)}" cy="{num(ay)}" r="{num(r)}"/></clipPath>'
    both = f'<g clip-path="url(#{uid}-lens)">{disc(bx, by, r, over(c["lead"], c["a"]))}</g>'
    return clip + lift(uid, disc(ax, ay, r, c["lead"]), 1) + lift(uid, disc(bx, by, r, c["a"]), 2) + both + lift(uid, disc(ax - r * 0.5, ay + r * 0.95, 30, c["b"]), 3)


def loop(rng, uid, c, words):
    cx, cy, gap, turn = 940 + rng.uniform(-30, 30), 370 + rng.uniform(-20, 20), rng.uniform(40, 80), rng.uniform(-30, 40)
    ex, ey = cx + 180 * math.sin(math.radians(turn + gap)), cy - 180 * math.cos(math.radians(turn + gap))
    return (lift(uid, sector(cx, cy, 150, 210, turn + gap, turn + 360, c["lead"]), 1) + lift(uid, bar(ex - 13, -40, 26, ey + 40, c["cream"]), 2)
            + lift(uid, disc(cx + 180 * math.sin(math.radians(turn)), cy - 180 * math.cos(math.radians(turn)), 46, c["a"]), 3)
            + lift(uid, disc(cx, cy, 30, c["b"]), 2))


def fan(rng, uid, c, words):
    n, hot, px, out = count(words, rng, 3, 6), 0, 900 + rng.uniform(-40, 60), ""
    hot, spread = rng.randrange(n), rng.uniform(11, 17)
    for i in range(n):
        fill = c["a"] if i == hot else mix(c["lead"], c["black"], 0.5 * (n - 1 - i) / n)
        card = bar(px - 110, 150, 220, 340, fill, rx=10) + bar(px - 80, 190, 100, 14, c["black"]) + disc(px + 70, 450, 16, c["cream"])
        out += lift(uid, f'<g transform="rotate({num((i - (n - 1) / 2) * spread + 8)} {num(px)} 760)">{card}</g>', 1 + min(i, 2))
    return out


def ball(rng, uid, c, words):
    """The round 4 picture with more shapes in it: a ball banded, ringed, halved or cut in wedges."""
    cx, cy, r, kind, turn = 960 + rng.uniform(-30, 30), 330 + rng.uniform(-30, 30), 262, rng.randrange(4), rng.uniform(-38, 38)
    if kind == 0:
        cut = "".join(bar(cx - r, cy - r + i * r / 3.5, 2 * r, r / 7, c["dark"]) for i in range(1, 7))
    elif kind == 1:
        cut = "".join(ring(cx, cy, 50 + i * 56, 74 + i * 56, c["dark"]) for i in range(4))
    elif kind == 2:
        cut = bar(cx - r, cy, 2 * r, r, c["a"])
    else:
        cut = "".join(sector(cx, cy, 0.1, r, i * 60, i * 60 + 30, c["dark"]) for i in range(6))
    body = (f'<clipPath id="{uid}-ball"><circle cx="{num(cx)}" cy="{num(cy)}" r="{r}"/></clipPath>' + disc(cx, cy, r, c["lead"])
            + f'<g clip-path="url(#{uid}-ball)"><g transform="rotate({num(turn)} {num(cx)} {num(cy)})">{cut}</g></g>')
    moons = ""
    for i in range(rng.randint(1, 3)):
        at = math.radians(rng.uniform(100, 250))
        moons += lift(uid, disc(cx + (r - 30 * i) * math.cos(at), cy - (r - 30 * i) * math.sin(at), 74 - 24 * i, (c["b"], c["cream"], c["a"])[i]), 3 - i % 2)
    return lift(uid, body, 1) + moons


DRAW = {f.__name__: f for f in (balance, lanes, keyhole, nest, road, dots, spokes, record, meter, rings, lens, loop, fan, ball)}
PLAIN = tuple(k for k in DRAW if k != "ball")


def subject(slug: str, words: str) -> str:
    """The drawing a page gets: the first topic its name and title match, else its summary, else one the slug
    decides. `words` is the title, a line break, then the summary."""
    title, _, summary = words.partition("\n")
    name = slug.rsplit("--", 1)[-1].replace("-", " ")
    for text in (f"{name} {title}", summary):
        for pattern, shape in TOPICS:
            if re.search(pattern, text.lower()):
                return shape
    return PLAIN[seed_of(slug) % len(PLAIN)]


def leads(pages: list[tuple[str, str]]) -> dict[str, str]:
    """A lead colour for each (slug, words) page, dealt in turn among the pages that share a drawing, so
    two pages with one drawing take different colours until the five brights run out."""
    seen: dict[str, int] = {}
    out = {}
    for slug, words in sorted(pages):
        name = subject(slug, words)
        out[slug] = BRIGHT[(seed_of(name) + seen.get(name, 0)) % len(BRIGHT)]
        seen[name] = seen.get(name, 0) + 1
    return out


def tool_cover(slug: str, words: str, uid: str, name: str | None = None, lead: str | None = None) -> tuple[str, str]:
    """(drawing name, SVG body) for one tool or room page. `name` forces a drawing, for a comparison sheet;
    `lead` is the colour `leads` dealt the page, else one its slug picks."""
    rng = random.Random(seed_of(slug))
    name = name or subject(slug, words)
    pick = BRIGHT[rng.randrange(len(BRIGHT))]
    return name, DRAW[name](rng, uid, inks(rng, lead or pick), words)
