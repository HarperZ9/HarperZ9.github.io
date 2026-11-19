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
  _project() {
    const { nx, ny, u, v, p, div, iters } = this, I = (x, y) => this.idx(x, y);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { div[y * nx + x] = -0.5 * (u[I(x + 1, y)] - u[I(x - 1, y)] + v[I(x, y + 1)] - v[I(x, y - 1)]); p[y * nx + x] = 0; }
    for (let k = 0; k < iters; k++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++)
      p[y * nx + x] = (div[y * nx + x] + p[I(x - 1, y)] + p[I(x + 1, y)] + p[I(x, y - 1)] + p[I(x, y + 1)]) / 4;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x; u[i] -= 0.5 * (p[I(x + 1, y)] - p[I(x - 1, y)]); v[i] -= 0.5 * (p[I(x, y + 1)] - p[I(x, y - 1)]);
    }
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
