"""Line-work motifs for the plugin icons, one per tool, drawn on a 1024 grid.

Each motif returns SVG elements centred on (C, C). Geometry is seeded so the
same seed always gives the same bytes. The shared aperture (ground, hairline
ring, incandescent core) lives in tools/plugin_icons.py.
"""

from __future__ import annotations

import math
import random

C = 512.0
R = 404.0  # art radius; keeps the mark inside the central 80 percent


def f(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".")


def path(points: list[tuple[float, float]], closed: bool = False) -> str:
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in points)
    return d + (" Z" if closed else "")


def polar(r: float, a: float) -> tuple[float, float]:
    return C + r * math.cos(a), C + r * math.sin(a)


def line(x1: float, y1: float, x2: float, y2: float, op: float = 1.0) -> str:
    o = "" if op >= 1 else f' opacity="{op:.2f}"'
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"{o}/>'


def curve(points: list[tuple[float, float]], op: float = 1.0, closed: bool = False) -> str:
    o = "" if op >= 1 else f' opacity="{op:.2f}"'
    return f'<path d="{path(points, closed)}"{o}/>'


def articulate(rng: random.Random, n: int) -> list[str]:
    """Lines of text deformed around the pupil: a contour field."""
    out, step = [], 2 * R / n
    for i in range(n + 1):
        y0 = -R + i * step
        pts = []
        for k in range(97):
            x = -R + k * 2 * R / 96
            push = 120 * math.exp(-(x * x + y0 * y0) / (190.0 ** 2))
            pts.append((C + x, C + y0 + math.copysign(push, y0 or 1) + rng.uniform(-0.8, 0.8)))
        out.append(curve(pts, 0.55 + 0.45 * (1 - abs(y0) / R)))
    return out


def canon(rng: random.Random, n: int) -> list[str]:
    """Nested square frames turning inward: one scope inside the next."""
    out, half, turn = [], R * 0.70, 0.0
    for _ in range(n):
        corners = [polar(half * math.sqrt(2), turn + math.pi / 4 + j * math.pi / 2) for j in range(4)]
        out.append(curve(corners, 0.9, closed=True))
        half *= 0.86
        turn += math.radians(5.5)
        if half < 60:
            break
    return out


def crucible(rng: random.Random, n: int) -> list[str]:
    """A corona held inside a hexagonal crystal."""
    out, rim = [], R * 0.96
    verts = [polar(rim, math.radians(-90 + 60 * j)) for j in range(6)]
    out.append(curve(verts, 1.0, closed=True))
    for i in range(n):
        a = 2 * math.pi * i / n
        sector = (a + math.pi / 2) % (math.pi / 3) - math.pi / 6
        reach = rim * math.cos(math.pi / 6) / math.cos(sector)
        reach *= rng.uniform(0.78, 0.99)
        out.append(line(*polar(70, a), *polar(reach, a), 0.75))
    for x, y in verts:
        out.append(line(C, C, x, y, 0.9))
    return out


def forum(rng: random.Random, n: int) -> list[str]:
    """Four fans that pinch to one node: requests converging on a route."""
    out = []
    for arm in range(4):
        base = math.radians(45 + 90 * arm)
        for i in range(n):
            a = base + math.radians(-19 + 38 * i / max(n - 1, 1))
            reach = R * (1.0 - 0.38 * abs(i / max(n - 1, 1) - 0.5) * 2) * rng.uniform(0.93, 1.0)
            out.append(line(*polar(66, a), *polar(reach, a), 0.85))
    return out


def gather(rng: random.Random, n: int) -> list[str]:
    """Spiral arms drawn in from the rim to the core."""
    out = []
    for i in range(n):
        a0, pts = 2 * math.pi * i / n, []
        for k in range(73):
            t = k / 72
            pts.append(polar(R - (R - 64) * t, a0 + 2.3 * t ** 0.85))
        out.append(curve(pts, 0.8))
    return out


def index(rng: random.Random, n: int) -> list[str]:
    """A coordinate grid pinched toward the core: a map with one focus."""
    out, step = [], 2 * R / n

    def warp(x: float, y: float) -> tuple[float, float]:
        s = 1 - 0.42 * math.exp(-(x * x + y * y) / (230.0 ** 2))
        return C + x * s, C + y * s

    for i in range(n + 1):
        v = -R + i * step
        out.append(curve([warp(v, -R + k * 2 * R / 64) for k in range(65)], 0.8))
        out.append(curve([warp(-R + k * 2 * R / 64, v) for k in range(65)], 0.8))
    return out


