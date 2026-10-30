#!/usr/bin/env python3
"""Build world/site/hero/spectra.js, the measured optics the home hero's shader reads.

The hero renders in wavelength bins, not RGB. This script reads the materials library (measured n and k on
the 380 to 780 nm grid, CIE 1931 2-degree CMFs) and, for each bin layout (8 bins for desktop, 3 for weak
devices), writes:
  - the bin's colour-matching weights, so a spectrum flat at 1 integrates to the equal-energy white, Y = 1;
  - the bin centroid wavelength, and N-BK7's n and water's n there;
  - water's and N-BK7's absorption coefficient alpha = 4 pi k / lambda (per metre), bin-averaged;
  - each light's spectral power, bin-averaged and normalised to Y = 1:
      sodium   high-pressure sodium, the parametric model of the Seattle night scenes (D doublet broadened,
               self-reversed, Na side lines, faint Hg), CCT near 2000 K
      filament a 2700 K Planck filament
      sun      a 5772 K blackbody through about 20 air masses of Rayleigh and aerosol extinction (low sun)
      daylight a 5772 K blackbody above the air (the light the sky scatters)
      moon     sunlight reddened by the lunar albedo slope
  - an XYZ to linear sRGB matrix per light, with Bradford adaptation at degree 0.3 toward that light (the
    night eye adapts only part of the way, as in the Seattle scenes).

Usage: python scripts/build-hero-spectra.py --materials <path to tools/materials>
"""
import argparse
import json
import math
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "world" / "site" / "hero" / "spectra.js"
LAYOUTS = {8: [(380 + 50 * i, 430 + 50 * i) for i in range(8)], 3: [(380, 490), (490, 590), (590, 780)]}


def planck(nm, K):
    lam = nm * 1e-9
    return 1.0 / (lam ** 5 * (math.exp(1.4387769e-2 / (lam * K)) - 1.0))


def hps(nm):
    """The Seattle scenes' high-pressure sodium model at one wavelength (spd.mjs, HPS_DEFAULT)."""
    g = lambda l, c, s: math.exp(-0.5 * ((l - c) / s) ** 2)
    lor = lambda l, c, w: 1.0 / (1.0 + ((l - c) / w) ** 2)
    wing = lor(nm, 589.3, 10) if nm < 589.3 else lor(nm, 589.3, 14)
    d = wing * (1 - 0.93 * g(nm, 589.3, 2.6))
    side = 0.25 * (0.9 * g(nm, 568.5, 2.2) + 0.55 * g(nm, 615.8, 2.6) + 0.12 * g(nm, 498.3, 1.2) + 0.1 * g(nm, 515.3, 1.2))
    hg = 0.06 * (g(nm, 435.8, 0.8) + g(nm, 546.1, 0.8))
    return d + side + hg + 0.05 * planck(nm, 2100) / planck(600, 2100)


def hps_5nm(nm):
    """Mean of the 1 nm model over the 5 nm cell, so the narrow lines are not lost between grid points."""
    return sum(hps(nm - 2 + i) for i in range(5)) / 5


def sun_low(nm, airmass=12.0):
    um = nm / 1000.0
    tau_r = 0.008569 * um ** -4 * (1 + 0.0113 * um ** -2 + 0.00013 * um ** -4)  # Hansen and Travis 1974
    tau_a = 0.08 * um ** -1.3  # Angstrom aerosol, clear coastal air (assumed)
    return planck(nm, 5772) * math.exp(-airmass * (tau_r + tau_a))


def moon(nm):
    return planck(nm, 5772) / planck(560, 5772) * (0.25 + 0.75 * (nm - 380) / 400)


BRAD = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]]
SRGB = [[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]]


