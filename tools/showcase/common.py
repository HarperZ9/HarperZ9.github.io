"""Shared pieces of the offline showcase renders (tools/showcase).

Spectra come from the materials library on its 81-sample grid (380 to 780 nm, 5 nm): measured n and k, the
CIE 1931 2-degree CMFs. Lights are the same models the live hero bins (scripts/build-hero-spectra.py). The grade
is the hero's: soft-knee bloom, red-first halation, the raw film chain's crosstalk, the Colour Core log-stop curve
per channel, sRGB. GPU energy comes from NVML's total-energy counter (tools/joules/nvml.py).

Paths: MATERIALS_DIR (tools/materials), KERNELS_DIR (tools/kernels), JOULES_DIR (tools/joules).
"""
import importlib.util
import math
import os
import sys
import time
from pathlib import Path

import numpy as np
import torch

HERE = Path(__file__).resolve().parent
for env in ("MATERIALS_DIR", "KERNELS_DIR", "JOULES_DIR"):
    p = os.environ.get(env)
    if not p or not Path(p).is_dir():
        raise SystemExit(f"showcase: set {env} to the local tools folder")
    sys.path.insert(0, p)
sys.dont_write_bytecode = True
import materials as M  # noqa: E402
from materials.spectral import GRID, cmf  # noqa: E402

_spec = importlib.util.spec_from_file_location("hero_spectra", HERE.parent.parent / "scripts" / "build-hero-spectra.py")
HS = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(HS)

DEV = torch.device("cuda")
LAM = np.array(GRID, np.float64)
CMF = np.array(cmf(), np.float64)  # [81, 3]
W81 = CMF * 5.0 / (CMF[:, 1].sum() * 5.0)  # bins of 5 nm; equal-energy white -> Y = 1


def nk(mid):
    o = M.get(mid)["optics"]
    n = np.array(o["n"]["value"], np.float64)
    k = np.array((o.get("k") or {}).get("value") or [0.0] * len(n), np.float64)
    return n, k


def light(name):
    f = {"sodium": HS.hps_5nm, "filament": lambda nm: HS.planck(nm, 2700), "sun": HS.sun_low,
         "daylight": lambda nm: HS.planck(nm, 5772), "moon": HS.moon}[name]
    s = np.array([f(nm) for nm in GRID], np.float64)
    return s / (s * W81[:, 1]).sum()


def to_srgb_matrix(name):
    s = light(name)
    white = (s[:, None] * W81).sum(0)
    return np.array(HS.adapt_matrix(list(white / white[1])), np.float64)


class Energy:
    """GPU joules over a window from NVML's counter, plus wall time."""
    def __init__(self):
        spec = importlib.util.spec_from_file_location("nvml", Path(os.environ["JOULES_DIR"]) / "nvml.py")
        self.nvml = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.nvml)

    def __enter__(self):
        torch.cuda.synchronize()
        self.e0, self.t0 = self.nvml.total_energy_mj(), time.perf_counter()
        return self

    def __exit__(self, *a):
        torch.cuda.synchronize()
        e1 = self.nvml.total_energy_mj()
        self.seconds = time.perf_counter() - self.t0
        self.joules = None if (e1 is None or self.e0 is None) else (e1 - self.e0) / 1000.0


def tiles(W, H, T):
    for y0 in range(0, H, T):
        for x0 in range(0, W, T):
            yield x0, y0, min(T, W - x0), min(T, H - y0)


def pixel_uv(x0, y0, w, h, W, H):
    """uv in [0, 1], v up, at pixel centres of one tile of a W x H frame."""
    xs = (torch.arange(x0, x0 + w, device=DEV, dtype=torch.float32) + 0.5) / W
    ys = 1.0 - (torch.arange(y0, y0 + h, device=DEV, dtype=torch.float32) + 0.5) / H
    v, u = torch.meshgrid(ys, xs, indexing="ij")
    return u, v


# ---- the grade (same constants as the live hero's composite pass) ----
def _stops(L):
    s = torch.log2(torch.clamp(L, min=1e-6) / 0.18)
    sp, sn = torch.clamp(s, min=0), torch.clamp(-s, min=0)
    return (sp / (1 + 0.42 * 0.58 * sp) - sn / (1 + 0.55 * 0.22 * sn)) * (1 + 0.18 * 0.34)


def film_curve(x):
    w = 0.18 * 2 ** _stops(torch.tensor(11.2, device=x.device))
    return torch.clamp(0.18 * torch.exp2(_stops(x)) / w, 0, 1)


def encode(rgb):
    return torch.where(rgb <= 0.0031308, 12.92 * rgb, 1.055 * torch.clamp(rgb, min=0) ** (1 / 2.4) - 0.055)


XTALK = torch.tensor([[0.93, 0.05, 0.02], [0.03, 0.94, 0.03], [0.02, 0.04, 0.94]], dtype=torch.float32)


