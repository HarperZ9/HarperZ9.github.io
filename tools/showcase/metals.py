"""metals.py: two scenes shaded by the fused spectral_shade kernel (tools/kernels, bit-identical CPU and GPU).

  metals   eight measured metals as polished spheres on black N-BK7 glass, in a studio: a 2700 K filament
           softbox, a 5772 K daylight strip and a faint daylight dome
  packing  the same metals in hexagonal close packing, a second layer resting in the hollows

Every metal and the glass floor are shaded by spectral_shade: n(lambda) and k(lambda) on 81 wavelengths, the
exact unpolarised Fresnel term at the pixel's incidence, integrated with each light's spectrum and the CIE 1931
observer. A direction's environment is a weighted sum of the lights, so a pixel's XYZ is the same weighted sum of
one kernel call per light. One bounce: a sphere seen in another sphere is dimmed, not re-shaded; the floor's
reflection of a sphere takes N-BK7's Fresnel at 550 nm as a scalar (N-BK7 varies under 4 % across the band).
"""
import math

import numpy as np
import torch

from common import CMF, DEV, light, nk, to_srgb_matrix
from kcore.ops import TorchOps
from spectral_shade import fused

OPS = TorchOps("cuda")
METALS = ["gold", "copper", "silver", "aluminium", "brass", "chromium", "titanium", "iron"]
F32 = lambda a: torch.tensor(np.asarray(a, np.float32), device=DEV)  # noqa: E731


class Kernel:
    def __init__(self, lights):
        self.cmf = F32(CMF)
        self.L = {k: F32(light(k)) for k in lights}
        self.norm = {k: fused.host_norm({"light": np.asarray(light(k), np.float32), "cmf": np.asarray(CMF, np.float32)}) for k in lights}
        self.m = {mid: tuple(F32(a) for a in nk(mid)) for mid in METALS + ["bk7"]}
        self.one = torch.tensor(1.0, device=DEV)

    def __call__(self, mid, cosi, lname):
        n, k = self.m[mid]
        d = {"wmix": torch.zeros_like(cosi), "cosi": cosi.contiguous(), "nA": n, "kA": k, "nB": n, "kB": k,
             "light": self.L[lname], "cmf": self.cmf, "n_out": self.one}
        return fused.run(d, OPS, self.norm[lname])["xyz"]


