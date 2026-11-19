// fluid.mjs: anything to liquid. A small stable-fluids solver (Stam 1999: semi-Lagrangian advection, Jacobi
// pressure projection) on a fixed clock, so the same seed and dye give the same field at the same time (M4).
//
//   const f = new Fluid(160, 90, { seed: 3, viscosity: 0.0002 });
//   f.dye.set(maskDownsampled); f.swirl(strength);  // or f.impulse(x, y, vx, vy, r)
//   f.run(2.0);                                     // 120 fixed steps of 1/60 s
//   f.sample(x01, y01)                              // bilinear dye, for upsampling to any resolution
import { fbm } from '../../techniques/lib/util.js';

export const STEP = 1 / 60;

export class Fluid {
  constructor(nx, ny, { seed = 1, iters = 24, dissipation = 0.999 } = {}) {
    this.nx = nx; this.ny = ny; this.seed = seed; this.iters = iters; this.diss = dissipation;
    const n = nx * ny;
    this.u = new Float32Array(n); this.v = new Float32Array(n); this.dye = new Float32Array(n);
    this.t0 = new Float32Array(n); this.t1 = new Float32Array(n); this.p = new Float32Array(n); this.div = new Float32Array(n);
    this.time = 0; this.steps = 0;
  }
  idx(x, y) { return Math.min(this.ny - 1, Math.max(0, y)) * this.nx + Math.min(this.nx - 1, Math.max(0, x)); }
  // A divergence-free start: the curl of a noise potential, scaled to `strength` cells per second.
  swirl(strength = 20, scale = 0.08) {
    const { nx, ny, u, v, seed } = this, psi = (x, y) => fbm(x * scale, y * scale, seed + 5, 3);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x;
      u[i] += strength * (psi(x, y + 0.5) - psi(x, y - 0.5));
      v[i] -= strength * (psi(x + 0.5, y) - psi(x - 0.5, y));
    }
    return this;
  }
  impulse(x, y, vx, vy, r = 4) {
    const { nx, ny } = this;
    for (let j = Math.max(0, Math.floor(y - r)); j < Math.min(ny, Math.ceil(y + r)); j++)
      for (let i = Math.max(0, Math.floor(x - r)); i < Math.min(nx, Math.ceil(x + r)); i++) {
        const k = Math.exp(-((i - x) ** 2 + (j - y) ** 2) / (r * r * 0.5)), q = j * nx + i;
        this.u[q] += vx * k; this.v[q] += vy * k;
      }
    return this;
  }
  _advect(src, dst, dt) {
    const { nx, ny, u, v } = this;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x, px = Math.min(nx - 1.001, Math.max(0, x - dt * u[i])), py = Math.min(ny - 1.001, Math.max(0, y - dt * v[i]));
      const x0 = px | 0, y0 = py | 0, ax = px - x0, ay = py - y0, k = y0 * nx + x0;
      dst[i] = (src[k] * (1 - ax) + src[k + 1] * ax) * (1 - ay) + (src[k + nx] * (1 - ax) + src[k + nx + 1] * ax) * ay;
    }
  }
  // The pressure solve, Gauss-Seidel in place: each cell from its source and its four neighbours, clamped at the border
  // as idx() clamps them. The cell to the left was written a moment before, so it is carried in a local, rounded to
  // float32 as the array rounds it, and sweeps are run two at a time (_sweep2). Every cell reads the same values in the
  // same order as the plain loops, so the field is the same to the bit (hashed against the plain loops at sizes 2 by 5
  // to 160 by 90, 1 to 24 sweeps). In node on an i7-13700KF a 96 by 72 step went from 1.9 ms (plain loops) to 0.72 ms
  // (19 November 2026).
  _project() {
    const { nx, ny, u, v, p, div, iters } = this, last = nx - 1;
    for (let y = 0; y < ny; y++) {
      const r = y * nx, up = (y > 0 ? y - 1 : 0) * nx, dn = (y < ny - 1 ? y + 1 : ny - 1) * nx;
      for (let x = 0; x < nx; x++) {
        const xl = x > 0 ? x - 1 : 0, xr = x < last ? x + 1 : last;
        div[r + x] = -0.5 * (u[r + xr] - u[r + xl] + v[dn + x] - v[up + x]); p[r + x] = 0;
      }
    }
    let k = 0;
    if (nx > 1) for (; k + 1 < iters; k += 2) { this._sweep(0); for (let y = 1; y < ny; y++) this._sweep2(y); this._sweep(ny - 1); }
    for (; k < iters; k++) for (let y = 0; y < ny; y++) {
      const r = y * nx, up = (y > 0 ? y - 1 : 0) * nx, dn = (y < ny - 1 ? y + 1 : ny - 1) * nx;
      for (let x = 0; x < nx; x++) { const xl = x > 0 ? x - 1 : 0, xr = x < last ? x + 1 : last; p[r + x] = (div[r + x] + p[r + xl] + p[r + xr] + p[up + x] + p[dn + x]) / 4; }
    }
    for (let y = 0; y < ny; y++) {
      const r = y * nx, up = (y > 0 ? y - 1 : 0) * nx, dn = (y < ny - 1 ? y + 1 : ny - 1) * nx;
      for (let x = 0; x < nx; x++) {
        const i = r + x, xl = x > 0 ? x - 1 : 0, xr = x < last ? x + 1 : last;
        u[i] -= 0.5 * (p[r + xr] - p[r + xl]); v[i] -= 0.5 * (p[dn + x] - p[up + x]);
      }
    }
  }
  // One row of one sweep (nx of 2 or more).
  _sweep(y) {
    const { nx, ny, p, div } = this, last = nx - 1, fr = Math.fround, r = y * nx, up = (y > 0 ? y - 1 : 0) * nx, dn = (y < ny - 1 ? y + 1 : ny - 1) * nx;
    let left = p[r] = fr((div[r] + p[r] + p[r + 1] + p[up] + p[dn]) / 4);
    for (let x = 1; x < last; x++) left = p[r + x] = fr((div[r + x] + left + p[r + x + 1] + p[up + x] + p[dn + x]) / 4);
    p[r + last] = (div[r + last] + left + p[r + last] + p[up + last] + p[dn + last]) / 4;
  }
  // Row y of one sweep and row y - 1 of the next, cell by cell. The next sweep's cell (x, y - 1) needs (x, y) and
  // (x + 1, y - 1) of this sweep, and both are done; nothing in this sweep reads (x, y - 1) after it is overwritten.
  // So the reads are the plain loops' reads, and the two chains of sums run side by side instead of one after the other.
  _sweep2(y) {
    const { nx, ny, p, div } = this, last = nx - 1, fr = Math.fround;
    const ra = y * nx, ua = ra - nx, da = (y < ny - 1 ? y + 1 : ny - 1) * nx, rb = ua, ub = (y > 1 ? y - 2 : 0) * nx, db = ra;
    let la = p[ra] = fr((div[ra] + p[ra] + p[ra + 1] + p[ua] + p[da]) / 4);
    let lb = p[rb] = fr((div[rb] + p[rb] + p[rb + 1] + p[ub] + p[db]) / 4);
    for (let x = 1; x < last; x++) {
      la = p[ra + x] = fr((div[ra + x] + la + p[ra + x + 1] + p[ua + x] + p[da + x]) / 4);
      lb = p[rb + x] = fr((div[rb + x] + lb + p[rb + x + 1] + p[ub + x] + p[db + x]) / 4);
    }
    p[ra + last] = fr((div[ra + last] + la + p[ra + last] + p[ua + last] + p[da + last]) / 4);
    p[rb + last] = (div[rb + last] + lb + p[rb + last] + p[ub + last] + p[db + last]) / 4;
  }
  step(dt = STEP) {
    this._project();
    this._advect(this.u, this.t0, dt); this._advect(this.v, this.t1, dt);
    this.u.set(this.t0); this.v.set(this.t1);
    this._project();
    this._advect(this.dye, this.t0, dt);
    for (let i = 0; i < this.dye.length; i++) this.dye[i] = this.t0[i] * this.diss;
    this.time += dt; this.steps++;
  }
  // Run to time t (seconds) on the fixed step; never more than 1200 steps per call (20 s).
  run(t) { const target = Math.min(this.steps + 1200, Math.round(t / STEP)); while (this.steps < target) this.step(); return this; }
  sample(fx, fy, f = this.dye) {
    const { nx, ny } = this, px = Math.min(nx - 1.001, Math.max(0, fx * (nx - 1))), py = Math.min(ny - 1.001, Math.max(0, fy * (ny - 1)));
    const x0 = px | 0, y0 = py | 0, ax = px - x0, ay = py - y0, k = y0 * nx + x0;
    return (f[k] * (1 - ax) + f[k + 1] * ax) * (1 - ay) + (f[k + nx] * (1 - ax) + f[k + nx + 1] * ax) * ay;
  }
  // Kinetic energy per cell, a number the liquid sound reads (more stirring, more bubbles).
  energy() { let e = 0; for (let i = 0; i < this.u.length; i++) e += this.u[i] ** 2 + this.v[i] ** 2; return e / this.u.length; }
}

// Downsample a w x h coverage to the grid by area average.
export function toGrid(F, w, h, nx, ny) {
  const out = new Float32Array(nx * ny), cnt = new Float32Array(nx * ny);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = Math.min(ny - 1, (y * ny / h) | 0) * nx + Math.min(nx - 1, (x * nx / w) | 0); out[k] += F[y * w + x]; cnt[k]++; }
  for (let i = 0; i < out.length; i++) out[i] = cnt[i] ? out[i] / cnt[i] : 0;
  return out;
}