def bloom_field(small, sigma_px):
    """Separable gaussian on a small HDR image [3, h, w] (soft-knee bright pass applied first)."""
    l = small.max(0).values
    s = torch.clamp(l - 0.9 + 0.5, 0, 1.0)
    w = torch.maximum(s * s / 2.0, l - 0.9) / torch.clamp(l, min=1e-5)
    b = (small * w).unsqueeze(0)
    r = int(3 * sigma_px) + 1
    k = torch.exp(-0.5 * (torch.arange(-r, r + 1, device=small.device, dtype=torch.float32) / sigma_px) ** 2)
    k = (k / k.sum())
    b = torch.nn.functional.conv2d(torch.nn.functional.pad(b, (r, r, 0, 0), mode="replicate"), k.view(1, 1, 1, -1).repeat(3, 1, 1, 1), groups=3)
    b = torch.nn.functional.conv2d(torch.nn.functional.pad(b, (0, 0, r, r), mode="replicate"), k.view(1, 1, -1, 1).repeat(3, 1, 1, 1), groups=3)
    return b[0]


def grade_tile(hdr, b1, b2, bloom=0.2, halation=0.35, seed=0):
    """hdr, b1, b2: [3, h, w] linear sRGB; returns uint8 [h, w, 3]."""
    c = hdr + (b1 * 0.6 + b2 * 0.4) * bloom
    halo = torch.stack([b2[0], (b1[1] + b2[1]) * 0.5 * 0.45, b1[2] * 0.12])
    c = c + halo * halation
    c = torch.einsum("ij,jhw->ihw", XTALK.to(c.device), c)  # rows: the GLSL mat3 read column-major
    e = encode(film_curve(c))
    g = torch.Generator(device=c.device).manual_seed(seed)
    n = (torch.rand(e.shape[1:], generator=g, device=c.device) - torch.rand(e.shape[1:], generator=g, device=c.device)) / 255.0
    return torch.clamp((e + n) * 255.0 + 0.5, 0, 255).to(torch.uint8).permute(1, 2, 0)


def fresnel_dielectric(c, n):
    c = torch.clamp(c, 0, 1)
    t2 = n * n - (1 - c * c)
    w = torch.sqrt(torch.clamp(t2, min=0))
    rs, rp = (c - w) / (c + w), (n * n * c - w) / (n * n * c + w)
    return torch.where(t2 <= 0, torch.ones_like(c), 0.5 * (rs * rs + rp * rp))


def ggx(nh, a):
    d = nh * nh * (a * a - 1) + 1
    return a * a / (math.pi * d * d)


# ---- the frame loop: tiles into an HDR memmap, then the grade into an 8-bit memmap (both .npy on disk) ----
def to_rgb(xyz, M):
    """xyz [P, 3] -> linear sRGB [P, 3] through a light's adaptation matrix (row-major)."""
    return xyz @ torch.tensor(M, dtype=torch.float32, device=xyz.device).T


def render(shade, W, H, out_dir, name, tile=2048, exposure=1.0):
    """shade(u, v, px) -> linear sRGB [h, w, 3] for one tile (px: one pixel in uv units, for supersampling)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    hdr = np.lib.format.open_memmap(out_dir / f"{name}-{W}x{H}.hdr.npy", mode="w+", dtype=np.float16, shape=(H, W, 3))
    with Energy() as e:
        for x0, y0, w, h in tiles(W, H, tile):
            u, v = pixel_uv(x0, y0, w, h, W, H)
            rgb = shade(u, v, (1.0 / W, 1.0 / H)) * exposure
            hdr[y0:y0 + h, x0:x0 + w] = torch.clamp(rgb, 0, 6e4).half().cpu().numpy()
    hdr.flush()
    return hdr, {"render_s": round(e.seconds, 2), "render_J": None if e.joules is None else round(e.joules, 1)}


def finish(hdr, out_dir, name, bloom=0.2, halation=0.35, tile=2048):
    H, W, _ = hdr.shape
    f = max(1, W // 1920)
    hs, ws = H // f, W // f
    small = torch.zeros((3, hs, ws), device=DEV)
    for y0 in range(0, hs, 256):
        y1 = min(hs, y0 + 256)
        blk = torch.from_numpy(np.asarray(hdr[y0 * f:y1 * f, :ws * f], dtype=np.float32)).to(DEV)
        small[:, y0:y1] = blk.view(y1 - y0, f, ws, f, 3).mean((1, 3)).permute(2, 0, 1)
    b1, b2 = bloom_field(small, 4.0), bloom_field(small, 18.0)
    out = np.lib.format.open_memmap(Path(out_dir) / f"{name}-{W}x{H}.u8.npy", mode="w+", dtype=np.uint8, shape=(H, W, 3))
    with Energy() as e:
        for x0, y0, w, h in tiles(W, H, tile):
            c = torch.from_numpy(np.asarray(hdr[y0:y0 + h, x0:x0 + w], dtype=np.float32)).to(DEV).permute(2, 0, 1)
            gy = (torch.arange(y0, y0 + h, device=DEV) + 0.5) / H * 2 - 1
            gx = (torch.arange(x0, x0 + w, device=DEV) + 0.5) / W * 2 - 1
            yy, xx = torch.meshgrid(gy, gx, indexing="ij")
            grid = torch.stack([xx, yy], -1)[None]
            up = lambda b: torch.nn.functional.grid_sample(b[None], grid, mode="bilinear", align_corners=False)[0]  # noqa: E731
            out[y0:y0 + h, x0:x0 + w] = grade_tile(c, up(b1), up(b2), bloom, halation, seed=x0 * 7919 + y0).cpu().numpy()
    out.flush()
    return out, {"grade_s": round(e.seconds, 2), "grade_J": None if e.joules is None else round(e.joules, 1)}
