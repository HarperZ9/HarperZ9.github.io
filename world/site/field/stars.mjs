// stars.mjs: the reference for the field's star kernel (starTint and starLayer in scene.glsl.js).
//
// Contract
//   LAYERS               the four layers of the procedural catalogue: cells per cube-face edge, magnitude range and
//                        the share of cells that hold a star. Expected count per layer is 6 n^2 occ.
//   magnitude(u, m0, m1) u in [0, 1] -> m in [m0, m1], drawn so that the count brighter than m grows as 10^(0.5 m)
//                        (about 3.2 times per magnitude, the naked-eye count law). Monotonic in u.
//   flux(m)              display flux. Pogson's law is 10^(-0.4 m); the exponent is halved here because a screen
//                        at night holds about 100:1 and the sky's naked-eye range is 1600:1. The order of the
//                        stars by brightness is kept; the ratios between them are compressed.
//   temperature(bv)      B-V colour index -> kelvin (Ballesteros 2012, EPL 97, 34008).
//   tint(bv)             linear RGB with the largest channel at 1: blue-white for hot stars, orange for cool ones.
//   cubeFace(e)          unit vector -> { face 0..5, u, v in [-1, 1] }, and faceDir is its inverse, so a cell keeps
//                        about the same size at the pole as at the equator (a latitude-longitude grid pinches).
//   Tolerance            float64 here, float32 in the shader; the test holds the constants to the shader source.
export const LAYERS = [
  { n: 8, m0: -1.5, m1: 3.0, occ: 0.44 }, { n: 24, m0: 3.0, m1: 5.0, occ: 0.43 },
  { n: 56, m0: 5.0, m1: 6.5, occ: 0.40 }, { n: 120, m0: 6.5, m1: 8.0, occ: 0.40 },
];
export const expectedCount = (l) => 6 * l.n * l.n * l.occ;
export const magnitude = (u, m0, m1) => m0 + (2 * Math.log(1 + u * (Math.pow(10, 0.5 * (m1 - m0)) - 1))) / Math.LN10;
export const flux = (m) => 4 * Math.pow(10, -0.4 * 0.5 * (m - 2));
export const temperature = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
export const HOT = [0.62, 0.74, 1.0], SUNLIKE = [1.0, 0.96, 0.9], COOL = [1.0, 0.64, 0.36];
export function tint(bv) {
  const m = 1e6 / temperature(bv);
  return m < 172 ? mix(HOT, SUNLIKE, (m - 33) / 139) : mix(SUNLIKE, COOL, (m - 172) / 114);
}
// the B-V index the shader draws for a star from a uniform value h in [0, 1]: most stars sit near white, few are red
export const colourIndex = (h) => -0.25 + 1.75 * Math.pow(h, 1.6);
export function cubeFace([x, y, z]) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (ax >= ay && ax >= az) return { face: x > 0 ? 0 : 1, u: y / ax, v: z / ax };
  if (ay >= az) return { face: y > 0 ? 2 : 3, u: z / ay, v: x / ay };
  return { face: z > 0 ? 4 : 5, u: x / az, v: y / az };
}
export function faceDir({ face, u, v }) {
  const s = face % 2 === 0 ? 1 : -1, d = face < 2 ? [s, u, v] : face < 4 ? [v, s, u] : [u, v, s], l = Math.hypot(...d);
  return d.map((c) => c / l);
}
