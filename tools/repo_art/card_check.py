"""Check every link card for overlap and legibility, from the same type data the card is drawn from.

    python -I tools/repo_art/card_check.py [--only slug,slug] [--report FILE]

Each card is drawn once with its type left off. Every line of type is then checked as a box:
inside the safe area, clear of an upright plate, clear of every other line, and set on a ground
dark enough for its ink. The contrast figure is WCAG 2 relative luminance, the ink against the
brightest part of the picture under the line (the 99th percentile, so one stray pixel does not
decide it). The title is also sized as it shows in a 300 px wide preview.

Pure functions over explicit data; only `grounds` touches a browser.
"""

from __future__ import annotations

import io
import json
import sys
from itertools import combinations
from pathlib import Path

if __package__ in {None, ""}:  # run as a file: make the package importable
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.repo_art.type import measure  # noqa: E402

W, H = 1200, 630
SAFE = 40           # px kept clear at every edge of the card
GAP = 24            # px kept between a line of type and an upright plate
FLOOR = 4.5         # WCAG 2 AA contrast for body text; applied to every line, titles included
THUMB = 300         # px width of a chat or feed preview
TITLE_MIN = 8.0     # px a title must keep at THUMB to stay readable
ASCENT, DESCENT = 0.74, 0.22   # of the type size: cap height above the baseline, descender below


def box(run: dict) -> tuple[float, float, float, float]:
    """(x0, y0, x1, y1) of one line of type."""
    wide = measure(run["text"], run["face"], run["size"], run["tracking"])
    return run["x"], run["y"] - ASCENT * run["size"], run["x"] + wide, run["y"] + DESCENT * run["size"]


def crosses(a: tuple, b: tuple) -> bool:
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def geometry_faults(runs: list[dict], plate: int | None) -> list[str]:
    """Lines that leave the safe area, reach an upright plate, or cross another line."""
    out = []
    boxes = [(r, box(r)) for r in runs]
    limit = W - plate - GAP if plate else W - SAFE
    for r, b in boxes:
        if b[0] < SAFE or b[1] < SAFE or b[3] > H - SAFE:
            out.append(f"{r['role']} leaves the safe area: {r['text']!r}")
        if b[2] > limit:
            out.append(f"{r['role']} runs {round(b[2] - limit)} px past its column: {r['text']!r}")
    for (ra, a), (rb, b) in combinations(boxes, 2):
        if crosses(a, b):
            out.append(f"{ra['role']} and {rb['role']} cross: {ra['text']!r} / {rb['text']!r}")
    return out


def luminance(rgb: tuple[float, float, float]) -> float:
    """WCAG 2 relative luminance of an sRGB colour with 0..255 channels."""
    lin = [c / 255 for c in rgb]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in lin]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def hex_rgb(colour: str) -> tuple[int, int, int]:
    c = colour.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


def contrast(a: float, b: float) -> float:
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def brightest(lums: list[float], share: float = 0.99) -> float:
    """The luminance `share` of the pixels sit at or under."""
    ordered = sorted(lums)
    return ordered[min(len(ordered) - 1, int(share * len(ordered)))]


def contrast_faults(runs: list[dict], pixel_lums) -> tuple[list[str], float]:
    """(faults, lowest ratio). `pixel_lums(box)` returns the luminances of the ground under a box."""
    out, lowest = [], 21.0
    for r in runs:
        ratio = contrast(luminance(hex_rgb(r["fill"])), brightest(pixel_lums(box(r))))
        lowest = min(lowest, ratio)
        if ratio < FLOOR:
            out.append(f"{r['role']} has contrast {ratio:.2f} on its ground: {r['text']!r}")
    return out, round(lowest, 2)


def thumb_faults(runs: list[dict]) -> list[str]:
    small = min(r["size"] for r in runs if r["role"] == "title") * THUMB / W
    return [f"title is {small:.1f} px in a {THUMB} px preview"] if small < TITLE_MIN else []


def check(runs: list[dict], plate: int | None, pixel_lums) -> dict:
    faults, lowest = contrast_faults(runs, pixel_lums)
    return {"faults": geometry_faults(runs, plate) + faults + thumb_faults(runs), "lowest_contrast": lowest,
            "lines": len(runs)}


def grounds(cards: list[dict], repos: dict):
    """Yield (card, runs, plate width, pixel_lums) with each card drawn once, type left off."""
    from PIL import Image
    from playwright.sync_api import sync_playwright

    from tools.repo_art.cards import card_runs, card_svg
    from tools.repo_art.render import CHROME_ARGS, raster
    from tools.repo_art.svg import PAL

    tmp = Path(__file__).resolve().parents[2] / ".card-check.svg"
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", args=CHROME_ARGS)
        page = browser.new_page(device_scale_factor=1)
        try:
            for card in cards:
                svg, scene = card_svg(card, repos, words=False)
                tmp.write_text(svg, "utf-8")
                im = Image.open(io.BytesIO(raster(page, tmp, None, False))).convert("RGB")

                def pixel_lums(b, im=im):
                    area = im.crop((max(0, int(b[0])), max(0, int(b[1])), min(W, int(b[2]) + 1), min(H, int(b[3]) + 1)))
                    raw = area.tobytes()
                    return [luminance(raw[i:i + 3]) for i in range(0, len(raw), 3)]

                plate = scene.get("plate_width")
                yield card, card_runs(card, PAL["dark"], plate), plate, pixel_lums
        finally:
            browser.close()
            tmp.unlink(missing_ok=True)


def main(argv: list[str]) -> int:
    from tools.repo_art import site_cards

    only = set(argv[argv.index("--only") + 1].split(",")) if "--only" in argv else None
    repos = json.loads((Path(__file__).parent / "repos.json").read_text("utf-8"))["repos"]
    cards = [c for c in site_cards.plan() if only is None or c["slug"] in only]
    report = {c["slug"]: check(runs, plate, lums) for c, runs, plate, lums in grounds(cards, repos)}
    bad = {slug: r["faults"] for slug, r in report.items() if r["faults"]}
    for slug, faults in bad.items():
        for fault in faults:
            print(f"{slug}: {fault}")
    lowest = min(report.items(), key=lambda kv: kv[1]["lowest_contrast"])
    print(f"{len(report)} cards, {sum(r['lines'] for r in report.values())} lines of type, {len(bad)} cards with a fault; "
          f"lowest contrast {lowest[1]['lowest_contrast']} on {lowest[0]}")
    if "--report" in argv:
        Path(argv[argv.index("--report") + 1]).write_text(json.dumps(report, indent=1, sort_keys=True) + "\n", "utf-8")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
