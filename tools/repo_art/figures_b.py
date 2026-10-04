"""Function figures for forum, telos and raw-native."""

from __future__ import annotations

import math

from .ctx import Ctx
from .svg import TAU, arc_points, circle, core, flare, line, polar, polyline


def forum(c: Ctx) -> str:
    """A request leaves the core and runs in waves of agents; one wave boundary is a gate;
    the outermost ring is the hash-chained ledger every run writes."""
    p, r, R = c.p, c.rand, c.R
    a0, a1 = -1.3, 1.3
    waves = [(R * 0.36, 3), (R * 0.64, 5), (R * 0.9, 4)]
    out, prev = [], [(c.cx, c.cy)]
    for wi, (rr, n) in enumerate(waves):
        for k in range(c.count(5, 2)):
            out.append(polyline(arc_points(c.cx, c.cy, rr + (k - 2) * c.hw(2.2), a0, a1, 60),
                                p["ink"], c.hw(0.5), 0.22 + 0.06 * (k == 2)))
        nodes = [polar(c.cx, c.cy, rr, a0 + (a1 - a0) * (i + 0.5) / n + r.u(-0.06, 0.06)) for i in range(n)]
        for x, y in nodes:
            parents = sorted(prev, key=lambda q: (q[0] - x) ** 2 + (q[1] - y) ** 2)[: 1 + (r.f() < 0.4)]
            for px, py in parents:
                for _ in range(c.count(6, 2)):
                    mx = (px + x) / 2 + r.n(c.hw(4))
                    my = (py + y) / 2 + r.n(c.hw(4))
                    out.append(polyline([(px, py), (mx, my), (x, y)], p["ink"], c.hw(0.5), 0.35))
        if wi == 1:  # the approval gate at this wave boundary
            ga = a0 + (a1 - a0) * 3.0 / n
            for dr in (-c.hw(5), c.hw(5)):
                x1, y1 = polar(c.cx, c.cy, rr - c.hw(14), ga + dr / rr)
                x2, y2 = polar(c.cx, c.cy, rr + c.hw(14), ga + dr / rr)
                out.append(line(x1, y1, x2, y2, p["ink"], c.hw(1.6), 0.95))
            lx, ly = polar(c.cx, c.cy, R * 1.3, ga)  # outside the ledger ring, clear of the line-work
            out.append(c.label("GATE", lx, ly + R * 0.02, R * 0.065, p["quiet"], "middle"))
        out += [circle(x, y, c.hw(4.5), p["ink"], c.hw(1.0), fill=p["ground"]) for x, y in nodes]
        prev = nodes
    # The ledger: hash-chained records on the outer ring, each linked to the last.
    lr, cells = R * 1.1, c.count(22, 10)
    pts = [polar(c.cx, c.cy, lr, a0 + (a1 - a0) * i / (cells - 1)) for i in range(cells)]
    out.append(polyline(pts, p["ink"], c.hw(0.7), 0.6))
    s = c.hw(3.2)
    for x, y in pts:
        out.append(f'<rect x="{x - s:.2f}" y="{y - s:.2f}" width="{2 * s:.2f}" height="{2 * s:.2f}" '
                   f'fill="{p["ground"]}" stroke="{p["ink"]}" stroke-width="{c.hw(0.9):.2f}"/>')
    if c.m["flare"]:
        out.append(flare(c.cx, c.cy, R * 0.2, -0.9, 1.8, p, c.hw(0.7)))
    out.append(core(c.uid, c.cx, c.cy, R * 0.075, halo=7 if c.m["glow"] else 2.5))
    return "".join(out)


def telos(c: Ctx) -> str:
    """The eye: an aperture of nested contours around an iris corona and a void pupil.
    Five lanes sit on its rim; one returns UNVERIFIABLE rather than a confident pass."""
    p, r, R = c.p, c.rand, c.R
    out = []
    h0 = 0.5
    for k in range(c.count(16, 5)):
        s = 1.0 - k * 0.5 / max(1, c.count(16, 5))
        out.append(polyline(_almond(c.cx, c.cy, R * s, R * h0 * s, 80), p["ink"], c.hw(0.6),
                            0.55 if k == 0 else 0.26))
    iris = R * 0.34
    for k in range(c.count(140, 40)):
        a = TAU * k / c.count(140, 40) + r.n(0.004)
        r0 = iris * r.u(0.5, 0.6)
        out.append(line(*polar(c.cx, c.cy, r0, a), *polar(c.cx, c.cy, iris * r.u(0.92, 1.0), a),
                        p["ink"], c.hw(0.45), 0.38))
    out.append(circle(c.cx, c.cy, iris, p["ink"], c.hw(1.0), opacity=0.8))
    rim = _almond(c.cx, c.cy, R, R * h0, 200)
    lanes = [rim[i] for i in (25, 60, 100, 140, 175)]
    unv = r.i(0, 4)
    for i, (x, y) in enumerate(lanes):
        if i == unv:
            out.append(circle(x, y, c.hw(6.5), p["quiet"], c.hw(1.1), fill=p["ground"], dash=f"{c.hw(2)} {c.hw(2.5)}"))
            out.append(c.label("UNVERIFIABLE", x, y + (c.hw(44) if y > c.cy else -c.hw(30)), R * 0.058,
                               p["quiet"], "middle"))
        else:
            out.append(circle(x, y, c.hw(6.5), p["ink"], c.hw(1.1), fill=p["ground"]))
            out.append(circle(x, y, c.hw(2.2), fill=p["ink"]))
    if c.m["flare"]:
        out.append(flare(c.cx, c.cy, iris * 1.08, -2.5, 0.8, p, c.hw(0.7)))
    out.append(core(c.uid, c.cx, c.cy, R * 0.13, halo=4.5 if c.m["glow"] else 2.0, pupil=True, p=p))
    return "".join(out)


