"""Python twin of the Telos colour-word rule R-hue-v1 (pre-registered in
tests/telos-track-a/PREREGISTRATION.md). Written from the rule text, stdlib only,
so the JavaScript in system/lib/sense-core/features.mjs has an independent
re-implementation to agree with. Float math is fine here: every reference colour
sits at least 0.5 degree of hue, 0.005 of L or 0.002 of chroma from a boundary.

CLI: python hue_words.py <hex> [<hex> ...]   prints "<hex> <name> <margin>" per colour.
"""
import math
import sys

M1 = ((0.4122214708, 0.5363325363, 0.0514459929),
      (0.2119034982, 0.6806995451, 0.1073969566),
      (0.0883024619, 0.2817188376, 0.6299787005))
M2 = ((0.2104542553, 0.7936177850, -0.0040720468),
      (1.9779984951, -2.4285922050, 0.4505937099),
      (0.0259040371, 0.7827717662, -0.8086757660))

# build-color _BASIC_COLORS prototypes (sRGB bytes). Grey is spelled "grey" here.
PROTOTYPES = {
    "red": (255, 0, 0), "orange": (255, 165, 0), "yellow": (255, 255, 0),
    "green": (0, 128, 0), "blue": (0, 0, 255), "purple": (128, 0, 128),
    "pink": (255, 192, 203), "brown": (139, 69, 19),
    "white": (255, 255, 255), "grey": (128, 128, 128), "black": (0, 0, 0),
}
HUE_BEARING = ("pink", "red", "orange", "yellow", "green", "blue", "purple")
C_ACHROMATIC = 0.035      # build-color color_description achromatic threshold
L_BLACK = 0.35            # build-color bands: black + very dark gray collapse to black
L_WHITE = 0.85            # build-color bands: white


def srgb_to_linear(c8):
    c = c8 / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def oklab(rgb8):
    r, g, b = (srgb_to_linear(v) for v in rgb8)
    lms = [m[0] * r + m[1] * g + m[2] * b for m in M1]
    lms_ = [math.copysign(abs(v) ** (1.0 / 3.0), v) for v in lms]
    return tuple(m[0] * lms_[0] + m[1] * lms_[1] + m[2] * lms_[2] for m in M2)


def lch(rgb8):
    L, a, b = oklab(rgb8)
    h = math.degrees(math.atan2(b, a)) % 360.0
    return L, math.hypot(a, b), h


PROTO_LCH = {n: lch(v) for n, v in PROTOTYPES.items()}
L_BROWN_SPLIT = (PROTO_LCH["orange"][0] + PROTO_LCH["brown"][0]) / 2
H_RED_BROWN = (PROTO_LCH["red"][2] + PROTO_LCH["brown"][2]) / 2
L_DARK_PINK = (PROTO_LCH["red"][0] + PROTO_LCH["purple"][0]) / 2


def circ(a, b):
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


def arc(c, deg):
    """OKLab distance from a point at chroma c to a hue ray deg degrees away (chord)."""
    return 2.0 * c * math.sin(math.radians(min(deg, 90.0)) / 2.0)


def name(rgb8):
    """Return (word, margin). margin is the OKLab distance to the nearest boundary that
    decided the word: hue rays as chords at the colour's chroma, L and C splits directly."""
    L, C, h = lch(rgb8)
    if C < C_ACHROMATIC:
        m_c = C_ACHROMATIC - C
        if L < L_BLACK:
            return "black", min(m_c, L_BLACK - L)
        if L >= L_WHITE:
            return "white", min(m_c, L - L_WHITE)
        return "grey", min(m_c, L - L_BLACK, L_WHITE - L)
    ds = sorted((circ(h, PROTO_LCH[n][2]), n) for n in HUE_BEARING)
    sector = ds[0][1]
    margin = arc(C, (ds[1][0] - ds[0][0]) / 2.0)   # OKLab distance to the sector boundary ray
    margin = min(margin, C - C_ACHROMATIC)
    brownish = sector in ("orange", "yellow") or (sector == "red" and h >= H_RED_BROWN)
    if sector == "red":
        margin = min(margin, arc(C, abs(h - H_RED_BROWN)))
    if brownish:
        margin = min(margin, abs(L - L_BROWN_SPLIT))
        if L < L_BROWN_SPLIT:
            return "brown", margin
    if sector == "pink":
        margin = min(margin, abs(L - L_DARK_PINK))
        if L < L_DARK_PINK:
            return "red", margin
    return sector, margin


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        w, m = name(hex_rgb(arg))
        print(arg, w, f"{m:.4f}")
