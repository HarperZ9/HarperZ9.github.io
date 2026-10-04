"""The helper every figure family ends with: the flare, once stable, and the core."""

from __future__ import annotations

from .ctx import Ctx
from .svg import TAU, core, flare


def finish(c: Ctx, out: list, ring: float, glow: float = 7.0) -> str:
    if c.m["flare"]:
        out.append(flare(c.cx, c.cy, ring, c.rand.u(0, TAU), 0.5, c.p, c.hw(0.8)))
    out.append(core(c.uid, c.cx, c.cy, c.R * 0.07, halo=glow if c.m["glow"] else 2.5))
    return "".join(out)
