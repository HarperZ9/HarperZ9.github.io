"""Function figures for crucible, gather and index.

Each figure draws what the tool does, taken from its README, around the
aperture core. Coordinates come only from the context's seeded draws.
"""

from __future__ import annotations

import math

from .ctx import Ctx
from .svg import TAU, arc_points, circle, core, flare, line, polar, polyline


def crucible(c: Ctx) -> str:
    """Claims as measured axes around the core; the weakest axis falls short (DRIFT),
    one axis has no measurement (UNVERIFIABLE)."""
    p, r, R = c.p, c.rand, c.R
    n = 7
    rot = -math.pi / 2 + r.u(-0.2, 0.2)
    weak = r.i(0, n - 1)
    unver = (weak + r.i(2, n - 2)) % n
    out = []
    for k in range(9):
        rr = R * (0.24 + 0.095 * k)
        out.append(circle(c.cx, c.cy, rr, p["ink"], c.hw(0.6), opacity=0.14 + 0.03 * (k == 3)))
    out.append(circle(c.cx, c.cy, R * 1.0, p["ink"], c.hw(0.9), opacity=0.55))
    tol = R * 0.52
    out.append(circle(c.cx, c.cy, tol, p["ink"], c.hw(0.7), opacity=0.38, dash="2 5"))
    margins, verts = [], []
    for a in range(n):
        ang = rot + TAU * a / n
        m = 0.36 if a == weak else r.u(0.66, 0.95)
        margins.append(m)
        if a == unver:
            out.append(line(*polar(c.cx, c.cy, R * 0.12, ang), *polar(c.cx, c.cy, R, ang),
                            p["ink"], c.hw(0.9), 0.5, dash="3 6"))
            continue
        lines = c.count(46)
        for j in range(lines):
            da = (j / max(1, lines - 1) - 0.5) * 0.12 + r.n(0.004)
            end = R * m * (1 - 0.06 * abs(j / max(1, lines - 1) - 0.5) * 2)
            out.append(line(*polar(c.cx, c.cy, R * 0.11, ang), *polar(c.cx, c.cy, end, ang + da),
                            p["ink"], c.hw(0.55), 0.32))
        verts.append(polar(c.cx, c.cy, R * m, ang))
    out.append(polyline(verts + verts[:1], p["ink"], c.hw(1.1), 0.85))
    # The weakest axis: a bracket from its margin out to the tolerance ring, in the drift colour.
    wa = rot + TAU * weak / n
    col = c.verdict("DRIFT")
    for rr in (R * margins[weak], tol):
        x1, y1 = polar(c.cx, c.cy, rr, wa - 0.11)
        x2, y2 = polar(c.cx, c.cy, rr, wa + 0.11)
        out.append(line(x1, y1, x2, y2, col, c.hw(2.4)))
    out.append(line(*polar(c.cx, c.cy, R * margins[weak], wa), *polar(c.cx, c.cy, tol, wa), col, c.hw(2.4)))
    lx, ly = polar(c.cx, c.cy, R * 1.16, wa)
    out.append(c.label("DRIFT", lx, ly + R * 0.035, R * 0.095, col, "middle"))
    ux, uy = polar(c.cx, c.cy, R * 1.12, rot + TAU * unver / n)
    out.append(c.label("UNVERIFIABLE", ux, uy + R * 0.03, R * 0.06, p["quiet"], "middle"))
    if c.m["flare"]:
        a0 = wa + math.pi + r.u(-0.4, 0.2)
        out.append(flare(c.cx, c.cy, R, a0, 0.55, p, c.hw(0.9)))
    out.append(core(c.uid, c.cx, c.cy, R * 0.075, halo=7 if c.m["glow"] else 2.5))
    return "".join(out)


