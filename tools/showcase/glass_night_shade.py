"""glass_night_shade.py: per-pixel shading of the glass scene, a line-for-line port of the hero's scene shader
(world/site/hero/scene.js) with every optical quantity carried at 81 wavelengths. c is glass_night.context()."""
import math

import torch

from common import DEV, fresnel_dielectric, ggx

ALL = torch.arange(81, device=DEV)


def norm3(v):
    return v / torch.linalg.norm(v, dim=-1, keepdim=True)


def geo(c, uv, front):
    d = c.ray(uv); P = d.shape[0]
    g = dict(d=d, water=d[:, 1] < -1e-4, r=d.clone(), cosi=torch.ones(P, device=DEV), depth=torch.zeros(P, device=DEV),
             caus=torch.ones(P, device=DEV), gcaus=torch.ones(P, device=DEV), grefl=torch.zeros(P, device=DEV),
             glint=torch.zeros(P, device=DEV), rim=torch.zeros(P, device=DEV))
    w = g["water"]
    if not w.any():
        return g
    dw = d[w]; t = c.CAM["h"] / -dw[:, 1]; Pt = torch.tensor([0.0, c.CAM["h"], 0.0], device=DEV) + dw * t[:, None]
    xz = Pt[:, [0, 2]]; fade = 1 / (1 + 0.06 * Pt[:, 2]); e = c.size / 1024
    ex, ez = torch.tensor([e, 0.0], device=DEV), torch.tensor([0.0, e], device=DEV)
    h0, hx, hz, hxm, hzm = (c.sim_h(xz + o) for o in (0 * ex, ex, ez, -ex, -ez))
    grad = torch.stack([hx - hxm, hz - hzm], -1) / (2 * e) * 0.9 + c.swell_grad(xz)
    n = norm3(torch.stack([-grad[:, 0] * fade, torch.ones_like(fade), -grad[:, 1] * fade], -1))
    cos = torch.clamp(-(dw * n).sum(-1), min=0); r = dw + 2 * cos[:, None] * n; r[:, 1] = r[:, 1].abs()
    g["r"][w], g["cosi"][w] = r, cos
    depth = 0.35 + 0.045 * Pt[:, 2]; g["depth"][w] = depth
    lap = (hx + hxm + hz + hzm - 4 * h0) / (e * e) * 0.9
    g["caus"][w] = torch.clamp(1 / torch.clamp(1 + depth * 0.25 * lap * fade, min=0.25), 0.25, 4.0)
    hv = norm3(c.lamp[None] - dw)
    g["glint"][w] = ggx(torch.clamp((n * hv).sum(-1), min=0), 0.06 + 0.02 * Pt[:, 2] / 20)
    if front:
        fr = Pt[:, 2] < c.CAM["zg"]
        sel = fr & (r[:, 2] > 1e-3)
        if sel.any():
            Q = Pt[sel] + r[sel] * ((c.CAM["zg"] - Pt[sel, 2]) / r[sel, 2])[:, None]
            up = Q[:, 1] > 0; q = c.uv_of(Q)
            gl = c.glyph_at(q)[1] * up; rim = 1 - c.glyph_normal(q)[:, 2]
            idx = torch.nonzero(w).squeeze(1)[sel]
            g["grefl"][idx], g["rim"][idx] = gl, rim * up
        if c.lamp[2] > 1e-3 and fr.any():
            G = Pt[fr] + c.lamp[None] * ((c.CAM["zg"] - Pt[fr, 2]) / c.lamp[2])[:, None]; q = c.uv_of(G)
            tx = torch.tensor([3 / 1280, 0.0], device=DEV); ty = torch.tensor([0.0, 3 / 720], device=DEV)  # the hero's spacing
            lg = c.glyph_at(q + tx)[0] + c.glyph_at(q - tx)[0] + c.glyph_at(q + ty)[0] + c.glyph_at(q - ty)[0] - 4 * c.glyph_at(q)[0]
            g["gcaus"][torch.nonzero(w).squeeze(1)[fr]] = torch.clamp(1 - lg * 6, 0.4, 5.0)
    return g


def radiance(c, g, idx):
    """Spectral radiance [P, k] at the wavelength indices idx."""
    S = c.S
    out = c.sky(g["d"], idx)
    w = g["water"]
    if not w.any():
        return out
    cos = g["cosi"][w][:, None]; nw = S["nw"][idx][None]
    F = fresnel_dielectric(cos.expand(-1, idx.numel()), nw.expand(cos.shape[0], -1))
    refl = c.sky(g["r"][w], idx)
    gr = g["grefl"][w][:, None]
    refl = refl * (1 - gr) + gr * (refl * 0.7 + (S["SZ"][idx] * 0.3 + S["SH"][idx] * 0.5) * g["rim"][w][:, None] * c.FILL_W * 0.6)
    ct = torch.sqrt(torch.clamp(1 - (1 - cos * cos) / (nw * nw), min=0))
    depth = g["depth"][w][:, None]; path = depth + depth / torch.clamp(ct, min=0.05)
    E = S["SL"][idx] * 0.06 * (g["caus"][w] * g["gcaus"][w])[:, None] + (S["SZ"][idx] * 0.35 + S["SH"][idx] * 0.2) * 0.5
    floor = 0.32 / math.pi * E * torch.exp(-S["aw"][idx] * path)
    out[w] = F * refl + (1 - F) * floor + S["SL"][idx] * g["glint"][w][:, None] * F * 1.5
    return out