def mm(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def mv(M, v):
    return [sum(M[i][k] * v[k] for k in range(3)) for i in range(3)]


def inv3(M):
    (a, b, c), (d, e, f), (g, h, i) = M
    A, B, C = e * i - f * h, f * g - d * i, d * h - e * g
    det = a * A + b * B + c * C
    return [[A / det, (c * h - b * i) / det, (b * f - c * e) / det],
            [B / det, (a * i - c * g) / det, (c * d - a * f) / det],
            [C / det, (b * g - a * h) / det, (a * e - b * d) / det]]


def adapt_matrix(white_xyz, degree=0.3):
    d65 = [0.95047, 1.0, 1.08883]
    lw, ld = mv(BRAD, white_xyz), mv(BRAD, d65)
    gain = [[(ld[k] / lw[k]) ** degree if j == k else 0.0 for j in range(3)] for k in range(3)]
    return mm(SRGB, mm(inv3(BRAD), mm(gain, BRAD)))


def build(materials_dir):
    sys.path.insert(0, str(materials_dir))
    import materials as M
    from materials.spectral import GRID, cmf
    bk7, water = M.get("bk7")["optics"], M.get("water")["optics"]
    n_bk7, n_w, k_w = bk7["n"]["value"], water["n"]["value"], water["k"]["value"]
    alpha_w = [4 * math.pi * k / (nm * 1e-9) for k, nm in zip(k_w, GRID)]
    alpha_g = [4 * math.pi * k / (nm * 1e-9) for k, nm in zip(bk7["k"]["value"], GRID)]
    cm = cmf()
    lights = {"sodium": [hps_5nm(nm) for nm in GRID], "filament": [planck(nm, 2700) for nm in GRID],
              "sun": [sun_low(nm) for nm in GRID], "daylight": [planck(nm, 5772) for nm in GRID], "moon": [moon(nm) for nm in GRID]}
    ybar_sum = sum(c[1] for c in cm) * 5.0
    interp = lambda arr, nm: arr[min(len(GRID) - 2, int((nm - 380) // 5))] + (arr[min(len(GRID) - 2, int((nm - 380) // 5)) + 1] - arr[min(len(GRID) - 2, int((nm - 380) // 5))]) * (((nm - 380) / 5) - min(len(GRID) - 2, int((nm - 380) // 5)))
    out = {"source": {"bk7": bk7["n"]["source"], "water": water["n"]["source"], "cmf": "CIE 1931 2-degree (CIE CSV, CC BY-SA 4.0)"},
           "layouts": {}, "lights": {}}
    for N, bins in LAYOUTS.items():
        L = {"lambda": [], "W": [], "n_bk7": [], "n_water": [], "alpha_water": [], "alpha_bk7": [], "S": {k: [] for k in lights}}
        for lo, hi in bins:
            idx = [i for i, nm in enumerate(GRID) if lo <= nm <= hi]
            # trapezoid cell weights: an edge sample shared with the next bin gives each half
            wt = [(0.5 if (GRID[i] == lo and lo != 380) or (GRID[i] == hi and hi != 780) else 1.0) * 5.0 for i in idx]
            e = [sum(cm[i]) * w for i, w in zip(idx, wt)]
            lam = sum(GRID[i] * x for i, x in zip(idx, e)) / sum(e)
            L["lambda"].append(round(lam, 3))
            L["W"].append([round(sum(cm[i][c] * w for i, w in zip(idx, wt)) / ybar_sum, 7) for c in range(3)])
            L["n_bk7"].append(round(interp(n_bk7, lam), 6))
            L["n_water"].append(round(interp(n_w, lam), 6))
            L["alpha_water"].append(round(sum(alpha_w[i] * x for i, x in zip(idx, e)) / sum(e), 6))
            L["alpha_bk7"].append(round(sum(alpha_g[i] * x for i, x in zip(idx, e)) / sum(e), 6))
            for k, spd in lights.items():
                L["S"][k].append(sum(spd[i] * x for i, x in zip(idx, e)) / sum(e))
        for k in lights:  # each light normalised so its own white integrates to Y = 1 in this layout
            Y = sum(s * w[1] for s, w in zip(L["S"][k], L["W"]))
            L["S"][k] = [round(s / Y, 6) for s in L["S"][k]]
        out["layouts"][N] = L
    for k, spd in lights.items():
        norm = sum(s * c[1] for s, c in zip(spd, cm))
        white = [sum(s * c[j] for s, c in zip(spd, cm)) / norm for j in range(3)]
        x, y = white[0] / sum(white), white[1] / sum(white)
        n = (x - 0.332) / (0.1858 - y)
        out["lights"][k] = {"xy": [round(x, 5), round(y, 5)], "cct_mccamy": round(449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33),
                            "to_srgb": [[round(v, 6) for v in r] for r in adapt_matrix(white)]}
    out["check"] = {"n_bk7_587_56": round(interp(n_bk7, 587.56), 6), "alpha_water_lib_vs_4pik_over_lambda_max_rel":
                    max(abs(a - b) / b for a, b in zip(alpha_w, water["absorption_coefficient"]["value"]) if b > 0)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--materials", required=True, help="path to the materials library (tools/materials)")
    data = build(Path(ap.parse_args().materials))
    head = ("// Generated by scripts/build-hero-spectra.py from the materials library (measured n and k, CIE 1931 2-degree).\n"
            "// Do not edit by hand. N-BK7: SCHOTT catalogue via refractiveindex.info (CC0). Water: Hale and Querry 1973.\n")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(head + "export const SPECTRA = " + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"hero spectra: {OUT.relative_to(SITE)}; n_BK7(587.56) = {data['check']['n_bk7_587_56']}; "
          + ", ".join(f"{k} {v['cct_mccamy']} K" for k, v in data["lights"].items()))


if __name__ == "__main__":
    main()
