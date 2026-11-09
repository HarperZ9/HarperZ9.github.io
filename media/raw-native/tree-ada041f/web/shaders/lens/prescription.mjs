// A lens prescription and its ghosts by paraxial ray-transfer matrices.
//
// A ghost is light that reflects twice inside the lens (off surface i, back to surface j < i,
// then forward again) and lands on the sensor out of focus. In the paraxial limit every ray is
// a linear map of its entry state, so a ghost of a source at field angle u lands at
// c + m (p - c), where p is the source's own image and c the optical centre, and is the image
// of the aperture stop with radius rho. m and rho depend on wavelength through the glass
// (Cauchy dispersion), so ghosts split into colours. Reduced angles (omega = n u) are used:
//   transfer d in index n:   y' = y + d omega / n
//   surface of curvature C:  omega' = omega - y (n' - n) C
// A reflection is a surface with n' = -n; a ray travelling backwards carries a negative index.
// Element edges (vignetting) are not modelled.
import { GLASS, cauchy, LAMBDA_D, BIN_NM } from "./spectrum.mjs";

// Our own three-element design, mm: { R (radius, Infinity flat), t (gap to next), glass after }.
// The stop sits in the air gap after surface 3, `stopAt` mm behind it. The radii came from a
// seeded random search around a hand-drawn triplet (2026-10-15) that kept the focal length
// between 40 and 120 mm and asked for a spread of ghost sizes, a few nearly focused: f = 43.0 mm.
export const LENS = {
  surfaces: [
    { R: 14.2, t: 3.5, glass: "crown" }, { R: -288.4, t: 4.0, glass: "air" },
    { R: -29.7, t: 1.5, glass: "flint" }, { R: 43.9, t: 2.4, glass: "air" },
    { R: 80.1, t: 3.0, glass: "crown" }, { R: -42.8, t: 0, glass: "air" },
  ],
  stopAfter: 3, stopAt: 1.2,
};

const idx = (lens, k, nm) => (k < 0 ? 1 : cauchy(GLASS[lens.surfaces[k].glass], nm));
const C = (s) => (Number.isFinite(s.R) ? 1 / s.R : 0);
function T(r, d, n) { return [r[0] + (d * r[1]) / n, r[1]]; }
function S(r, c, n, n2) { return [r[0], r[1] - r[0] * (n2 - n) * c]; }

// Ops from the front surface to the stop (forward), and the paraxial matrix entries of the map
// entry state (y, omega) -> stop height, by tracing two unit rays.
function toStop(lens, nm) {
  return (r) => {
    for (let k = 0; k <= lens.stopAfter; k++) {
      r = S(r, C(lens.surfaces[k]), idx(lens, k - 1, nm), idx(lens, k, nm));
      r = T(r, k === lens.stopAfter ? lens.stopAt : lens.surfaces[k].t, idx(lens, k, nm));
    }
    return r[0];
  };
}
// Forward through every surface, then to the sensor at `sensor` mm after the last surface.
function forward(lens, nm, r, from, sensor) {
  const n = lens.surfaces.length;
  for (let k = from; k < n; k++) {
    r = S(r, C(lens.surfaces[k]), idx(lens, k - 1, nm), idx(lens, k, nm));
    r = T(r, k === n - 1 ? sensor : lens.surfaces[k].t, idx(lens, k, nm));
  }
  return r;
}
// The ghost path: forward to surface i, reflect, back to surface j, reflect, forward to the sensor.
function ghostPath(lens, nm, r, i, j, sensor) {
  for (let k = 0; k < i; k++) { r = S(r, C(lens.surfaces[k]), idx(lens, k - 1, nm), idx(lens, k, nm)); r = T(r, lens.surfaces[k].t, idx(lens, k, nm)); }
  const ni = idx(lens, i - 1, nm);
  r = S(r, C(lens.surfaces[i]), ni, -ni); // reflect at i, now travelling back in medium i-1
  for (let k = i - 1; k > j; k--) { r = T(r, -lens.surfaces[k].t, -idx(lens, k, nm)); r = S(r, C(lens.surfaces[k]), -idx(lens, k, nm), -idx(lens, k - 1, nm)); }
  r = T(r, -lens.surfaces[j].t, -idx(lens, j, nm));
  const nj = idx(lens, j, nm);
  r = S(r, C(lens.surfaces[j]), -nj, nj); // reflect at j, forward again in medium j
  r = T(r, lens.surfaces[j].t, nj);
  return forward(lens, nm, r, j + 1, sensor);
}

// First-order properties at the d line: effective focal length and the sensor distance
// (back focal distance) where a parallel bundle focuses.
export function firstOrder(lens = LENS, nm = LAMBDA_D) {
  const r = forward(lens, nm, [1, 0], 0, 0), f = -1 / r[1], bfd = -r[0] / r[1];
  return { f, bfd };
}

// Ghost table: for every pair i > j and every wavelength bin, the position factor m, the radius
// rho (mm, per unit stop semi-diameter at the entrance pupil), and the sign of the image.
export function ghostTable(lens = LENS, bins = BIN_NM) {
  const { f, bfd } = firstOrder(lens), stop = toStop(lens, LAMBDA_D);
  const a = stop([1, 0]), b = stop([0, 1]); // stop height = a y0 + b omega0
  const u0 = 1e-3, yImg = forward(lens, LAMBDA_D, [-(b * u0) / a, u0], 0, bfd)[0]; // chief ray, main path
  const ghosts = [], n = lens.surfaces.length;
  for (let i = 1; i < n; i++) for (let j = 0; j < i; j++) {
    const m = [], rho = [];
    for (let l = 0; l < bins.length; l++) {
      const nm = bins[l], sl = toStop(lens, nm), al = sl([1, 0]), bl = sl([0, 1]);
      const chief = ghostPath(lens, nm, [-(bl * u0) / al, u0], i, j, bfd)[0];
      const marg = ghostPath(lens, nm, [1, 0], i, j, bfd)[0]; // entrance height 1 mm
      m.push(chief / yImg); rho.push(marg);
    }
    ghosts.push({ i, j, m, rho });
  }
  return { f, bfd, ghosts };
}
