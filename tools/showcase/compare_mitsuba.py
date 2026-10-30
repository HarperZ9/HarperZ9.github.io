"""compare_mitsuba.py: spectral accuracy bar. Our spectral_shade kernel against Mitsuba 3 (scalar_spectral) on the
same inputs: a smooth metal plate under a constant D65 environment, seen at 0.5, 45 and 75 degrees, with each metal's
n(lambda) and k(lambda) from the materials library given to Mitsuba's conductor as tabulated spectra.

Both sides are normalised by a perfect mirror under the same light, so each result is the plate's reflectance colour
under D65 with Y_white = 1. The colour difference is CIEDE2000 (Sharma, Wu and Dalal 2005) in CIELAB with the D65
white. Mitsuba samples wavelengths stochastically, so its own noise floor is measured too: two seeds against each other.

  python compare_mitsuba.py [spp]      (MATERIALS_DIR, KERNELS_DIR set; needs mitsuba and numpy)
"""
import json
import math
import os
import sys

import numpy as np

for env in ("MATERIALS_DIR", "KERNELS_DIR"):
    sys.path.insert(0, os.environ[env])
sys.dont_write_bytecode = True
import mitsuba as mi  # noqa: E402
import materials as M  # noqa: E402
from materials.spectral import GRID  # noqa: E402
from kcore.ops import NumpyOps  # noqa: E402
from spectral_shade import kernel as S  # noqa: E402

METALS = ["gold", "copper", "silver", "aluminium", "brass", "chromium", "titanium", "iron"]
ANGLES = [0.5, 45.0, 75.0]  # 0.5, not 0: an exactly head-on orthographic ray returns NaN in this Mitsuba set-up


def lab(xyz, white):
    f = lambda t: t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29  # noqa: E731
    fx, fy, fz = (f(xyz[i] / white[i]) for i in range(3))
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de2000(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2); Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if C1p else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if C2p else 0.0
    dL, dC = L2 - L1, C2p - C1p
    dh = 0.0 if C1p * C2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360)
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hb = h1p + h2p if C1p * C2p == 0 else ((h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2)
    T = 1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb)) + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.2 * math.cos(math.radians(4 * hb - 63))
    Sl = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2); Sc = 1 + 0.045 * Cbp; Sh = 1 + 0.015 * Cbp * T
    Rt = -2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-(((hb - 275) / 25) ** 2))))
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def ours(mid, cos):
    inp = S.spectra(mid, mid, "D65")
    inp["wmix"] = np.zeros(1, np.float32); inp["cosi"] = np.array([cos], np.float32)
    return [float(v) for v in S.run(S.prepare(inp, NumpyOps()), NumpyOps())["xyz"][0]]


def spectrum(vals):
    return {"type": "irregular", "wavelengths": ", ".join(str(w) for w in GRID), "values": ", ".join(f"{v:.6g}" for v in vals)}


def mitsuba_xyz(bsdf, angle, spp, seed):
    th = math.radians(angle)
    scene = mi.load_dict({
        "type": "scene", "integrator": {"type": "path", "max_depth": 2},
        "sensor": {"type": "orthographic", "to_world": mi.ScalarTransform4f().look_at(origin=[0, 0, 3], target=[0, 0, 0], up=[0, 1, 0])
                   @ mi.ScalarTransform4f().scale([0.02, 0.02, 1]),
                   "film": {"type": "hdrfilm", "width": 8, "height": 8, "pixel_format": "xyz", "rfilter": {"type": "box"}},
                   "sampler": {"type": "independent", "sample_count": spp, "seed": seed}},
        "plate": {"type": "rectangle", "to_world": mi.ScalarTransform4f().rotate([0, 1, 0], angle), "bsdf": bsdf},
        "light": {"type": "constant", "radiance": {"type": "d65"}},
    })
    img = np.array(mi.render(scene))
    return img.reshape(-1, img.shape[-1])[:, :3].mean(0) / 1.0, th


def main(spp=4096):
    spp = int(spp)
    mi.set_variant("scalar_spectral")
    assert abs(de2000((50.0, 2.6772, -79.7751), (50.0, 0.0, -82.7485)) - 2.0425) < 1e-4  # Sharma 2005, pair 1
    rows, white_d65 = [], [0.95047, 1.0, 1.08883]
    for angle in ANGLES:
        mirror, _ = mitsuba_xyz({"type": "conductor", "material": "none"}, angle, spp, 1)
        for mid in METALS:
            o = M.get(mid)["optics"]
            bsdf = {"type": "conductor", "eta": spectrum(o["n"]["value"]), "k": spectrum(o["k"]["value"])}
            m1, _ = mitsuba_xyz(bsdf, angle, spp, 1); m2, _ = mitsuba_xyz(bsdf, angle, spp, 2)
            a = [float(v) for v in m1 / mirror[1]]; b = [float(v) for v in m2 / mirror[1]]
            ref_white = [float(v) for v in mirror / mirror[1]]
            us = ours(mid, math.cos(math.radians(angle)))
            d = de2000(lab(us, white_d65), lab(a, ref_white)); noise = de2000(lab(a, ref_white), lab(b, ref_white))
            rows.append({"metal": mid, "angle": angle, "ours_xyz": [round(v, 5) for v in us], "mitsuba_xyz": [round(v, 5) for v in a],
                         "dE00": round(d, 3), "mitsuba_seed_noise_dE00": round(noise, 3)})
            print(json.dumps(rows[-1]))
    worst = max(r["dE00"] for r in rows); mean = sum(r["dE00"] for r in rows) / len(rows)
    print(json.dumps({"summary": {"cases": len(rows), "mean_dE00": round(mean, 3), "max_dE00": worst,
                                  "max_noise_dE00": max(r["mitsuba_seed_noise_dE00"] for r in rows), "spp": spp, "mitsuba": mi.__version__}}))


if __name__ == "__main__":
    main(*sys.argv[1:2])
