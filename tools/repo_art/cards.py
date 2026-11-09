"""Per-page link preview cards for the site (og:image and twitter:image), 1200 x 630.

Each card carries the page's own title and author. A page with a render of its own
work (site_cards.WORK_RULES: the lettering, the glass and water, superframe, the
film posters) shows that render on the right, fading into the ground under the title.
Otherwise essays, papers and briefings use their cover from art/aperture/ (dark
variant, embedded) and tool pages use the tool's figure. Covers and renders are
embedded as isolated images so their ids never clash. The author's name is a
byline at the foot of every card and never the picture.
"""

from __future__ import annotations

import base64
import hashlib
from pathlib import Path

from .compose import figure_for, wrap
from .ctx import Ctx
from .svg import PAL, core_defs, num, svg_doc, texture, texture_defs
from .type import text_path

ROOT = Path(__file__).resolve().parents[2]
W, H = 1200, 630


def balanced(text: str, face: str, size: float, width: float) -> list[str]:
    """Wrap, then narrow the measure while the line count holds, so lines come out even."""
    lines = wrap(text, face, size, width)
    w = width
    while len(lines) > 1 and w > width * 0.5:
        trial = wrap(text, face, size, w - 10)
        if len(trial) != len(lines):
            break
        lines, w = trial, w - 10
    return lines


WORK_X = 420  # the render fills the card from here to the right edge, under the veil


WHOLE = (600, 1190)  # a piece that is a word is shown whole, in this span, fading in from its left edge


def work_image(path: Path, scale: int = 2, box: tuple[int, int] | None = None) -> tuple[str, str]:
    """The render cropped to cover `box` (default the card's right side) at `scale` x, as a JPEG data URI."""
    import io
    from PIL import Image
    try:
        im = Image.open(path).convert("RGB")
    except Exception:  # a format Pillow lacks: let ffmpeg decode it
        import subprocess
        import imageio_ffmpeg
        raw = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path), "-frames:v", "1",
                              "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
        im = Image.open(io.BytesIO(raw)).convert("RGB")
    tw, th = ((box or (W - WORK_X, H))[0]) * scale, ((box or (W - WORK_X, H))[1]) * scale
    k = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x0, y0 = (im.width - tw) // 2, (im.height - th) // 2
    buf = io.BytesIO()
    im.crop((x0, y0, x0 + tw, y0 + th)).save(buf, "JPEG", quality=92, subsampling=0)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), hashlib.sha256(path.read_bytes()).hexdigest()


