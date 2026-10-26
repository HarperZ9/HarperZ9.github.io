// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// liquid.js: a water surface and its reflection. The surface is a damped wave equation on a grid, with an optional
// plate-stiffness term that makes it dispersive the way capillary ripples are (short waves outrun long ones):
//   u_tt = c^2 lap(u) - kappa lap(lap(u)) - gamma u_t
// explicit leapfrog, periodic or absorbing edges, obstacle cells pinned at zero so ripples bend round things that
// stand in the water. The shore renderer looks at that surface in perspective from a low camera, reflects the scene
// through the ripple normals (exact mirror direction, not a screen-space wobble), lets a shallow sandy bottom show
// through by Fresnel and Beer-Lambert, and wets the sand above the waterline.
//
//   const sea = new Water({ nx: 256, ny: 256, seed: 3 }); sea.rain(40); sea.step(120);
//   const out = renderShore(sky, sea, { horizon: 0.56, objects: [{ raster: word, contact: 610 }] });
import { raster, sample, clamp, mix, hexLin, random, gauss, boxBlur } from './lib/raster.js';
import { fresnel } from './lib/optics.js';

export class Water {
  constructor({ nx = 256, ny = 256, courant = 0.5, damping = 0.004, stiffness = 0, edge = 'wrap', seed = 1 } = {}) {
    const C2 = courant * courant;
    if (8 * C2 + 64 * stiffness > 4) throw new RangeError(`liquid: unstable (8 c^2 + 64 kappa = ${(8 * C2 + 64 * stiffness).toFixed(3)} must stay at or under 4)`);
    Object.assign(this, { nx, ny, C2, courant, damping, stiffness, edge, t: 0 });
    this.u = new Float32Array(nx * ny); this.p = new Float32Array(nx * ny); this.n = new Float32Array(nx * ny);
    this.lap = new Float32Array(nx * ny); this.solid = new Uint8Array(nx * ny); this.rng = random(`water/${seed}`);
  }
  idx(x, y) {
    const { nx, ny } = this;
    if (this.edge === 'wrap') return ((y % ny + ny) % ny) * nx + ((x % nx + nx) % nx);
    return clamp(y, 0, ny - 1) * nx + clamp(x, 0, nx - 1);
  }
  laplace(src, dst) {
    const { nx, ny } = this, wrap = this.edge === 'wrap';
    for (let y = 0; y < ny; y++) {
      const ym = wrap ? (y + ny - 1) % ny : Math.max(0, y - 1), yp = wrap ? (y + 1) % ny : Math.min(ny - 1, y + 1);
      for (let x = 0; x < nx; x++) {
        const xm = wrap ? (x + nx - 1) % nx : Math.max(0, x - 1), xp = wrap ? (x + 1) % nx : Math.min(nx - 1, x + 1);
        dst[y * nx + x] = src[y * nx + xm] + src[y * nx + xp] + src[ym * nx + x] + src[yp * nx + x] - 4 * src[y * nx + x];
      }
    }
  }
  step(steps = 1) {
    const { nx, ny, C2, damping: g, stiffness: K } = this, N = nx * ny;
    const bi = K > 0 ? new Float32Array(N) : null;
    for (let s = 0; s < steps; s++) {
      this.laplace(this.u, this.lap);
      if (bi) this.laplace(this.lap, bi);
      const { u, p, n, lap, solid } = this;
      for (let i = 0; i < N; i++) {
        if (solid[i]) { n[i] = 0; continue; }
        n[i] = 2 * u[i] - p[i] + C2 * lap[i] - (bi ? K * bi[i] : 0) - g * (u[i] - p[i]);
      }
      if (this.edge === 'absorb') this.sponge(n);
      this.p = u; this.u = n; this.n = p; this.t++;
    }
    return this;
  }
  // a cosine-tapered sponge layer, 12 cells wide, so absorbing edges do not reflect
  sponge(a) {
    const { nx, ny } = this, W = 12;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const d = Math.min(x, y, nx - 1 - x, ny - 1 - y); if (d >= W) continue;
      a[y * nx + x] *= 0.5 - 0.5 * Math.cos(Math.PI * d / W);
    }
  }
  // a raised-cosine dent of radius r (cells) and amplitude amp, applied to both time levels so it starts at rest
  drop(x, y, r = 3, amp = -1) {
    for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
      const d = Math.hypot(i, j) / r; if (d >= 1) continue;
      const k = this.idx(Math.round(x) + i, Math.round(y) + j), v = amp * 0.5 * (1 + Math.cos(Math.PI * d));
      this.u[k] += v; this.p[k] += v;
    }
    return this;
  }
  // n seeded drops of random size, spread over the grid (or a region [x0, y0, x1, y1] in cells)
  rain(n, { r = [1.5, 4], amp = [-0.8, -0.2], region = null } = {}) {
    const R = this.rng, [x0, y0, x1, y1] = region ?? [0, 0, this.nx, this.ny];
    for (let k = 0; k < n; k++) this.drop(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), mix(r[0], r[1], R()), mix(amp[0], amp[1], R()));
    return this;
  }
  // a wind field: low-amplitude Gaussian forcing on every cell, the source of the fine cat's-paw texture
  wind(amp = 0.004) { const R = this.rng; for (let i = 0; i < this.u.length; i++) if (!this.solid[i]) this.u[i] += amp * gauss(R); return this; }
  block(fn) { for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) if (fn(x, y)) this.solid[y * this.nx + x] = 1; return this; }
  // central-difference slope field (two channels, d/dx and d/dy per cell), optionally blurred for far footprints
  slopes(blur = 0) {
    const { nx, ny, u } = this, S = new Float32Array(nx * ny * 2);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x;
      S[i * 2] = 0.5 * (u[this.idx(x + 1, y)] - u[this.idx(x - 1, y)]); S[i * 2 + 1] = 0.5 * (u[this.idx(x, y + 1)] - u[this.idx(x, y - 1)]);
    }
    return blur > 0 ? boxBlur(S, nx, ny, blur, { stride: 2, passes: 2 }) : S;
  }
  energy() { let e = 0; for (let i = 0; i < this.u.length; i++) e += this.u[i] * this.u[i]; return e; }
}

