// Thin-film anti-reflection coating: the reflectance of one layer (index n1, thickness d nm)
// on glass (index ns), seen from air, at wavelength nm and angle of incidence theta (radians),
// averaged over s and p polarisation. Airy summation of the two interfaces:
//   r = (r01 + r12 e^{i delta}) / (1 + r01 r12 e^{i delta}),  delta = 4 pi n1 d cos(theta1) / lambda.
// A quarter-wave layer (n1 d = lambda0 / 4) cancels reflection near lambda0 and leaves the ends
// of the spectrum reflecting, which is why single-layer coated lenses flare magenta.
export const COATING = { n1: 1.38, quarterAt: 550, ns: 1.52 }; // a magnesium-fluoride-like layer on crown

function fresnel(n0, n1, c0, c1) {
  return [(n0 * c0 - n1 * c1) / (n0 * c0 + n1 * c1), (n1 * c0 - n0 * c1) / (n1 * c0 + n0 * c1)]; // [rs, rp]
}
// |(a + b e^{i d}) / (1 + a b e^{i d})|^2 for real a, b.
function airy(a, b, d) {
  const c = Math.cos(d), s = Math.sin(d);
  const nr = a + b * c, ni = b * s, dr = 1 + a * b * c, di = a * b * s;
  return (nr * nr + ni * ni) / (dr * dr + di * di);
}
export function filmReflectance(nm, theta = 0, coat = COATING, ns = coat.ns) {
  const n0 = 1, n1 = coat.n1, d = coat.quarterAt / (4 * n1);
  if (d <= 0 || coat.n1 <= 0) return bare(theta, ns);
  const s0 = Math.sin(theta), c0 = Math.cos(theta);
  const s1 = (n0 * s0) / n1, c1 = Math.sqrt(1 - s1 * s1), s2 = (n0 * s0) / ns, c2 = Math.sqrt(1 - s2 * s2);
  const [r01s, r01p] = fresnel(n0, n1, c0, c1), [r12s, r12p] = fresnel(n1, ns, c1, c2);
  const delta = (4 * Math.PI * n1 * d * c1) / nm;
  return 0.5 * (airy(r01s, r12s, delta) + airy(r01p, r12p, delta));
}
// An uncoated glass surface (the control the coating is measured against).
export function bare(theta = 0, ns = COATING.ns) {
  const s0 = Math.sin(theta), c0 = Math.cos(theta), s2 = s0 / ns, c2 = Math.sqrt(1 - s2 * s2);
  const [rs, rp] = fresnel(1, ns, c0, c2);
  return 0.5 * (rs * rs + rp * rp);
}
// The closed form at the design wavelength and normal incidence, for the tests:
//   R = ((n0 ns - n1^2) / (n0 ns + n1^2))^2.
export const quarterWaveMinimum = (n1 = COATING.n1, ns = COATING.ns) => ((ns - n1 * n1) / (ns + n1 * n1)) ** 2;

// WGSL twin of filmReflectance (the pass evaluates it per ghost at the source's field angle).
export const COATING_WGSL = /* wgsl */ `
fn lens_fr(n0: f32, n1: f32, c0: f32, c1: f32) -> vec2f {
  return vec2f((n0 * c0 - n1 * c1) / (n0 * c0 + n1 * c1), (n1 * c0 - n0 * c1) / (n1 * c0 + n0 * c1));
}
fn lens_airy(a: f32, b: f32, d: f32) -> f32 {
  let c = cos(d); let s = sin(d);
  let nr = a + b * c; let ni = b * s; let dr = 1.0 + a * b * c; let di = a * b * s;
  return (nr * nr + ni * ni) / (dr * dr + di * di);
}
fn lens_film(nm: f32, theta: f32, n1: f32, quarter: f32, ns: f32) -> f32 {
  let d = quarter / (4.0 * n1);
  let s0 = sin(theta); let c0 = cos(theta);
  let s1 = s0 / n1; let c1 = sqrt(1.0 - s1 * s1); let s2 = s0 / ns; let c2 = sqrt(1.0 - s2 * s2);
  let r01 = lens_fr(1.0, n1, c0, c1); let r12 = lens_fr(n1, ns, c1, c2);
  let delta = (4.0 * 3.141592653589793 * n1 * d * c1) / nm;
  return 0.5 * (lens_airy(r01.x, r12.x, delta) + lens_airy(r01.y, r12.y, delta));
}
`;