def smooth(e0, e1, x):
    t = torch.clamp((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def norm3(v):
    return v / torch.linalg.norm(v, dim=-1, keepdim=True)


KEY, RIM = norm3(torch.tensor([-0.55, 0.62, -0.55])), norm3(torch.tensor([0.85, 0.3, 0.45]))


def env(r):
    """Weights per light (Y units) for directions r [P, 3]: filament key softbox; daylight strip and dome."""
    k, s = KEY.to(r.device), RIM.to(r.device)
    ak = torch.acos(torch.clamp(r @ k, -1, 1))
    key = 3.2 * smooth(0.75, 0.55, ak)
    az, az0 = torch.atan2(r[:, 0], r[:, 2]), math.atan2(float(s[0]), float(s[2]))
    rim = 2.5 * smooth(0.16, 0.10, (az - az0).abs()) * smooth(0.75, 0.5, (r[:, 1] - float(s[1])).abs())
    dome = 0.12 + 0.38 * torch.clamp(r[:, 1], 0, 1) ** 0.7
    below = r[:, 1] < 0
    return {"filament": torch.where(below, key * 0.04, key), "daylight": torch.where(below, 0.004 + rim * 0.04, rim + dome)}


def hit_spheres(o, d, S, skip=None):
    """Nearest sphere hit: t [P], index [P] (-1 for none). S: [n, 4] centre and radius."""
    best_t = torch.full(d.shape[:1], 1e9, device=DEV)
    best_i = torch.full(d.shape[:1], -1, device=DEV, dtype=torch.long)
    for i in range(S.shape[0]):
        oc = o - S[i, :3]
        b = (oc * d).sum(-1)
        c = (oc * oc).sum(-1) - S[i, 3] ** 2
        disc = b * b - c
        t = -b - torch.sqrt(torch.clamp(disc, min=0))
        ok = (disc > 0) & (t > 1e-4) & (t < best_t)
        if skip is not None:
            ok &= skip != i
        best_t, best_i = torch.where(ok, t, best_t), torch.where(ok, torch.full_like(best_i, i), best_i)
    return best_t, best_i


def scene(name):
    if name == "metals":
        S = [(-1.65, 0.5, -0.2, 0.5), (-0.55, 0.5, -0.2, 0.5), (0.55, 0.5, -0.2, 0.5), (1.65, 0.5, -0.2, 0.5),
             (-1.1, 0.5, 0.95, 0.5), (0.0, 0.5, 0.95, 0.5), (1.1, 0.5, 0.95, 0.5), (0.0, 0.28, -1.05, 0.28)]
        mats = METALS
        cam = dict(eye=(0.0, 1.15, -5.6), at=(0.0, 0.45, 0.25), fov=30.0)
    else:
        r, S, mats = 0.25, [], []
        for j in range(9):
            for i in range(13):
                x, z = (i - 6 + 0.5 * (j % 2)) * 2 * r, (j - 4) * math.sqrt(3) * r
                S.append((x, r, z, r)); mats.append(METALS[(i + 2 * j) % 3])
        for j in range(5):
            for i in range(6 - (j % 2)):
                x, z = (i - 2.5 + 0.5 * (j % 2)) * 2 * r, (j - 2) * math.sqrt(3) * r + r / math.sqrt(3) * 2
                S.append((x, r + 2 * r * math.sqrt(2 / 3), z - math.sqrt(3) * r / 3, r)); mats.append(METALS[3 + (i + j) % 5])
        cam = dict(eye=(0.0, 3.4, -3.3), at=(0.0, 0.1, 0.35), fov=42.0)
    return torch.tensor(S, device=DEV, dtype=torch.float32), mats, cam


def make_shader(name, samples=2):
    S, mats, cam = scene(name)
    K = Kernel(["filament", "daylight"])
    Ms = {k: to_srgb_matrix(k) for k in ("filament", "daylight")}
    M = torch.tensor((Ms["filament"] + Ms["daylight"]) / 2, dtype=torch.float32, device=DEV)  # balance between the two
    eye, at = torch.tensor(cam["eye"], device=DEV), torch.tensor(cam["at"], device=DEV)
    fwd = norm3(at - eye); right = norm3(torch.linalg.cross(torch.tensor([0.0, 1.0, 0.0], device=DEV), fwd)); up = torch.linalg.cross(fwd, right)
    tanh = math.tan(math.radians(cam["fov"]) / 2)
    f_bk7 = 0.0424  # N-BK7 at 550 nm, normal incidence; scaled by Schlick toward grazing below

    def lit(mid_of, idx, cos, r):
        """XYZ of a mirror hit: per material, one kernel call per light, weighted by the environment."""
        out = torch.zeros((cos.shape[0], 3), device=DEV)
        w = env(r)
        for m in sorted(set(mid_of)):
            sel = torch.isin(idx, torch.tensor([i for i, x in enumerate(mid_of) if x == m], device=DEV))
            if sel.any():
                c = cos[sel]
                out[sel] = sum(K(m, c, ln)[...] * w[ln][sel, None] for ln in ("filament", "daylight"))
        return out

    def shade(u, v, px):
        h, w = u.shape
        acc = torch.zeros((h * w, 3), device=DEV)
        for sy in range(samples):
            for sx in range(samples):
                uu = (u + (sx + 0.5) / samples * px[0] - px[0] / 2).reshape(-1)
                vv = (v + (sy + 0.5) / samples * px[1] - px[1] / 2).reshape(-1)
                asp = px[1] / px[0]
                d = norm3(fwd + right * ((uu - 0.5) * 2 * tanh * asp)[:, None] + up * ((vv - 0.5) * 2 * tanh)[:, None])
                o = eye.expand_as(d)
                t, i = hit_spheres(o, d, S)
                xyz = torch.zeros_like(d)
                # spheres
                hs = i >= 0
                if hs.any():
                    p = o[hs] + d[hs] * t[hs, None]; n = norm3(p - S[i[hs], :3]); c = torch.clamp(-(d[hs] * n).sum(-1), 0, 1)
                    r = d[hs] + 2 * c[:, None] * n
                    _, j = hit_spheres(p + n * 1e-3, r, S, skip=i[hs])
                    val = lit(mats, i[hs], c, r)
                    xyz[hs] = torch.where((j >= 0)[:, None], val * 0.08, val)
                # floor of black N-BK7 at y = 0
                tf = -o[:, 1] / d[:, 1]
                fl = (~hs) & (d[:, 1] < 0)
                if fl.any():
                    p = o[fl] + d[fl] * tf[fl, None]; c = torch.clamp(-d[fl, 1], 0, 1)
                    r = d[fl] * torch.tensor([1.0, -1.0, 1.0], device=DEV)
                    t2, j = hit_spheres(p + torch.tensor([0, 1e-3, 0], device=DEV), r, S)
                    floor_env = K("bk7", c, "filament") * env(r)["filament"][:, None] + K("bk7", c, "daylight") * env(r)["daylight"][:, None]
                    sph = j >= 0
                    if sph.any():
                        q = p[sph] + r[sph] * t2[sph, None]; n2 = norm3(q - S[j[sph], :3]); c2 = torch.clamp(-(r[sph] * n2).sum(-1), 0, 1)
                        F = f_bk7 + (1 - f_bk7) * (1 - c[sph]) ** 5
                        floor_env[sph] = lit(mats, j[sph], c2, r[sph] + 2 * c2[:, None] * n2) * F[:, None]
                    # contact shade: the faint diffuse of the glass, occluded toward the key
                    _, occ = hit_spheres(p + torch.tensor([0, 1e-3, 0], device=DEV), KEY.to(DEV).expand_as(p), S)
                    xyz[fl] = floor_env + torch.where((occ >= 0)[:, None], 0.0, 0.012) * torch.tensor([0.98, 1.0, 0.75], device=DEV)
                sky = (~hs) & (d[:, 1] >= 0)
                xyz[sky] = (env(d[sky])["daylight"][:, None] * 0.5) * torch.tensor([0.9505, 1.0, 1.089], device=DEV)
                acc += xyz
        return (acc / samples ** 2 @ M.T).reshape(h, w, 3)
    return shade