export const SHORE = Object.freeze({
  horizon: 0.52, camHeight: 22, tile: 1, ripple: 6,
  deep: '#1d3640', shallow: '#6f8a86', sand: '#b79f7d', wetSand: '#6d5d4a',
  absorb: 0.55, depthSlope: 0.02, shore: 0.86, swash: 0.012,
  sun: { x: 0.33, y: 0.47, power: 40, shine: 40000, colour: '#ffd9a8' }, // shine ~ 2 / (sun radius in rad)^2
  wet: 0.75, seed: 1,
});

// Map a slope grid (one or more mip levels) to perspective sampling, cached per call.
function levels(sea) { return [sea.slopes(0), sea.slopes(1), sea.slopes(3), sea.slopes(8)]; }
function slopeAt(L, sea, gx, gy, foot) {
  const { nx, ny } = sea, k = clamp(Math.log2(Math.max(1, foot)) / 1.6, 0, 3), a = Math.floor(k), b = Math.min(3, a + 1), t = k - a;
  const x = ((gx % nx) + nx) % nx, y = ((gy % ny) + ny) % ny, x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const get = (S, ch) => {
    const i00 = (y0 * nx + x0) * 2 + ch, i10 = (y0 * nx + (x0 + 1) % nx) * 2 + ch, i01 = (((y0 + 1) % ny) * nx + x0) * 2 + ch, i11 = (((y0 + 1) % ny) * nx + (x0 + 1) % nx) * 2 + ch;
    return (S[i00] * (1 - fx) + S[i10] * fx) * (1 - fy) + (S[i01] * (1 - fx) + S[i11] * fx) * fy;
  };
  const fade = clamp(1 - (foot - 3) / 24);
  return [mix(get(L[a], 0), get(L[b], 0), t) * fade, mix(get(L[a], 1), get(L[b], 1), t) * fade];
}

