"""Compose a repository's README hero and social preview.

No frame and no fixed grid. What every piece shares is the type (Hanken Grotesk
title and tagline, a Conso command line and metadata row), the calm text field,
the aperture core, the colour rules and the seed. Composition varies per tool:
the figure sits where its config puts it, and the text takes the calm side.
"""

from __future__ import annotations

from .ctx import Ctx
from .figures_a import crucible, gather, index
from .families import FAMILIES, alt_for
from .figures_b import FIGURES
from .svg import PAL, core_defs, num, svg_doc, texture, texture_defs
from .type import measure, text_path  # noqa: F401

FIG = {"crucible": crucible, "gather": gather, "index": index, **FIGURES}


def resolve(name: str, cfg: dict) -> dict:
    """Fill a family repository's defaults: legend from its words, alt text, and a seeded layout."""
    if name in FIG or "archetype" not in cfg:
        return cfg
    out = dict(cfg)
    out.setdefault("legend", "  /  ".join(cfg["words"]))
    out.setdefault("figure_alt", alt_for(cfg))
    pick = ss.xmur3(name + "/layout")
    left = pick % 2 == 1
    out.setdefault("layout", "art-left" if left else "art-right")
    out.setdefault("text", ("top", "center", "bottom")[(pick >> 3) % 3])
    out.setdefault("art", {"x": 0.25 if left else 0.73, "y": 0.46, "r": 0.33})
    return out


def figure_for(name: str, cfg: dict):
    if name in FIG:
        return FIG[name]
    family = FAMILIES[cfg["archetype"]]
    return lambda c: family(c, cfg)
from tools import superstack as ss  # noqa: E402

# A README shows the 1280 hero at about 830 px, so 23 px in the file reads as 15 px on screen.
MIN_LABEL = {"hero": 23.0, "social": 23.0}

SURFACES = {
    # w, h, title, tagline, command, meta sizes, margin
    "hero": {"w": 1280, "h": 480, "title": 92, "tag": 25, "cmd": 20, "meta": 15, "m": 72},
    "social": {"w": 1280, "h": 640, "title": 124, "tag": 33, "cmd": 26, "meta": 18, "m": 84},
}


def wrap(text: str, face: str, size: float, width: float) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if cur and measure(trial, face, size) > width:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    return lines + ([cur] if cur else [])


def meta_row(cfg: dict) -> str:
    parts = ["ZAIN DANA HARPER"]
    if cfg.get("family"):
        parts.append("A FLYWHEEL LANE")
    parts.append(cfg["maturity"].upper())
    return "  /  ".join(parts)


def text_block(cfg: dict, s: dict, p: dict, x0: float, width: float, anchor: str = "center") -> tuple[str, float]:
    """Title, tagline, command and metadata on the calm side; anchor is top, center or bottom."""
    tag_lines = wrap(cfg["tagline"], "grotesk-regular", s["tag"], width)
    gap_t, lead = s["title"] * 0.42, s["tag"] * 1.34
    command = cfg.get("hero_command", cfg["command"])
    block = s["title"] * 0.74 + gap_t + lead * len(tag_lines) + (s["cmd"] * 2.7 if command else 0)
    top = {"top": s["m"] * 0.9, "center": (s["h"] - block) / 2 - s["meta"],
           "bottom": s["h"] - s["m"] * 1.25 - s["meta"] * 2 - block}[anchor]
    y = top + s["title"] * 0.74
    title, lines = s["title"], [cfg["wordmark"]]
    while title > s["title"] * 0.62 and measure(cfg["wordmark"], "grotesk-semibold", title, -0.025) > width:
        title -= 2
    if measure(cfg["wordmark"], "grotesk-semibold", title, -0.025) > width and "-" in cfg["wordmark"]:
        parts = cfg["wordmark"].split("-")
        cut = min(range(1, len(parts)), key=lambda i: abs(len("-".join(parts[:i])) - len("-".join(parts[i:]))))
        lines = ["-".join(parts[:cut]) + "-", "-".join(parts[cut:])]
        title = s["title"] * 0.7
        while title > s["title"] * 0.5 and max(measure(t, "grotesk-semibold", title, -0.025) for t in lines) > width:
            title -= 2
        y -= title * 0.5
    out = []
    for i, t in enumerate(lines):
        out.append(text_path(t, "grotesk-semibold", title, x0, y + i * title * 1.0, tracking=-0.025, fill=p["ink"]))
    y += (len(lines) - 1) * title * 1.0
    y += gap_t
    for ln in tag_lines:
        y += lead
        out.append(text_path(ln, "grotesk-regular", s["tag"], x0, y, fill=p["soft"]))
    if command:
        y += s["cmd"] * 2.7
        prompt_w = measure("$ ", "mono-regular", s["cmd"])
        out.append(text_path("$", "mono-regular", s["cmd"], x0, y, fill=p["quiet"]))
        out.append(text_path(command, "mono-medium", s["cmd"], x0 + prompt_w, y, fill=p["ink"]))
    meta, msize = meta_row(cfg), s["meta"]
    while msize > 11 and x0 + measure(meta, "mono-regular", msize, 0.14) > s["w"] - s["m"] * 0.6:
        msize -= 0.5  # the metadata row shrinks before it ever leaves the canvas
    out.append(text_path(meta, "mono-regular", msize, x0, s["h"] - s["m"] * 0.62, tracking=0.14, fill=p["quiet"]))
    return "".join(out), max(max(measure(t, "grotesk-semibold", title, -0.025) for t in lines),
                              max(measure(t, "grotesk-regular", s["tag"]) for t in tag_lines))


