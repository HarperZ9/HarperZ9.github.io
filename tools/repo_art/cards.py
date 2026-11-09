"""Per-page link preview cards for the site (og:image and twitter:image), 1200 x 630.

Each card carries the page's own title and author. A page with a render of its own
work (site_cards.WORK_RULES: the lettering, the glass and water, superframe, the
film posters) shows that render edge to edge, with a scrim only where the type sits:
down the left side ("side"), or along the foot when the render is itself a word or a
film frame that must stay whole ("foot"). Essays, papers and briefings use their cover
from art/aperture/ (dark variant, embedded), tool pages use the tool's figure, and a
page with neither gets a drawn cover from the family for its kind (page_motifs).
Covers and renders are embedded as isolated images so their ids never clash. The
author's name is a byline at the foot of every card and never the picture.
"""

from __future__ import annotations

import base64
import hashlib
from itertools import combinations
from pathlib import Path

from .compose import figure_for, wrap
from .ctx import Ctx
from .page_covers import cover_svg
from .page_motifs import motif_svg
from .svg import PAL, core_defs, num, svg_doc, texture, texture_defs
from .type import measure, text_path

ROOT = Path(__file__).resolve().parents[2]
W, H = 1200, 630


def balanced(text: str, face: str, size: float, width: float) -> list[str]:
    """Wrap to the fewest lines that fit `width`, then choose the breaks that leave the lines most even."""
    words = text.split()
    greedy = wrap(text, face, size, width)
    if len(greedy) < 2 or len(words) > 22:
        return greedy
    best, best_score = greedy, None
    for cuts in combinations(range(1, len(words)), len(greedy) - 1):
        lines = [" ".join(words[i:j]) for i, j in zip((0, *cuts), (*cuts, len(words)))]
        widths = [measure(ln, face, size) for ln in lines]
        if max(widths) > width:
            continue
        score = sum((max(widths) - w) ** 2 for w in widths)
        if best_score is None or score < best_score:
            best, best_score = lines, score
    return best


TITLE_FACE = "grotesk-semibold"
X0 = 72  # the left edge every line of type hangs from
FOOT_PICTURE = 540  # height of the picture on a foot card; the band of type covers the rest
PLATE_MIN, PLATE_MAX = 500, 730  # width of an upright sheet standing down the right of a plate card


def plate_width(path: Path) -> int:
    """How wide an upright scan stands on a plate card: its own shape at full card height, within limits."""
    from PIL import Image
    with Image.open(path) as im:
        return int(min(PLATE_MAX, max(PLATE_MIN, round(H * im.width / im.height))))


def work_image(path: Path, scale: int = 2, box: tuple[int, int] = (W, H), anchor: float = 0.5) -> tuple[str, str]:
    """The render cropped to cover `box` at `scale` x, as a JPEG data URI, with the file's hash.
    anchor is where the crop sits down the image's height: 0 keeps the top, 0.5 the middle."""
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
    tw, th = box[0] * scale, box[1] * scale
    k = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x0, y0 = (im.width - tw) // 2, round((im.height - th) * anchor)
    buf = io.BytesIO()
    im.crop((x0, y0, x0 + tw, y0 + th)).save(buf, "JPEG", quality=92, subsampling=0)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), hashlib.sha256(path.read_bytes()).hexdigest()


def scrim(uid: str, ground: str, layout: str, over_image: bool, lift: float = 0.0) -> tuple[str, str]:
    """(defs, body): the dark the type sits on. Stops are (offset, opacity) along x for side, y for foot."""
    if layout.startswith("plate:"):  # the sheet's left edge fades into the ground: no frame, no hard box
        x = (W - int(layout.split(":")[1])) / W
        stops, vec = [(0, 1), (num(x), 1), (num(x + 0.07), 0)], 'x1="0" y1="0" x2="1" y2="0"'
    elif layout == "foot":
        # solid under the type, so nothing lettered in the render shows through the title or the byline
        base = [(0.52, 0), (0.67, 0.84), (0.74, 0.985)]
        stops = [(o - lift if lift else o, a) for o, a in base] + [(1, 1)]
        stops, vec = [(num(o) if lift else o, a) for o, a in stops], 'x1="0" y1="0" x2="0" y2="1"'
    elif over_image:
        stops, vec = [(0, 0.94), (0.34, 0.88), (0.68, 0)], 'x1="0" y1="0" x2="1" y2="0"'
    else:
        stops, vec = [(0.42, 0.96), (0.66, 0)], 'x1="0" y1="0" x2="1" y2="0"'
    grad = "".join(f'<stop offset="{o}" stop-color="{ground}" stop-opacity="{a}"/>' for o, a in stops)
    return (f'<linearGradient id="{uid}-veil" {vec}>{grad}</linearGradient>',
            f'<rect width="{W}" height="{H}" fill="url(#{uid}-veil)"/>')


