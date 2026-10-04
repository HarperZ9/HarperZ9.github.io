"""Figure families, part two: lattice, orbit and document. See families.py."""

from __future__ import annotations

import math

from .ctx import Ctx
from .family_base import finish as _finish
from .svg import TAU, circle, line, polar, polyline


def lattice(c: Ctx, cfg: dict) -> str:
    """A regular structure bulged around the core, as if seen through a lens. The seed picks
    the structure (square, triangular or polar) and the strength of the bulge."""
    p, r, R = c.p, c.rand, c.R
    mode = int(r.f() * 3)
    n = c.count(16, 7)
    rot = r.u(0, math.pi / 3)
    bulge = r.u(0.2, 0.5)
    out = []

    def warp(x, y):
        d = math.hypot(x, y) / R
        k = 1 + bulge * math.exp(-d * d * 2.5)
        xr, yr = x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot)
        return c.cx + xr * k, c.cy + yr * k

    def keep(pts):
        inside = [q for q in pts if math.hypot(q[0] - c.cx, q[1] - c.cy) < R * 1.05]
        if len(inside) > 1:
            out.append(polyline(inside, p["ink"], c.hw(0.55), 0.4))

    if mode == 2:  # polar: rings and spokes
        for k in range(1, n):
            keep([warp(*polar(0, 0, R * k / n, TAU * i / 90)) for i in range(91)])
        for k in range(n * 2):
            keep([warp(*polar(0, 0, R * t / 40, TAU * k / (n * 2))) for t in range(41)])
    else:
        dirs = (0.0, math.pi / 2) if mode == 0 else (0.0, math.pi / 3, 2 * math.pi / 3)
        for a in dirs:
            ca, sa = math.cos(a), math.sin(a)
            for i in range(-n, n + 1):
                off = i / n * R
                keep([warp(off * -sa + t / 40 * R * ca, off * ca + t / 40 * R * sa) for t in range(-40, 41)])
    out.append(circle(c.cx, c.cy, R * 1.05, p["ink"], c.hw(0.9), opacity=0.6))
    return _finish(c, out, R * 1.12)


def orbit(c: Ctx, cfg: dict) -> str:
    """Streamlines of a seeded flow field spiralling around the core."""
    p, r, R = c.p, c.rand, c.R
    out = []
    swirl, wob = r.u(0.6, 1.2), [r.u(0, TAU) for _ in range(2)]
    for k in range(c.count(40, 14)):
        a = TAU * k / c.count(40, 14) + r.u(0, 0.1)
        rr = R * r.u(0.6, 1.05)
        pts = []
        for _ in range(70):
            pts.append(polar(c.cx, c.cy, rr, a))
            a += 0.04 * swirl + 0.01 * math.sin(3 * a + wob[0])
            rr *= 0.985 + 0.004 * math.sin(2 * a + wob[1])
            if rr < R * 0.1:
                break
        out.append(polyline(pts, p["ink"], c.hw(0.55), 0.45))
    return _finish(c, out, R * 1.08)


def document(c: Ctx, cfg: dict) -> str:
    """A fan of ruled sheets, the top sheet lit by the core."""
    p, r, R = c.p, c.rand, c.R
    out = []
    sheets = 3 + int(r.f() * 4)
    fan = r.u(0.06, 0.14) * (1 if r.f() < 0.5 else -1)
    columns = 1 + int(r.f() * 2)
    w, h = R * 0.95, R * 1.25
    for s in range(sheets):
        a = (s - sheets + 1) * fan
        corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
        rot = [(c.cx + x * math.cos(a) - y * math.sin(a), c.cy + x * math.sin(a) + y * math.cos(a)) for x, y in corners]
        out.append(f'<polygon points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in rot)}" fill="{p["ground"]}" '
                   f'stroke="{p["ink"]}" stroke-width="{c.hw(0.9):.2f}" stroke-opacity="0.7"/>')
        if s == sheets - 1:
            for k in range(c.count(18, 6) * columns):
                col = k % columns
                y = -h / 2 + h * (k // columns + 1.2) / 20
                cw = w * 0.84 / columns
                ln = cw * r.u(0.55, 0.95)
                x0 = -w / 2 + w * 0.08 + col * (cw + w * 0.04)
                x1 = x0 + ln
                p0 = (c.cx + x0 * math.cos(a) - y * math.sin(a), c.cy + x0 * math.sin(a) + y * math.cos(a))
                p1 = (c.cx + x1 * math.cos(a) - y * math.sin(a), c.cy + x1 * math.sin(a) + y * math.cos(a))
                out.append(line(*p0, *p1, p["ink"], c.hw(0.8), 0.55, dash=f"{c.hw(10)} {c.hw(3)}"))
    return _finish(c, out, R * 0.9)
