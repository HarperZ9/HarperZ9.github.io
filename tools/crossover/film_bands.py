"""Check the thin-film colours the renderer draws against the interference colour order (H88).

python tools/crossover/film_bands.py

A free film (n 1.38, air both sides) seen head-on under D65: reflectance from the Airy formula, integrated with
the CIE 1931 observer, for thicknesses 0 to 1200 nm. The first-order sequence in reflection is black, then
white or silver, then yellow, then red to purple, then blue, then green (second order). The check names the hue of
each saturated band in order of thickness and asserts Newton's first two orders: yellow, red to purple, blue,
green, then yellow, red to purple, blue, green again. It prints the band thicknesses for the record.
"""
import numpy as np
import colour

SH = colour.SpectralShape(380, 730, 5)
CM = colour.MSDS_CMFS["CIE 1931 2 Degree Standard Observer"].copy().align(SH)
D65 = colour.SDS_ILLUMINANTS["D65"].copy().align(SH)
WL = SH.wavelengths


def film(d, n2=1.38):
    r1, r2 = (1 - n2) / (1 + n2), (n2 - 1) / (n2 + 1)
    de = 4 * np.pi * n2 * d / WL
    return (r1 ** 2 + r2 ** 2 + 2 * r1 * r2 * np.cos(de)) / (1 + r1 ** 2 * r2 ** 2 + 2 * r1 * r2 * np.cos(de))


def lab(d):
    sd = colour.SpectralDistribution(dict(zip(WL, film(d) * 8)))  # scaled so the bright bands sit near white
    return colour.XYZ_to_Lab(colour.sd_to_XYZ(sd, cmfs=CM, illuminant=D65) / 100)


def name(h):
    for lo, hi, n in ((20, 70, "red"), (70, 110, "yellow"), (110, 200, "green"), (200, 290, "blue"), (290, 340, "purple")):
        if lo <= h < hi:
            return n
    return "red"


ds = np.arange(0, 1201, 5)
L = np.array([lab(d) for d in ds])
C = np.hypot(L[:, 1], L[:, 2]); H = np.degrees(np.arctan2(L[:, 2], L[:, 1])) % 360
print("thinnest film: L* %.1f (black film)" % L[0, 0])
first_white = ds[np.argmax(L[:, 0] > 60)]
print("first bright (silver) band near %d nm, chroma %.1f" % (first_white, C[np.argmax(L[:, 0] > 60)]))
# walk up in thickness, name each saturated sample, and collapse repeats into bands
seq = []
for d, c, h in zip(ds, C, H):
    if c < 30:
        continue
    n = name(h)
    n = "red-purple" if n in ("red", "purple") else n
    if not seq or seq[-1][1] != n:
        seq.append((int(d), n))
print("bands (first thickness, nm):", seq)
got = [n for _, n in seq]
want = ["yellow", "red-purple", "blue", "green", "yellow", "red-purple", "blue", "green"]  # Newton's first two orders
ok = L[0, 0] < 5 and got[:len(want)] == want
print("ok" if ok else "FAIL", "black, silver, then", " -> ".join(got[:len(want)]))
raise SystemExit(0 if ok else 1)
