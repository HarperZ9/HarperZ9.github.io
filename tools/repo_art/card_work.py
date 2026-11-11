"""The picture on a card that shows a page's own render or scan: cropped, never redrawn.

Pure functions over explicit data. `work_image` cuts the picture to a box; `sheet` lays a flat texture
on the card as a cut sheet of paper over a coloured one, so a grey scan does not sit flat on the dark.
A card may name a `crop` (the part of the scan to use, as shares of its width and height) and a `gain`
(exposure, with the same share of contrast); both are recorded in the card's plan, and the scan on disk
is left as it is.
"""

from __future__ import annotations

import base64
import hashlib
import io
from pathlib import Path

from .paper import SWATCH, bar, cover_defs, disc, lift
from .svg import num

W, H = 1200, 630
PLATE_MIN, PLATE_MAX = 500, 730  # width of an upright sheet standing down the right of a plate card


def plate_width(path: Path) -> int:
    """How wide an upright scan stands on a plate card: its own shape at full card height, within limits."""
    from PIL import Image
    with Image.open(path) as im:
        return int(min(PLATE_MAX, max(PLATE_MIN, round(H * im.width / im.height))))


def opened(path: Path):
    from PIL import Image
    try:
        return Image.open(path).convert("RGB")
    except Exception:  # a format Pillow lacks: let ffmpeg decode it
        import subprocess

        import imageio_ffmpeg
        raw = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path), "-frames:v", "1",
                              "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
        return Image.open(io.BytesIO(raw)).convert("RGB")


def work_image(path: Path, scale: int = 2, box: tuple[int, int] = (W, H), anchor: float = 0.5,
               crop: tuple[float, float, float, float] | None = None, gain: float = 1.0) -> tuple[str, str]:
    """The picture cut to cover `box` at `scale` x, as a JPEG data URI, with the file's hash.
    anchor is where the cut sits down the picture's height: 0 keeps the top, 0.5 the middle."""
    from PIL import Image, ImageEnhance
    im = opened(path)
    if crop:
        im = im.crop((round(crop[0] * im.width), round(crop[1] * im.height), round(crop[2] * im.width), round(crop[3] * im.height)))
    if gain != 1.0:
        im = ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(gain)).enhance(gain)
    tw, th = box[0] * scale, box[1] * scale
    k = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x0, y0 = (im.width - tw) // 2, round((im.height - th) * anchor)
    buf = io.BytesIO()
    im.crop((x0, y0, x0 + tw, y0 + th)).save(buf, "JPEG", quality=92, subsampling=0)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), hashlib.sha256(path.read_bytes()).hexdigest()


def sheet(uid: str, uri: str, under: str, turn: float) -> tuple[str, str]:
    """(defs, body): the texture as a sheet leaning `turn` degrees over a sheet of colour `under`, both running
    off the right of the card, each casting a shadow, with one small disc resting on the texture."""
    x, y, w, h = 660, -60, 640, 760
    spin = f'rotate({num(turn)} {x + w / 2} {H / 2})'
    defs = cover_defs(uid) + f'<clipPath id="{uid}-cut"><rect x="{x}" y="{y}" width="{w}" height="{h}" transform="{spin}"/></clipPath>'
    top = (f'<g clip-path="url(#{uid}-cut)"><image x="{x - 60}" y="{y}" width="{h}" height="{h}" '
           f'preserveAspectRatio="xMidYMid slice" href="{uri}" transform="{spin}"/></g>')
    return defs, (lift(uid, bar(x - 54, y, w, h, SWATCH[under], turn=-turn * 1.6), 1) + lift(uid, top, 3)
                  + lift(uid, disc(x + 70, 500 if turn > 0 else 130, 30, SWATCH["cream"]), 2))
