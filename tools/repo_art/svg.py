"""SVG primitives shared by every figure, mark and card.

Colours come from two places only. The art palette is the site's aperture
palette (scripts/render-site-art.mjs PAL). Verdict colours are the superstack
risk tokens (SPEC 7.2), and a view draws at most one of them (hot_mark).
"""

from __future__ import annotations

import math

TAU = math.tau

PAL = {
    "dark": {
        "ground": "#040405", "lift": "#0d0f18", "ink": "#e6e1d6", "soft": "#c9c3b6",
        "quiet": "#8f8b84", "core": "#fff7e8", "honey": "#ffd592", "warm": "#ffab52",
        "flare": ["#ff3d6e", "#ff8f3a", "#ffe04a", "#5dff8f", "#3fd8ff", "#5b6bff", "#c35cff"],
        "verdict": {"low": "#8fdc8a", "moderate": "#a9a6b4", "elevated": "#f0a848", "high": "#ff7a6b"},
    },
    "light": {
        "ground": "#f1ece1", "lift": "#e6dfd0", "ink": "#1a1712", "soft": "#3a352d",
        "quiet": "#5f584d", "core": "#fffdf7", "honey": "#e7a653", "warm": "#c4621d",
        "flare": ["#d4144a", "#e3620b", "#c79b00", "#1f9a4c", "#0a86c0", "#3345d6", "#8b33cf"],
        "verdict": {"low": "#186844", "moderate": "#5c5a66", "elevated": "#8f5200", "high": "#b3261e"},
    },
}
VERDICT_RISK = {"MATCH": "low", "VERIFIED": "low", "UNVERIFIABLE": "moderate", "DRIFT": "elevated",
                "REFUTED": "high", "REFUSED": "high"}


def num(v: float) -> str:
    """Fixed two-decimal coordinates with trailing zeros cut: stable bytes across runs."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pts(points) -> str:
    return " ".join(f"{num(x)},{num(y)}" for x, y in points)


def polyline(points, stroke: str, width: float, opacity: float = 1.0, dash: str | None = None) -> str:
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<polyline points="{pts(points)}" fill="none" stroke="{stroke}" stroke-width="{num(width)}"'
            f' stroke-opacity="{num(opacity)}" stroke-linecap="round" stroke-linejoin="round"{d}/>')


def line(x1, y1, x2, y2, stroke: str, width: float, opacity: float = 1.0, dash: str | None = None) -> str:
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<line x1="{num(x1)}" y1="{num(y1)}" x2="{num(x2)}" y2="{num(y2)}" stroke="{stroke}"'
            f' stroke-width="{num(width)}" stroke-opacity="{num(opacity)}" stroke-linecap="round"{d}/>')


def circle(cx, cy, r, stroke: str | None = None, width: float = 1.0, fill: str = "none",
           opacity: float = 1.0, dash: str | None = None) -> str:
    s = f' stroke="{stroke}" stroke-width="{num(width)}"' if stroke else ""
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}" fill="{fill}"{s} opacity="{num(opacity)}"{d}/>'


def arc_points(cx, cy, r, a0, a1, steps: int = 48):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / steps), cy + r * math.sin(a0 + (a1 - a0) * i / steps))
            for i in range(steps + 1)]


def polar(cx, cy, r, a):
    return cx + r * math.cos(a), cy + r * math.sin(a)


def core_defs(uid: str, p: dict) -> str:
    """Radial gradients for the luminous core: a wide warm halo and an incandescent disk."""
    light = p is PAL["light"]
    hr, ho, hm = ("22%", "0.18", "0.05") if light else ("50%", "0.34", "0.1")
    return (f'<radialGradient id="{uid}-halo" r="{hr}"><stop offset="0" stop-color="{p["warm"]}" stop-opacity="{ho}"/>'
            f'<stop offset="0.35" stop-color="{p["warm"]}" stop-opacity="{hm}"/>'
            f'<stop offset="1" stop-color="{p["warm"]}" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="{uid}-core"><stop offset="0" stop-color="{p["core"]}"/>'
            f'<stop offset="0.45" stop-color="{p["core"]}" stop-opacity="0.96"/>'
            f'<stop offset="0.72" stop-color="{p["honey"]}" stop-opacity="{"0.3" if light else "0.55"}"/>'
            f'<stop offset="1" stop-color="{p["warm"]}" stop-opacity="0"/></radialGradient>')


def core(uid: str, cx, cy, r, *, halo: float = 6.0, pupil: bool = False, p: dict | None = None) -> str:
    """The aperture's luminous core. A pupil leaves a void at the centre (the eye form)."""
    out = [f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r * halo)}" fill="url(#{uid}-halo)"/>',
           f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r * 1.6)}" fill="url(#{uid}-core)"/>']
    if pupil and p:
        void = "#040405" if p is PAL["dark"] else p["ink"]
        out.append(circle(cx, cy, r * 0.62, fill=void))
        out.append(circle(cx, cy, r * 0.62, stroke=p["core"], width=max(0.8, r * 0.06), opacity=0.9))
    return "".join(out)


def texture_defs(uid: str, p: dict, seed_u32: int) -> str:
    """Film grain and fine scanlines, the corpus's universal veil. Static, no animation."""
    tone = "1 1 1" if p is PAL["dark"] else "0 0 0"
    r, g, b = tone.split()
    return (f'<filter id="{uid}-grain" x="0" y="0" width="100%" height="100%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="{seed_u32 % 9973}"/>'
            f'<feColorMatrix values="0 0 0 0 {r}  0 0 0 0 {g}  0 0 0 0 {b}  0 0 0 2.4 -1.3"/></filter>'
            f'<pattern id="{uid}-scan" width="6" height="3" patternUnits="userSpaceOnUse">'
            f'<rect width="6" height="1" fill="{p["ground"]}"/></pattern>')


def texture(uid: str, w, h, grain: float = 0.07, scan: float = 0.18) -> str:
    return (f'<rect width="{num(w)}" height="{num(h)}" fill="url(#{uid}-scan)" opacity="{num(scan)}"/>'
            f'<rect width="{num(w)}" height="{num(h)}" filter="url(#{uid}-grain)" opacity="{num(grain)}"/>')


def flare(cx, cy, r, a0, span, p: dict, width: float = 1.2) -> str:
    """The one spectral flare: seven hairline arcs, the art's single hot mark."""
    out = []
    for i, col in enumerate(p["flare"]):
        rr = r + (i - 3) * width * 1.15
        out.append(polyline(arc_points(cx, cy, rr, a0, a0 + span, 40), col, width, 0.9))
    return "".join(out)


def svg_doc(w, h, body: str, defs: str = "", label: str = "", title: str = "", desc: str = "") -> str:
    aria = f' role="img" aria-label="{escape(label)}"' if label else ""
    title = f"<title>{escape(title or label)}</title>" if (title or label) else ""
    if desc:
        title += f"<desc>{escape(desc)}</desc>"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(w)} {num(h)}" width="{num(w)}"'
            f' height="{num(h)}"{aria}>{title}<defs>{defs}</defs>{body}</svg>' + chr(10))


def escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
