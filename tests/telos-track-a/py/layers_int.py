"""Python twin of system/lib/sense-core/layers-int.mjs: layer text oklab-int/v1, integers only.

CLI:
  python layers_int.py random <count> <out.json>          seeded random images (images.py)
  python layers_int.py frames <dir> <out.json>            the audit frames (<dir>/index.json + .rgba)
out.json = [{"name": ..., "image_sha256": ..., "text": ...}, ...]
"""
import hashlib
import json
import os
import sys

from oklab_int import LIN_Q20, OKLAB_INT_SCHEMA, bin_q36, oklab_q36_from_linear_q20

LAYER_TEXT_SCHEMA = "oklab-int/v1"
B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
L1_CELLS = 8
L2_CHROMATIC_N = (12, 32)
L2_ACHROMATIC_N = (16, 24)


def _isqrt(n):
    import math
    return math.isqrt(n)


def integral_linear(px, w, h, ch):
    W = w + 1
    S = [[0] * (W * (h + 1)) for _ in range(3)]
    for y in range(h):
        run = [0, 0, 0]
        for x in range(w):
            i = (y * w + x) * ch
            o = (y + 1) * W + (x + 1)
            up = y * W + (x + 1)
            for k in range(3):
                run[k] += LIN_Q20[px[i + k]]
                S[k][o] = S[k][up] + run[k]
    return S, W


def cell_means(I, w, h, rows, cols):
    S, W = I
    out = []
    for r in range(rows):
        y0 = (r * h) // rows
        y1 = max(y0 + 1, ((r + 1) * h) // rows)
        for c in range(cols):
            x0 = (c * w) // cols
            x1 = max(x0 + 1, ((c + 1) * w) // cols)
            count = (y1 - y0) * (x1 - x0)
            cell = []
            for k in range(3):
                s = S[k][y1 * W + x1] - S[k][y0 * W + x1] - S[k][y1 * W + x0] + S[k][y0 * W + x0]
                cell.append((2 * s + count) // (2 * count))
            out.append(cell)
    return out


def grid_rows(values, rows, cols, fmt, sep):
    return "\n".join(sep.join(fmt(v) for v in values[r * cols:(r + 1) * cols]) for r in range(rows))


def layer_l0(px, w, h, ch=4):
    n = w * h
    L8, S2 = [], []
    for i in range(n):
        o = i * ch
        L, a, b = oklab_q36_from_linear_q20(LIN_Q20[px[o]], LIN_Q20[px[o + 1]], LIN_Q20[px[o + 2]])
        L8.append(bin_q36(L, "L", 8))
        a16 = (a + 524288) // 1048576
        b16 = (b + 524288) // 1048576
        S2.append(a16 * a16 + b16 * b16)
    L8.sort()
    S2.sort()
    rank = lambda p: ((n - 1) * p) // 100
    s95 = S2[rank(95)]
    achromatic = 1 if s95 * 2500 < 4294967296 else 0
    c95milli = (_isqrt(s95) * 1000 + 32768) // 65536
    text = (f"L0 {w}x{h} srgb8 declared:unverified achromatic:{achromatic} "
            f"L8p5/50/95:{L8[rank(5)]}/{L8[rank(50)]}/{L8[rank(95)]} chroma-p95-milli:{c95milli}")
    return achromatic, text


def chromatic_layer(tag, I, w, h, n):
    m = max(1, n // 2)
    Lv = [bin_q36(oklab_q36_from_linear_q20(*c)[0], "L", 6) for c in cell_means(I, w, h, n, n)]
    ab = []
    for c in cell_means(I, w, h, m, m):
        _, A, B = oklab_q36_from_linear_q20(*c)
        ab.append(B64[bin_q36(A, "a", 6)] + B64[bin_q36(B, "b", 6)])
    return (f"{tag} {LAYER_TEXT_SCHEMA} cells:{n}x{n} chroma:{m}x{m} bits:L6,ab6 alphabet:b64\nL:\n"
            + grid_rows(Lv, n, n, lambda v: B64[v], "") + "\nab:\n" + grid_rows(ab, m, m, lambda s: s, " "))


def achromatic_layer(I, w, h, n):
    Lv = [bin_q36(oklab_q36_from_linear_q20(*c)[0], "L", 8) for c in cell_means(I, w, h, n, n)]
    return (f"L2 {LAYER_TEXT_SCHEMA} cells:{n}x{n} bits:L8 alphabet:hex branch:achromatic\n"
            + grid_rows(Lv, n, n, lambda v: format(v, "02x"), ""))


def layer_text_all(px, w, h, ch=4):
    I = integral_linear(px, w, h, ch)
    parts = [layer_l0(px, w, h, ch)[1], chromatic_layer("L1", I, w, h, L1_CELLS)]
    parts += [chromatic_layer("L2", I, w, h, n) for n in L2_CHROMATIC_N]
    parts += [achromatic_layer(I, w, h, n) for n in L2_ACHROMATIC_N]
    return "\n".join(parts) + "\n"


def _entry(name, px, w, h):
    return {"name": name, "w": w, "h": h, "image_sha256": hashlib.sha256(bytes(px)).hexdigest(),
            "text": layer_text_all(px, w, h, 4)}


def main(argv):
    mode, arg, dst = argv[1], argv[2], argv[3]
    out = []
    if mode == "random":
        from images import random_images
        for name, w, h, px in random_images(int(arg)):
            out.append(_entry(name, px, w, h))
    elif mode == "frames":
        index = json.load(open(os.path.join(arg, "index.json")))
        for f in index:
            px = open(os.path.join(arg, f["name"] + ".rgba"), "rb").read()
            out.append(_entry(f["name"], px, f["w"], f["h"]))
    else:
        raise SystemExit("mode must be random or frames")
    json.dump({"schema": OKLAB_INT_SCHEMA, "entries": out}, open(dst, "w", encoding="utf-8"))


if __name__ == "__main__":
    main(sys.argv)
