"""glass_night.py: the hero's scene offline, at 81 wavelengths (5 nm) instead of 8 bins.

The name as N-BK7 rods on the waterline at night, a high-pressure sodium lamp behind the "p", moonlit sky. Same
camera, optics and grade as the live hero (world/site/hero/scene.js). What is finer here:
  - every optical quantity at all 81 wavelengths: n and k of N-BK7 and water, the sodium SPD, the CIE CMFs;
  - the refracted geometry under the glass at 41 wavelengths (10 nm), each shared by its two 5 nm neighbours;
  - the water: the same wave equation at 1024 x 1024 after a seeded history of drops, plus capillary-gravity
    waves with omega^2 = g k + (sigma / rho) k^3, sigma from the materials record (0.07275 N/m), so ripples
    stay sharp at 16K;
  - the glyph height field from the 8K field (glyph_field.py), sampled bicubic.
"""
import math

import numpy as np
import torch
import torch.nn.functional as Fn

from common import DEV, LAM, W81, M, light, nk, to_srgb_matrix, fresnel_dielectric, ggx

CAM = dict(h=1.0, zg=12.0, f=1.6, s0=0.42)
T = 2.0
SIGMA = M.get("water")["surface"]["surface_tension"]["value"]  # N/m
RHO = 998.0


def t32(a):
    return torch.tensor(np.asarray(a, np.float32), device=DEV)


def norm3(v):
    return v / torch.linalg.norm(v, dim=-1, keepdim=True)


def wave_sim(n=1024, size=24.0, seed=21):
    """The hero's wave equation (leapfrog, Courant 0.5, damping 0.996) after a seeded history of drops."""
    g = torch.Generator(device="cpu").manual_seed(seed)
    h = torch.zeros((n, n), device=DEV); hp = torch.zeros_like(h)
    yy, xx = torch.meshgrid((torch.arange(n, device=DEV) + 0.5) / n, (torch.arange(n, device=DEV) + 0.5) / n, indexing="ij")
    def drop(u, v, s):
        dx = xx - u; dz = yy - v; dx -= torch.floor(dx + 0.5); dz -= torch.floor(dz + 0.5)
        return s * torch.exp(-(dx * dx + dz * dz) / 0.006 ** 2)
    for k in range(40):
        h = h + drop(float(torch.rand(1, generator=g)), float(torch.rand(1, generator=g)) * 0.6, -0.08 * (0.5 + float(torch.rand(1, generator=g))))
        for _ in range(int(4 * n / 256)):
            lap = torch.roll(h, 1, 0) + torch.roll(h, -1, 0) + torch.roll(h, 1, 1) + torch.roll(h, -1, 1) - 4 * h
            h, hp = (2 * h - hp + 0.25 * lap) * 0.996, h
    return h[None, None], size


WAVES = []  # (dir x, dir z, k, amplitude, phase): gravity swell plus capillary-gravity ripples
_rng = np.random.default_rng(7)
for k in np.geomspace(0.9, 90.0, 24):
    a = _rng.uniform(-0.6, 0.6) + (0.6 if k < 4 else 0.0)
    WAVES.append((math.sin(a), math.cos(a), float(k), 0.012 / k * (1.0 if k < 4 else 0.35), float(_rng.uniform(0, 2 * math.pi))))


def swell_grad(xz):
    s = torch.zeros_like(xz)
    for dx, dz, k, a, ph in WAVES:
        w = math.sqrt(9.81 * k + SIGMA / RHO * k ** 3)
        c = torch.cos(k * (dx * xz[:, 0] + dz * xz[:, 1]) - w * T + ph) * (k * a)
        s[:, 0] += dx * c; s[:, 1] += dz * c
    return s


