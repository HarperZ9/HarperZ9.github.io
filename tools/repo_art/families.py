"""Ten figure families for the roll-out: one per kind of work, each drawn around the core.

A repository's config names its family (`archetype`) and the words its README uses
for the work, in order. The seed (the repository name) varies the geometry, and the
words become the figure's stations and its legend, so two tools in one family still
draw differently. A family shows a verdict only when the README itself uses the word.
"""

from __future__ import annotations

import math

from .ctx import Ctx
from .family_base import finish as _finish
from .families_more import document, lattice, orbit
from .svg import TAU, arc_points, circle, core, flare, line, polar, polyline


def _away(cfg: dict) -> int:
    """+1 when the text sits left of the art (sources come from the right), -1 otherwise."""
    return -1 if cfg.get("layout") == "art-left" else 1


def _stations(c: Ctx, words: list, pts: list) -> list:
    return [c.caption(w, x, y - c.hw(14), c.R * 0.05) for w, (x, y) in zip(words, pts)]


def pipeline(c: Ctx, cfg: dict) -> str:
    """Stages along a sweeping path, fine-line bundles carrying the work into the core."""
    p, r, R, words = c.p, c.rand, c.R, cfg["words"]
    n = len(words)
    a0 = (0.0 if _away(cfg) > 0 else math.pi) + r.u(-0.3, 0.3)
    turn = r.u(1.6, 2.2) * (1 if r.f() < 0.5 else -1)
    turn = (3.4 if turn > 0 else -3.4) * (n - 1) / max(1, n)
    pts = [polar(c.cx, c.cy, R * (1.08 - 0.4 * k / max(1, n - 1)), a0 + turn * k / max(1, n - 1))
           for k in range(n)] + [(c.cx, c.cy)]
    out = []
    for k in range(n):
        (x0, y0), (x1, y1) = pts[k], pts[k + 1]
        width = R * (0.16 - 0.1 * k / n)
        for j in range(c.count(14, 4)):
            off = (j / max(1, c.count(14, 4) - 1) - 0.5) * width
            nx, ny = -(y1 - y0), x1 - x0
            L = math.hypot(nx, ny) or 1
            mx, my = (x0 + x1) / 2 + nx / L * off * 1.4, (y0 + y1) / 2 + ny / L * off * 1.4
            out.append(polyline([(x0 + nx / L * off, y0 + ny / L * off), (mx, my), (x1, y1)], p["ink"], c.hw(0.5), 0.36))
    for x, y in pts[:-1]:
        out.append(circle(x, y, c.hw(12), p["ink"], c.hw(1.2), fill=p["ground"]))
        out.append(circle(x, y, c.hw(4), fill=p["ink"]))
    for w, (x, y) in zip(words, pts[:-1]):  # each label outward along its station's ray
        dx, dy = x - c.cx, y - c.cy
        L = math.hypot(dx, dy) or 1.0
        lx, ly = x + dx / L * R * 0.26, y + dy / L * R * 0.26
        anchor = "start" if dx > R * 0.3 else ("end" if dx < -R * 0.3 else "middle")
        out.append(c.caption(w, lx, ly + c.hw(4), R * 0.05, anchor))
    if cfg.get("verdict"):
        col = c.verdict(cfg["verdict"])
        x, y = pts[n - 1]
        out.append(c.label(cfg["verdict"], x, y + c.hw(34), R * 0.07, col, "middle"))
    return _finish(c, out, R * 1.1)


