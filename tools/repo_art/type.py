"""Set text in the two canon faces and return it as outlined SVG paths.

Only Hanken Grotesk and Conso are allowed. Glyphs become path data, so a README,
a link card or a favicon never depends on the viewer having either font. Pair
kerning comes from the font's GPOS 'kern' lookups (formats 1 and 2).
"""

from __future__ import annotations

import hashlib
import os
from functools import lru_cache
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

from .svg import num

FACES = {
    "grotesk-regular": "hanken-grotesk-regular.ttf",
    "grotesk-medium": "hanken-grotesk-medium.ttf",
    "grotesk-semibold": "hanken-grotesk-semibold.ttf",
    "mono-regular": "conso-regular.ttf",
    "mono-medium": "conso-medium.ttf",
}


def font_dir() -> Path:
    env = os.environ.get("REPO_ART_FONTS")
    if env:
        return Path(env)
    return Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Windows" / "Fonts"


def font_path(face: str) -> Path:
    if face not in FACES:
        raise ValueError(f"face {face!r} is not one of the two canon families")
    p = font_dir() / FACES[face]
    if not p.exists():
        raise FileNotFoundError(f"{p} missing; set REPO_ART_FONTS to the folder holding {FACES[face]}")
    return p


def font_receipts(faces) -> dict:
    """SHA-256 of every font file used, so the scene pins the exact outlines."""
    return {f: hashlib.sha256(font_path(f).read_bytes()).hexdigest() for f in sorted(set(faces))}


@lru_cache(maxsize=None)
def _font(face: str) -> TTFont:
    return TTFont(str(font_path(face)))


@lru_cache(maxsize=None)
def _kern_table(face: str):
    """Pair kerning from GPOS: a dict for format 1 pairs, a list of format 2 subtables."""
    font = _font(face)
    pairs: dict = {}
    classed: list = []
    if "GPOS" not in font:
        return pairs, classed
    gpos = font["GPOS"].table
    kern_lookups = set()
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag == "kern":
            kern_lookups.update(fr.Feature.LookupListIndex)
    for li in sorted(kern_lookups):
        lookup = gpos.LookupList.Lookup[li]
        if lookup.LookupType != 2:
            continue
        for st in lookup.SubTable:
            if st.Format == 1:
                for g1, ps in zip(st.Coverage.glyphs, st.PairSet):
                    for pvr in ps.PairValueRecord:
                        v = getattr(pvr.Value1, "XAdvance", 0) if pvr.Value1 else 0
                        if v:
                            pairs.setdefault((g1, pvr.SecondGlyph), v)
            elif st.Format == 2:
                classed.append(st)
    return pairs, classed


def _kern(face: str, left: str, right: str) -> int:
    pairs, classed = _kern_table(face)
    if (left, right) in pairs:
        return pairs[(left, right)]
    for st in classed:
        if left not in st.Coverage.glyphs:
            continue
        c1 = st.ClassDef1.classDefs.get(left, 0) if st.ClassDef1 else 0
        c2 = st.ClassDef2.classDefs.get(right, 0) if st.ClassDef2 else 0
        rec = st.Class1Record[c1].Class2Record[c2]
        x = getattr(rec.Value1, "XAdvance", 0) if rec.Value1 else 0
        if x:
            return x
    return 0


def measure(text: str, face: str, size: float, tracking: float = 0.0) -> float:
    """Advance width in px; tracking is in em (0.02 = 2 percent)."""
    return _layout(text, face, size, tracking)[1]


def _layout(text: str, face: str, size: float, tracking: float):
    font = _font(face)
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    scale = size / upm
    x = 0.0
    placed = []
    prev = None
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            raise ValueError(f"{face} has no glyph for {ch!r}")
        if prev is not None:
            x += _kern(face, prev, gname) * scale
        placed.append((gname, x))
        x += hmtx[gname][0] * scale + tracking * size
        prev = gname
    width = x - (tracking * size if text else 0.0)
    return placed, width


def text_path(text: str, face: str, size: float, x: float, y: float, *,
              tracking: float = 0.0, anchor: str = "start", fill: str = "#000",
              opacity: float | None = None) -> str:
    """One <path> holding the outlined text with its baseline at y."""
    placed, width = _layout(text, face, size, tracking)
    if anchor == "end":
        x -= width
    elif anchor == "middle":
        x -= width / 2
    font = _font(face)
    gs = font.getGlyphSet()
    scale = size / font["head"].unitsPerEm
    parts = []
    for gname, gx in placed:
        pen = SVGPathPen(gs, ntos=num)
        tpen = TransformPen(pen, (scale, 0, 0, -scale, x + gx, y))
        gs[gname].draw(tpen)
        d = pen.getCommands()
        if d:
            parts.append(d)
    op = f' opacity="{opacity}"' if opacity is not None else ""
    return f'<path fill="{fill}"{op} d="{"".join(parts)}"/>'
