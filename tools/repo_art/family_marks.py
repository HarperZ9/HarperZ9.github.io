"""Mark elements for the ten figure families, on the 512 grid inside the aperture ring.

Each family has one silhouette; the repository seed turns it in 45 degree steps and
picks a count, so two marks in one family still differ at 16 px. The wordmark beside
the mark carries the rest of the identity.
"""

from __future__ import annotations

import math

from tools import superstack as ss

from .svg import TAU, arc_points, circle, line, polar, polyline

C = 256.0


def _variant(name: str) -> tuple[float, int]:
    v = ss.xmur3(name + "/mark-variant")
    return (v % 8) * math.pi / 4, 2 + (v >> 3) % 3


def element(family: str, name: str, ink: str, ground: str, w: float) -> list[str]:
    rot, k = _variant(name)

    def R(x, y):
        return C + x * math.cos(rot) - y * math.sin(rot), C + x * math.sin(rot) + y * math.cos(rot)

    o = []
    if family == "pipeline":
        pts = [R(-130 + 75 * i, -60 + 30 * i) for i in range(k + 1)]
        o.append(polyline(pts + [(C, C)], ink, w * 0.6))
        o += [circle(x, y, 22, ink, w * 0.6, fill=ground) for x, y in pts]
    elif family == "gate":
        o.append(line(*R(-60, -150), *R(-60, 150), ink, w * 0.8))
        o += [line(*R(-150, -90 + 60 * i), *R(-75, -90 + 60 * i), ink, w * 0.5) for i in range(k + 1)]
        o.append(line(*R(-45, 0), *R(-15, 0), ink, w * 0.5))
    elif family == "ledger":
        for i in range(k):
            x, y = R(-110 + 70 * i, 90 - 60 * i)
            o.append(f'<rect x="{x - 26:.1f}" y="{y - 26:.1f}" width="52" height="52" fill="{ground}" '
                     f'stroke="{ink}" stroke-width="{w * 0.6:.1f}"/>')
    elif family == "graph":
        pts = [R(*polar(0, 0, 120, TAU * i / (k + 1) + 0.3)) for i in range(k + 1)]
        o += [line(x, y, C, C, ink, w * 0.55) for x, y in pts]
        o.append(polyline(pts + pts[:1], ink, w * 0.4))
        o += [circle(x, y, 20, ink, w * 0.55, fill=ground) for x, y in pts]
    elif family == "signal":
        pts = [R(-150 + 300 * i / 60, -70 * math.sin(TAU * k * i / 60 / 2) * (1 - i / 80)) for i in range(61)]
        o.append(polyline(pts, ink, w * 0.7))
    elif family == "lens":
        lx = -90
        o.append(polyline(arc_points(*R(lx - 120, 0), 140, -0.5 + rot, 0.5 + rot, 20) +
                          arc_points(*R(lx + 120, 0), 140, math.pi - 0.5 + rot, math.pi + 0.5 + rot, 20)[1:], ink, w * 0.6))
        o += [polyline([R(-170, dy), R(lx, dy), (C, C)], ink, w * 0.45) for dy in (-55, 55)]
    elif family == "strata":
        o += [circle(C, C, 70 + 42 * i, ink, w * 0.5, dash="18 10" if i % 2 else None) for i in range(k)]
    elif family == "lattice":
        for i in (-1, 1):
            o.append(line(*R(i * 55, -140), *R(i * 55, 140), ink, w * 0.55))
            o.append(line(*R(-140, i * 55), *R(140, i * 55), ink, w * 0.55))
    elif family == "orbit":
        pts = [R(*polar(0, 0, 150 * (1 - t / 90), t * (0.12 + 0.02 * k))) for t in range(80)]
        o.append(polyline(pts, ink, w * 0.6))
    elif family == "document":
        o += [line(*R(-120, -80 + 50 * i), *R(120 - 40 * (i % 2), -80 + 50 * i), ink, w * 0.6) for i in range(k + 1)]
    return o
