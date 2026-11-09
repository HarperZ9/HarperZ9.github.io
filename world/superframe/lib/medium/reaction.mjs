// lib/medium/reaction.mjs: a reaction term beside the medium's diffusion (Turing 1952; the Gray-Scott model). Two
// fields U and V live in the water: U is fed in at rate F, V is removed at rate F + k, and they react U + 2V -> 3V,
// each diffusing at its own rate (Du, Dv). With diffusion alone a dye only spreads; with the reaction it can hold
// spots, stripes or coral, depending on F and k. Both fields ride the flow like any dissolved substance.
//   m.add('reaction', { x, y, r }, 1, { F: 0.037, k: 0.06, Du: 0.2, Dv: 0.1, sub: 8 })   seeds V in the region
import { advect } from './grid.mjs';

export function seedReaction(m, cells, props) {
  if (!m.reaction) { m.reaction = { U: new Float32Array(m.n).fill(1), V: new Float32Array(m.n), F: props.F ?? 0.037, k: props.k ?? 0.06, Du: props.Du ?? 0.2, Dv: props.Dv ?? 0.1, sub: props.sub ?? 8 }; }
  for (const [c, f] of cells) { m.reaction.V[c] = Math.max(m.reaction.V[c], 0.5 * f * (0.7 + 0.6 * m.rng())); m.reaction.U[c] = Math.min(m.reaction.U[c], 1 - 0.5 * f); }
}

export function stepReaction(m, dt) {
  const { nx, ny } = m, R = m.reaction, { U, V } = R, L = (a, k, i, j) => a[i > 0 ? k - 1 : k] + a[i < nx - 1 ? k + 1 : k] + a[j > 0 ? k - nx : k] + a[j < ny - 1 ? k + nx : k] - 4 * a[k];
  const U2 = new Float32Array(m.n), V2 = new Float32Array(m.n);
  for (let s = 0; s < R.sub; s++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (!m.phase[k] || m.solid[k]) { U2[k] = U[k]; V2[k] = V[k]; continue; }
      const uvv = U[k] * V[k] * V[k];
      U2[k] = U[k] + R.Du * L(U, k, i, j) - uvv + R.F * (1 - U[k]);
      V2[k] = V[k] + R.Dv * L(V, k, i, j) + uvv - (R.F + R.k) * V[k];
    }
    U.set(U2); V.set(V2);
  }
  // carried by the flow
  const s = dt * 30, t = new Float32Array(m.n);
  advect(Float32Array.from(U), m.u, m.v, nx, ny, s, t); U.set(t); advect(Float32Array.from(V), m.u, m.v, nx, ny, s, t); V.set(t);
}
