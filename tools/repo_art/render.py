"""Render repository heroes, social previews, marks, lockups and page cards, with receipts.

    python -m tools.repo_art.render --out DIR [--repos a,b] [--cards]
    python -m tools.repo_art.render --out DIR --twice     # render twice, compare every byte

Needs fontTools (outlining) and Playwright with Chrome (PNG export). Fonts come
from REPO_ART_FONTS or the per-user Windows font folder; their hashes go in
every scene, so a receipt names the exact outlines it was drawn from.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import shutil
import tempfile
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

from tools import superstack as ss  # noqa: E402
from tools.repo_art.cards import PILOT_CARDS, card_svg  # noqa: E402
from tools.repo_art.compose import compose  # noqa: E402
from tools.repo_art.marks import lockup_svg, mark_svg  # noqa: E402
from tools.repo_art.type import FACES, font_receipts  # noqa: E402

VERSION = "0.1.0"
# Software raster and a fixed colour profile: GPU raster left single pixels one level apart between runs.
CHROME_ARGS = ["--disable-gpu", "--force-color-profile=srgb", "--disable-lcd-text", "--disable-font-subpixel-positioning"]
HERE = Path(__file__).resolve().parent
DNP = [
    "It does not show the figure's numbers come from a real run, except where the alt text quotes a README result.",
    "It does not show the PNG bytes are the same under another Chrome build; the SVG and the scene are the portable record.",
    "It does not show the artwork meets the brand rules; that is a human review against ART-DIRECTION.md.",
]


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def jobs(repos: dict, names: list[str], cards: bool):
    """Yield (relative path stem, svg text, scene, png sizes, transparent)."""
    fonts = font_receipts(FACES)
    for n in names:
        cfg = repos[n]
        for surface, theme in (("hero", "dark"), ("hero", "light"), ("social", "dark")):
            svg, scene = compose(n, cfg, surface, theme)
            scene["fonts"] = fonts
            yield f"{n}/{surface}-{theme}", svg, scene, [None], False
        for tier, sizes in (("micro", [16, 32]), ("full", [64, 512])):
            svg = mark_svg(n, cfg["maturity"], tier, "dark", True)
            scene = {"kind": "harperz9.mark/1", "repo": n, "tier": tier, "tile": True, "seed": n,
                     "maturity": cfg["maturity"], "fonts": fonts}
            yield f"{n}/mark-{tier}-tile", svg, scene, sizes, False
        for theme in ("light", "dark"):
            svg = mark_svg(n, cfg["maturity"], "full", theme, False)
            yield f"{n}/mark-full-{theme}", svg, {"kind": "harperz9.mark/1", "repo": n, "theme": theme,
                                                 "seed": n, "fonts": fonts}, [512], True
            for stacked in (False, True):
                svg = lockup_svg(n, cfg["maturity"], theme, stacked)
                kind = "stacked" if stacked else "horizontal"
                yield f"{n}/lockup-{kind}-{theme}", svg, {"kind": "harperz9.lockup/1", "repo": n, "theme": theme,
                                                         "layout": kind, "seed": n, "fonts": fonts}, [None], True
    if cards:
        for card in PILOT_CARDS:
            svg, scene = card_svg(card, repos)
            scene["fonts"] = fonts
            yield f"cards/{card['slug']}", svg, scene, [None], False


def raster(page, svg_path: Path, size, transparent: bool) -> bytes:
    text = svg_path.read_text("utf-8")
    vb = text.split('viewBox="', 1)[1].split('"', 1)[0].split()
    w, h = float(vb[2]), float(vb[3])
    scale = 1.0 if size is None else size / w
    page.set_viewport_size({"width": max(1, round(w * scale)), "height": max(1, round(h * scale))})
    page.set_content(f'<html><body style="margin:0;background:transparent">'
                     f'<img src="data:image/svg+xml;base64,{base64.b64encode(text.encode()).decode()}" width="{round(w * scale)}" '
                     f'height="{round(h * scale)}" style="display:block"></body></html>')
    page.wait_for_load_state("load")
    return page.screenshot(omit_background=transparent, clip={"x": 0, "y": 0, "width": round(w * scale),
                                                               "height": round(h * scale)})


def to_jpeg(png: bytes) -> bytes:
    """Link cards as JPEG q90 with 4:4:4 chroma: a fifth of the PNG size, line-work kept sharp.
    A quantised PNG was tested and rejected: it bands the glow around the core."""
    buf = io.BytesIO()
    Image.open(io.BytesIO(png)).convert("RGB").save(buf, "JPEG", quality=90, subsampling=0, optimize=True)
    return buf.getvalue()


def receipt(scene: dict, png: bytes, outputs: dict, backend: str) -> dict:
    im = Image.open(io.BytesIO(png))
    mode = "RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB"
    raw = im.convert(mode).tobytes()
    media = {"kind": "image", "width": im.width, "height": im.height,
             "format": "rgba8" if mode == "RGBA" else "rgb8", "transfer": "srgb"}
    rec = ss.make_receipt(producer="harperz9.repo-art", version=VERSION, backend=backend, scene=scene,
                          media=media, content=raw, outputs=outputs, does_not_prove=DNP)
    errs = ss.verify_receipt(rec)
    if errs:
        raise RuntimeError(f"receipt failed its own check: {errs}")
    return rec


def render(out: Path, names: list[str], cards: bool) -> dict:
    repos = json.loads((HERE / "repos.json").read_text("utf-8"))["repos"]
    out.mkdir(parents=True, exist_ok=True)
    books: dict = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", args=CHROME_ARGS)
        backend = f"chrome-{browser.version}-skia"
        page = browser.new_page(device_scale_factor=1)
        for stem, svg, scene, sizes, transparent in jobs(repos, names, cards):
            svg_path = out / f"{stem}.svg"
            svg_path.parent.mkdir(parents=True, exist_ok=True)
            svg_bytes = svg.encode("utf-8")
            svg_path.write_bytes(svg_bytes)
            for size in sizes:
                png = raster(page, svg_path, size, transparent)
                png_name = f"{stem}.png" if size is None else f"{stem}-{size}.png"
                if stem.startswith("cards/"):
                    png, png_name = to_jpeg(png), f"{stem}.jpg"
                (out / png_name).write_bytes(png)
                outs = {Path(stem).name + ".svg": sha(svg_bytes), Path(png_name).name: sha(png)}
                book = books.setdefault(stem.split("/")[0], {"schema": "harperz9.repo-art.receipts/1",
                                                             "receipts": {}})
                book["receipts"][Path(png_name).name] = receipt(scene, png, outs, backend)
        browser.close()
    for group, book in books.items():
        (out / group / "receipts.json").write_text(json.dumps(book, indent=1, sort_keys=True) + "\n", "utf-8")
    return books


def render_cards(cards: list, out: Path) -> None:
    """Site link cards: one JPEG per page plus one receipts.json for the folder."""
    repos = json.loads((HERE / "repos.json").read_text("utf-8"))["repos"]
    fonts = font_receipts(FACES)
    out.mkdir(parents=True, exist_ok=True)
    book = {"schema": "harperz9.repo-art.receipts/1", "receipts": {}}
    with sync_playwright() as pw, tempfile.TemporaryDirectory() as tmp:
        browser = pw.chromium.launch(channel="chrome", args=CHROME_ARGS)
        backend = f"chrome-{browser.version}-skia"
        page = browser.new_page(device_scale_factor=1)
        for card in cards:
            svg, scene = card_svg(card, repos)
            scene["fonts"] = fonts
            svg_path = Path(tmp) / f"{card['slug']}.svg"  # the SVG embeds its cover; only its hash ships
            svg_path.write_bytes(svg.encode("utf-8"))
            jpg = to_jpeg(raster(page, svg_path, None, False))
            name = f"{card['slug']}.jpg"
            (out / name).write_bytes(jpg)
            outs = {svg_path.name: sha(svg.encode("utf-8")), name: sha(jpg)}
            book["receipts"][name] = receipt(scene, jpg, outs, backend)
        browser.close()
    (out / "receipts.json").write_text(json.dumps(book, indent=1, sort_keys=True) + "\n", "utf-8")


def tree_hashes(root: Path) -> dict:
    return {str(p.relative_to(root)).replace("\\", "/"): sha(p.read_bytes()) for p in sorted(root.rglob("*")) if p.is_file()}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--repos", default="")
    ap.add_argument("--cards", action="store_true")
    ap.add_argument("--twice", action="store_true", help="render into out/run-a and out/run-b and compare")
    a = ap.parse_args(argv)
    repos = json.loads((HERE / "repos.json").read_text("utf-8"))["repos"]
    names = [n for n in a.repos.split(",") if n] or list(repos)
    if not a.twice:
        render(a.out, names, a.cards)
        return 0
    runs = []
    for tag in ("run-a", "run-b"):
        target = a.out / tag
        if target.exists():
            shutil.rmtree(target)
        render(target, names, a.cards)
        runs.append(tree_hashes(target))
    same = sorted(k for k in runs[0] if runs[1].get(k) == runs[0][k])
    diff = sorted(set(runs[0]) ^ set(runs[1]) | {k for k in runs[0] if runs[1].get(k) not in (None, runs[0][k])})
    report = {"files": len(runs[0]), "identical": len(same), "different": diff, "hashes": runs[0]}
    (a.out / "DETERMINISM.json").write_text(json.dumps(report, indent=1) + "\n", "utf-8")
    print(f"{len(same)} of {len(runs[0])} files byte-identical across two renders; different: {diff or 'none'}")
    return 0 if not diff else 1


if __name__ == "__main__":
    raise SystemExit(main())
