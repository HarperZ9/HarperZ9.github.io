"""The ink palette for the drawn marks and colour studies: every ink, key and overlap colour is computed from the
five measured Olivetti inks, never picked.

python tools/crossover/icon_palette.py [--out world/site/crossover/icon-palette.json]

1. Overprint model race. Each model is fitted on single inks only and scored on the five overlaps measured on the
   "De A a Z" sheet (CIEDE2000, mean and median). Entries:
     multiply   per-channel multiply in linear sRGB (the baseline)
     beer       spectral Beer-Lambert: ink transmittance is ink / paper per wavelength, films multiply
     clapper-yule  Williams-Clapper full-tone model: a surface of index 1.5 with specular reflection Ks and diffuse
                internal reflection Ki = 0.596 (from n = 1.5, Judd), paper intrinsic reflectance recovered from the
                paper, each ink's two-pass transmittance T^2 recovered from its own patch, and an overlap's T^2 the
                product of both. Ks = 0 (the scan's geometry excludes the gloss) and Ks = 0.04 are both scored.
   Kill rule from the 2026-11-04 golden sweep: a model replaces the baseline only if its median CIEDE2000 beats
   per-channel multiply by at least 1.0. The winner colours every overlap in the marks.
2. Overlap colours for every pair and triple of the seven keyboard keys and five inks, by the winning model.
3. A Michel-Levy ramp: a birefringent grain between crossed polarisers transmits sin^2(pi G / lambda) at
   retardance G, under D65 with the CIE 1931 observer, every 10 nm of G from 0 to 1700 nm.
4. A thin-film ramp: a free film of index 1.38 in air, reflectance by the Airy formula, under D65 with the
   CIE 1931 observer, every 10 nm from 0 to 1200 nm, head-on and at 45 degrees. These are the colours of the one
   iridescent ink a view may carry.
Limit: the inks are recovered from a scan as smooth spectra (Jakob and Hanika 2019), so the race scores models on
recovered spectra, not on spectrophotometer readings.
"""
import argparse
import itertools
import json
import sys
from pathlib import Path

import numpy as np
import colour

sys.path.insert(0, str(Path(__file__).parent))
import overprint_model as om  # noqa: E402

KI = 0.596  # diffuse internal reflectance of a surface of index 1.5 (Judd)
KEYS = {  # world/site/crossover/keyboard.js, Le Corbusier's roles; weights are ink film fractions
    "sky": {"cyan": 0.42}, "mist": {"cyan": 0.2, "yellow": 0.06}, "sand": {"yellow": 0.55, "red": 0.1},
    "straw": {"yellow": 0.32, "red": 0.03, "cyan": 0.04}, "land": {"red": 0.95}, "leaf": {"green": 0.9},
    "velvet": {"red": 0.5, "cyan": 0.38, "yellow": 0.08},
}
INKS5 = ["red", "cyan", "yellow", "green", "black"]


def cy_paper(ks):
    rp = om.S["paper"]
    return (rp - ks) / ((1 - ks) * (1 - KI) + KI * (rp - ks))


def cy_t2(ink, ks):
    """Two-pass transmittance T^2 of an ink film, inverted from its own patch."""
    rg, ri = cy_paper(ks), om.S[ink]
    x = (ri - ks) / (rg * ((1 - ks) * (1 - KI) + KI * (ri - ks)))
    return np.clip(x, 1e-6, 1.0)


def cy_forward(t2, ks):
    rg = cy_paper(ks)
    return ks + (1 - ks) * (1 - KI) * rg * t2 / (1 - KI * rg * t2)


def beer_t(ink):
    return np.clip(om.S[ink] / om.S["paper"], 1e-6, 1.0)


def predict(model, films):
    """films: {ink: weight}. Returns a reflectance spectrum on paper."""
    if model == "beer":
        return om.S["paper"] * np.exp(sum(w * np.log(beer_t(k)) for k, w in films.items()))
    ks = 0.0 if model == "clapper-yule" else 0.04
    return cy_forward(np.exp(sum(w * np.log(cy_t2(k, ks)) for k, w in films.items())), ks)