def _almond(cx, cy, w, h, steps):
    """A vesica: upper and lower arcs meeting in points at +/- w."""
    rad = (w * w + h * h) / (2 * h)
    off = rad - h
    half = math.asin(w / rad)
    top = [(cx + rad * math.sin(t), cy + off - rad * math.cos(t))
           for t in (-half + 2 * half * i / (steps // 2) for i in range(steps // 2 + 1))]
    bot = [(cx - rad * math.sin(t), cy - off + rad * math.cos(t))
           for t in (-half + 2 * half * i / (steps // 2) for i in range(steps // 2 + 1))]
    return top + bot[1:]


def raw_native(c: Ctx) -> str:
    """One shaded point, occlusion estimated twice. Left: ray-traced hemisphere rays, some
    stopped by a box. Right: screen-space samples against a depth profile. Below: the
    error strip and the README's default verdict, REFUTED at 0.1349 RMSE over 0.1200."""
    p, r, R = c.p, c.rand, c.R
    px, py = c.cx, c.cy + R * 0.42
    hemi = R * 0.95
    out = [line(c.cx - R * 1.25, py, c.cx + R * 1.25, py, p["ink"], c.hw(1.0), 0.75)]
    out.append(polyline(arc_points(px, py, hemi, math.pi, TAU, 80), p["ink"], c.hw(0.7), 0.45, dash="2 5"))
    bx0, by0, bx1, by1 = px - R * 0.78, py - R * 0.62, px - R * 0.3, py  # the occluding box
    for k in range(c.count(22, 8)):
        y = by0 + (by1 - by0) * k / c.count(22, 8)
        out.append(line(bx0, y, bx1, y, p["ink"], c.hw(0.5), 0.3))
    out.append(polyline([(bx0, by1), (bx0, by0), (bx1, by0), (bx1, by1)], p["ink"], c.hw(1.0), 0.8))
    for k in range(c.count(64, 20)):  # cosine-weighted directions on the left half
        u = r.f()
        a = math.pi + (math.pi / 2) * math.sqrt(u) + r.n(0.01)
        dx, dy = math.cos(a), math.sin(a)
        t = hemi
        if dx < 0 and dy < 0:
            tx = (bx1 - px) / dx if dx else 1e9
            hit_y = py + dy * tx
            if 0 < tx < t and by0 <= hit_y <= by1:
                t = tx
            ty = (by0 - py) / dy
            hit_x = px + dx * ty
            if 0 < ty < t and bx0 <= hit_x <= bx1:
                t = ty
        ex, ey = px + dx * t, py + dy * t
        hit = t < hemi
        out.append(line(px, py, ex, ey, p["ink"], c.hw(0.55), 0.55 if hit else 0.3))
        if hit:
            out.append(circle(ex, ey, c.hw(1.6), fill=p["ink"], opacity=0.9))
    prof = []  # a stepped depth profile on the right half: the screen-space view of the scene
    steps = 9
    for k in range(steps + 1):
        x = px + R * 0.12 + (R * 1.1) * k / steps
        h = R * (0.18 + 0.32 * abs(math.sin(k * 1.3 + r.u(0, 0.6))))
        prof.append((x, py - h))
    for k in range(steps):
        x0, y0 = prof[k]
        x1 = prof[k + 1][0]
        for yy in range(int(y0), int(py), max(2, int(c.hw(3)))):
            out.append(line(x0, yy, x1, yy, p["ink"], c.hw(0.45), 0.22))
        out.append(line(x0, y0, x1, y0, p["ink"], c.hw(1.0), 0.8))
    for k in range(c.count(34, 12)):  # screen-space samples in a disk above the point
        a = r.u(-math.pi / 2, 0)
        d = hemi * math.sqrt(r.f()) * 0.9
        sx, sy = px + abs(math.cos(a)) * d, py + math.sin(a) * d * 0.9
        col_k = min(steps - 1, max(0, int((sx - px - R * 0.12) / (R * 1.1) * steps)))
        occluded = sx > px + R * 0.12 and sy > prof[col_k][1]
        out.append(circle(sx, sy, c.hw(3.4), p["ink"], c.hw(1.0),
                          fill=p["ink"] if occluded else p["ground"]))
    for k in range(c.count(70, 30)):  # the error strip: dot size is the per-pixel difference
        x = c.cx - R * 1.2 + R * 2.4 * k / c.count(70, 30)
        e = abs(math.sin(k * 0.21 + 0.6)) * (0.35 + 0.65 * r.f())
        out.append(circle(x, py + R * 0.18, c.hw(0.6 + 3.2 * e), fill=p["ink"], opacity=0.75))
    out.append(c.caption("RAY-TRACED", px - hemi * 0.55, py - hemi * 1.04, R * 0.06))
    out.append(c.caption("SCREEN-SPACE", px + hemi * 0.6, py - hemi * 1.04, R * 0.06))
    col = c.verdict("REFUTED")
    out.append(c.label("RMSE 0.1349 > 0.1200", c.cx - R * 1.2, py + R * 0.46, R * 0.07, p["quiet"]))
    out.append(c.label("REFUTED", c.cx - R * 1.2, py + R * 0.46 + max(R * 0.1, c.min_label * 1.3), R * 0.07, col))
    if c.m["flare"]:
        out.append(flare(px, py, hemi, -1.2, 0.5, p, c.hw(0.7)))
    out.append(core(c.uid, px, py, R * 0.07, halo=7 if c.m["glow"] else 2.5))
    return "".join(out)


FIGURES = {"forum": forum, "telos": telos, "raw-native": raw_native}