def art_layer(card: dict, uid: str, p: dict, repos: dict, scene: dict) -> tuple[str, str]:
    """(defs, body) for the picture under the type; records what it drew from in `scene`."""
    if card.get("work") and card.get("layout") == "plate":
        pw = plate_width(ROOT / card["work"])
        uri, scene["work_sha256"] = work_image(ROOT / card["work"], box=(pw, H), anchor=card.get("anchor", 0.0))
        scene["plate_width"] = pw
        return "", f'<image x="{W - pw}" y="0" width="{pw}" height="{H}" preserveAspectRatio="xMidYMid slice" href="{uri}"/>'
    if card.get("work"):
        # a foot card's picture sits in the part of the card the type leaves clear, so its middle stays in view
        ih = FOOT_PICTURE if card.get("layout") == "foot" else H
        uri, scene["work_sha256"] = work_image(ROOT / card["work"], box=(W, ih), anchor=card.get("anchor", 0.5))
        return "", f'<image x="0" y="0" width="{W}" height="{ih}" preserveAspectRatio="xMidYMid slice" href="{uri}"/>'
    if card.get("motif"):
        scene["motif"] = card["motif"]
        if card.get("alternate"):  # the line drawings of 2026-11-09, kept for comparison
            return motif_svg(card["motif"], card["slug"], uid, p, True)
        scene["cover"] = "cut-paper/1"
        return cover_svg(card["motif"], card["slug"], uid, p["ground"])
    if card.get("cover"):
        raw = (ROOT / "art" / "aperture" / f"{card['cover']}-dark.svg").read_bytes()
        scene["cover_sha256"] = hashlib.sha256(raw).hexdigest()
        vb = raw.split(b'viewBox="', 1)[1].split(b'"', 1)[0].split()
        cw = H * float(vb[2]) / float(vb[3])  # the cover at full card height, its centre at x = 900
        return "", (f'<image x="{num(900 - cw / 2)}" y="0" width="{num(cw)}" height="{H}" '
                    f'href="data:image/svg+xml;base64,{base64.b64encode(raw).decode()}"/>')
    cfg = repos[card["tool"]]
    c = Ctx(uid, card["tool"], "figure", W * 0.74, H * 0.5, H * 0.36, "dark", cfg["maturity"], min_label=22.0)
    body = figure_for(card["tool"], cfg)(c)
    scene["hot_mark"] = c.hot
    return "", body


def kicker(card: dict) -> str:
    """The small line beside the byline: the kind of page when that says something, then the site."""
    kind = card["kind"].upper()
    return "HARPERZ9.GITHUB.IO" if kind == "PAGE" else f"{kind}  /  HARPERZ9.GITHUB.IO"


def run(text: str, face: str, size: float, x: float, y: float, fill: str, tracking: float = 0.0, role: str = "title") -> dict:
    """One line of type as data: what it says and where its baseline sits. Drawn by `draw`, measured by card_check."""
    return {"text": text, "face": face, "size": size, "x": x, "y": y, "fill": fill, "tracking": tracking, "role": role}


def draw(runs: list[dict]) -> str:
    return "".join(text_path(r["text"], r["face"], r["size"], r["x"], r["y"], tracking=r["tracking"], fill=r["fill"])
                   for r in runs)


def fitted(title: str, face: str, size: float, width: float, most: int, least: int) -> tuple[list[str], float]:
    """Title lines and their size: shrunk until there are at most `most` lines and no line is wider than `width`.
    A single word wider than the column would otherwise run on into the picture."""
    lines = balanced(title, face, size, width)
    while (len(lines) > most or max(measure(ln, face, size, -0.015) for ln in lines) > width) and size > least:
        size -= 2
        lines = balanced(title, face, size, width)
    return lines, size


