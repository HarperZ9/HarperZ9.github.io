"""Frame drawing for the explainer videos: the aperture, scene marks, captions and grain.

Every value that reaches a pixel comes from the spec or from the constants here, and every
random draw is seeded, so the same spec gives the same frames.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from tools.explainer.marks import GROUND, HAIR, INK, LEVELS, QUIET, RISK, VERDICT_RISK, hot_index, risk_of  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
FONTS = {"sans": ROOT / "system/fonts/hanken-grotesk.woff2", "mono": ROOT / "system/fonts/conso-regular.woff2"}
W, H, FPS = 1280, 720, 30


def rgb(hexcol: str) -> tuple[int, int, int]:
    return tuple(int(hexcol[i:i + 2], 16) for i in (1, 3, 5))


def fade(hexcol: str, alpha: float) -> tuple[int, int, int]:
    ground = rgb(GROUND)
    return tuple(int(g + (c - g) * alpha) for g, c in zip(ground, rgb(hexcol)))


def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def aperture(size: int, seed: int) -> Image.Image:
    """Seeded line-mesh corona around a void core with one prismatic flare: the only spectrum."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    for i in range(720):
        a = 2 * math.pi * i / 720 + rng.uniform(-0.004, 0.004)
        r0, r1 = size * rng.uniform(0.16, 0.19), size * rng.uniform(0.30, 0.48)
        if 0.55 < a % (2 * math.pi) < 0.85:
            hue = (a - 0.55) / 0.30
            col = tuple(int(150 + 105 * math.sin(2 * math.pi * (hue + k / 3))) for k in range(3)) + (150,)
        else:
            col = (236, 229, 214, rng.randint(28, 70))
        d.line([(c + r0 * math.cos(a), c + r0 * math.sin(a)), (c + r1 * math.cos(a), c + r1 * math.sin(a))],
               fill=col, width=1)
    return img


def grain(frame: Image.Image, seed: int) -> Image.Image:
    noise = np.random.default_rng(seed).integers(0, 14, (H, W, 1), dtype=np.uint8)
    arr = np.clip(np.asarray(frame, dtype=np.int16) + noise - 7, 0, 255).astype(np.uint8)
    arr[::3] = (arr[::3] * 0.92).astype(np.uint8)  # faint scanline
    return Image.fromarray(arr)


