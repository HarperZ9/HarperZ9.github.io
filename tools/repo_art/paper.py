"""Cut-paper parts: the few flat shapes every cover is built from, the shadows they cast, and their colours.

The colours are the computed inks of tools/crossover/icon_palette.py (read from its output file) wherever the
ink keeps a 3 to 1 contrast against the card's ground; SWATCH_SOURCE says which colour came from where.
Pure functions: numbers in, SVG text out.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from .card_check import contrast, hex_rgb, luminance
from .svg import num

W, H = 1200, 630
GROUND = "#040405"
BY_EYE = {"pink": "#ff4f8b", "red": "#e8392c", "yellow": "#ffd03b", "green": "#19a862", "blue": "#2f6dff",
          "cream": "#efe6d2", "black": "#0b0b0e"}
INK_FOR = {"red": "red", "yellow": "yellow", "green": "green", "blue": "cyan", "black": "black"}  # swatch: computed ink
SHAPE_FLOOR = 3.0   # WCAG 2 contrast a flat shape keeps against the ground (1.4.11, graphic objects)
BRIGHT = ("pink", "red", "yellow", "green", "blue")
PALETTE = Path(__file__).resolve().parents[2] / "world/site/crossover/icon-palette.json"


def swatch(by_eye: dict, computed: dict, ground: str = GROUND, floor: float = SHAPE_FLOOR) -> tuple[dict, dict]:
    """(colours, source per colour). A computed ink replaces the by-eye colour where it keeps `floor` against
    the ground; black is a detail ink laid on colour, so it is held against the cream paper instead."""
    inks, out, source = computed["ink"], dict(by_eye), {k: "by eye, no computed ink of this hue" for k in by_eye}
    cream = computed["paper"]
    if contrast(luminance(hex_rgb(cream)), luminance(hex_rgb(ground))) >= floor:
        out["cream"], source["cream"] = cream, "computed: paper"
    for name, ink in INK_FOR.items():
        against = out["cream"] if name == "black" else ground
        ratio = contrast(luminance(hex_rgb(inks[ink])), luminance(hex_rgb(against)))
        if ratio >= floor:
            out[name], source[name] = inks[ink], f"computed: {ink} ink, {ratio:.1f} to 1"
        else:
            source[name] = f"by eye: computed {ink} ink reaches {ratio:.1f} to 1"
    return out, source


COMPUTED = json.loads(PALETTE.read_text("utf-8"))
SWATCH, SWATCH_SOURCE = swatch(BY_EYE, COMPUTED)
OVER_KEY = {SWATCH[k]: v for k, v in INK_FOR.items()}


def over(a: str, b: str) -> str:
    """The colour where flat colour `a` prints over `b`: the computed overprint where both are inks, else multiply."""
    key = "+".join(k for k in ("red", "cyan", "yellow", "green", "black") for c in (a, b) if OVER_KEY.get(c) == k)
    if key.count("+") == 1 and key in COMPUTED["over"]:
        return COMPUTED["over"][key]
    ca, cb = (hex_rgb(c) for c in (a, b))
    return "#" + "".join(f"{round(x * y / 255):02x}" for x, y in zip(ca, cb))


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


def ring(cx, cy, r0, r1, fill: str) -> str:
    """A whole ring between two radii."""
    return (f'<path fill-rule="evenodd" d="M{num(cx - r1)} {num(cy)}a{num(r1)} {num(r1)} 0 1 0 {num(2 * r1)} 0a{num(r1)} {num(r1)} 0 1 0 {num(-2 * r1)} 0Z'
            f'M{num(cx - r0)} {num(cy)}a{num(r0)} {num(r0)} 0 1 0 {num(2 * r0)} 0a{num(r0)} {num(r0)} 0 1 0 {num(-2 * r0)} 0Z" fill="{fill}"/>')


def inks(rng: random.Random, lead: str) -> dict:
    """The colours one cover uses: its lead, a darker lead, two other brights, cream and black."""
    a, b = others(rng, lead, 2)
    return {"lead": SWATCH[lead], "dark": mix(SWATCH[lead], SWATCH["black"], 0.4), "a": a, "b": b,
            "cream": SWATCH["cream"], "black": SWATCH["black"]}


def cover_defs(uid: str) -> str:
    """Three shadows, for layers that float a little, more, and most above what they cover."""
    return "".join(f'<filter id="{uid}-sh{n}" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
                   f'<feDropShadow dx="{6 * n}" dy="{9 * n}" stdDeviation="{5 + 5 * n}" flood-color="#000" '
                   f'flood-opacity="{num(0.42 + 0.06 * n)}"/></filter>' for n in (1, 2, 3))
