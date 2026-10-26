// lib/medium/grid.mjs: the numerical core of the medium. A collocated grid of cells, Stam's stable fluids
// (semi-Lagrangian advection, implicit diffusion, Jacobi pressure projection) generalised in three ways the medium
// needs: a per-cell viscosity field (honey and water in one tank), a phase mask that splits the tank into two fluids
// (water and air) with the interface acting as a wall for the pressure solve, and vorticity confinement scaled by a
// per-cell turbulence field. Fixed iteration counts and no randomness, so a run is byte-repeatable (QUALITY-SPEC M4).
// Coordinates: x right, y down, cell (i, j) at index j * nx + i.

// the water's own pigment diffusion rate (cells^2 per s at grid scale); a pour's props.spread scales it
export const KAPPA = 0.12;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function bilerp(f, nx, ny, x, y) {
  x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001);
  const i = x | 0, j = y | 0, a = x - i, b = y - j, k = j * nx + i;
  return (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + nx] * (1 - a) + f[k + nx + 1] * a) * b;
}

// Semi-Lagrangian advection of q by (u, v) over dt, cells of the other phase untouched (mask: 1 where q lives).
export function advect(q, u, v, nx, ny, dt, out, mask = null) {
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (mask && !mask[k]) { out[k] = 0; continue; }
    out[k] = bilerp(q, nx, ny, i - dt * u[k], j - dt * v[k]);
  }
  return out;
}

// Implicit diffusion with a per-cell coefficient (cells per second squared times dt), Jacobi, inside the mask.
export function diffuse(q, coef, nx, ny, iters, tmp, mask = null) {
  if (typeof coef !== 'number') return diffuseFlux(q, coef, nx, ny, tmp, mask);
  const base = Float32Array.from(q);
  for (let it = 0; it < iters; it++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (mask && !mask[k]) { tmp[k] = q[k]; continue; }
      const n = nb(q, nx, ny, i, j, k, mask);
      tmp[k] = (base[k] + coef * n.sum) / (1 + coef * n.count);
    }
    q.set(tmp);
  }
  return q;
}
// A per-cell coefficient: explicit flux through each face at the mean of the two cells, in as many substeps as keep
// it stable. What one cell gives, its neighbour takes, so the total is kept to float rounding. (The Jacobi form with
// a per-cell rate destroyed mass where fast cells met slow ones: a bloom ink lost over 90% of its pigment in 3 s,
// found 2026-10-25. A later gain of up to 20% was advection's, not this step's; medium.mjs renormalises for it.)
function diffuseFlux(q, coef, nx, ny, tmp, mask) {
  let amax = 0; for (let k = 0; k < coef.length; k++) if (coef[k] > amax) amax = coef[k];
  const sub = Math.max(1, Math.ceil(amax * 4 / 0.9));
  for (let s = 0; s < sub; s++) {
    tmp.set(q);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (mask && !mask[k]) continue;
      // each face once: right and down neighbours
      for (const kk of [i < nx - 1 ? k + 1 : -1, j < ny - 1 ? k + nx : -1]) {
        if (kk < 0 || (mask && !mask[kk])) continue;
        const f = 0.5 * (coef[k] + coef[kk]) / sub * (q[kk] - q[k]);
        tmp[k] += f; tmp[kk] -= f;
      }
    }
    q.set(tmp);
  }
  return q;
}
function nb(q, nx, ny, i, j, k, mask) {
  let sum = 0, count = 0;
  if (i > 0 && (!mask || mask[k - 1])) { sum += q[k - 1]; count++; }
  if (i < nx - 1 && (!mask || mask[k + 1])) { sum += q[k + 1]; count++; }
  if (j > 0 && (!mask || mask[k - nx])) { sum += q[k - nx]; count++; }
  if (j < ny - 1 && (!mask || mask[k + nx])) { sum += q[k + nx]; count++; }
  return { sum, count };
}

// Pressure projection within each phase: phase[k] is 1 (water) or 0 (air); a neighbour of the other phase, a solid
// cell or the tank edge is a wall (zero normal velocity, Neumann pressure). solid: 1 where nothing flows (bed, glass).
export function project(u, v, phase, solid, nx, ny, iters, p, div) {
  const same = (k, m) => phase[k] === phase[m] && !solid[m];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; p[k] = 0;
    if (solid[k]) { div[k] = 0; continue; }
    const ue = i < nx - 1 && same(k, k + 1) ? u[k + 1] : -u[k], uw = i > 0 && same(k, k - 1) ? u[k - 1] : -u[k];
    const vs = j < ny - 1 && same(k, k + nx) ? v[k + nx] : -v[k], vn = j > 0 && same(k, k - nx) ? v[k - nx] : -v[k];
    div[k] = -0.5 * (ue - uw + vs - vn);
  }
  for (let it = 0; it < iters; it++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (solid[k]) continue;
    let s = 0, c = 0;
    for (const m of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < ny - 1 ? k + nx : -1]) if (m >= 0 && same(k, m)) { s += p[m]; c++; }
    p[k] = c ? (div[k] + s) / c : 0;
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (solid[k]) { u[k] = 0; v[k] = 0; continue; }
    const pe = i < nx - 1 && same(k, k + 1) ? p[k + 1] : p[k], pw = i > 0 && same(k, k - 1) ? p[k - 1] : p[k];
    const ps = j < ny - 1 && same(k, k + nx) ? p[k + nx] : p[k], pn = j > 0 && same(k, k - nx) ? p[k - nx] : p[k];
    u[k] -= 0.5 * (pe - pw); v[k] -= 0.5 * (ps - pn);
    // walls: no flow into the other phase, a solid or the tank edge
    if ((i === 0 && u[k] < 0) || (i === nx - 1 && u[k] > 0)) u[k] = 0;
    if ((j === ny - 1 || (j < ny - 1 && (solid[k + nx] || phase[k + nx] !== phase[k]))) && v[k] > 0) v[k] *= 0.2;
    if ((j === 0 || (j > 0 && (solid[k - nx] || phase[k - nx] !== phase[k]))) && v[k] < 0) v[k] *= 0.2;
  }
}

// Vorticity confinement: puts back the small curls the grid smooths away, scaled per cell (the turbulence field).
export function confine(u, v, scale, nx, ny, dt, curl) {
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i; curl[k] = 0.5 * (v[k + 1] - v[k - 1] - (u[k + nx] - u[k - nx])); }
  for (let j = 2; j < ny - 2; j++) for (let i = 2; i < nx - 2; i++) {
    const k = j * nx + i, e = typeof scale === 'number' ? scale : scale[k]; if (!e) continue;
    let gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1])), gy = 0.5 * (Math.abs(curl[k + nx]) - Math.abs(curl[k - nx]));
    const l = Math.hypot(gx, gy) + 1e-6; gx /= l; gy /= l;
    u[k] += dt * e * gy * curl[k]; v[k] -= dt * e * gx * curl[k];
  }
}
