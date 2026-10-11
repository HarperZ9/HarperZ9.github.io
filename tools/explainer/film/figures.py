"""The evidence marks a film draws over its plate, with Pillow at 1920x1080.

Colour follows the risk rule of the short explainers (tools/explainer/marks.py): quiet ink for
everything, and one hot mark per view in the colour of its level; on screen it carries a plain claim tag.
Every number drawn comes from film.json, which takes it from the evidence files.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from tools.explainer.marks import HAIR, INK, QUIET, RISK, VERDICT_RISK
from tools.explainer.film.timeline import revealed

ROOT = Path(__file__).resolve().parents[3]
FONTS = {"sans": ROOT / "system/fonts/hanken-grotesk.woff2", "mono": ROOT / "system/fonts/conso-regular.woff2"}
W, H = 1920, 1080
X0 = 140


def rgba(hexcol: str, a: float) -> tuple[int, int, int, int]:
    return tuple(int(hexcol[i:i + 2], 16) for i in (1, 3, 5)) + (int(255 * max(0.0, min(1.0, a))),)


class Fonts:
    def __init__(self):
        def face(kind, size, weight=None):
            f = ImageFont.truetype(str(FONTS[kind]), size)
            if weight:
                f.set_variation_by_name(weight)
            return f
        self.title = face("sans", 92, "SemiBold")
        self.h1 = face("sans", 60, "SemiBold")
        self.body = face("sans", 40, "Regular")
        self.big = face("sans", 54, "Regular")
        self.mono = face("mono", 34)
        self.small = face("mono", 25)


def tag(d, f: Fonts, right: float, y: float, text: str, level: str, a: float) -> None:
    """A plain claim tag in mono, right-aligned, in the hot colour of its level."""
    d.text((right - d.textlength(text, font=f.mono), y), text, font=f.mono, fill=rgba(RISK[level], a))


def header(d, f: Fonts, st: dict, count: int) -> None:
    seg, a = st["segment"], st["alpha"]
    d.text((X0, 84), f"{st['index']:02d} / {count - 1:02d}", font=f.small, fill=rgba(QUIET, a))
    d.text((X0, 124), seg["heading"], font=f.h1, fill=rgba(INK, a))


def footer(d, f: Fonts, st: dict, evidence: dict) -> None:
    ids = st["segment"].get("sources", [])
    for k, sid in enumerate(ids):
        e = evidence[sid]
        d.text((X0, H - 96 - 40 * k), f"source: {e['short']}  |  {e['n']}", font=f.small, fill=rgba(QUIET, st["alpha"]))


def title(d, f: Fonts, st: dict, film: dict) -> None:
    a = st["alpha"]
    text = film["title"]
    tw = d.textlength(text, font=f.title)
    d.text(((W - tw) / 2, H / 2 - 70), text, font=f.title, fill=rgba(INK, a))
    sub = "an explainer, with its sources under the video"
    d.text(((W - d.textlength(sub, font=f.small)) / 2, H / 2 + 60), sub, font=f.small, fill=rgba(QUIET, a))


def reference(d, f: Fonts, st: dict, fig: dict) -> None:
    a = st["alpha"]
    y = 360
    d.rectangle([X0, y - 30, W - X0, y + 3 * 62 + 30], outline=rgba(HAIR, a * 1.6), width=2)
    for k, line in enumerate(fig["text"]):
        d.text((X0 + 40, y + k * 62), line, font=f.mono, fill=rgba(INK, a))
    inv = revealed(st, fig["invented_at"])
    d.text((X0, y + 3 * 62 + 60), "invented for this example", font=f.small, fill=rgba(QUIET, inv))
    tag(d, f, W - X0 - 40, y + 3 * 62 + 60, fig.get("tag", fig["verdict"]), "moderate", revealed(st, fig["verdict_at"]))
    v = revealed(st, fig["verdict_at"])
    d.text((X0, y + 3 * 62 + 160), "exists?  not checked yet", font=f.body, fill=rgba(INK, v))


def dotgrid(d, f: Fonts, st: dict, fig: dict) -> None:
    cols, gap, r = 28, 25, 9
    for g_i, g in enumerate(fig["groups"]):
        x = X0 + g_i * 820
        a = revealed(st, g["on"])
        hot_a = revealed(st, g["hot_at"])
        fake = round(g["n"] * g["share"])
        d.text((x, 300), f"{g['label']}  ({g['n']} {g.get('unit', 'references')})", font=f.body, fill=rgba(INK, a))
        for k in range(g["n"]):
            cx, cy = x + (k % cols) * gap + r, 380 + (k // cols) * gap + r
            hot = k < fake
            col = rgba(RISK["high"], a * hot_a) if hot and hot_a > 0 else rgba(INK, a * 0.75)
            if hot and hot_a > 0:
                ink = rgba(INK, a * 0.75 * (1 - hot_a))
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
        share = f"{round(g['share'] * 100)}% {fig['legend_hot']}"
        below = 380 + math.ceil(g["n"] / cols) * gap + 24
        d.text((x, below), share, font=f.mono, fill=rgba(RISK["high"], a * hot_a))
        if g.get("detail"):
            d.text((x, below + 50), g["detail"], font=f.mono, fill=rgba(QUIET, revealed(st, g["detail_at"])))
    hot_a = revealed(st, fig["groups"][0]["hot_at"])
    d.text((X0, H - 150), f"{fig['note']}  Marked: {fig['legend_hot']}.", font=f.small,
           fill=rgba(QUIET, st["alpha"] * hot_a))


def arith(d, f: Fonts, st: dict, fig: dict) -> None:
    y = 330
    vx = X0 + max(520, max(d.textlength(r["label"], font=f.body) for r in fig["rows"]) + 70)  # value column
    for row in fig["rows"]:
        a = revealed(st, row["on"])
        d.text((X0, y), row["label"], font=f.body, fill=rgba(QUIET, a))
        if row.get("verdict"):
            tag(d, f, W - X0, y, row.get("tag", row["verdict"]), VERDICT_RISK.get(row["verdict"], "moderate"), a)
            d.text((vx, y), row["value"], font=f.mono, fill=rgba(INK, a))
        else:
            font = f.big if row.get("strong") else f.mono
            d.text((vx, y - (8 if row.get("strong") else 0)), row["value"], font=font, fill=rgba(INK, a))
        if row.get("strong"):
            d.line([X0, y - 20, W - X0, y - 20], fill=rgba(HAIR, a * 2), width=2)
        y += 104


def race(d, f: Fonts, st: dict, fig: dict) -> None:
    a = revealed(st, fig["on"])
    top = max(r["value"] for r in fig["rows"])
    lw = fig.get("label_w", 300)  # width of the label column
    y, span = 400, W - X0 * 2 - lw - 560  # room on the right for the value label
    if fig.get("intro"):
        d.text((X0, 260), fig["intro"]["text"], font=f.body, fill=rgba(INK, revealed(st, fig["intro"]["on"])))
    d.text((X0, 340), fig["caption"], font=f.small, fill=rgba(QUIET, a))
    for row in fig["rows"]:
        ra = revealed(st, row["on"]) if "on" in row else a
        length = max(6, span * row["value"] / top * ra)  # the bars grow as they fade in
        col = RISK["high"] if row.get("hot") else INK
        d.text((X0, y + 4), row["label"], font=f.body, fill=rgba(INK, ra))
        d.rectangle([X0 + lw, y + 10, X0 + lw + length, y + 54], fill=rgba(col, ra * 0.9))
        d.text((X0 + lw + 20 + length, y + 12), row["display"], font=f.mono, fill=rgba(QUIET, ra))
        y += 100
    if fig.get("hot_note"):
        d.text((X0, y + 10), fig["hot_note"], font=f.small, fill=rgba(QUIET, a))
    for k, extra in enumerate(fig.get("extras", [])):
        d.text((X0, y + 70 + 50 * k), extra["text"], font=f.mono, fill=rgba(QUIET, revealed(st, extra["on"])))
    if "adage_at" in fig:
        ad = revealed(st, fig["adage_at"])
        d.text((X0, y + 270), "refuting costs ten times making:", font=f.body, fill=rgba(INK, ad))
        d.text((X0, y + 330), "an adage. No study has measured the ratio.", font=f.body, fill=rgba(QUIET, ad))


def squares(d, f: Fonts, st: dict, fig: dict) -> None:
    size, gap, x, y = 64, 18, X0, 330
    frame = revealed(st, fig.get("frame_on"))
    if fig.get("lead"):
        la = revealed(st, fig["lead"]["on"]) * (1 - revealed(st, fig["lead"]["until"]) / max(1e-6, st["alpha"]))
        d.text((X0, 262), fig["lead"]["text"], font=f.big, fill=rgba(INK, la))
    if fig.get("frame_label"):
        d.text((X0, 262), fig["frame_label"], font=f.body, fill=rgba(INK, frame))
    k = 0
    for g in fig["groups"]:
        a = revealed(st, g["on"])
        col = RISK["elevated"] if g.get("hot") else (QUIET if g.get("quiet") else INK)
        for _ in range(g["n"]):
            cx = x + (k % 18) * (size + gap)
            cy = y + (k // 18) * (size + gap)
            d.rectangle([cx, cy, cx + size, cy + size], fill=rgba(col, a * 0.92), outline=rgba(QUIET, frame * 0.7))
            k += 1
    ly = y + 2 * (size + gap) + 30
    for g in fig["groups"]:
        a = revealed(st, g["on"])
        col = RISK["elevated"] if g.get("hot") else (QUIET if g.get("quiet") else INK)
        d.rectangle([X0, ly + 8, X0 + 26, ly + 34], fill=rgba(col, a))
        d.text((X0 + 44, ly), f"{g['n']}  {g['label']}", font=f.body, fill=rgba(INK, a))
        ly += 58
    for h in fig["hours"]:
        a = revealed(st, h["on"])
        d.text((X0 + 1000, ly - 3 * 58 + (fig["hours"].index(h)) * 58), f"{h['label']}: {h['value']}",
               font=f.mono, fill=rgba(QUIET, a))


def keep(d, f: Fonts, st: dict, fig: dict) -> None:
    y = 400
    for k, item in enumerate(fig["items"]):
        a = revealed(st, item["on"])
        d.text((X0, y), f"{k + 1}", font=f.mono, fill=rgba(QUIET, a))
        d.text((X0 + 70, y - 10), item["text"], font=f.big, fill=rgba(INK, a))
        y += 130


DRAW = {"reference": reference, "dotgrid": dotgrid, "arith": arith, "race": race, "squares": squares, "keep": keep}


def overlay(f: Fonts, st: dict, film: dict, evidence: dict) -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    seg = st["segment"]
    if seg.get("layout") == "title":
        title(d, f, st, film)
        return img
    header(d, f, st, len(film["segments"]))
    if seg.get("figure"):
        DRAW[seg["figure"]["type"]](d, f, st, seg["figure"])
    footer(d, f, st, evidence)
    return img
