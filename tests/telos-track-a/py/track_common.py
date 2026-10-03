"""Shared pieces for the Track A T5 to T7 analyses (system Python: numpy, scipy).

- prereg_hashes(): the SHA-256 of every pre-registered block in PREREGISTRATION.md (same rule as
  prereg-hash.mjs: UTF-8 bytes strictly between the markers, CRLF folded to LF).
- parse_layer / encode_layer: layer text to numbers and back (the T7 parser round-trip check).
- decode_*: layer bins to OKLab values with the integer path ranges.
- Metrics copied from the resolution experiments (exp-resolution/colour.py: srgb_to_linear,
  linear_to_lab, linear_to_oklab, oklab_to_linear, de2000, luma_linear, ssim; e2_tokens_recon.py:
  bilinear), unchanged, so this suite runs inside the repo.
- cluster_boot: percentile bootstrap of a mean, resampling clusters (seed 20261002, 10,000 draws).
"""
import hashlib
import os
import re

import numpy as np
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
PREREG = os.path.join(HERE, "..", "PREREGISTRATION.md")
BLOCKS = {"prereg_sha256": "prereg-track-a-v1", "amendment_1_sha256": "prereg-track-a-amend-1",
          "prereg_t4t7_sha256": "prereg-track-a-t4t7", "amendment_2_sha256": "prereg-track-a-amend-2",
          "amendment_3_sha256": "prereg-track-a-amend-3", "amendment_4_sha256": "prereg-track-a-amend-4",
          "prereg_t7v2_sha256": "prereg-track-a-t7v2"}
B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
RANGES = {"L": (0.0, 1.0), "a": (-0.234, 0.277), "b": (-0.312, 0.199)}


def prereg_hashes(keys=("prereg_sha256", "prereg_t4t7_sha256", "amendment_2_sha256", "amendment_3_sha256")):
    t = open(PREREG, encoding="utf-8").read().replace("\r\n", "\n")
    out = {}
    for k in keys:
        a, b = f"<!-- {BLOCKS[k]}:start -->", f"<!-- {BLOCKS[k]}:end -->"
        out[k] = hashlib.sha256(t[t.index(a) + len(a):t.index(b)].encode("utf-8")).hexdigest()
    return out


# ---- layer text ---------------------------------------------------------------------------------
def parse_layer(text):
    """Return a dict: kind (L0 | chromatic | achromatic), numbers and grids."""
    lines = text.split("\n")
    head = lines[0]
    if head.startswith("L0 "):
        m = re.match(r"L0 (\d+)x(\d+) srgb8 declared:unverified achromatic:(\d) L8p5/50/95:(\d+)/(\d+)/(\d+) chroma-p95-milli:(\d+)$", head)
        w, h, a, p5, p50, p95, c = map(int, m.groups())
        return {"kind": "L0", "w": w, "h": h, "achromatic": a, "p": [p5, p50, p95], "chroma_milli": c}
    m = re.match(r"(L[12]) oklab-int/v2 cells:(\d+)x\d+ (?:chroma:(\d+)x\d+ bits:L6,ab6 alphabet:b64|bits:L8 alphabet:hex branch:achromatic)$", head)
    tag, n, mm = m.group(1), int(m.group(2)), m.group(3)
    if mm is None:
        L = np.array([[int(row[2 * j:2 * j + 2], 16) for j in range(n)] for row in lines[1:1 + n]])
        return {"kind": "achromatic", "tag": tag, "n": n, "L": L}
    mm = int(mm)
    assert lines[1] == "L:" and lines[2 + n] == "ab:"
    L = np.array([[B64.index(ch) for ch in row] for row in lines[2:2 + n]])
    ab = [[(B64.index(tok[0]), B64.index(tok[1])) for tok in row.split(" ")] for row in lines[3 + n:3 + n + mm]]
    return {"kind": "chromatic", "tag": tag, "n": n, "m": mm, "L": L, "A": np.array([[p[0] for p in r] for r in ab]),
            "B": np.array([[p[1] for p in r] for r in ab])}


def encode_layer(p):
    if p["kind"] == "L0":
        return (f"L0 {p['w']}x{p['h']} srgb8 declared:unverified achromatic:{p['achromatic']} "
                f"L8p5/50/95:{p['p'][0]}/{p['p'][1]}/{p['p'][2]} chroma-p95-milli:{p['chroma_milli']}")
    if p["kind"] == "achromatic":
        n = p["n"]
        return (f"{p['tag']} oklab-int/v2 cells:{n}x{n} bits:L8 alphabet:hex branch:achromatic\n"
                + "\n".join("".join(format(int(v), "02x") for v in row) for row in p["L"]))
    n, m = p["n"], p["m"]
    return (f"{p['tag']} oklab-int/v2 cells:{n}x{n} chroma:{m}x{m} bits:L6,ab6 alphabet:b64\nL:\n"
            + "\n".join("".join(B64[int(v)] for v in row) for row in p["L"]) + "\nab:\n"
            + "\n".join(" ".join(B64[int(a)] + B64[int(b)] for a, b in zip(ra, rb)) for ra, rb in zip(p["A"], p["B"])))


def dq(bins, ch, bits):
    lo, hi = RANGES[ch]
    return lo + np.asarray(bins, dtype=np.float64) * (hi - lo) / ((1 << bits) - 1)


def oklab_grids(p, l1=None):
    """(L grid, a grid, b grid) in OKLab of a parsed L1/L2 layer; achromatic L2 takes a, b from l1."""
    if p["kind"] == "chromatic":
        return dq(p["L"], "L", 6), dq(p["A"], "a", 6), dq(p["B"], "b", 6)
    return dq(p["L"], "L", 8), dq(l1["A"], "a", 6), dq(l1["B"], "b", 6)


