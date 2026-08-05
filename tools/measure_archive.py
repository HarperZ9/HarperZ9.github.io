"""Measure every work in the session archive, on the pixels this site actually delivers.

The archive page publishes all 165 works and states their range: how dark the darkest is, how
luminous the lightest, where the band edges fall, how many are monochrome. Those are claims, so
this is the pass that produces them, kept next to the site rather than in a scratch directory.

    python tools/measure_archive.py --check     # recompute and diff against the manifest
    python tools/measure_archive.py --write     # recompute and write the manifest

Lightness is CIE L*, not the mean of RGB, which would call a saturated red and a mid grey equally
bright. Chroma is mean LAB chroma, which separates monochrome from merely desaturated. Hue is a
circular mean weighted by chroma, so grey pixels do not vote on it. Band edges are this corpus's
own terciles of measured lightness; the split into 55, 55 and 55 is a result, not a target.

Needs numpy and pillow, which the site's CI does not install. CI checks the manifest's internal
consistency instead (tests/test_session_archive.py); this checks it against the pixels.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "art" / "session-archive" / "manifest.json"

SAMPLE = 160          # works are measured at this longest edge; full size changes nothing visible
MONOCHROME_BELOW = 8.0
DARK_PERCENTILE = 33
LUMINOUS_PERCENTILE = 67
WARM_ARC = (330, 100)  # hues outside this arc are cool; two families, because a third had one work

METHOD = ("Measured on the delivered pixels: CIE L* for lightness, mean LAB chroma for colour, "
          "the spread of L* for contrast, and a chroma-weighted circular mean for hue so grey "
          "pixels do not vote. Tone bands are this corpus's own terciles of measured lightness, "
          "not chosen numbers; monochrome is chroma under 8.")


def srgb_to_linear(a: np.ndarray) -> np.ndarray:
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def measure(path: Path) -> dict:
    im = Image.open(path).convert("RGB")
    im.thumbnail((SAMPLE, SAMPLE), Image.LANCZOS)
    lin = srgb_to_linear(np.asarray(im, dtype=np.float32) / 255.0)
    X = lin @ np.array([0.4124, 0.3576, 0.1805], dtype=np.float32)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    Z = lin @ np.array([0.0193, 0.1192, 0.9505], dtype=np.float32)
    wp = (0.95047, 1.0, 1.08883)
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16.0 / 116.0)  # noqa: E731
    fx, fy, fz = f(X / wp[0]), f(Y / wp[1]), f(Z / wp[2])
    L = 116 * fy - 16
    A = 500 * (fx - fy)
    B = 200 * (fy - fz)
    C = np.hypot(A, B)
    hue = (np.degrees(np.arctan2(B, A)) + 360) % 360

    w = C.flatten()
    h = np.radians(hue.flatten())
    if w.sum() > 1e-6:
        hx, hy = float((w * np.cos(h)).sum()), float((w * np.sin(h)).sum())
        dom = (math.degrees(math.atan2(hy, hx)) + 360) % 360
        focus = math.hypot(hx, hy) / float(w.sum())   # 0 = every hue at once, 1 = a single hue
    else:
        dom, focus = 0.0, 0.0
    return {
        "lightness": round(float(L.mean()) / 100, 4),
        "chroma": round(float(C.mean()), 2),
        "contrast": round(float(L.std()) / 100, 4),
        "hue": round(dom, 1),
        "hue_focus": round(focus, 3),
    }


def band(works: list[dict]) -> dict:
    light = np.array([w["measure"]["lightness"] for w in works])
    chroma = np.array([w["measure"]["chroma"] for w in works])
    contrast = np.array([w["measure"]["contrast"] for w in works])
    lo = float(np.percentile(light, DARK_PERCENTILE))
    hi = float(np.percentile(light, LUMINOUS_PERCENTILE))
    warm_from, warm_to = WARM_ARC
    for w in works:
        ms = w["measure"]
        ms["tone"] = "dark" if ms["lightness"] < lo else ("luminous" if ms["lightness"] > hi else "mid")
        ms["monochrome"] = bool(ms["chroma"] < MONOCHROME_BELOW)
        ms["family"] = ("monochrome" if ms["monochrome"] else
                        "warm" if (ms["hue"] < warm_to or ms["hue"] >= warm_from) else "cool")
    return {
        "method": METHOD,
        "lightness": {"min": round(float(light.min()), 4), "max": round(float(light.max()), 4),
                      "median": round(float(np.median(light)), 4),
                      "dark_below": round(lo, 4), "luminous_above": round(hi, 4)},
        "chroma": {"min": round(float(chroma.min()), 2), "max": round(float(chroma.max()), 2),
                   "median": round(float(np.median(chroma)), 2),
                   "monochrome_below": MONOCHROME_BELOW},
        "contrast": {"min": round(float(contrast.min()), 4), "max": round(float(contrast.max()), 4),
                     "median": round(float(np.median(contrast)), 4)},
        "tone_counts": {t: sum(1 for w in works if w["measure"]["tone"] == t)
                        for t in ("dark", "mid", "luminous")},
        "family_counts": {f_: sum(1 for w in works if w["measure"]["family"] == f_)
                          for f_ in ("monochrome", "warm", "cool")},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write", action="store_true", help="write the recomputed values")
    ap.add_argument("--check", action="store_true", help="diff against what is published")
    args = ap.parse_args()
    if not (args.write or args.check):
        ap.error("choose --check or --write")

    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    published = {w["id"]: w.get("measure") for w in m["works"]}
    for w in m["works"]:
        w["measure"] = measure(ROOT / w["thumb"])
    fresh_range = band(m["works"])

    if args.check:
        drift = [w["id"] for w in m["works"] if published.get(w["id"]) != w["measure"]]
        same_range = m.get("range") == fresh_range
        if drift:
            print(f"{len(drift)} works drifted from their published measurement: "
                  f"{', '.join(drift[:8])}{'...' if len(drift) > 8 else ''}")
        if not same_range:
            print("the published range is not what the works measure")
        if drift or not same_range:
            return 1
        r = fresh_range["lightness"]
        print(f"{len(m['works'])} works match their published measurement "
              f"(lightness {r['min']:.3f}..{r['max']:.3f}, bands {fresh_range['tone_counts']})")
        return 0

    m["range"] = fresh_range
    MANIFEST.write_text(json.dumps(m, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {len(m['works'])} measurements: {fresh_range['tone_counts']}, "
          f"{fresh_range['family_counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
