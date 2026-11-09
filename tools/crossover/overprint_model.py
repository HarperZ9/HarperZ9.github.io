"""Overprint glass: predict where two printed inks overlap from the inks alone, and score it against
measured overlaps on a real print (the Olivetti "De A a Z" sheet, five overlaps measured on the scan).

python tools/crossover/overprint_model.py [--bins 16] [--json out.json]

Models, each scored with CIE76 and CIEDE2000 against the measured overlap colour:
  rgb       per-channel multiply in linear sRGB (the earlier test's "ideal multiply")
  spectral  each ink's reflectance recovered as a smooth spectrum (Jakob and Hanika 2019), its
            transmission through the ink film is ink/paper per wavelength, two films multiply per
            wavelength (Beer-Lambert: absorbances add), integrated under D65 with the CIE 1931 2 deg
            observer
  spectral+fresnel  as spectral, with the first-surface reflection fixed by physics, not fitted: a
            surface of index 1.5 seen head-on returns F0 = ((1.5 - 1) / (1.5 + 1))^2 = 0.04 unfiltered
  spectral+surface  as spectral, with a first-surface reflection r_s that every printed surface
            returns unfiltered, and a trap fraction tau (how much of the second ink transfers onto the
            first); r_s and tau are fitted, and the score is leave-one-out (each overlap predicted with
            parameters fitted on the other four)
Also writes the per-ink absorbance at the shader's wavelength bins, so the site renderer uses the
same numbers this script scores.
"""
import argparse
import json
import sys

import numpy as np
import colour

INKS = {"paper": "#fcf7eb", "red": "#eb4324", "cyan": "#04b2dd", "yellow": "#fcc603", "green": "#07ac3d", "black": "#1a1b22"}
MEASURED = {"cyan+yellow": "#028e3f", "red+yellow": "#c03314", "green+cyan": "#029642", "red+black": "#482a26", "green+red": "#261b28"}

SHAPE = colour.SpectralShape(380, 730, 5)
CMFS = colour.MSDS_CMFS["CIE 1931 2 Degree Standard Observer"].copy().align(SHAPE)
D65 = colour.SDS_ILLUMINANTS["D65"].copy().align(SHAPE)
WL = SHAPE.wavelengths


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])


def srgb_to_xyz(rgb):
    return colour.sRGB_to_XYZ(rgb)


def spectrum(hexc):
    """Smooth reflectance whose D65 colour is the given sRGB (Jakob and Hanika 2019 sigmoid)."""
    xyz = srgb_to_xyz(hex_rgb(hexc))
    sd = colour.recovery.XYZ_to_sd_Jakob2019(xyz, cmfs=CMFS, illuminant=D65)
    return np.clip(sd.copy().align(SHAPE).values, 1e-4, 1.0)


def refl_to_xyz(r):
    sd = colour.SpectralDistribution(dict(zip(WL, r)))
    return colour.sd_to_XYZ(sd, cmfs=CMFS, illuminant=D65) / 100


def refl_to_hex(r):
    rgb = np.clip(colour.XYZ_to_sRGB(refl_to_xyz(r)), 0, 1)
    return "#" + "".join(f"{int(round(v * 255)):02x}" for v in rgb)


def lab_of_hex(h):
    return colour.XYZ_to_Lab(srgb_to_xyz(hex_rgb(h)))


def scores(pred_hex, meas_hex):
    a, b = lab_of_hex(pred_hex), lab_of_hex(meas_hex)
    return float(colour.delta_E(a, b, method="CIE 1976")), float(colour.delta_E(a, b, method="CIE 2000"))


def rgb_multiply(a, b):
    lin = lambda h: colour.cctf_decoding(hex_rgb(h), function="sRGB")
    p = lin(INKS["paper"])
    out = p * (lin(INKS[a]) / p) * (lin(INKS[b]) / p)
    rgb = np.clip(colour.cctf_encoding(np.clip(out, 0, 1), function="sRGB"), 0, 1)
    return "#" + "".join(f"{int(round(v * 255)):02x}" for v in rgb)


