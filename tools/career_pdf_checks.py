"""Checks that decide whether a designed career PDF meets the standards in the plain edition's place.

Used by tests/test_career_designed.py and runnable on its own:

    python tools/career_pdf_checks.py

Each check reads the rendered PDF with PyMuPDF and pypdf, readers that share no code
with the typesetter, so a passing typeset receipt cannot vouch for itself.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import fitz  # PyMuPDF
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
AA = 4.5                 # WCAG 2.x AA contrast for normal-size text
MAX_BYTES = 2_500_000    # Greenhouse cannot parse a resume over 2.5 MB, the strictest documented limit
FAX_DARK_SHARE = 0.005   # outside text, at most 0.5% of the page may fall below mid grey


def _lin(v: int) -> float:
    c = v / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _lum(px: bytes, i: int, n: int) -> float:
    if n == 1:
        return _lin(px[i])
    return 0.2126 * _lin(px[i]) + 0.7152 * _lin(px[i + 1]) + 0.0722 * _lin(px[i + 2])


def tokens(path: Path, reader: str) -> list[str]:
    """The word sequence a parser gets from the PDF: letters and digits, in extraction order."""
    if reader == "pypdf":
        text = " ".join(p.extract_text() or "" for p in PdfReader(path).pages)
    else:
        text = " ".join(p.get_text() for p in fitz.open(path))
    return re.findall(r"[0-9A-Za-z]+", text)


def first_difference(a: list[str], b: list[str]) -> str:
    for k, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return f"token {k}: {' '.join(a[max(0, k - 4):k + 4])!r} vs {' '.join(b[max(0, k - 4):k + 4])!r}"
    return "" if len(a) == len(b) else f"lengths {len(a)} and {len(b)}"


def spans(page: "fitz.Page") -> list[tuple["fitz.Rect", str]]:
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip():
                    out.append((fitz.Rect(s["bbox"]), s["text"]))
    return out


def span_contrast(page: "fitz.Page", rect: "fitz.Rect") -> float:
    """Contrast of one text span against its own ground, read from rendered pixels at 300 dpi."""
    pix = page.get_pixmap(dpi=300, clip=rect)
    s, n = pix.samples, pix.n
    lum = sorted(_lum(s, i, n) for i in range(0, len(s), n))
    ink, ground = lum[len(lum) // 50], lum[len(lum) * 95 // 100]
    return (ground + 0.05) / (ink + 0.05)


def contrast(path: Path) -> tuple[float, str]:
    """Lowest span contrast in the document and the text of that span."""
    worst, where = 99.0, ""
    for page in fitz.open(path):
        for rect, text in spans(page):
            r = span_contrast(page, rect)
            if r < worst:
                worst, where = r, text
    return worst, where


def fax_dark_share(path: Path) -> float:
    """Share of page area, outside text, darker than mid grey in a greyscale render: what a fax prints black."""
    worst = 0.0
    for page in fitz.open(path):
        pix = page.get_pixmap(dpi=100, colorspace=fitz.csGRAY)
        scale = 100 / 72
        text = [fitz.Rect(r.x0 * scale - 1, r.y0 * scale - 1, r.x1 * scale + 1, r.y1 * scale + 1) for r, _ in spans(page)]
        dark = 0
        w, h, s = pix.width, pix.height, pix.samples
        for y in range(h):
            row = s[y * pix.stride:y * pix.stride + w]
            for x, v in enumerate(row):
                if v < 128 and not any(t.x0 <= x <= t.x1 and t.y0 <= y <= t.y1 for t in text):
                    dark += 1
        worst = max(worst, dark / (w * h))
    return worst


def decorations_clear_of_body(path: Path, first_body_heading: str) -> list[str]:
    """Decoration may sit in the header band, the margins or behind the whole page, never behind body text.

    Body text is everything from the first section heading on. The full-page paper ground is
    background, not decoration, and is allowed.
    """
    bad = []
    for number, page in enumerate(fitz.open(path)):
        body = spans(page)
        if number == 0:
            top = next((r.y0 for r, t in body if t.strip() == first_body_heading), None)
            body = [(r, t) for r, t in body if top is not None and r.y0 >= top - 0.5]
        marks = [d["rect"] for d in page.get_drawings() if fitz.Rect(d["rect"]) != page.rect]
        marks += [fitz.Rect(info["bbox"]) for info in page.get_image_info()]
        for m in marks:
            for r, t in body:
                if fitz.Rect(m).intersects(r):
                    bad.append(f"page {number + 1}: decoration {tuple(round(v) for v in m)} meets {t!r}")
                    break
    return bad


def report() -> dict:
    src = json.loads((ROOT / "career" / "resume-source.json").read_text(encoding="utf-8"))
    out = {}
    for doc in src["documents"]:
        designed = ROOT / "career" / "designed" / f"{doc['stem']}.pdf"
        plain = ROOT / "career" / f"{doc['stem']}.pdf"
        heading = next(b["text"] for b in doc["blocks"] if b.get("kind") == "h2")
        low, where = contrast(designed)
        out[doc["stem"]] = {
            "pages": len(PdfReader(designed).pages),
            "pages_plain": len(PdfReader(plain).pages),
            "bytes": designed.stat().st_size,
            "parse_equal": {r: tokens(designed, r) == tokens(plain, r) for r in ("pypdf", "pymupdf")},
            "first_difference": {r: first_difference(tokens(designed, r), tokens(plain, r)) for r in ("pypdf", "pymupdf")},
            "min_contrast": round(low, 2),
            "min_contrast_text": where,
            "fax_dark_share": round(fax_dark_share(designed), 5),
            "decoration_over_body": decorations_clear_of_body(designed, heading),
        }
    return out


if __name__ == "__main__":
    print(json.dumps(report(), indent=1))