def race():
    out = {}
    for model in ("multiply", "beer", "clapper-yule", "clapper-yule-ks04"):
        rows = {}
        for k, meas in om.MEASURED.items():
            a, b = k.split("+")
            h = om.rgb_multiply(a, b) if model == "multiply" else om.refl_to_hex(predict(model, {a: 1, b: 1}))
            rows[k] = {"hex": h, "dE00": round(om.scores(h, meas)[1], 2)}
        e = [r["dE00"] for r in rows.values()]
        out[model] = {"overlaps": rows, "mean_dE00": round(float(np.mean(e)), 2), "median_dE00": round(float(np.median(e)), 2)}
    base = out["multiply"]["median_dE00"]
    best = min(out, key=lambda m: out[m]["median_dE00"])
    winner = best if best != "multiply" and base - out[best]["median_dE00"] >= 1.0 else "multiply"
    return out, winner


def colour_of(model, films):
    if model == "multiply":  # per-channel multiply generalised to weights, in linear sRGB
        lin = lambda h: colour.cctf_decoding(om.hex_rgb(h), function="sRGB")
        p = lin(om.INKS["paper"])
        v = p * np.prod([(np.clip(lin(om.INKS[k]) / p, 1e-6, 1)) ** w for k, w in films.items()], axis=0)
        rgb = np.clip(colour.cctf_encoding(np.clip(v, 0, 1), function="sRGB"), 0, 1)
        return "#" + "".join(f"{int(round(c * 255)):02x}" for c in rgb)
    return om.refl_to_hex(predict(model, films))


def film_hex(d, theta_deg=0.0, n2=1.38):
    wl = om.WL
    ct = np.sqrt(1 - (np.sin(np.radians(theta_deg)) / n2) ** 2)
    r1, r2 = (1 - n2) / (1 + n2), (n2 - 1) / (n2 + 1)
    de = 4 * np.pi * n2 * d * ct / wl
    r = (r1 ** 2 + r2 ** 2 + 2 * r1 * r2 * np.cos(de)) / (1 + r1 ** 2 * r2 ** 2 + 2 * r1 * r2 * np.cos(de))
    xyz = colour.sd_to_XYZ(colour.SpectralDistribution(dict(zip(wl, r * 8))), cmfs=om.CMFS, illuminant=om.D65) / 100
    rgb = np.clip(colour.XYZ_to_sRGB(np.clip(xyz, 0, None)), 0, 1)
    return "#" + "".join(f"{int(round(c * 255)):02x}" for c in rgb)


def ml_hex(g):
    t = np.sin(np.pi * g / om.WL) ** 2
    xyz = colour.sd_to_XYZ(colour.SpectralDistribution(dict(zip(om.WL, t))), cmfs=om.CMFS, illuminant=om.D65) / 100
    rgb = np.clip(colour.XYZ_to_sRGB(np.clip(xyz, 0, None)), 0, 1)
    return "#" + "".join(f"{int(round(c * 255)):02x}" for c in rgb)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="world/site/crossover/icon-palette.json")
    args = ap.parse_args()
    scores, winner = race()
    films = {**{k: {k: 1.0} for k in INKS5}, **KEYS}
    names = list(films)
    pal = {"paper": om.INKS["paper"], "model": winner, "race": scores,
           "kill_rule": "replace per-channel multiply only if median CIEDE2000 improves by 1.0 or more",
           "ink": {n: colour_of(winner, films[n]) for n in names}, "over": {}}
    for r in (2, 3):
        for combo in itertools.combinations_with_replacement(names, r):
            mix = {}
            for n in combo:
                for k, w in films[n].items():
                    mix[k] = mix.get(k, 0) + w
            pal["over"]["+".join(combo)] = colour_of(winner, mix)
    pal["film"] = {"n": 1.38, "step_nm": 10, "head_on": [film_hex(d) for d in range(0, 1201, 10)],
                   "at_45": [film_hex(d, 45) for d in range(0, 1201, 10)]}
    pal["michel_levy"] = {"step_nm": 10, "ramp": [ml_hex(g) for g in range(0, 1701, 10)]}
    Path(args.out).write_text(json.dumps(pal, indent=1))
    for m, s in scores.items():
        print(f"{m:18s} mean {s['mean_dE00']:5.2f}  median {s['median_dE00']:5.2f}  " + "  ".join(f"{k} {v['dE00']}" for k, v in s["overlaps"].items()))
    print("winner:", winner, "->", args.out)


if __name__ == "__main__":
    sys.exit(main())
