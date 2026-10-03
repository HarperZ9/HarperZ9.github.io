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

ROOT = Path(__file__).resolve().parents[2]
FONTS = {"sans": ROOT / "system/fonts/hanken-grotesk.woff2", "mono": ROOT / "system/fonts/conso-regular.woff2"}
W, H, FPS = 1280, 720, 30

# The dark pole of the site's risk tokens (system/media-engine/colour.mjs, RISK_TOKENS.dark).
GROUND = "#060608"
INK, QUIET, HAIR = "#ebe5d8", "#9d978a", "#2a2830"
RISK = {"low": "#8fdc8a", "moderate": "#a9a6b4", "elevated": "#f0a848", "high": "#ff7a6b"}
LEVELS = ["low", "moderate", "elevated", "high"]
VERDICT_RISK = {"MATCH": "low", "VERIFIED": "low", "PASS": "low", "UNVERIFIABLE": "moderate",
                "UNKNOWN": "moderate", "DRIFT": "elevated", "STALE": "elevated", "FAIL": "high", "REFUSED": "high"}


def rgb(hexcol: str) -> tuple[int, int, int]:
    return tuple(int(hexcol[i:i + 2], 16) for i in (1, 3, 5))


def fade(hexcol: str, alpha: float) -> tuple[int, int, int]:
    ground = rgb(GROUND)
    return tuple(int(g + (c - g) * alpha) for g, c in zip(ground, rgb(hexcol)))


def ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def risk_of(mark: dict) -> str | None:
    if mark.get("risk"):
        return mark["risk"]
    verdict = mark.get("verdict")
    return VERDICT_RISK.get(verdict.upper(), "moderate") if verdict else None


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
        level = risk_of(mark)
        col = RISK[level] if hot else QUIET
        word = (mark.get("verdict") or level).upper()
        self.text(d, (right - d.textlength(word, font=self.f["mono"]), y), word, "mono", col, a)
        sub = f"{level} liability"
        self.text(d, (right - d.textlength(sub, font=self.f["small"]), y + 34), sub, "small", col if hot else QUIET, a)

    def card(self, d, y: int, mark: dict, hot: bool, a: float) -> int:
        d.rectangle([140, y, W - 140, y + 84], outline=fade(HAIR, a), width=1)
        self.text(d, (164, y + 12), mark["label"], "small", QUIET, a)
        self.text(d, (164, y + 40), mark["value"], "mono", INK, a)
        if risk_of(mark):
            if hot:
                d.rectangle([W - 152, y, W - 140, y + 84], fill=fade(RISK[risk_of(mark)], a))
            self.level_tag(d, W - 176, y + 14, mark, hot, a)
        return y + 100

    def note(self, d, y: int, mark: dict, hot: bool, a: float) -> int:
        x = 164
        if risk_of(mark):
            col = RISK[risk_of(mark)] if hot else QUIET
            d.rectangle([140, y + 8, 152, y + 20], fill=fade(col, a))
            label = f"{mark['text']}  ({risk_of(mark)} liability)"
            self.text(d, (x, y), label, "small", col if hot else QUIET, a)
        else:
            self.text(d, (x, y), mark["text"], "small", QUIET, a)
        return y + 44

    def bars(self, d, y: int, mark: dict, u: float, a: float) -> int:
        """Horizontal bars; a bar with "to" moves from value to to across its scene."""
        top = mark.get("scale") or max(max(item["value"], item.get("to", 0)) for item in mark["items"])
        for item in mark["items"]:
            v = item["value"] + (item.get("to", item["value"]) - item["value"]) * ease((u - 0.2) / 0.6)
            ia = 1.0 if item.get("carry") else a  # a carried bar was already on screen in the scene before
            length = max(4, (W - 300 - 470) * v / top * ease(ia))  # room for the value label
            self.text(d, (140, y + 6), item["label"], "body", INK, ia)
            d.rectangle([470, y + 10, 470 + length, y + 44], fill=fade(INK if item.get("strong") else QUIET, ia * 0.9))
            self.text(d, (470 + length + 16, y + 12), item["display"], "mono", QUIET, ia)
            y += 72
        return y + 8


def hot_index(marks: list[dict]) -> int:
    """The one mark drawn in colour: the highest liability, the first on a tie."""
    best, rank = -1, -1
    for i, mark in enumerate(marks):
        level = risk_of(mark)
        if level and LEVELS.index(level) > rank:
            best, rank = i, LEVELS.index(level)
    return best


def draw_scene(p: Painter, scene: dict, u: float, img: Image.Image) -> None:
    """u runs 0..1 across the scene. A mark appears at its "at" fraction and fades in quickly."""
    d = ImageDraw.Draw(img)
    if scene.get("layout") in ("title", "close"):
        close = scene["layout"] == "close"  # the closing scene also carries a caption, so it sits higher
        img.alpha_composite(p.art, ((W - 560) // 2, -40 if close else 8))
        line = scene.get("heading", "")
        a = ease(u / 0.15)
        p.text(d, ((W - d.textlength(line, font=p.f["h1"])) / 2, 482 if close else 580), line, "h1", INK, a)
        if scene.get("command"):
            cmd = scene["command"]
            p.text(d, ((W - d.textlength(cmd, font=p.f["small"])) / 2, 556), cmd, "small", QUIET, a)
        return
    p.text(d, (140, 96), scene["heading"], "h1", INK, 1.0 if scene.get("carry_heading") else ease(u / 0.12))
    marks = scene.get("marks", [])
    alphas = [ease((u - m.get("at", 0.0)) / 0.12) for m in marks]
    shown = [m if alpha > 0 else {} for m, alpha in zip(marks, alphas)]
    hot = hot_index(shown)
    y = 210
    for i, (mark, alpha) in enumerate(zip(marks, alphas)):
        kind = mark["type"]
        if kind == "card":
            y = p.card(d, y, mark, i == hot, alpha) if alpha > 0 else y + 100
        elif kind == "note":
            y = p.note(d, y, mark, i == hot, alpha) if alpha > 0 else y + 44
        elif kind == "bars":
            y = p.bars(d, y, mark, u, alpha)
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