def learn(rng: random.Random, n: int) -> list[str]:
    """A halftone orb lit from the upper left: light that grows by degrees."""
    out, step = [], 2 * R / n
    lx, ly, lz = -0.55, -0.6, 0.58
    for row in range(n + 2):
        y = -R + row * step * 0.866
        shift = step / 2 if row % 2 else 0.0
        for col in range(n + 2):
            x = -R + col * step + shift
            rr = math.hypot(x, y)
            if rr > R * 0.97:
                continue
            z = math.sqrt(max(R * R - rr * rr, 0)) / R
            lit = ((x / R) * lx + (y / R) * ly + z * lz + 0.45) / 1.45
            radius = step * 0.46 * min(1.0, max(0.0, lit) ** 1.6 * 1.3)
            radius = min(radius, R * 0.99 - rr)
            if radius > step * 0.06:
                out.append(f'<circle cx="{f(C + x)}" cy="{f(C + y)}" r="{f(radius)}"/>')
    return out


def mneme(rng: random.Random, n: int) -> list[str]:
    """Rings laid down one at a time, with a second record slightly offset."""
    out, radii, r = [], [], 70.0
    while r < R:
        radii.append(r)
        r += (R - 70) / n * rng.uniform(0.7, 1.3)
    for rad in radii:
        out.append(f'<circle cx="{f(C)}" cy="{f(C)}" r="{f(rad)}" opacity="0.85"/>')
    for rad in radii[1:-1]:
        out.append(f'<circle cx="{f(C + 0.06 * rad)}" cy="{f(C)}" r="{f(rad * 0.97)}" opacity="0.35"/>')
    return out


def plexus(rng: random.Random, n: int) -> list[str]:
    """Nodes on two rings joined by routes: tools and the paths between them."""
    outer = [polar(R * 0.86, 2 * math.pi * i / n - math.pi / 2) for i in range(n)]
    inner = [polar(R * 0.46, 2 * math.pi * (i + 0.5) / n - math.pi / 2) for i in range(n)]
    out = []
    for i, p in enumerate(outer):
        for step in (n // 3, n // 2):
            q = outer[(i + step) % n]
            out.append(line(*p, *q, 0.45))
        out.append(line(*p, *inner[i], 0.8))
        out.append(line(*p, *inner[i - 1], 0.8))
    for i, p in enumerate(inner):
        out.append(line(*p, *polar(64, math.atan2(p[1] - C, p[0] - C)), 0.8))
    return out


def relay(rng: random.Random, n: int) -> list[str]:
    """A band of waves carried through the core and out the far side."""
    out = []
    for i in range(n):
        phase, amp = 2 * math.pi * i / n, 120 + 200 * i / max(n - 1, 1)
        pts = []
        for k in range(121):
            x = -R + k * 2 * R / 120
            env = math.exp(-(x / (R * 0.66)) ** 2)
            pts.append((C + x, C + amp * env * math.sin(x / 70 + phase) * 0.72))
        out.append(curve(pts, 0.85))
    return out


def telos(rng: random.Random, n: int) -> list[str]:
    """The eye: senses in the iris, permission tiers as nested lids, actuators as lashes."""
    out = []
    for tier, (w, h) in enumerate(((R * 0.98, R * 0.56), (R * 0.80, R * 0.42), (R * 0.62, R * 0.30))):
        top = [(C - w + 2 * w * k / 60, C - h * math.sin(math.pi * k / 60)) for k in range(61)]
        bottom = [(x, 2 * C - y) for x, y in reversed(top)]
        out.append(curve(top + bottom[1:], 1.0 - 0.18 * tier, closed=True))
    iris = R * 0.27
    for i in range(n):
        a = 2 * math.pi * i / n
        out.append(line(*polar(62, a), *polar(iris * rng.uniform(0.86, 1.0), a), 0.8))
    lashes = max(5, n // 6)
    for i in range(lashes):
        k = 0.2 + 0.6 * i / (lashes - 1)
        x = C - R * 0.98 + 2 * R * 0.98 * k
        y = C - R * 0.56 * math.sin(math.pi * k)
        a = -math.pi / 2 + (k - 0.5) * 1.3
        out.append(line(x, y, x + 46 * math.cos(a), y + 46 * math.sin(a), 0.9))
    return out


MOTIFS = {
    "articulate": articulate, "canon": canon, "crucible": crucible, "forum": forum,
    "gather": gather, "index": index, "learn": learn, "mneme": mneme,
    "plexus": plexus, "relay": relay, "telos": telos,
}