def veil(uid: str, p: dict, w: float, h: float, x_solid: float, x_clear: float) -> tuple[str, str]:
    """A ground-coloured gradient under the text so the art always recedes behind words.
    Fully solid at x_solid, clear at x_clear; either side may hold the text."""
    s0, s1 = sorted((x_solid / w, x_clear / w))
    o0, o1 = ("0.94", "0") if x_solid < x_clear else ("0", "0.94")
    d = (f'<linearGradient id="{uid}-veil" x1="0" y1="0" x2="1" y2="0">'
         f'<stop offset="{num(s0)}" stop-color="{p["ground"]}" stop-opacity="{o0}"/>'
         f'<stop offset="{num(s1)}" stop-color="{p["ground"]}" stop-opacity="{o1}"/></linearGradient>')
    return d, f'<rect width="{num(w)}" height="{num(h)}" fill="url(#{uid}-veil)"/>'


def compose(name: str, cfg: dict, surface: str, theme: str) -> tuple[str, dict]:
    """Return (svg, scene). The scene holds every input that decides the bytes."""
    cfg = resolve(name, cfg)
    s, p = SURFACES[surface], PAL[theme]
    uid = f"ra-{name}-{surface[0]}{theme[0]}"
    w, h = s["w"], s["h"]
    art = cfg["art"]
    left = cfg.get("layout", "art-right") == "art-left"
    c = Ctx(uid, name, "figure", w * art["x"], h * art["y"], h * art["r"], theme, cfg["maturity"],
            min_label=MIN_LABEL[surface])
    figure = figure_for(name, cfg)(c)
    x0 = w * 0.53 if left else s["m"]
    width = w * 0.42 if left else w * 0.44
    text, used = text_block(cfg, s, p, x0, width, cfg.get("text", "center"))
    if left:
        vd, vr = veil(uid, p, w, h, x0 + 30, x0 - 150)
    else:
        vd, vr = veil(uid, p, w, h, x0 + used * 0.75, x0 + used + 130)
    seed_u32 = ss.xmur3(name)
    defs = core_defs(uid, p) + vd + (texture_defs(uid, p, seed_u32) if c.m["texture"] else "")
    body = [f'<rect width="{w}" height="{h}" fill="{p["ground"]}"/>', figure, vr]
    if c.m["texture"]:
        body.append(texture(uid, w, h, grain=0.06 if theme == "dark" else 0.05, scan=0.14))
    body.append(text)
    if cfg.get("legend"):  # where the figure leaves room: bottom of the art side, or top-left
        top = cfg.get("legend_at") == "top-left"
        lx = s["m"] if (left or top) else w - s["m"] * 0.6
        ly = s["m"] * 0.62 + s["meta"] if top else h - s["m"] * 0.62
        if not top:  # never on the metadata row's line when the two would touch
            lw = measure(cfg["legend"], "mono-regular", s["meta"], 0.14)
            meta_end = x0 + measure(meta_row(cfg), "mono-regular", s["meta"], 0.14)
            legend_start = lx if left else lx - lw
            legend_end = lx + lw if left else lx
            if legend_start < meta_end + 40 and legend_end > x0 - 40:
                ly = s["m"] * 0.62 + s["meta"]  # the bottom line is taken: the top of the art side
        body.append(text_path(cfg["legend"], "mono-regular", s["meta"], lx, ly,
                              tracking=0.14, anchor="start" if (left or top) else "end", fill=p["quiet"]))
    label = f'{cfg["wordmark"]}: {cfg["tagline"]} {cfg["figure_alt"]}'
    scene = {"kind": "harperz9.repo-art/1", "repo": name, "surface": surface, "theme": theme,
             "seed": name, "seed_tag": "figure", "config": cfg, "size": [w, h], "hot_mark": c.hot}
    return svg_doc(w, h, "".join(body), defs, label, title=f'{cfg["wordmark"]}: {cfg["tagline"]}',
                   desc=cfg["figure_alt"]), scene