// Render the shore. `above` is the scene with no water (sky, sea-line, anything far); `objects` stand in the water
// with their own rasters (straight alpha) and contact rows; they are drawn over the scene and reflected about their
// contact line with the same ripple distortion as the sky.
export function renderShore(above, sea, o = {}) {
  const p = { ...SHORE, ...o, sun: { ...SHORE.sun, ...(o.sun ?? {}) } }, { w, h } = above, O = raster(w, h);
  const yh = p.horizon * h, f = h, cx = w / 2, L = levels(sea), objs = p.objects ?? [];
  const deep = hexLin(p.deep), shallow = hexLin(p.shallow), sand = hexLin(p.sand), wet = hexLin(p.wetSand), sunC = hexLin(p.sun.colour);
  const sunDir = sunDirection(p, w, h);
  const R = random(`shore/${p.seed}`), wob = Array.from({ length: 8 }, () => [R() * 6.28, 1 + R() * 5]);
  const blurAbove = { w, h, data: boxBlur(above.data, w, h, Math.max(1, Math.round(w / 300)), { stride: 4, passes: 2 }) };
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const j = i * 4; O.data[j + 3] = 1;
    if (y + 0.5 <= yh) { for (let c = 0; c < 3; c++) O.data[j + c] = above.data[j + c]; continue; }
    const dy = y + 0.5 - yh, z = p.camHeight * f / dy, wx = (x + 0.5 - cx) * z / f, foot = z / f / p.tile;
    const [sx, sz] = slopeAt(L, sea, wx / p.tile, z / p.tile, foot);
    const n = norm([-sx * p.ripple, 1, -sz * p.ripple]), v = norm([wx, -p.camHeight, z]);
    const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2], r = [v[0] - 2 * vn * n[0], v[1] - 2 * vn * n[1], v[2] - 2 * vn * n[2]];
    // screen position of the reflected ray (distant scene), and the same for a flat mirror, give the ripple offset
    const ry = Math.max(1e-3, r[1]), rz = Math.max(1e-3, r[2]);
    const qx = cx + f * r[0] / rz, qy = yh - f * ry / rz, ox = qx - (x + 0.5), oy = qy - (2 * yh - (y + 0.5));
    const F = fresnel(-vn, 1, 1.333);
    // waterline: the swash edge wanders with x; rows below it are wet sand
    let edge = p.shore * h; for (const [ph, fr] of wob) edge += p.swash * h * Math.sin(ph + fr * x / w * 6.283) / wob.length * 2;
    const sandMix = clamp((y + 0.5 - edge) / 3), src = sandMix > 0 ? blurAbove : above;
    let rc = [0, 1, 2].map(c => sample(src, qx, qy, c));
    for (const ob of objs) {
      const mx = x + 0.5 + ox * (ob.ripple ?? 1), my = 2 * ob.contact - (y + 0.5) + oy * (ob.ripple ?? 1);
      if (my < 0 || my >= h || my > ob.contact) continue;
      const a = sample(ob.raster, mx, my, 3);
      if (a > 0) rc = rc.map((v, c) => mix(v, sample(ob.raster, mx, my, c) * (ob.reflect ?? 0.92), a));
    }
    const spec = p.sun.power * Math.max(0, r[0] * sunDir[0] + r[1] * sunDir[1] + r[2] * sunDir[2]) ** p.sun.shine;
    const depth = Math.max(0, p.depthSlope * (h * p.shore - y) * (z / p.camHeight) * 0.05 + 0.02), T = Math.exp(-p.absorb * depth / Math.max(0.2, -v[1]));
    for (let c = 0; c < 3; c++) {
      const body = T * sand[c] * 0.8 + (1 - T) * mix(deep[c], shallow[c], clamp(1 - depth * 2));
      const water = F * (rc[c] + spec * sunC[c]) + (1 - F) * body;
      const film = mix(0.02, 0.35, p.wet) * (rc[c] + spec * sunC[c] * 0.4) + wet[c] * (1 - 0.35 * p.wet);
      O.data[j + c] = mix(water, film, sandMix);
    }
  }
  for (const ob of objs) composite(O, ob.raster);
  return O;
}
const norm = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
// The sun's direction from where it sits in the sky picture (shares of the frame), so glints line up with the disc.
export function sunDirection(p, w, h) { return norm([(p.sun.x * w - w / 2) / h, (p.horizon * h - p.sun.y * h) / h, 1]); }
function composite(O, A) { for (let i = 0; i < O.w * O.h; i++) { const a = A.data[i * 4 + 3]; if (a <= 0) continue; for (let c = 0; c < 3; c++) O.data[i * 4 + c] = mix(O.data[i * 4 + c], A.data[i * 4 + c], a); } }