def footer(card: dict, p: dict, one_row: bool) -> list[dict]:
    """Byline and kicker: stacked at the foot of a side card, on one row under a foot card's title."""
    name = run("Zain Dana Harper", "grotesk-medium", 26, X0, H - (52 if one_row else 92), p["ink"], role="byline")
    if one_row:
        x = X0 + measure("Zain Dana Harper", "grotesk-medium", 26) + 30
        return [name, run(kicker(card), "mono-medium", 17, x, H - 53, p["soft"], 0.1, "kicker")]
    return [name, run(kicker(card), "mono-medium", 17, X0, H - 56, p["soft"], 0.1, "kicker")]


def type_side(card: dict, p: dict, face: str, width: float) -> list[dict]:
    """Title from the top left, the dek under it when it fits, byline and kicker at the foot."""
    size = 64 if len(card["title"]) < 28 else 56 if len(card["title"]) < 56 else 48
    lines, size = fitted(card["title"], face, size, width, 4, 36)
    if len(lines) > 5:
        raise ValueError(f"{card['slug']}: title too long for a card: {card['title']!r}")
    out, y = [], 84 + size * 0.8
    for ln in lines:
        out.append(run(ln, face, size, X0, y, p["ink"], -0.015))
        y += size * 1.1
    dek = wrap(card.get("dek") or "", "grotesk-regular", 26, width - 40)
    if dek and len(dek) <= (3 if len(lines) <= 3 else 2):  # a dek that does not fit is left off, never cut
        y += 16
        for ln in dek:
            y += 35
            out.append(run(ln, "grotesk-regular", 26, X0, y, p["soft"], role="dek"))
    return out + footer(card, p, one_row=False)


def type_foot(card: dict, p: dict, face: str) -> list[dict]:
    """Title along the foot in one or two lines, over the byline row; the picture keeps the rest."""
    size = 52 if len(card["title"]) < 34 else 44
    lines, size = fitted(card["title"], face, size, W - 2 * X0, 2, 30)
    if len(lines) > 2:
        raise ValueError(f"{card['slug']}: title too long for the foot of a card: {card['title']!r}")
    y = H - 104 - (len(lines) - 1) * size * 1.1
    out = []
    for ln in lines:
        out.append(run(ln, face, size, X0, y, p["ink"], -0.015))
        y += size * 1.1
    return out + footer(card, p, one_row=True)


def card_runs(card: dict, p: dict, plate: int | None = None) -> list[dict]:
    """Every line of type on a card, as data."""
    face = card.get("face", TITLE_FACE)
    if card.get("layout", "side") == "foot":
        return type_foot(card, p, face)
    return type_side(card, p, face, W - plate - X0 - 48 if plate else 500 if card.get("work") else 540)


def card_svg(card: dict, repos: dict, words: bool = True) -> tuple[str, dict]:
    """The card as SVG and its scene record. `words=False` leaves the type off, so a check can read what lies under it."""
    p = PAL["dark"]
    uid = f"cd-{card['slug']}"
    scene = {"kind": "harperz9.page-card/2", "card": card, "size": [W, H], "seed": card["slug"]}
    layout = card.get("layout", "side")
    art_defs, art = art_layer(card, uid, p, repos, scene)
    pw = scene.get("plate_width")
    runs = card_runs(card, p, pw)
    # a second title line on a foot card lifts the solid band with it, so no line of type sits on the picture
    lift = sum(r["role"] == "title" for r in runs) - 1 if layout == "foot" else 0
    veil_defs, veil = scrim(uid, p["ground"], f"plate:{pw}" if pw else layout, bool(card.get("work")),
                            lift * runs[0]["size"] * 1.1 / H)
    flat = card.get("work") or scene.get("cover") == "cut-paper/1"
    if scene.get("cover") == "cut-paper/1":  # cut paper keeps clear of the type by its own geometry: no veil over it
        veil_defs, veil = "", ""
    defs = core_defs(uid, p) + art_defs + veil_defs + texture_defs(uid, p, 7)
    # a render or flat colour keeps its own surface: no scanlines over it
    tex = texture(uid, W, H, grain=0.03, scan=0) if flat else texture(uid, W, H, grain=0.05, scan=0.12)
    body = f'<rect width="{W}" height="{H}" fill="{p["ground"]}"/>' + art + veil + tex + (draw(runs) if words else "")
    alt = f"{card['title']}, by Zain Dana Harper. {card['alt']}"
    return svg_doc(W, H, body, defs, alt), scene


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
