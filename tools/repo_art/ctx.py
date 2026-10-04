"""Drawing context handed to every figure: seeded draws, palette, scale and maturity."""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from tools import superstack as ss

from .svg import PAL, VERDICT_RISK
from .type import text_path

# How much of the generative layer each maturity stage draws. Identity (the
# figure's geometry and the mark) never changes; detail and the flare are earned.
MATURITY = {
    "experimental": {"density": 0.4, "glow": False, "flare": False, "texture": False},
    "beta": {"density": 0.75, "glow": True, "flare": False, "texture": True},
    "stable": {"density": 1.0, "glow": True, "flare": True, "texture": True},
}


class Rand:
    """superstack xmur3-mulberry32/1 draws with the helpers the figures need."""

    def __init__(self, seed: str):
        self.seed = seed
        self._m = ss.rng(seed)

    def f(self) -> float:
        return self._m.next_float()

    def u(self, a: float, b: float) -> float:
        return a + (b - a) * self.f()

    def i(self, a: int, b: int) -> int:
        """Integer in [a, b]."""
        return a + int(self.f() * (b - a + 1))

    def n(self, sigma: float = 1.0) -> float:
        """Approximate normal draw (Irwin-Hall of four), no transcendental calls."""
        return (sum(self.f() for _ in range(4)) - 2.0) * sigma * 1.7320508


@dataclass
class Ctx:
    uid: str
    seed: str
    tag: str
    cx: float
    cy: float
    R: float
    theme: str
    maturity: str
    hot: list = field(default_factory=list)
    min_label: float = 0.0  # px floor so a verdict word stays 15 px at its smallest display width

    def __post_init__(self):
        self.p = PAL[self.theme]
        self.m = MATURITY[self.maturity]
        self.rand = Rand(ss.substream(self.seed, self.tag))

    def count(self, full: int, floor: int = 3) -> int:
        return max(floor, int(round(full * self.m["density"])))

    def hw(self, w: float) -> float:
        """Hairline width scaled to the figure; never thinner than 0.6 px."""
        return max(0.6, w * self.R / 200.0)

    def verdict(self, word: str) -> str:
        """Colour for a verdict word. The first call in a view takes the hot colour;
        later calls fall back to ink, so a view never shows two hot marks."""
        level = VERDICT_RISK[word]
        if self.hot:
            return self.p["ink"]
        self.hot.append(word)
        return self.p["verdict"][level]

    def caption(self, text: str, x: float, y: float, size: float, anchor: str = "middle") -> str:
        """A quiet naming label (not a verdict): no size floor beyond legibility."""
        return text_path(text, "mono-regular", max(size, 13.0), x, y, tracking=0.14, anchor=anchor,
                         fill=self.p["quiet"])

    def label(self, text: str, x: float, y: float, size: float, fill: str, anchor: str = "start") -> str:
        return text_path(text, "mono-medium", max(size, self.min_label), x, y, tracking=0.1, anchor=anchor, fill=fill)


def rotate(x, y, a):
    return x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