def card_svg(card: dict, repos: dict) -> tuple[str, dict]:
    p = PAL["dark"]
    uid = f"cd-{card['slug']}"
    defs, body = core_defs(uid, p), [f'<rect width="{W}" height="{H}" fill="{p["ground"]}"/>']
    scene = {"kind": "harperz9.page-card/1", "card": card, "size": [W, H], "seed": card["slug"]}
    if card.get("work") and card.get("fit") == "whole":
        x0, x1 = WHOLE
        w = x1 - x0
        h = round(w * 9 / 16)
        y0 = (H - h) // 2
        uri, scene["work_sha256"] = work_image(ROOT / card["work"], box=(w, h))
        # soft edges all round: the word sits in the card's dark, with no frame
        defs += (f'<radialGradient id="{uid}-soft" cx="0.5" cy="0.5" r="0.5"><stop offset="0.72" stop-color="#fff"/>'
                 f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
                 f'<mask id="{uid}-m" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#{uid}-soft)"/></mask>')
        body.append(f'<image x="{x0}" y="{y0}" width="{w}" height="{h}" mask="url(#{uid}-m)" href="{uri}"/>')
    elif card.get("work"):
        uri, scene["work_sha256"] = work_image(ROOT / card["work"])
        body.append(f'<image x="{WORK_X}" y="0" width="{W - WORK_X}" height="{H}" preserveAspectRatio="xMidYMid slice" href="{uri}"/>')
    elif card.get("cover"):
        src = ROOT / "art" / "aperture" / f"{card['cover']}-dark.svg"
        raw = src.read_bytes()
        scene["cover_sha256"] = hashlib.sha256(raw).hexdigest()
        b64 = base64.b64encode(raw).decode()
        vb = raw.split(b'viewBox="', 1)[1].split(b'"', 1)[0].split()
        ch = H  # the cover at full card height, its centre at x = 900, its left edge under the veil
        cw = ch * float(vb[2]) / float(vb[3])
        body.append(f'<image x="{num(900 - cw / 2)}" y="0" width="{num(cw)}" height="{ch}" '
                    f'href="data:image/svg+xml;base64,{b64}"/>')
    else:
        cfg = repos[card["tool"]]
        c = Ctx(uid, card["tool"], "figure", W * 0.74, H * 0.5, H * 0.36, "dark", cfg["maturity"], min_label=22.0)
        body.append(figure_for(card["tool"], cfg)(c))
        scene["hot_mark"] = c.hot
    # the veil: solid under the title, gone by two thirds across; a render fades in from its own left edge
    lo, hi = (0.40, 0.62) if card.get("work") else (0.42, 0.66)
    if card.get("fit") == "whole":
        lo, hi = 0.44, 0.50
    defs += ('<linearGradient id="%s-veil" x1="0" y1="0" x2="1" y2="0">'
             '<stop offset="%s" stop-color="%s" stop-opacity="0.96"/>'
             '<stop offset="%s" stop-color="%s" stop-opacity="0"/></linearGradient>' % (uid, lo, p["ground"], hi, p["ground"]))
    body.append(f'<rect width="{W}" height="{H}" fill="url(#{uid}-veil)"/>')
    defs += texture_defs(uid, p, 7)
    body.append(texture(uid, W, H, grain=0.05, scan=0.12))
    size = 62 if len(card["title"]) < 40 else 54
    lines = balanced(card["title"], "grotesk-semibold", size, 560)
    while len(lines) > 4 and size > 36:  # shrink the title before it is ever cut
        size -= 2
        lines = balanced(card["title"], "grotesk-semibold", size, 580)
    if len(lines) > 5:
        raise ValueError(f"{card['slug']}: title too long for a card: {card['title']!r}")
    dek_lines = 3 if len(lines) <= 3 else 2
    y = 84 + size * 0.8
    for ln in lines:
        body.append(text_path(ln, "grotesk-semibold", size, 72, y, tracking=-0.02, fill=p["ink"]))
        y += size * 1.12
    if card.get("dek"):
        y += 14
        dek = wrap(card["dek"], "grotesk-regular", 25, 500)
        for ln in (dek if len(dek) <= dek_lines else []):  # a dek that does not fit is left off, never cut
            y += 34
            body.append(text_path(ln, "grotesk-regular", 25, 72, y, fill=p["soft"]))
    body.append(text_path("Zain Dana Harper", "grotesk-medium", 26, 72, H - 92, fill=p["ink"]))
    body.append(text_path(f"{card['kind'].upper()}  /  HARPERZ9.GITHUB.IO", "mono-regular", 15, 72, H - 58,
                          tracking=0.14, fill=p["quiet"]))
    alt = f"{card['title']}, by Zain Dana Harper. {card['alt']}"
    return svg_doc(W, H, "".join(body), defs, alt), scene


PILOT_CARDS = [
    {"slug": "no-receipt-no-accept", "title": "No Receipt, No Accept", "kind": "Essay",
     "cover": "cover-no-receipt-no-accept",
     "dek": "Why a result without a re-checkable receipt should not be accepted.",
     "alt": "A halftone sphere cut by a vertical strip of scanlines with a perforated edge, like a receipt."},
    {"slug": "the-second-hearing", "title": "The Second Hearing", "kind": "Essay",
     "cover": "cover-the-second-hearing",
     "dek": "Repeated listening changes liking, prediction, attention and memory in different ways.",
     "alt": "A large disc of fine lines with two bright points side by side near its centre."},
    {"slug": "frontier-safety", "title": "Frontier Safety Briefing, 30 September 2026", "kind": "Briefing",
     "cover": "cover-frontier-safety",
     "dek": "A dated, source-grounded record of frontier AI safety developments.",
     "alt": "A bright core ringed by fifty-two fine tick marks, one drawn long past the outer rings."},
    {"slug": "crucible", "title": "Crucible", "kind": "Tool", "tool": "crucible",
     "dek": "Break a thesis into claims, measure each one, and get MATCH, DRIFT or UNVERIFIABLE.",
     "alt": "Seven measured axes around a bright core; one falls short and is marked DRIFT."},
]