def on_grid(g, size=32):
    c = g.shape[0]
    idx = (np.arange(size) * c) // size
    return g[np.ix_(idx, idx)]


# ---- metrics (copied from exp-resolution) ---------------------------------------------------------
M_RGB2XYZ = np.array([[0.4124564, 0.3575761, 0.1804375],
                      [0.2126729, 0.7151522, 0.0721750],
                      [0.0193339, 0.1191920, 0.9503041]])
WHITE_D65 = M_RGB2XYZ @ np.ones(3)
M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
               [0.2119034982, 0.6806995451, 0.1073969566],
               [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
               [1.9779984951, -2.4285922050, 0.4505937099],
               [0.0259040371, 0.7827717662, -0.8086757660]])
M1I, M2I = np.linalg.inv(M1), np.linalg.inv(M2)


def srgb_to_linear(u8):
    c = np.asarray(u8, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_lab(lin):
    xyz = lin @ M_RGB2XYZ.T / WHITE_D65
    e, k = 216 / 24389, 24389 / 27
    f = np.where(xyz > e, np.cbrt(xyz), (k * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def oklab_to_linear(lab):
    return ((lab @ M2I.T) ** 3) @ M1I.T


def de2000(lab1, lab2):
    L1, a1, b1 = lab1[..., 0], lab1[..., 1], lab1[..., 2]
    L2, a2, b2 = lab2[..., 0], lab2[..., 1], lab2[..., 2]
    cb = (np.hypot(a1, b1) + np.hypot(a2, b2)) / 2
    g = 0.5 * (1 - np.sqrt(cb ** 7 / (cb ** 7 + 25.0 ** 7)))
    a1p, a2p = (1 + g) * a1, (1 + g) * a2
    c1p, c2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    zero = (c1p * c2p) == 0
    dh = h2p - h1p
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dh = np.where(zero, 0, dh)
    dLp, dCp = L2 - L1, c2p - c1p
    dHp = 2 * np.sqrt(c1p * c2p) * np.sin(np.radians(dh / 2))
    lbp, cbp = (L1 + L2) / 2, (c1p + c2p) / 2
    hs = h1p + h2p
    hbp = np.where(np.abs(h1p - h2p) <= 180, hs / 2, np.where(hs < 360, (hs + 360) / 2, (hs - 360) / 2))
    hbp = np.where(zero, hs, hbp)
    t = (1 - 0.17 * np.cos(np.radians(hbp - 30)) + 0.24 * np.cos(np.radians(2 * hbp))
         + 0.32 * np.cos(np.radians(3 * hbp + 6)) - 0.20 * np.cos(np.radians(4 * hbp - 63)))
    dth = 30 * np.exp(-(((hbp - 275) / 25) ** 2))
    rc = 2 * np.sqrt(cbp ** 7 / (cbp ** 7 + 25.0 ** 7))
    sl = 1 + 0.015 * (lbp - 50) ** 2 / np.sqrt(20 + (lbp - 50) ** 2)
    sc, sh = 1 + 0.045 * cbp, 1 + 0.015 * cbp * t
    rt = -np.sin(np.radians(2 * dth)) * rc
    return np.sqrt((dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh))


def luma_linear(lin):
    return lin @ np.array([0.2126729, 0.7151522, 0.0721750])


def ssim(x, y, sigma=1.5):
    c1, c2 = 0.01 ** 2, 0.03 ** 2
    mx, my = gaussian_filter(x, sigma), gaussian_filter(y, sigma)
    sxx = gaussian_filter(x * x, sigma) - mx * mx
    syy = gaussian_filter(y * y, sigma) - my * my
    sxy = gaussian_filter(x * y, sigma) - mx * my
    m = ((2 * mx * my + c1) * (2 * sxy + c2)) / ((mx * mx + my * my + c1) * (sxx + syy + c2))
    return float(m.mean())


def bilinear(grid, h, w):
    rows, cols = grid.shape[:2]
    fy = np.clip((np.arange(h) + 0.5) * rows / h - 0.5, 0, rows - 1)
    fx = np.clip((np.arange(w) + 0.5) * cols / w - 0.5, 0, cols - 1)
    y0 = np.floor(fy).astype(int); y1 = np.minimum(rows - 1, y0 + 1); wy = (fy - y0)[:, None, None]
    x0 = np.floor(fx).astype(int); x1 = np.minimum(cols - 1, x0 + 1); wx = (fx - x0)[None, :, None]
    g = grid
    return (g[y0][:, x0] * (1 - wx) * (1 - wy) + g[y0][:, x1] * wx * (1 - wy)
            + g[y1][:, x0] * (1 - wx) * wy + g[y1][:, x1] * wx * wy)


# ---- statistics ---------------------------------------------------------------------------------
def cluster_boot(values, clusters, n=10000, seed=20261002):
    """Mean and percentile 95% interval of a mean, resampling whole clusters with replacement."""
    values = np.asarray(values, dtype=np.float64)
    keys = sorted(set(clusters))
    pos = {k: i for i, k in enumerate(keys)}
    cid = np.array([pos[c] for c in clusters])
    sums = np.bincount(cid, weights=values, minlength=len(keys))
    counts = np.bincount(cid, minlength=len(keys)).astype(np.float64)
    rng = np.random.default_rng(seed)
    draw = rng.integers(0, len(keys), (n, len(keys)))
    means = sums[draw].sum(1) / counts[draw].sum(1)
    return {"mean": float(values.mean()), "lo": float(np.percentile(means, 2.5)), "hi": float(np.percentile(means, 97.5)),
            "n": int(len(values)), "clusters": len(keys)}