class Painter:
    def __init__(self, seed: int):
        def face(kind: str, size: int, weight: str | None = None) -> ImageFont.FreeTypeFont:
            font = ImageFont.truetype(str(FONTS[kind]), size)
            if weight:
                font.set_variation_by_name(weight)
            return font

        self.f = {"h1": face("sans", 54, "SemiBold"), "body": face("sans", 34, "Regular"),
                  "cap": face("sans", 27, "Regular"), "mono": face("mono", 28), "small": face("mono", 20)}
        self.art = aperture(560, seed)

    def text(self, d: ImageDraw.ImageDraw, xy, s: str, font: str, col: str, a: float) -> None:
        d.text(xy, s, font=self.f[font], fill=fade(col, a))

    def level_tag(self, d, right: float, y: float, mark: dict, hot: bool, a: float) -> None:
        """Verdict word in mono, its liability level in words under it, right-aligned."""
        level = mark["risk"]
        col = RISK[level] if hot else QUIET
        word = (mark.get("verdict") or level).upper()
        self.text(d, (right - d.textlength(word, font=self.f["mono"]), y), word, "mono", col, a)
        sub = f"{level} liability"
        self.text(d, (right - d.textlength(sub, font=self.f["small"]), y + 34), sub, "small", col if hot else QUIET, a)

    def card(self, d, y: int, mark: dict, a: float) -> int:
        hot = mark["hot"]
        d.rectangle([140, y, W - 140, y + 84], outline=fade(HAIR, a), width=1)
        self.text(d, (164, y + 12), mark["label"], "small", QUIET, a)
        self.text(d, (164, y + 40), mark["value"], "mono", INK, a)
        if mark["risk"]:
            if hot:
                d.rectangle([W - 152, y, W - 140, y + 84], fill=fade(RISK[mark["risk"]], a))
            self.level_tag(d, W - 176, y + 14, mark, hot, a)
        return y + 100

    def note(self, d, y: int, mark: dict, a: float) -> int:
        x, hot = 164, mark["hot"]
        if mark["risk"]:
            col = RISK[mark["risk"]] if hot else QUIET
            d.rectangle([140, y + 8, 152, y + 20], fill=fade(col, a))
            label = f"{mark['text']}  ({mark['risk']} liability)"
            self.text(d, (x, y), label, "small", col if hot else QUIET, a)
        else:
            self.text(d, (x, y), mark["text"], "small", QUIET, a)
        return y + 44

    def bars(self, d, y: int, mark: dict) -> int:
        """Horizontal bars; frame_state has already moved a bar with "to" along its scene."""
        top = mark["scale"]
        for item in mark["items"]:
            v, ia = item["value"], item["alpha"]
            length = max(4, (W - 300 - 470) * v / top * ease(ia))  # room for the value label
            self.text(d, (140, y + 6), item["label"], "body", INK, ia)
            d.rectangle([470, y + 10, 470 + length, y + 44], fill=fade(INK if item.get("strong") else QUIET, ia * 0.9))
            self.text(d, (470 + length + 16, y + 12), item["display"], "mono", QUIET, ia)
            y += 72
        return y + 8

    def grid(self, d, y: int, mark: dict, a: float) -> int:
        """One cell per claim, 25 to a row: checked cells filled in ink, the rest outlined."""
        cell, gap, per_row = 18, 6, 25
        for i in range(mark["count"]):
            x0, y0 = 140 + (i % per_row) * (cell + gap), y + (i // per_row) * (cell + gap)
            if i < mark["filled"]:
                d.rectangle([x0, y0, x0 + cell, y0 + cell], fill=fade(INK, a))
            else:
                d.rectangle([x0, y0, x0 + cell, y0 + cell], outline=fade(QUIET, a), width=1)
        rows = -(-mark["count"] // per_row)
        self.text(d, (140, y + rows * (cell + gap) + 4), mark["label"], "small", QUIET, a)
        return y + rows * (cell + gap) + 44

    def tries(self, d, y: int, mark: dict) -> int:
        """One box per candidate, left to right: its number and what the check said."""
        n = len(mark["slots"])
        width = (W - 280 - 12 * (n - 1)) / n
        for slot in mark["slots"]:
            a = slot["alpha"] * (1.0 if slot["in_budget"] else 0.45)
            if a <= 0:
                continue
            x0 = 140 + (slot["n"] - 1) * (width + 12)
            solid = slot["word"] == "PASS"
            d.rectangle([x0, y, x0 + width, y + 84], outline=fade(INK if solid else HAIR, a), width=2 if solid else 1)
            self.text(d, (x0 + 14, y + 12), f"candidate {slot['n']}", "small", QUIET, a)
            self.text(d, (x0 + 14, y + 42), slot["word"], "small" if " " in slot["word"] else "mono", INK if solid else QUIET, a)
        return y + 104


def draw_frame(p: Painter, state: dict, img: Image.Image) -> None:
    """Draw one frame from scene.frame_state(): the same state the live engine plugin draws."""
    d = ImageDraw.Draw(img)
    a = state["heading_alpha"]
    if state["layout"] in ("title", "close"):
        close = state["layout"] == "close"  # the closing scene also carries a caption, so it sits higher
        img.alpha_composite(p.art, ((W - 560) // 2, -40 if close else 8))
        line = state["heading"]
        p.text(d, ((W - d.textlength(line, font=p.f["h1"])) / 2, 482 if close else 580), line, "h1", INK, a)
        if state.get("command"):
            cmd = state["command"]
            p.text(d, ((W - d.textlength(cmd, font=p.f["small"])) / 2, 556), cmd, "small", QUIET, a)
        return
    p.text(d, (140, 96), state["heading"], "h1", INK, a)
    y = 210
    for mark in state["marks"]:
        kind, alpha = mark["type"], mark["alpha"]
        if kind == "card":
            y = p.card(d, y, mark, alpha) if alpha > 0 else y + 100
        elif kind == "note":
            y = p.note(d, y, mark, alpha) if alpha > 0 else y + 44
        elif kind == "bars":
            y = p.bars(d, y, mark)
        elif kind == "grid":
            y = p.grid(d, y, mark, alpha) if alpha > 0 else y + 4 * 24 + 44
        elif kind == "tries":
            y = p.tries(d, y, mark)
        else:
            raise ValueError(f"unknown mark type {kind!r}")


def caption(p: Painter, img: Image.Image, text: str) -> None:
    """Burned caption, wrapped to at most two centred lines inside a 140 px margin."""
    d, font, lines = ImageDraw.Draw(img), p.f["cap"], [""]
    for word in text.split():
        trial = (lines[-1] + " " + word).strip()
        if d.textlength(trial, font=font) > W - 280 and lines[-1]:
            lines.append(word)
        else:
            lines[-1] = trial
    y = H - 36 - 38 * len(lines)
    for line in lines:
        d.text(((W - d.textlength(line, font=font)) / 2, y), line, font=font, fill=rgb(QUIET))
        y += 38
