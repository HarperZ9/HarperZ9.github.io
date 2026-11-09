"""Drawn covers for pages with no render and no cover of their own, one family per kind of page.

Each family is a pure function of (rng, palette, ink): it returns SVG for the right half of a
1200 x 630 link card. The planner (site_cards.MOTIF_RULES) picks the family from what the page
is: an archive object, a film, a lesson, a hub, an essay, a place. The slug seeds the drawing, so
two pages of one family share a shape language and a colour and never share a picture.

Colour comes from the site's colour system (world/site/crossover/colour-tokens.json): a family
takes one platform ink for dark grounds and steps it in lightness only, and each family also has
its own geometry, so a family reads with the colour removed. Two families are redrawn from
public-domain colour plates, credited on the credits page: the hub wheel from Chevreul's first
chromatic circle (1864), with its 72 graded sectors, and the place globe from Runge's colour
sphere (1810), with its meridians and parallels.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path

from .svg import circle, line, num, polyline

BOX = (600, 96, 1150, 520)  # x0, y0, x1, y1: where a family draws
TOKENS = Path(__file__).resolve().parents[2] / "world" / "site" / "crossover" / "colour-tokens.json"
INKS = {"frames": "thecmmns", "strip": "theplygrnd", "plot": "rsrch", "map": "bldlng", "column": "artiql8",
        "contours": "theflywheel"}  # family -> the platform whose dark-ground ink it draws in


def seed_of(slug: str) -> int:
    return int.from_bytes(hashlib.sha256(slug.encode("utf-8")).digest()[:8], "big")


def family_ink(family: str) -> str:
    return json.loads(TOKENS.read_text("utf-8"))["platform"][INKS[family]]["dark"]["ink"]["hex"]


def tone(ink: str, light: int = 64) -> str:
    """The ink stepped in lightness only: 64 is the ink itself, lower goes to the ground, higher to paper."""
    to, t = ((0x10, 0x13, 0x18), (64 - light) / 64) if light < 64 else ((0xED, 0xE9, 0xE1), (light - 64) / 36)
    rgb = [int(ink[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(c + (d - c) * t):02x}" for c, d in zip(rgb, to))


def rect(x, y, w, h, *, fill="none", stroke=None, width=1.0, opacity=1.0, rx=0.0) -> str:
    s = f' stroke="{stroke}" stroke-width="{num(width)}"' if stroke else ""
    return (f'<rect x="{num(x)}" y="{num(y)}" width="{num(w)}" height="{num(h)}" rx="{num(rx)}" fill="{fill}"{s}'
            f' opacity="{num(opacity)}"/>')


def frames(rng: random.Random, p: dict, ink: str) -> str:
    """An archive object: a contact sheet of twelve frames following one throw, one frame lit."""
    cw, ch, gap, x0, y0 = 124, 92, 14, 612, 140
    lift, lit, out = rng.uniform(34, 60), rng.randrange(12), []
    for i in range(12):
        x, y, t = x0 + (i % 4) * (cw + gap), y0 + (i // 4) * (ch + gap), i / 11
        on = i == lit
        out.append(rect(x, y, cw, ch, fill=tone(ink, 58) if on else p["lift"], stroke=tone(ink) if on else p["quiet"],
                        width=2 if on else 1, opacity=1 if on else 0.9, rx=3))
        out.append(line(x + 10, y + ch - 14, x + cw - 10, y + ch - 14, p["ground"] if on else p["quiet"], 1, 0.7))
        path = [(x + 14 + s / 11 * (cw - 28), y + ch - 20 - 4 * lift * (s / 11) * (1 - s / 11)) for s in range(i + 1)]
        out.append(polyline(path, p["ground"] if on else p["soft"], 1.2, 0.55))
        out.append(circle(*path[-1], 5.5, fill=p["ground"] if on else p["core"]))
    return "".join(out)


def strip(rng: random.Random, p: dict, ink: str) -> str:
    """A film: a strip of frames with a rising disc, and the sound under it with the playhead."""
    y, h, fw, out = 132, 168, 196, [rect(580, 132, 640, 168, fill=p["lift"])]
    for k in range(20):
        for yy in (y + 9, y + h - 19):
            out.append(rect(590 + k * 32, yy, 16, 10, fill=p["ground"], rx=2))
    for i in range(4):
        x = 592 + i * (fw + 12)
        out.append(rect(x, y + 28, fw, h - 56, fill=p["ground"], stroke=p["quiet"], width=1))
        out.append(circle(x + fw / 2, y + h - 40 - i * 17, 12 + i * 7, fill=tone(ink, 52 + i * 6), opacity=0.5 + i * 0.15))
    bars, head = 78, rng.randrange(18, 60)
    phase, f1, f2 = rng.uniform(0, 6), rng.uniform(0.11, 0.2), rng.uniform(0.31, 0.5)
    for b in range(bars):
        a = 10 + 58 * abs(math.sin(b * f1 + phase) * math.cos(b * f2)) + rng.uniform(0, 10)
        col = tone(ink) if b <= head else p["quiet"]
        out.append(line(600 + b * 7.4, 420 - a / 2, 600 + b * 7.4, 420 + a / 2, col, 3, 1 if b <= head else 0.6))
    out.append(line(600 + head * 7.4 + 4, 352, 600 + head * 7.4 + 4, 488, p["core"], 1.5))
    return "".join(out)


def plot(rng: random.Random, p: dict, ink: str) -> str:
    """A lesson: measured points, the curve fitted through them, and the axes they sit on."""
    x0, y0, x1, y1 = 630, 130, 1140, 480
    out = [line(x0, y1, x1, y1, p["quiet"], 1.5), line(x0, y0, x0, y1, p["quiet"], 1.5)]
    out += [line(x0 + k * 85, y1, x0 + k * 85, y1 + 8, p["quiet"], 1.5) for k in range(1, 7)]
    out += [line(x0 - 8, y1 - k * 70, x1, y1 - k * 70, p["quiet"], 1, 0.22) for k in range(1, 5)]
    rate, floor, rise = rng.uniform(2.4, 5.5), rng.uniform(0.08, 0.3), rng.random() < 0.35
    def f(t: float) -> float:
        v = floor + (1 - floor) * math.exp(-rate * t)
        return 1.08 - v if rise else v
    for _ in range(46):
        t = rng.random()
        out.append(circle(x0 + t * (x1 - x0), y1 - (f(t) + rng.gauss(0, 0.045)) * (y1 - y0) * 0.9, 4, fill=p["soft"],
                          opacity=0.55))
    out.append(polyline([(x0 + t / 60 * (x1 - x0), y1 - f(t / 60) * (y1 - y0) * 0.9) for t in range(61)], tone(ink), 4))
    return "".join(out)


def graph(rng: random.Random, p: dict, ink: str) -> str:
    """A hub: the pages it leads to as points, each joined to its two nearest, one of them lit."""
    nodes: list[tuple[float, float]] = []
    while len(nodes) < 24:
        c = (rng.uniform(BOX[0] + 10, BOX[2]), rng.uniform(BOX[1] + 20, BOX[3]))
        if all(math.dist(c, n) > 62 for n in nodes):
            nodes.append(c)
    out, lit = [], rng.randrange(24)
    for i, a in enumerate(nodes):
        near = sorted((n for n in nodes if n != a), key=lambda n: math.dist(a, n))[:2]
        out += [line(*a, *b, tone(ink) if i == lit else p["quiet"], 2 if i == lit else 1.1, 0.95 if i == lit else 0.5)
                for b in near]
    for i, a in enumerate(nodes):
        out.append(circle(*a, 12 if i == lit else rng.choice((4, 5, 7)), fill=tone(ink, 66) if i == lit else p["soft"]))
    return "".join(out)


def column(rng: random.Random, p: dict, ink: str) -> str:
    """An essay: a column of set text, one line of it marked."""
    out, marked = [], rng.randrange(3, 11)
    for row in range(14):
        x, y, end = 640.0, 132 + row * 28, 640 + rng.uniform(360, 470)
        if row == marked:
            out.append(rect(616, y - 4, 6, 20, fill=tone(ink)))
        while x < end:
            w = min(rng.uniform(22, 88), end - x)
            out.append(rect(x, y, w, 11, fill=tone(ink) if row == marked else p["quiet"],
                            opacity=1 if row == marked else 0.5, rx=2))
            x += w + 11
    return "".join(out)


def contours(rng: random.Random, p: dict, ink: str) -> str:
    """A place: ground drawn as contour lines around one high point, one contour picked out."""
    cx, cy = rng.uniform(850, 930), rng.uniform(290, 340)
    a3, a5, f3, f5 = rng.uniform(0.05, 0.16), rng.uniform(0.03, 0.09), rng.uniform(0, 6), rng.uniform(0, 6)
    lit, out = rng.randrange(3, 8), []
    for k in range(1, 10):
        ring = [(cx + r * math.cos(th) * 1.25, cy + r * math.sin(th))
                for th in (i / 96 * math.tau for i in range(97))
                for r in [k * 23 * (1 + a3 * math.sin(3 * th + f3 + k * 0.2) + a5 * math.sin(5 * th + f5))]]
        out.append(polyline(ring, tone(ink) if k == lit else p["quiet"], 3 if k == lit else 1.2, 1 if k == lit else 0.6))
    out.append(circle(cx, cy, 5, fill=p["core"]))
    return "".join(out)


def wheel(rng: random.Random, p: dict, ink: str) -> str:
    """A hub: its pages as the 72 sectors of a graded circle, after Chevreul, one sector drawn out and lit."""
    cx, cy, r0, r1 = 880.0, 312.0, 78.0, 214.0
    lit, turn, out = rng.randrange(72), rng.uniform(0, math.tau), []
    for i in range(72):
        a0, a1 = turn + i * math.tau / 72 + 0.012, turn + (i + 1) * math.tau / 72 - 0.012
        on = i == lit
        ra, rb = (r0 + 14, r1 + 26) if on else (r0, r1)
        pts = [(cx + ra * math.cos(a0), cy + ra * math.sin(a0)), (cx + rb * math.cos(a0), cy + rb * math.sin(a0)),
               (cx + rb * math.cos(a1), cy + rb * math.sin(a1)), (cx + ra * math.cos(a1), cy + ra * math.sin(a1))]
        step = 14 + 40 * (0.5 + 0.5 * math.cos((i - lit) * math.tau / 72))  # lightness runs round the circle
        d = "M" + "L".join(f"{num(x)} {num(y)}" for x, y in pts) + "Z"
        out.append(f'<path d="{d}" fill="{tone(ink, 78) if on else tone(ink, round(step))}"/>')
    out.append(circle(cx, cy, r0 - 12, fill="none", stroke=p["quiet"], width=1.2))
    return "".join(out)


def globe(rng: random.Random, p: dict, ink: str) -> str:
    """A place: a sphere drawn by its meridians and parallels, after Runge, with one cell of it lit."""
    cx, cy, r, tilt = 880.0, 312.0, 206.0, rng.uniform(0.3, 0.55)
    spin, out = rng.uniform(0, math.tau), []

    def at(lat: float, lon: float) -> tuple[float, float, float]:
        x, y, z = math.cos(lat) * math.sin(lon), math.sin(lat), math.cos(lat) * math.cos(lon)
        return cx + r * x, cy - r * (y * math.cos(tilt) - z * math.sin(tilt)), y * math.sin(tilt) + z * math.cos(tilt)

    def arc(points: list[tuple[float, float, float]], colour: str, width: float, opacity: float) -> str:
        runs, run = [], []
        for x, y, z in points:  # only the half of the sphere that faces us is drawn
            if z >= 0:
                run.append((x, y))
            elif run:
                runs.append(run)
                run = []
        return "".join(polyline(seg, colour, width, opacity) for seg in runs + [run] if len(seg) > 1)

    for k in range(-5, 6):
        out.append(arc([at(k * math.pi / 12, spin + i * math.tau / 96) for i in range(97)], p["quiet"], 1.2, 0.7))
    for k in range(12):
        out.append(arc([at(-math.pi / 2 + i * math.pi / 48, spin + k * math.tau / 12) for i in range(49)],
                       p["quiet"], 1.2, 0.7))
    out.append(circle(cx, cy, r, fill="none", stroke=p["soft"], width=1.6))
    la = rng.randrange(-1, 3) * math.pi / 12
    lo = spin + (round(-spin / (math.tau / 12)) + rng.randrange(-2, 1)) * math.tau / 12  # a cell that faces us
    cell = [at(la, lo), at(la, lo + math.tau / 12), at(la + math.pi / 12, lo + math.tau / 12), at(la + math.pi / 12, lo)]
    d = "M" + "L".join(f"{num(x)} {num(y)}" for x, y, _ in cell) + "Z"
    out.append(f'<path d="{d}" fill="{tone(ink)}" stroke="{tone(ink, 80)}" stroke-width="2"/>')
    return "".join(out)


FAMILIES = {"frames": frames, "strip": strip, "plot": plot, "map": wheel, "column": column, "contours": globe}
ALTERNATES = {"map": graph, "contours": contours}  # drawn and compared on 2026-11-09; kept for other uses


def motif_svg(family: str, slug: str, uid: str, p: dict, alternate: bool = False) -> tuple[str, str]:
    """(defs, body) for one page's drawn cover: a glow in the family's colour, then the drawing."""
    rng = random.Random(seed_of(slug))
    ink, draw = family_ink(family), (ALTERNATES if alternate else FAMILIES)[family]
    defs = (f'<radialGradient id="{uid}-glow" cx="0.74" cy="0.48" r="0.5"><stop offset="0" stop-color="{ink}"'
            f' stop-opacity="0.16"/><stop offset="1" stop-color="{ink}" stop-opacity="0"/></radialGradient>')
    return defs, f'<rect width="1200" height="630" fill="url(#{uid}-glow)"/>' + draw(rng, p, ink)
