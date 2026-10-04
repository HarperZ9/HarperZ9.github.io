"""Tool marks: one construction for every tool, one silhouette per tool.

Construction (512 grid, centre 256): an aperture ring of radius 196, a core at
the centre, and one function element. Telos alone replaces the ring with the
eye, the original Telos form. Two optical sizes share the silhouette:
  micro (16 to 32 px): heavy strokes, the silhouette only
  full (64 px and up): the same silhouette plus line-work, glow and, once stable, the flare
"""

from __future__ import annotations

import math
import re

from tools import superstack as ss

from .ctx import MATURITY, Rand
from .family_marks import element
from .svg import PAL, TAU, arc_points, circle, core, core_defs, flare, line, num, polar, polyline, svg_doc
from .type import measure, text_path

C, RING = 256.0, 196.0
# Angle ranges (radians, 0 = right, clockwise) where a tool's element meets the ring.
FLARE_KEEP_OUT = {"gather": (2.2, 4.1), "forum": (5.4, 7.0), "raw-native": (1.4, 4.9)}


def _micro(name: str, ink: str, ground: str, w: float) -> list[str]:
    """The silhouette. w is the stroke width in grid units."""
    o = []
    if name != "telos":
        o.append(circle(C, C, RING, ink, w))
    if name == "crucible":
        kite = [(C, C - 150), (C + 66, C), (C, C + 150), (C - 150, C)]
        if w >= 30:  # micro: a solid kite reads at 16 px; the dent is the weakest axis
            o.append(f'<polygon points="{" ".join(f"{num(x)},{num(y)}" for x, y in kite)}" fill="{ink}"/>')
        else:
            o.append(polyline(kite + kite[:1], ink, w * 0.8))
    elif name == "forum":
        if w >= 30:  # micro: one heavy wave; two arcs merge at 16 px
            o.append(polyline(arc_points(C - 70, C, 128, -0.9, 0.9, 24), ink, w * 1.05))
        else:
            for rr in (82, 142):
                o.append(polyline(arc_points(C - 70, C, rr, -0.95, 0.95, 24), ink, w * 0.85))
    elif name == "gather":
        o = [polyline(arc_points(C, C, RING, math.pi + 0.62, TAU + math.pi - 0.62, 48), ink, w)]
        for dy in (-92, 0, 92):
            o.append(line(C - 236, C + dy * 1.25, C, C, ink, w * 0.75))
    elif name == "index":
        for a in (-math.pi / 2, math.pi / 6, 5 * math.pi / 6):
            x, y = polar(C, C, 128, a)
            o.append(line(C, C, x, y, ink, w * 0.7))
            o.append(circle(x, y, 40, ink, w * 0.7, fill=ground))
    elif name == "telos":
        o.append(polyline(_almond(236, 128), ink, w))
    elif name == "raw-native":
        if w >= 30:  # micro: the solid half carries the silhouette at 16 px
            half = arc_points(C, C, RING, math.pi / 2, 3 * math.pi / 2, 48)
            o.append(f'<path d="M{num(C)} {num(C - RING)} L' + " L".join(f"{num(x)} {num(y)}" for x, y in half[::-1])
                     + f' Z" fill="{ink}"/>')
        else:  # full: the reference half as close hatching, so it weighs what the other marks weigh
            for k in range(1, 30):
                x = C - RING + k * RING / 30
                dy = math.sqrt(max(0.0, RING * RING - (x - C) ** 2))
                o.append(line(x, C - dy, x, C + dy, ink, 3.2, 0.85))
        o.append(line(C, C - RING, C, C + RING, ink, w * 0.6))
    return o


def _almond(w, h):
    rad = (w * w + h * h) / (2 * h)
    off, half = rad - h, math.asin(w / rad)
    top = [(C + rad * math.sin(t), C + off - rad * math.cos(t)) for t in (-half + 2 * half * i / 40 for i in range(41))]
    bot = [(C - rad * math.sin(t), C - off + rad * math.cos(t)) for t in (-half + 2 * half * i / 40 for i in range(41))]
    return top + bot[1:]


def _detail(name: str, p: dict, r: Rand, density: float) -> list[str]:
    """Line-work for the full size, inside the same silhouette."""
    ink, n = p["ink"], lambda k: max(4, int(k * density))
    o = []
    if name == "crucible":
        kite = [(0, -150), (66, 0), (0, 150), (-150, 0)]
        for k in range(n(90)):
            a = TAU * k / n(90)
            reach = _ray_to_polygon(math.cos(a), math.sin(a), kite)
            o.append(line(*polar(C, C, 30, a), *polar(C, C, reach * r.u(0.86, 0.97), a), ink, 1.4, 0.4))
    elif name == "forum":
        for rr in range(70, 160, 7):
            o.append(polyline(arc_points(C - 70, C, rr, -0.95, 0.95, 24), ink, 1.2, 0.3))
    elif name == "gather":
        for k in range(n(27)):
            dy = (k / (n(27) - 1) - 0.5) * 290
            o.append(line(C - 236, C + dy, C, C, ink, 1.2, 0.35))
    elif name == "index":
        for k in range(n(36)):
            a = TAU * k / n(36)
            o.append(circle(*polar(C, C, 172, a), 5, ink, 1.6, opacity=0.6))
    elif name == "telos":
        for k in range(1, n(10)):
            o.append(polyline(_almond(236 - k * 13, 128 - k * 7), ink, 1.3, 0.35))
        for k in range(n(120)):
            a = TAU * k / n(120)
            o.append(line(*polar(C, C, 50, a), *polar(C, C, 84, a), ink, 1.2, 0.45))
    elif name == "raw-native":
        for k in range(n(40)):
            a = math.pi / 2 + math.pi * (k + 0.5) / n(40)
            o.append(line(C, C, *polar(C, C, RING * r.u(0.55, 0.98), a), p["ground"], 2.2, 0.7))
        for k in range(n(60)):
            x, y = C + r.u(16, 180), C + r.u(-180, 180)
            if (x - C) ** 2 + (y - C) ** 2 < 170 ** 2:
                o.append(circle(x, y, r.u(3, 8), fill=ink, opacity=0.55))
    return o