def slab_offset(nrm, n, T, D):
    """GLSL refract() twice: in through the curved front, out through the flat back; flag on total reflection."""
    i = torch.tensor([0.0, 0.0, -1.0], device=DEV).expand_as(nrm); eta = 1 / n
    ci = -(nrm * i).sum(-1); k = 1 - eta * eta * (1 - ci * ci)
    t1 = eta[:, None] * i + (eta * ci - torch.sqrt(torch.clamp(k, min=0)))[:, None] * nrm
    ci2 = -t1[:, 2]; k2 = 1 - n * n * (1 - ci2 * ci2)
    t2 = n[:, None] * t1 + (n * ci2 - torch.sqrt(torch.clamp(k2, min=0)))[:, None] * torch.tensor([0.0, 0.0, 1.0], device=DEV)
    off = t1[:, :2] / torch.clamp(-t1[:, 2:3], min=1e-3) * T[:, None] + t2[:, :2] / torch.clamp(-t2[:, 2:3], min=1e-3) * D
    tir = k2 < 0
    return torch.where(tir[:, None], t1[:, :2] / torch.clamp(-t1[:, 2:3], min=1e-3) * T[:, None], off), tir


def film_reflect(cos, nf, n, d, lam):
    c0 = torch.clamp(cos, 0, 1); s2 = 1 - c0 * c0
    c1 = torch.sqrt(torch.clamp(1 - s2 / (nf * nf), min=0)); c2 = torch.sqrt(torch.clamp(1 - s2 / (n * n), min=0))
    r01s, r12s = (c0 - nf * c1) / (c0 + nf * c1), (nf * c1 - n * c2) / (nf * c1 + n * c2)
    r01p, r12p = (nf * c0 - c1) / (nf * c0 + c1), (n * c1 - nf * c2) / (n * c1 + nf * c2)
    cd = torch.cos(4 * math.pi * nf * d * c1 / lam)
    Rs = (r01s ** 2 + r12s ** 2 + 2 * r01s * r12s * cd) / (1 + r01s ** 2 * r12s ** 2 + 2 * r01s * r12s * cd)
    Rp = (r01p ** 2 + r12p ** 2 + 2 * r01p * r12p * cd) / (1 + r01p ** 2 * r12p ** 2 + 2 * r01p * r12p * cd)
    return 0.5 * (Rs + Rp)


def glass(c, uv, nrm, h, edge):
    """XYZ [P, 3] of glass pixels at all 81 wavelengths; the scene behind at 41 knots (10 nm)."""
    S = c.S; d = c.ray(uv); P = uv.shape[0]
    nwv = torch.stack([nrm[:, 0], nrm[:, 1], -nrm[:, 2]], -1)
    film = 260.0 * edge * edge
    r = d - 2 * (d * nwv).sum(-1, keepdim=True) * nwv
    env = torch.where((r[:, 1:2] > 0), c.sky(r, ALL), c.sky(r * torch.tensor([1.0, -1.0, 1.0], device=DEV), ALL) * 0.25)
    spec = S["SL"][None] * (ggx(torch.clamp((nwv * norm3(c.lamp[None] - d)).sum(-1), min=0), 0.03) * 0.004 * c.LS[1])[:, None] \
        + S["SZ"][None] * (ggx(torch.clamp((nwv * norm3(c.fill[None] - d)).sum(-1), min=0), 0.12) * 0.02 * c.FILL_W)[:, None]
    xyz = torch.zeros((P, 3), device=DEV)
    for j in range(0, 81, 2):
        idx = ALL[j:j + 2]
        off, tir = slab_offset(nrm, S["ng"][j].expand(P), 0.05 * h, 0.32)
        behind = radiance(c, geo(c, uv + torch.stack([off[:, 0] / c.aspect, off[:, 1]], -1), False), idx)
        for q, li in enumerate(idx.tolist()):
            F = film_reflect(nrm[:, 2], 1.38, S["ng"][li], film, S["lam"][li])
            bh = torch.where(tir, env[:, li] * 0.5, behind[:, q])
            L = F * (env[:, li] + spec[:, li]) + (1 - F) * torch.exp(-S["ag"][li] * 0.3 * h) * bh
            xyz += L[:, None] * S["W"][li][None]
    return xyz


def shader(c, samples=1):
    water_uv = c.CAM["s0"] - c.CAM["h"] * c.CAM["f"] / c.CAM["zg"]

    def shade(u, v, px):
        h, w = u.shape
        acc = torch.zeros((h * w, 3), device=DEV)
        for sy in range(samples):
            for sx in range(samples):
                uv = torch.stack([(u + ((sx + 0.5) / samples - 0.5) * px[0]).reshape(-1), (v + ((sy + 0.5) / samples - 0.5) * px[1]).reshape(-1)], -1)
                g = geo(c, uv, True)
                xyz = radiance(c, g, ALL) @ c.S["W"]
                gl = c.glyph_at(uv); a = gl[1]; sel = a > 0.003
                if sel.any():
                    us = uv[sel]; nrm = c.glyph_normal(us); edge = torch.clamp((1 - nrm[:, 2]) * 3, 0, 1)
                    xg = glass(c, us, nrm, gl[0][sel], edge)
                    under = g["water"][sel] & (us[:, 1] < water_uv)
                    if under.any():   # the part of the rod below the waterline, seen through the surface
                        k = (torch.exp(-c.S["aw"] * 1.5)[None] * (1 - fresnel_dielectric(g["cosi"][sel][under][:, None].expand(-1, 81), c.S["nw"][None].expand(int(under.sum()), -1)))) @ c.S["W"] / c.S["W"].sum(0)
                        xg[under] = xg[under] * k
                    xyz[sel] = xyz[sel] * (1 - a[sel, None]) + xg * a[sel, None]
                acc += xyz
        rgb = torch.clamp(acc / samples ** 2 @ c.Mx.T, min=0) * c.EXPOSURE
        return rgb.reshape(h, w, 3)
    return shade
