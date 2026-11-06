// fog.mjs: the two fog models the field draws, in plain JavaScript so they can be checked.
// Sea mist (advected ground fog): a few thin layers over the water, each a density field carried downwind with the
// air. A pure carry by a uniform wind moves the field without making or losing any of it, so the mist's mass is
// conserved; advect() is the semi-Lagrangian step on a periodic grid that the check uses.
// Long-range fog: single scattering of sunlight in a homogeneous medium along a ray of length d. With extinction
// beta_t, scattering beta_s and phase p, the light gathered is Ls p beta_s (1 - exp(-beta_t d)) / beta_t; the field
// multiplies that by the fraction of the path the clouds leave lit, which draws the shafts.
export function advect(grid, n, ux, uy, dt) {
  const out = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const sx = x - ux * dt, sy = y - uy * dt, x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    const at = (i, j) => grid[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
    out[y * n + x] = (1 - fx) * (1 - fy) * at(x0, y0) + fx * (1 - fy) * at(x0 + 1, y0) + (1 - fx) * fy * at(x0, y0 + 1) + fx * fy * at(x0 + 1, y0 + 1);
  }
  return out;
}
export const singleScatterAnalytic = (Ls, p, bs, bt, d) => (Ls * p * bs * (1 - Math.exp(-bt * d))) / bt;
export function singleScatterMarch(Ls, p, bs, bt, d, steps = 2000) {
  let L = 0; const dt = d / steps;
  for (let i = 0; i < steps; i++) L += Ls * p * bs * Math.exp(-bt * (i + 0.5) * dt) * dt;
  return L;
}
