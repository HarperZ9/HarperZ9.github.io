// optics.js: the GLSL optics the home hero shades with, kept in one string so the browser test compiles the same
// source and checks it against known answers (tests/hero-physical.cjs): N-BK7 at normal incidence reflects 4.2 %, a
// zero-thickness film equals the bare interface, a quarter-wave MgF2 layer on BK7 reflects 1.27 % at its design
// wavelength, and blue bends more than red through the same glass.
export const OPTICS = /* glsl */ `
// unpolarised Fresnel reflectance from air into a dielectric of real index n (the same real-arithmetic form as the
// materials library: rs = (c - w)/(c + w), rp = (n^2 c - w)/(n^2 c + w), w = sqrt(n^2 - sin^2))
float fresnelDielectric(float cosi, float n) {
  float c = clamp(cosi, 0.0, 1.0), s2 = 1.0 - c * c, n2 = n * n, t2 = n2 - s2;
  if (t2 <= 0.0) return 1.0;
  float w = sqrt(t2), rs = (c - w) / (c + w), rp = (n2 * c - w) / (n2 * c + w);
  return 0.5 * (rs * rs + rp * rp);
}
// Airy reflectance of one thin film (index nf, thickness d nm) on a substrate of index n, at wavelength lam nm.
// At d = 0 it reduces exactly to fresnelDielectric(cosi, n).
float filmReflect(float cosi, float nf, float n, float d, float lam) {
  float c0 = clamp(cosi, 0.0, 1.0), s2 = 1.0 - c0 * c0;
  float c1 = sqrt(max(0.0, 1.0 - s2 / (nf * nf))), c2 = sqrt(max(0.0, 1.0 - s2 / (n * n)));
  float r01s = (c0 - nf * c1) / (c0 + nf * c1), r12s = (nf * c1 - n * c2) / (nf * c1 + n * c2);
  float r01p = (nf * c0 - c1) / (nf * c0 + c1), r12p = (n * c1 - nf * c2) / (n * c1 + nf * c2);
  float cd = cos(12.566370614 * nf * d * c1 / lam);
  float Rs = (r01s * r01s + r12s * r12s + 2.0 * r01s * r12s * cd) / (1.0 + r01s * r01s * r12s * r12s + 2.0 * r01s * r12s * cd);
  float Rp = (r01p * r01p + r12p * r12p + 2.0 * r01p * r12p * cd) / (1.0 + r01p * r01p * r12p * r12p + 2.0 * r01p * r12p * cd);
  return 0.5 * (Rs + Rp);
}
// screen-space displacement of the scene seen through a glass slab: refract in through the curved front (normal
// nrm, viewer looking down -z), cross thickness T, refract out of the flat back, then travel D to the scene behind.
// Total internal reflection at the back returns a flag in z.
vec3 slabOffset(vec3 nrm, float n, float T, float D) {
  vec3 t1 = refract(vec3(0.0, 0.0, -1.0), nrm, 1.0 / n);
  vec3 t2 = refract(t1, vec3(0.0, 0.0, 1.0), n);
  if (dot(t2, t2) < 1e-6) return vec3(t1.xy / max(1e-3, -t1.z) * T, 1.0);
  return vec3(t1.xy / max(1e-3, -t1.z) * T + t2.xy / max(1e-3, -t2.z) * D, 0.0);
}
// GGX normal distribution, for the lamp's highlight on glass and its glitter path on the water
float ggx(float nh, float a) { float a2 = a * a, d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (3.14159265 * d * d); }
`;
