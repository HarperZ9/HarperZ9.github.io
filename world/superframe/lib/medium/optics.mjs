// lib/medium/optics.mjs: how light moves through the tank, for the render.
//   water    an underwater fog: what is seen at depth d keeps exp(-sigma d) of its light per channel (red lost first,
//            blue last) and the rest is replaced by the deep water's own colour lit by what light reaches it, so the
//            tank is warm and clear under the surface and deepens to green-blue (Kitada's underwater paintings)
//   shafts   the caustic density field read twice: as light on the wall and the floor (a network, sharpest on the
//            floor), and as in-scattered light in the water column, so the shafts are seen in the water itself
//   mirror   the underside of the surface seen from slightly below: total internal reflection makes it a mirror of
//            the water beneath, except where a wave face tilts the surface enough to open Snell's window to the sky
//   lens     a glass sphere resting in the sediment: an inverted, reduced image of what is behind it, a dark refracting
//            rim, a Fresnel edge and highlight, and the light it focuses on the floor beside it
import { bilerp, clamp } from './grid.mjs';

// the output window: which part of the tank (tank units, x0 y0 x1 y1) fills a W x H raster. g(x, y) is the grid
// point under pixel (x, y); p(gx, gy) the pixel over a grid point; cx, cy are pixels per grid cell
export function viewport(m, W, H, view = [0, 0, 1, 1]) {
  const [x0, y0, x1, y1] = view, cx = W / (m.nx * (x1 - x0)), cy = H / (m.ny * (y1 - y0)), ox = x0 * m.nx, oy = y0 * m.ny;
  return { W, H, cx, cy, g: (x, y) => [ox + (x + 0.5) / cx - 0.5, oy + (y + 0.5) / cy - 0.5], p: (gx, gy) => [(gx + 0.5 - ox) * cx, (gy + 0.5 - oy) * cy] };
}

export const hexLin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };

// caustic density per cell: rays from above refract through the surface slope and land below (mean about 1)
export function caustics(m) {
  const { nx, ny } = m, C = new Float32Array(nx * ny), per = 10;
  for (let i = 0; i < nx; i++) for (let s = 0; s < per; s++) {
    const x = i + (s + 0.5) / per, a = clamp(Math.floor(x), 1, nx - 2), slope = (m.h[a + 1] - m.h[a - 1]) / 2, ys = m.surfaceY(a), jit = 0.06 * Math.sin(i * 12.9898 + s * 78.233) * Math.sin(i * 0.7 + s);
    for (let j = Math.ceil(ys); j < ny; j++) { const X = x + (j - ys) * (slope * 1.5 + 0.08 + jit) - 0.5, i0 = Math.floor(X), f = X - i0; if (i0 >= 0 && i0 < nx - 1) { C[j * nx + i0] += (1 - f) / per; C[j * nx + i0 + 1] += f / per; } }
  }
  for (let pass = 0; pass < 3; pass++) { const T = Float32Array.from(C); for (let j = 0; j < ny; j++) for (let i = 1; i < nx - 1; i++) C[j * nx + i] = (T[j * nx + i - 1] + 2 * T[j * nx + i] + T[j * nx + i + 1]) / 4; }
  return C;
}

// the light a point in the water receives and how much of it reaches the eye: depth below the surface in tank units
export function waterLight(m, C, look, gx, gy, surf) {
  const depth = clamp((gy - surf) / m.ny, 0, 1), c = bilerp(C, m.nx, m.ny, gx, gy), fade = Math.exp(-1.6 * depth) * clamp(depth / 0.035, 0.35, 1);
  const shaft = 1 + (c - 1) * look.shafts * fade;                    // light on a surface at this depth
  const T = look.sigma.map(s => Math.exp(-s * (depth + look.thickness)));
  return { depth, shaft, T, c, fade };
}

// what is seen at that point: surface colour lit by the shafts, then the water between it and the eye
// the scattered light is warm where the sun is still strong (just under the surface) and the deep colour below
export function fog(look, deep, sun, rgb, W) {
  const warm = look.warmLin, f = W.fade ** 1.5;
  return rgb.map((v, k) => v * W.shaft * sun[k] * W.T[k] + (warm[k] * f + deep[k] * (1 - f)) * (1 - W.T[k]) * (0.6 + 0.4 * W.fade * (0.55 + 0.45 * W.c)));
}