S = {k: spectrum(v) for k, v in INKS.items()}
F0 = ((1.5 - 1) / (1.5 + 1)) ** 2  # head-on Fresnel reflectance of a surface of index 1.5


def body(r, rs):
    return np.clip((r - rs) / (1 - rs), 1e-5, 1)


def spectral_overlap(a, b, rs=0.0, tau=1.0):
    p = body(S["paper"], rs)
    ta, tb = np.clip(body(S[a], rs) / p, 1e-5, 1), np.clip(body(S[b], rs) / p, 1e-5, 1)
    # Beer-Lambert: absorbances add; the second ink lays down tau of its film on top of the first
    rb = p * np.exp(np.log(ta) + tau * np.log(tb))
    return refl_to_hex(rs + (1 - rs) * rb)


def fit(pairs):
    best = None
    for rs in np.linspace(0, 0.08, 33):
        for tau in np.linspace(0.3, 1.2, 37):
            e = np.mean([scores(spectral_overlap(*k.split("+"), rs, tau), MEASURED[k])[1] for k in pairs])
            if best is None or e < best[0]:
                best = (e, rs, tau)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bins", type=int, default=16)
    ap.add_argument("--json")
    args = ap.parse_args()
    out = {"source": "Olivetti 'De A a Z' sheet, five measured overlaps", "inks": INKS, "overlaps": {}}
    keys = list(MEASURED)
    allfit = fit(keys)
    for k in keys:
        a, b = k.split("+")
        loo = fit([x for x in keys if x != k])
        row = {"measured": MEASURED[k]}
        for name, h in (("rgb", rgb_multiply(a, b)), ("spectral", spectral_overlap(a, b)), ("spectral+fresnel", spectral_overlap(a, b, F0, 1.0)),
                        ("spectral+surface (leave-one-out)", spectral_overlap(a, b, loo[1], loo[2]))):
            e76, e00 = scores(h, MEASURED[k])
            row[name] = {"hex": h, "dE76": round(e76, 1), "dE00": round(e00, 1)}
        row["loo_params"] = {"r_s": round(loo[1], 4), "tau": round(loo[2], 3)}
        out["overlaps"][k] = row
    names = ["rgb", "spectral", "spectral+fresnel", "spectral+surface (leave-one-out)"]
    out["mean"] = {n: {m: round(float(np.mean([out["overlaps"][k][n][m] for k in keys])), 1) for m in ("dE76", "dE00")} for n in names}
    out["fit_all"] = {"r_s": round(allfit[1], 4), "tau": round(allfit[2], 3), "mean_dE00": round(allfit[0], 1)}
    # absorbance per ink at the shader's bins (band means), for the renderer
    edges = np.linspace(400, 700, args.bins + 1)
    rs, tau = 0.0, 1.0  # the renderer: inks as the scan sees them; it adds its own Fresnel reflection
    p = body(S["paper"], rs)
    band = lambda r: [float(np.mean(r[(WL >= lo) & (WL < hi)])) for lo, hi in zip(edges[:-1], edges[1:])]
    out["shader"] = {"bins_nm": [float((lo + hi) / 2) for lo, hi in zip(edges[:-1], edges[1:])], "r_s": rs, "tau": tau,
                     "paper_body": band(p),
                     "absorbance": {k: band(-np.log(np.clip(body(S[k], rs) / p, 1e-5, 1))) for k in INKS if k != "paper"}}
    for k in keys:
        r = out["overlaps"][k]
        print(f"{k:12s} measured {r['measured']}  " + "  ".join(f"{n.split(' ')[0]} {r[n]['hex']} {r[n]['dE76']:5.1f}/{r[n]['dE00']:4.1f}" for n in names) + f"  loo r_s={r['loo_params']['r_s']} tau={r['loo_params']['tau']}")
    print("mean dE76/dE00:", {n: (out['mean'][n]['dE76'], out['mean'][n]['dE00']) for n in names}, "fit on all:", out["fit_all"])
    if args.json:
        json.dump(out, open(args.json, "w"), indent=1)


if __name__ == "__main__":
    sys.exit(main())