def _bezier(p0, p1, p2, p3, steps):
    out = []
    for i in range(steps + 1):
        t = i / steps
        a, b, cc, d = (1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3
        out.append((a * p0[0] + b * p1[0] + cc * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + cc * p2[1] + d * p3[1]))
    return out


def gather(c: Ctx) -> str:
    """Five kinds of source converge through the aperture ring to one grounded core.
    One source stops at the ring: its values were not found on the page, so it is dropped."""
    p, r, R = c.p, c.rand, c.R
    ring = R * 0.3
    styles = ["solid", "dash", "dot", "wave", "step"]
    out = [circle(c.cx, c.cy, ring, p["ink"], c.hw(1.0), opacity=0.7)]
    dropped = r.i(0, 4)
    for b, style in enumerate(styles):
        theta = -1.25 + 2.5 * (b + 0.5) / 5 + r.u(-0.08, 0.08)
        n = c.count(16)
        drop_line = r.i(0, n - 1) if b == dropped else -1
        for j in range(n):
            spread = (j / max(1, n - 1) - 0.5)
            start = polar(c.cx, c.cy, R * 2.3, theta + spread * 0.42)
            entry_a = theta * 0.55 + spread * 0.18
            entry = polar(c.cx, c.cy, ring, entry_a)
            c1 = polar(c.cx, c.cy, R * 1.45, theta + spread * 0.3 + r.n(0.03))
            c2 = polar(c.cx, c.cy, R * 0.7, entry_a + r.n(0.02))
            path = _bezier(start, c1, c2, entry, 60)
            out.append(_styled(path, style, c, j))
            if j == drop_line:
                tx, ty = entry
                nx, ny = polar(0, 0, R * 0.05, entry_a + math.pi / 2)
                out.append(line(tx - nx, ty - ny, tx + nx, ty + ny, p["ink"], c.hw(1.6)))
                continue
            out.append(line(*entry, c.cx, c.cy, p["ink"], c.hw(0.5), 0.45))
    if c.m["flare"]:
        out.append(flare(c.cx, c.cy, ring * 1.18, math.pi * 0.62, 0.9, p, c.hw(0.8)))
    out.append(core(c.uid, c.cx, c.cy, R * 0.07, halo=8 if c.m["glow"] else 2.5))
    return "".join(out)


def _styled(path, style: str, c: Ctx, j: int) -> str:
    ink, w = c.p["ink"], c.hw(0.6)
    if style == "solid":
        return polyline(path, ink, w, 0.42)
    if style == "dash":
        return polyline(path, ink, w, 0.5, dash=f"{c.hw(7)} {c.hw(5)}")
    if style == "dot":
        return polyline(path, ink, c.hw(1.3), 0.55, dash=f"0 {c.hw(4.5)}")
    if style == "wave":
        out, n = [], len(path)
        for i, (x, y) in enumerate(path):
            if 0 < i < n - 1:
                dx, dy = path[i + 1][0] - path[i - 1][0], path[i + 1][1] - path[i - 1][1]
                L = math.hypot(dx, dy) or 1
                amp = c.hw(5) * (1 - i / n) * math.sin(i * 0.9 + j)
                x, y = x - dy / L * amp, y + dx / L * amp
            out.append((x, y))
        return polyline(out, ink, w, 0.42)
    out = []  # step: the path quantised to a coarse grid, like a JSON API's discrete records
    g = c.hw(9)
    for x, y in path:
        q = (round(x / g) * g, round(y / g) * g)
        if not out or out[-1] != q:
            if out:
                out.append((q[0], out[-1][1]))
            out.append(q)
    return polyline(out, ink, w, 0.42)


def index(c: Ctx) -> str:
    """A workspace drawn as rings of repositories, modules and symbols around the core.
    One claimed edge is not in the graph: it is drawn dashed and marked REFUTED."""
    p, r, R = c.p, c.rand, c.R
    rings = [(R * 0.4, 6, 4.2), (R * 0.74, c.count(22, 10), 2.6), (R * 1.0, c.count(56, 20), 1.2)]
    nodes = []
    for k, (rr, n, size) in enumerate(rings):
        off = r.u(0, TAU)
        out_ring = [polar(c.cx, c.cy, rr, off + TAU * (i + r.u(-0.25, 0.25)) / n) for i in range(n)]
        nodes.append(out_ring)
    out = [circle(c.cx, c.cy, rr, p["ink"], c.hw(0.5), opacity=0.16) for rr, _, _ in rings]
    for i, (x, y) in enumerate(nodes[1]):  # module to its repository
        rx, ry = min(nodes[0], key=lambda q: (q[0] - x) ** 2 + (q[1] - y) ** 2)
        out.append(line(x, y, rx, ry, p["ink"], c.hw(0.7), 0.5))
    for x, y in nodes[2]:  # symbol to nearest module
        mx, my = min(nodes[1], key=lambda q: (q[0] - x) ** 2 + (q[1] - y) ** 2)
        out.append(line(x, y, mx, my, p["ink"], c.hw(0.45), 0.3))
    for _ in range(c.count(26, 8)):  # module dependencies bundle through the centre
        a, b = nodes[1][r.i(0, len(nodes[1]) - 1)], nodes[1][r.i(0, len(nodes[1]) - 1)]
        if a == b:
            continue
        mid = ((a[0] + b[0]) / 2 * 0.35 + c.cx * 0.65, (a[1] + b[1]) / 2 * 0.35 + c.cy * 0.65)
        out.append(polyline(_quad(a, mid, b, 30), p["ink"], c.hw(0.5), 0.3))
    for i in range(6):  # repository dependencies
        a, b = nodes[0][i], nodes[0][(i + 2) % 6]
        out.append(polyline(_quad(a, (c.cx, c.cy), b, 30), p["ink"], c.hw(0.9), 0.55))
    # The refuted claim: an edge someone asserted between two modules the graph does not carry.
    m = nodes[1]
    a, b = m[0], m[max(2, len(m) // 4)]
    col = c.verdict("REFUTED")
    out.append(line(*a, *b, col, c.hw(1.5), dash=f"{c.hw(6)} {c.hw(5)}"))
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    s = c.hw(6)
    out += [line(mx - s, my - s, mx + s, my + s, col, c.hw(1.8)), line(mx - s, my + s, mx + s, my - s, col, c.hw(1.8))]
    ex, ey = b[0] - a[0], b[1] - a[1]  # label on the edge's normal, on the side away from the core
    L = math.hypot(ex, ey) or 1.0
    nx, ny = -ey / L, ex / L
    if nx * (mx - c.cx) + ny * (my - c.cy) < 0:
        nx, ny = -nx, -ny
    dx, dy = mx - c.cx, my - c.cy  # the label sits outside the outer ring, on the ray through the edge
    D = math.hypot(dx, dy) or 1.0
    lx, ly = c.cx + dx / D * R * 1.22, c.cy + dy / D * R * 1.22
    out.append(c.label("REFUTED", lx, ly + R * 0.03, R * 0.085, col, "middle"))
    for (rr, _, _), name in zip(rings, ("REPOSITORY", "MODULE", "SYMBOL")):
        out.append(c.caption(name, c.cx, c.cy - rr - c.hw(7), R * 0.05))
    for k, (rr, n, size) in enumerate(rings):
        for x, y in nodes[k]:
            out.append(circle(x, y, c.hw(size), p["ink"], c.hw(0.8), fill=p["ground"], opacity=0.95))
    if c.m["flare"]:
        out.append(flare(c.cx, c.cy, R * 1.06, math.atan2(c.cy - ly, c.cx - lx) - 0.25, 0.5, p, c.hw(0.8)))
    out.append(core(c.uid, c.cx, c.cy, R * 0.07, halo=7 if c.m["glow"] else 2.5))
    return "".join(out)


def _quad(a, ctrl, b, steps):
    return [((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * ctrl[0] + t * t * b[0],
             (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * ctrl[1] + t * t * b[1])
            for t in (i / steps for i in range(steps + 1))]