// the underside of the surface, drawn over the rendered water in a band under the front waterline
export function mirrorBand(m, R, look, vp) {
  const { w: W, h: H } = R, d = R.data, bh = Math.max(3, m.ny * vp.cy * look.mirror), sky = hexLin(look.airLow);
  const src = Float32Array.from(d);
  for (let x = 0; x < W; x++) {
    const gx = vp.g(x, 0)[0], ci = clamp(Math.floor(gx), 1, m.nx - 2), t0 = clamp(gx - ci, 0, 1);
    const ys = vp.p(0, m.surfaceY(ci) * (1 - t0) + m.surfaceY(ci + 1) * t0 - 0.5)[1], sl = i => (m.h[clamp(i + 1, 0, m.nx - 1)] - m.h[clamp(i - 1, 0, m.nx - 1)]) * 0.5, slope = sl(ci) * (1 - t0) + sl(ci + 1) * t0;
    const open = clamp((Math.abs(slope) * 2.2 - 0.25) / 0.5, 0, 1);  // a steep wave face opens Snell's window
    for (let y = Math.max(0, Math.ceil(ys)); y < Math.min(H, ys + bh); y++) {
      const t = (y - ys) / bh, ym = Math.round(clamp(ys + bh + (ys + bh - y) * 1.8 + Math.sin(x * 0.02 + y * 0.3) * 2, 0, H - 1)), o = 4 * (y * W + x), s = 4 * (ym * W + x);
      const edge = Math.sin(Math.PI * clamp(t, 0, 1)) ** 0.6, win = open * (1 - t) * 0.9, a = 0.85 * edge;
      for (let k = 0; k < 3; k++) { const refl = src[s + k] * 0.92, seen = refl * (1 - win) + sky[k] * 1.08 * win; d[o + k] = src[o + k] * (1 - a) + seen * a; }
    }
  }
}

// a glass sphere: returns the colour over (gx, gy) or null outside every lens. behind(sx, sy) samples the scene
export function lensOver(m, c, gx, gy, vp, behind, look) {
  for (const g of m.glass) {
    const ex = ((gx + 0.5) / m.nx - g.x) / g.rx, ey = ((gy + 0.5) / m.ny - g.y) / g.ry, r = Math.hypot(ex, ey);
    const pr = 0.75 / Math.min(vp.cx * m.nx * g.rx, vp.cy * m.ny * g.ry), cov = clamp((1 - r) / pr + 0.5, 0, 1);
    if (cov <= 0) continue;
    const rr = Math.min(1, r), z = Math.sqrt(Math.max(0, 1 - rr * rr));
    // a ball lens inverts and reduces; toward the rim the bending grows, so the image compresses there (fisheye)
    const k = -1.05 - 0.6 * (1 - z), out = [0, 0, 0];
    for (let ch = 0; ch < 3; ch++) { const disp = 1 + (ch - 1) * 0.012 * rr * rr; const sx = (g.x + ex * g.rx * k * disp) * m.nx - 0.5, sy = (g.y + ey * g.ry * k * disp) * m.ny - 0.5; out[ch] = behind(sx, sy)[ch]; }
    const fres = 0.04 + 0.96 * (1 - z) ** 5, dark = clamp((rr - 0.78) / 0.2, 0, 1) * (1 - clamp((rr - 0.97) / 0.03, 0, 1));
    const sky = hexLin(look.airLow), tint = [0.94, 0.99, 0.96];
    // highlights: the window above mirrored in the upper rim, and a sharp spot where the sun's ray reflects
    const spot = Math.exp(-(((ex + 0.38) / 0.16) ** 2 + ((ey + 0.5) / 0.1) ** 2)), arc = clamp(1 - Math.abs(rr - 0.9) / 0.06, 0, 1) * clamp(-ey, 0, 1);
    const glass = out.map((v, ch) => v * tint[ch] * (1 - 0.65 * dark) * (1 - fres) + sky[ch] * fres * 1.1 + 0.9 * spot + 0.35 * arc * sky[ch]);
    return c.map((v, ch) => v * (1 - cov) + glass[ch] * cov);
  }
  return null;
}

// light a sphere focuses on the floor: a bright, slightly warm pool beside it (the sun is high and a little left)
export function lensCaustic(m, gx, gy) {
  let add = 0;
  for (const g of m.glass) {
    const fx = (g.x + g.rx * 0.35) * m.nx, fy = (g.y + g.ry * 1.02) * m.ny, dx = (gx + 0.5 - fx) / (g.rx * m.nx * 0.55), dy = (gy + 0.5 - fy) / (g.ry * m.ny * 0.16);
    add += 1.6 * Math.exp(-(dx * dx + dy * dy) * 2.2);
    // and the shadow the glass throws: it bends light away from the ring around the focus
    const sx = (gx + 0.5 - fx) / (g.rx * m.nx * 1.1), sy = (gy + 0.5 - fy) / (g.ry * m.ny * 0.3);
    add -= 0.35 * Math.exp(-(sx * sx + sy * sy) * 1.2) * (1 - Math.exp(-(dx * dx + dy * dy) * 2.2));
  }
  return add;
}