def _ray_to_polygon(dx: float, dy: float, poly) -> float:
    """Distance from the origin along (dx, dy) to the first edge of a convex-enough polygon."""
    best = 1e9
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        ex, ey = x2 - x1, y2 - y1
        den = dx * ey - dy * ex
        if abs(den) < 1e-12:
            continue
        t = (x1 * ey - y1 * ex) / den
        u = (x1 * dy - y1 * dx) / den
        if t > 0 and 0 <= u <= 1:
            best = min(best, t)
    return best


def mark_svg(name: str, maturity: str, tier: str, theme: str, tile: bool, family: str | None = None) -> str:
    """tier: micro or full. tile: draw the dark square ground (favicons, app icons)."""
    p = PAL["dark" if tile else theme]
    uid = f"mk-{name}-{tier[0]}{theme[0]}{int(tile)}"
    m = MATURITY[maturity]
    full = tier == "full" and maturity != "experimental"
    w = 40 if tier == "micro" else 18
    body = [f'<rect width="512" height="512" rx="56" fill="{p["ground"]}"/>'] if tile else []
    if family:  # a roll-out repository: the aperture ring plus its family's element
        detail = []
        silhouette = [circle(C, C, RING, p["ink"], w)] + element(family, name, p["ink"],
                                                                  p["ground"] if tile else "none", w)
    else:
        detail = _detail(name, p, Rand(ss.substream(name, "mark")), m["density"]) if full else []
        silhouette = _micro(name, p["ink"], p["ground"] if tile else "none", w)
    # Detail sits under the silhouette, except where the silhouette is a filled area.
    body += silhouette + detail if name == "raw-native" else detail + silhouette
    cr = {"telos": 46, "raw-native": 30}.get(name, 34) * (1.25 if tier == "micro" else 1.0)
    cx = C - 70 if name == "forum" else C
    if full and m["glow"]:
        body.append(core(uid, cx, C, cr * 0.7, halo=4.0, pupil=name == "telos", p=p))
    else:
        hole = name in ("raw-native", "crucible") and tier == "micro"
        body.append(circle(cx, C, cr, p["ink"], 14, fill=p["ground"]) if hole else circle(cx, C, cr, fill=p["ink"]))
        if name == "telos":
            body.append(circle(cx, C, cr * 0.42, fill=p["ground"]))
    if full and m["flare"]:
        a0 = Rand(ss.substream(name, "flare")).u(0, TAU)  # each tool's flare sits at its own seeded angle
        lo, hi = FLARE_KEEP_OUT.get(name, (0.0, 0.0))
        if lo <= (a0 % TAU) <= hi or lo <= (a0 % TAU) + 0.5 <= hi:
            a0 += math.pi  # never over the function element
        body.append(flare(C, C, RING + 20, a0, 0.5, p, 1.7))
    what = f"the {family} element" if family else "its own element"
    desc = f"A ring drawn around a bright core, with {what} inside the ring."
    return svg_doc(512, 512, "".join(body), core_defs(uid, p), f"{name} mark", desc=desc)


def lockup_svg(name: str, maturity: str, theme: str, stacked: bool, family: str | None = None) -> str:
    """Mark plus wordmark. Wordmark: Hanken Grotesk SemiBold, tracking -2.5 percent."""
    p = PAL[theme]
    inner = mark_svg(name, maturity, "full", theme, False, family)
    inner = inner.split(">", 1)[1].rsplit("</svg>", 1)[0]
    inner = re.sub(r"<title>.*?</title>", "", inner, count=1)  # the lockup carries its own title
    H = 160.0
    if stacked:
        size = H * 0.42
        tw = measure(name, "grotesk-semibold", size, -0.025)
        W = max(H, tw) + 40
        mark = f'<g transform="translate({num((W - H) / 2)} 0) scale({num(H / 512)})">{inner}</g>'
        word = text_path(name, "grotesk-semibold", size, W / 2, H + size * 1.05, tracking=-0.025,
                         anchor="middle", fill=p["ink"])
        return svg_doc(W, H + size * 1.35, mark + word, "", f"{name} lockup")
    size = H * 0.62
    tw = measure(name, "grotesk-semibold", size, -0.025)
    mark = f'<g transform="scale({num(H / 512)})">{inner}</g>'
    word = text_path(name, "grotesk-semibold", size, H * 1.3, H / 2 + size * 0.36, tracking=-0.025, fill=p["ink"])
    return svg_doc(H * 1.3 + tw + 8, H, mark + word, "", f"{name} lockup")
