// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// optics.js: dielectric optics for the glass and water materials. Pure functions, no state.
// - Index of refraction per channel from a two-term Cauchy fit through the catalogue pair (n_d, V_d), read at the
//   three wavelengths the thin-film module already samples (substrate/lib/thinfilm.mjs WAVELENGTHS: 650, 532, 450 nm),
//   so glass dispersion and film colour agree on what "red", "green" and "blue" mean.
// - Exact unpolarised Fresnel reflectance (and Schlick for comparison), total internal reflection included.
// - Vector refraction (Snell in vector form) and Beer-Lambert absorption.
import { WAVELENGTHS } from '../../substrate/lib/thinfilm.mjs';

export { WAVELENGTHS };
// Fraunhofer lines used to define the Abbe number V_d = (n_d - 1) / (n_F - n_C), in nm.
export const LINES = Object.freeze({ F: 486.13, d: 587.56, C: 656.27 });

// Catalogue pairs (n_d, V_d). Values from public glass catalogues, written from memory (moderate confidence on the
// third decimal of V_d); the tests check only properties that follow from the pair itself.
export const GLASSES = Object.freeze({
  crown: { nd: 1.5168, vd: 64.17 },   // borosilicate crown (BK7 class)
  flint: { nd: 1.6200, vd: 36.37 },   // light flint (F2 class)
  dense: { nd: 1.7847, vd: 25.68 },   // dense flint (SF11 class): strong fringes
  silica: { nd: 1.4585, vd: 67.82 },  // fused silica
  water: { nd: 1.3330, vd: 55.6 },    // water at room temperature
});

// Cauchy n(lambda) = A + B / lambda^2 (lambda in micrometres) through n_d with the given V_d.
export function cauchy(nd, vd) {
  if (!(nd > 1 && vd > 0)) throw new RangeError('optics: need n_d > 1 and V_d > 0');
  const um = l => l / 1000, B = (nd - 1) / (vd * (1 / um(LINES.F) ** 2 - 1 / um(LINES.C) ** 2));
  return { A: nd - B / um(LINES.d) ** 2, B };
}
export function iorAt(lambdaNm, nd, vd) { const { A, B } = cauchy(nd, vd); return A + B / (lambdaNm / 1000) ** 2; }

// [n_R, n_G, n_B] for a glass name or a { nd, vd } pair. `spread` scales dispersion (1 is physical, 0 is none).
export function channelIor(glass = 'crown', spread = 1) {
  const g = typeof glass === 'string' ? GLASSES[glass] : glass;
  if (!g) throw new RangeError(`optics: unknown glass ${glass}`);
  const n = [WAVELENGTHS.r, WAVELENGTHS.g, WAVELENGTHS.b].map(l => iorAt(l, g.nd, g.vd));
  return n.map(v => n[1] + (v - n[1]) * spread);
}

// Exact unpolarised Fresnel reflectance for light arriving at cos(theta_i) from medium n1 into n2. 1 at TIR.
export function fresnel(cosi, n1, n2) {
  cosi = Math.min(1, Math.abs(cosi));
  const s = (n1 / n2) ** 2 * (1 - cosi * cosi);
  if (s >= 1) return 1;
  const cost = Math.sqrt(1 - s);
  const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost), rp = (n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi);
  return 0.5 * (rs * rs + rp * rp);
}
export function fresnelP(cosi, n1, n2) {
  cosi = Math.min(1, Math.abs(cosi)); const s = (n1 / n2) ** 2 * (1 - cosi * cosi); if (s >= 1) return 1;
  const cost = Math.sqrt(1 - s), rp = (n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi); return rp * rp;
}
export function schlick(cosi, n1, n2) { const r0 = ((n1 - n2) / (n1 + n2)) ** 2; return r0 + (1 - r0) * (1 - Math.abs(cosi)) ** 5; }

// Refract unit vector I through a surface with unit normal N (facing against I), eta = n1 / n2.
// Returns the refracted unit vector, or null on total internal reflection.
export function refract(I, N, eta) {
  const d = I[0] * N[0] + I[1] * N[1] + I[2] * N[2], k = 1 - eta * eta * (1 - d * d);
  if (k < 0) return null;
  const a = eta * d + Math.sqrt(k);
  return [eta * I[0] - a * N[0], eta * I[1] - a * N[1], eta * I[2] - a * N[2]];
}
export function reflect(I, N) { const d = 2 * (I[0] * N[0] + I[1] * N[1] + I[2] * N[2]); return [I[0] - d * N[0], I[1] - d * N[1], I[2] - d * N[2]]; }

// Beer-Lambert transmittance over path length L for absorption coefficients sigma (per unit length).
export const beer = (L, sigma) => sigma.map(s => Math.exp(-s * L));

// Lateral offset of a view ray (0, 0, -1) that enters a glass slab through a front face with normal N, crosses
// thickness t to a flat back face, exits, and travels `gap` more to the background plane. Returns
// { dx, dy, path } in the same units as t and gap, or null when the ray is trapped (TIR at the back face).
export function slabOffset(N, n, t, gap) {
  const t1 = refract([0, 0, -1], N, 1 / n);
  if (!t1) return null;
  const s1 = t / Math.max(1e-4, -t1[2]);
  const t2 = refract(t1, [0, 0, 1], n);
  if (!t2) return null;
  const s2 = gap / Math.max(1e-4, -t2[2]);
  return { dx: t1[0] * s1 + t2[0] * s2, dy: t1[1] * s1 + t2[1] * s2, path: s1 };
}
