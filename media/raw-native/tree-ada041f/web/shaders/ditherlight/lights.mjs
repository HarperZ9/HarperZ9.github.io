// Light masks for dither-quantised lighting. A mask is a scalar field in [0, 1] times an
// intensity; the lighting pass adds them to the darkness level and resolves the sum through the
// threshold matrix. Both kinds are windowed (exactly zero outside their reach), so a light costs
// nothing where it does not touch.
//
// radial  { kind: "radial", pos, radius, core, intensity, wrap }
//     m = I (1 - q)^2 / (1 + r^2 / core^2), q = r^2 / radius^2 (0 at q >= 1), times a wrapped
//     N.L, (N.L + wrap) / (1 + wrap) clamped to [0, 1].
// beam    { kind: "beam", pos, dir, tan, bit, outer, inner, range, intensity, slats, duty, wrap }
//     the cone is a smoothstep on cos(angle) between the outer and inner half-angle; the range
//     falls off linearly; `slats` > 0 cuts the cone into that many angular blades (a lighthouse
//     fan) of the given duty, with soft edges.
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function beamBasis(dir) {
  const d = Math.hypot(...dir), D = dir.map((v) => v / d), up = Math.abs(D[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  let t = [D[1] * up[2] - D[2] * up[1], D[2] * up[0] - D[0] * up[2], D[0] * up[1] - D[1] * up[0]];
  const tl = Math.hypot(...t); t = t.map((v) => v / tl);
  const b = [D[1] * t[2] - D[2] * t[1], D[2] * t[0] - D[0] * t[2], D[0] * t[1] - D[1] * t[0]];
  return { dir: D, tan: t, bit: b };
}
export function makeBeam({ pos, dir, outerDeg = 9, innerDeg = 4, range = 40, intensity = 1.6, slats = 0, duty = 0.5, phase = 0, wrap = 0.1 }) {
  const b = beamBasis(dir);
  return { kind: "beam", pos, ...b, outer: Math.cos((outerDeg * Math.PI) / 180), inner: Math.cos((innerDeg * Math.PI) / 180), range, intensity, slats, duty, phase, wrap };
}
export const makeRadial = ({ pos, radius = 7, core = 1.5, intensity = 1, wrap = 0.3 }) => ({ kind: "radial", pos, radius, core, intensity, wrap });

// Mask value at a world position, before the surface term and the shadow.
export function maskAt(L, P) {
  const v = [P[0] - L.pos[0], P[1] - L.pos[1], P[2] - L.pos[2]], r2 = dot(v, v);
  if (L.kind === "radial") {
    const q = r2 / (L.radius * L.radius);
    return q >= 1 ? 0 : (L.intensity * (1 - q) * (1 - q)) / (1 + r2 / (L.core * L.core));
  }
  const r = Math.sqrt(r2);
  if (r < 1e-4 || r >= L.range) return 0;
  const c = dot(v, L.dir) / r, cone = smooth(L.outer, L.inner, c);
  if (cone <= 0) return 0;
  let blade = 1;
  if (L.slats > 0) {
    const phi = Math.atan2(dot(v, L.bit), dot(v, L.tan)), c0 = Math.cos(Math.PI * L.duty);
    blade = smooth(c0 - 0.06, c0 + 0.06, Math.cos(L.slats * phi + L.phase));
  }
  return L.intensity * cone * blade * (1 - r / L.range);
}
// The surface term: wrapped N.L toward the light.
export function surfaceTerm(L, P, N) {
  const v = [L.pos[0] - P[0], L.pos[1] - P[1], L.pos[2] - P[2]], l = Math.hypot(...v);
  if (l < 1e-6) return 1;
  return sat((dot(N, v) / l + L.wrap) / (1 + L.wrap));
}