def gate(c: Ctx, cfg: dict) -> str:
    """Requests arrive from one side; a toothed ring lets most through and stops some."""
    p, r, R = c.p, c.rand, c.R
    ring = R * 0.42
    side = (0.0 if _away(cfg) > 0 else math.pi) + r.u(-0.4, 0.4)
    out = [circle(c.cx, c.cy, ring, p["ink"], c.hw(1.0), opacity=0.7)]
    for k in range(c.count(48, 16)):
        a = TAU * k / c.count(48, 16)
        out.append(line(*polar(c.cx, c.cy, ring, a), *polar(c.cx, c.cy, ring + c.hw(8), a), p["ink"], c.hw(1.0), 0.6))
    stopped = []
    for j in range(c.count(30, 10)):
        a = side + (j / max(1, c.count(30, 10) - 1) - 0.5) * 1.2
        start = polar(c.cx, c.cy, R * 1.5, a + r.n(0.04))
        hit = polar(c.cx, c.cy, ring + c.hw(10), a)
        blocked = r.f() < 0.22
        out.append(line(*start, *hit, p["ink"], c.hw(0.55), 0.4))
        if blocked:
            nx, ny = polar(0, 0, c.hw(9), a + math.pi / 2)
            out.append(line(hit[0] - nx, hit[1] - ny, hit[0] + nx, hit[1] + ny, p["ink"], c.hw(1.6)))
            stopped.append((hit, a))
        else:
            out.append(line(*polar(c.cx, c.cy, ring, a), c.cx, c.cy, p["ink"], c.hw(0.5), 0.45))
    if cfg.get("verdict") and stopped:
        col = c.verdict(cfg["verdict"])
        (x, y), a = stopped[len(stopped) // 2]
        lx, ly = polar(c.cx, c.cy, R * 1.62, a)  # out past the barrier, on the stopped line's own ray
        out.append(c.label(cfg["verdict"], lx, ly + c.hw(6), R * 0.07, col, "middle"))
    return _finish(c, out, ring * 1.25)


def ledger(c: Ctx, cfg: dict) -> str:
    """A chain of linked records winding into the core, each sealed to the one before."""
    p, r, R = c.p, c.rand, c.R
    n = c.count(26, 10)
    turns = r.u(1.3, 1.8)
    a0 = r.u(0, TAU)
    pts = [polar(c.cx, c.cy, R * (1.0 - 0.78 * k / n), a0 + TAU * turns * k / n) for k in range(n)]
    out = [polyline(pts + [(c.cx, c.cy)], p["ink"], c.hw(0.8), 0.6)]
    for k, (x, y) in enumerate(pts):
        s = c.hw(9 - 4 * k / n)
        out.append(f'<rect x="{x - s:.2f}" y="{y - s:.2f}" width="{2 * s:.2f}" height="{2 * s:.2f}" fill="{p["ground"]}" '
                   f'stroke="{p["ink"]}" stroke-width="{c.hw(0.9):.2f}"/>')
        for h in range(1 + k % 3):
            yy = y - s + 2 * s * (h + 1) / (2 + k % 3)
            out.append(line(x - s * 0.6, yy, x + s * 0.6, yy, p["ink"], c.hw(0.5), 0.6))
    if cfg.get("verdict"):
        col = c.verdict(cfg["verdict"])
        x, y = pts[0]
        out.append(c.label(cfg["verdict"], x, y - c.hw(22), R * 0.07, col, "middle"))
    return _finish(c, out, R * 1.08)


def graph(c: Ctx, cfg: dict) -> str:
    """Nodes in clusters, one per word, wired to their neighbours and bundled through the core."""
    p, r, R, words = c.p, c.rand, c.R, cfg["words"]
    centres = [polar(c.cx, c.cy, R * 0.72, TAU * k / len(words) + r.u(-0.3, 0.3)) for k in range(len(words))]
    nodes = [(cx + r.n(R * 0.13), cy + r.n(R * 0.13)) for cx, cy in centres for _ in range(c.count(9, 4))]
    out = []
    for x, y in nodes:
        near = sorted(nodes, key=lambda q: (q[0] - x) ** 2 + (q[1] - y) ** 2)[1:3]
        out += [line(x, y, qx, qy, p["ink"], c.hw(0.5), 0.4) for qx, qy in near]
    for x, y in centres:
        out.append(polyline([(x, y), ((x + c.cx) / 2 + r.n(R * 0.05), (y + c.cy) / 2 + r.n(R * 0.05)), (c.cx, c.cy)],
                            p["ink"], c.hw(0.9), 0.55))
    out += [circle(x, y, c.hw(3), p["ink"], c.hw(0.9), fill=p["ground"]) for x, y in nodes]
    out += _stations(c, words, [(x, y - R * 0.16) for x, y in centres])
    return _finish(c, out, R * 1.02)


def signal(c: Ctx, cfg: dict) -> str:
    """Traces over time narrowing into the core; the words name the traces."""
    p, r, R, words = c.p, c.rand, c.R, cfg["words"]
    k = len(words) + 2
    x0, x1 = c.cx + _away(cfg) * R * 1.6, c.cx
    out = []
    spike = None
    for t in range(k):
        base = c.cy + (t - (k - 1) / 2) * R * 0.22
        f1, f2, ph = r.u(2, 5), r.u(7, 13), r.u(0, TAU)
        amp = R * r.u(0.04, 0.08)
        pts = []
        for i in range(161):
            u = i / 160
            y = base * (1 - u) + c.cy * u + amp * (1 - u) * (math.sin(TAU * f1 * u + ph) + 0.4 * math.sin(TAU * f2 * u))
            pts.append((x0 + (x1 - x0) * u, y))
        if t == k // 2 and cfg.get("verdict"):
            i = 50
            pts[i] = (pts[i][0], pts[i][1] - R * 0.22)
            spike = pts[i]
        out.append(polyline(pts, p["ink"], c.hw(0.7), 0.6))
    for i in range(c.count(30, 10)):
        x = x0 + (x1 - x0) * i / c.count(30, 10)
        out.append(line(x, c.cy + R * 0.95, x, c.cy + R * 0.95 + c.hw(6 if i % 5 else 12), p["ink"], c.hw(0.6), 0.5))
    if spike:
        col = c.verdict(cfg["verdict"])
        out.append(c.label(cfg["verdict"], spike[0], spike[1] - c.hw(28), R * 0.07, col, "middle"))
    return _finish(c, out, R * 0.3)


def lens(c: Ctx, cfg: dict) -> str:
    """Parallel rays bent by a lens and focused on the core, then spreading past it."""
    p, r, R = c.p, c.rand, c.R
    d = _away(cfg)  # rays enter from the side away from the text
    lx = c.cx + d * R * r.u(0.55, 0.9)
    bow = r.u(0.4, 0.7)
    rr = R * 0.56 / math.sin(bow)
    off = rr * math.cos(bow) - R * 0.12
    out = [polyline(arc_points(lx - off, c.cy, rr, -bow, bow, 40) +
                    arc_points(lx + off, c.cy, rr, math.pi - bow, math.pi + bow, 40)[1:],
                    p["ink"], c.hw(1.0), 0.7)]
    rays = c.count(int(r.u(18, 40)), 8)
    for j in range(rays):
        y = c.cy + (j / max(1, rays - 1) - 0.5) * R * 1.0
        ex = c.cx - d * R * 0.9
        ey = c.cy + (c.cy - y) * 0.9
        out.append(polyline([(lx + d * R * 1.4, y), (lx, y), (c.cx, c.cy), (ex, ey)], p["ink"], c.hw(0.5), 0.4))
    return _finish(c, out, R * 0.25)


def strata(c: Ctx, cfg: dict) -> str:
    """Layered rings, each a little deformed, the inner layers denser: records kept in layers."""
    p, r, R = c.p, c.rand, c.R
    out = []
    layers = c.count(22, 8)
    ph = [r.u(0, TAU) for _ in range(3)]
    for k in range(layers):
        rr = R * (0.18 + 0.85 * k / layers)
        pts = []
        for i in range(181):
            a = TAU * i / 180
            d = 1 + 0.05 * math.sin(3 * a + ph[0]) + 0.03 * math.sin(5 * a + ph[1]) * (k / layers)
            pts.append(polar(c.cx, c.cy, rr * d, a))
        dash = None if k % 4 else f"{c.hw(4)} {c.hw(3)}"
        out.append(polyline(pts, p["ink"], c.hw(0.6), 0.25 + 0.4 * (1 - k / layers), dash=dash))
    return _finish(c, out, R * 1.08)


FAMILIES = {"pipeline": pipeline, "gate": gate, "ledger": ledger, "graph": graph, "signal": signal,
            "lens": lens, "strata": strata, "lattice": lattice, "orbit": orbit, "document": document}

ALT = {
    "pipeline": "Bundles of fine lines carry the work through {n} stations, {words}, along a sweeping path into a bright core.",
    "gate": "Lines arrive from one side at a toothed ring around a bright core; most pass through and a few stop at the ring with a short cross mark.",
    "ledger": "A chain of small linked squares, each holding a few ruled lines, winds inward to a bright core.",
    "graph": "Clusters of small nodes, named {words}, are wired to their neighbours and bundled through a bright core.",
    "signal": "{n2} wavering traces run from the left and narrow into a bright core over a row of tick marks.",
    "lens": "Parallel rays pass through a lens drawn in fine lines, gather at a bright core and spread out past it.",
    "strata": "Layered rings drawn in fine lines, each slightly deformed, tighten around a bright core.",
    "lattice": "A fine lattice of lines bulges outward around a bright core, as if seen through a lens, inside a ring.",
    "orbit": "Streamlines of fine lines spiral inward around a bright core.",
    "document": "A fan of ruled sheets drawn in fine lines, the top sheet lit by a bright core.",
}


def alt_for(cfg: dict) -> str:
    words = [w.lower() for w in cfg["words"]]
    text = ALT[cfg["archetype"]].format(n=len(words), n2=len(words) + 2,
                                        words=", ".join(words[:-1]) + " and " + words[-1] if len(words) > 1 else words[0])
    if cfg.get("verdict"):
        text += f" One mark is labelled {cfg['verdict']}."
    return text