def context(W, H, field_path):
    aspect = W / H
    fld = np.load(field_path)
    lamp_x, rod = float(fld[2, 0, 0]), float(fld[2, 0, 1])
    glyph = torch.from_numpy(fld[:2].astype(np.float32)).to(DEV)[None]
    GH, GW = fld.shape[1:]
    tex = (1.0 / GW, 1.0 / GH)
    sim, size = wave_sim()
    nb, kb = nk("bk7"); nw, kw = nk("water")
    S = dict(ng=t32(nb), nw=t32(nw), aw=t32(4 * np.pi * kw / (LAM * 1e-9)), ag=t32(4 * np.pi * kb / (LAM * 1e-9)), lam=t32(LAM))
    SL = light("sodium"); moon = light("moon") * (LAM / 550.0) ** -4
    SZ = moon / (moon * W81[:, 1]).sum() * 0.05; SH = SL * 0.16
    S.update(SL=t32(SL), SZ=t32(SZ), SH=t32(SH), W=t32(W81))
    Mx = torch.tensor(to_srgb_matrix("sodium"), dtype=torch.float32, device=DEV)
    ly = CAM["s0"] + 0.018
    lamp = norm3(torch.tensor([(lamp_x - 0.5) * aspect, ly - CAM["s0"], CAM["f"]], device=DEV))
    fill = norm3(torch.tensor([-0.45, 0.55, -0.7], device=DEV))
    LS = (0.006, 700.0, 5.0, 0.86); FILL_W = 2.5; EXPOSURE = 1.25

    def ray(uv):
        return norm3(torch.stack([(uv[:, 0] - 0.5) * aspect, uv[:, 1] - CAM["s0"], torch.full_like(uv[:, 0], CAM["f"])], -1))

    def uv_of(q):
        return torch.stack([q[:, 0] * CAM["f"] / q[:, 2] / aspect + 0.5, (q[:, 1] - CAM["h"]) * CAM["f"] / q[:, 2] + CAM["s0"]], -1)

    def sample(img, uv, wrap=False):
        if wrap:
            uv = uv - torch.floor(uv)
        g = (uv * 2 - 1).view(1, -1, 1, 2)
        return Fn.grid_sample(img, g, mode="bicubic", padding_mode="border", align_corners=False)[0, :, :, 0]

    def sim_h(xz):
        return sample(sim, torch.stack([xz[:, 0] / size + 0.5, xz[:, 1] / size], -1), wrap=True)[0]

    def glyph_at(uv):
        return sample(glyph, uv)   # [2, P]

    def glyph_normal(uv):
        ex, ey = torch.tensor([tex[0], 0.0], device=DEV), torch.tensor([0.0, tex[1]], device=DEV)
        hx = glyph_at(uv + ex)[0] - glyph_at(uv - ex)[0]; hy = glyph_at(uv + ey)[0] - glyph_at(uv - ey)[0]
        return norm3(torch.stack([-hx * rod * 0.5, -hy * rod * 0.5, torch.ones_like(hx)], -1))

    def lamp_term(d):
        c = d @ lamp; ang = torch.acos(torch.clamp(c, -1, 1))
        t = torch.clamp((ang - LS[0] * 1.2) / (LS[0] * 0.8 - LS[0] * 1.2), 0, 1)
        g = LS[3]
        return t * t * (3 - 2 * t) * LS[1] + LS[2] * (1 - g * g) / (1 + g * g - 2 * g * c) ** 1.5 * 0.0005

    def sky(d, idx):   # [P, k]
        e = torch.clamp(d[:, 1:2], min=0)
        return S["SH"][idx] * torch.exp(-e / 0.07) * 0.55 + S["SZ"][idx] * (0.18 + 0.82 * (1 - torch.exp(-e / 0.3))) * 0.35 + S["SL"][idx] * lamp_term(d)[:, None]
    from types import SimpleNamespace
    return SimpleNamespace(**{k: v for k, v in locals().items() if k != "SimpleNamespace"}, CAM=CAM, swell_grad=swell_grad)


def make_shader(W, H, samples, field_path):
    from glass_night_shade import shader   # the per-pixel shading, split out for length
    return shader(context(W, H, field_path), samples)
