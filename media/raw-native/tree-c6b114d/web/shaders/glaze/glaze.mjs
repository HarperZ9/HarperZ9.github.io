// Interference glazes: pearlescent flakes (a titanium-dioxide film on mica) in a glaze over the
// painter's Kubelka-Munk body colour, evaluated on the paint's 31 wavelengths.
//
// Each flake reflects by thin-film interference: the reflections from the top and bottom of the
// film add in phase at some wavelengths and cancel at others, and the pattern slides toward blue as
// the viewing angle grows (Airy's formula, s and p averaged). The flake layer is non-absorbing, so
// what it does not reflect it passes to the body paint and back; the two layers combine by
// Kubelka's two-layer formula R = Rf + Tf^2 Rb / (1 - Rf Rb). The body is the pixel's own pigment
// latent, so where the flakes reflect green the body shows in the complementary hue, as real
// interference paint does over a dark ground. Prior work renders pearlescent car paint
// photorealistically (Ershov, Kolchin, Myszkowski, CGF 2001); this is a stylised pass with film
// thickness as an artistic field (oil slick, bruise, beetle shell).
//   cos(theta_air) = |n . v|; Snell into the binder (n0) and the film (n1)
//   delta = 4 pi n1 d cos(theta1) / lambda;  R = (r01^2 + r12^2 + 2 r01 r12 cos delta) / (1 + r01^2 r12^2 + 2 r01 r12 cos delta)
//   Rf = coverage R;  R_total = Rf + (1 - Rf)^2 Rb / (1 - Rf Rb)
// The RGB residual of the latent is carried additively, so with no flakes the result is the albedo.
// Film index: rutile-like Cauchy n(lambda) = A + B / lambda^2 (A 2.2, B 0.08 um^2; low confidence,
// from memory) or a constant for the tests.
import { LAMBDA, K_TAB, S_TAB, W_TAB } from "../paint/pigments.mjs";
import { latentOf } from "../lightpaint/lightpaint.mjs";
import { hash3 } from "../common.mjs";

export const GLAZE_PRESETS = {
  beetle: { d0: 330, dVar: 0, noiseScale: 0.4, coverage: 0.7, n0: 1.5, n2: 1.58, A: 2.2, B: 0.08, dispersion: true },
  "oil-slick": { d0: 140, dVar: 220, noiseScale: 0.45, coverage: 0.55, n0: 1.5, n2: 1.58, A: 2.2, B: 0.08, dispersion: true },
  bruise: { d0: 230, dVar: 60, noiseScale: 0.18, coverage: 0.65, n0: 1.5, n2: 1.58, A: 2.2, B: 0.08, dispersion: true },
};
export const resolveGlaze = (preset, overrides = {}) => ({ p: { ...GLAZE_PRESETS[preset], filmN: 2.4, ...overrides } });

export const filmIndex = (p, lam) => (p.dispersion ? p.A + p.B / ((lam / 1000) ** 2) : p.filmN);

// Thin-film reflectance at one wavelength (nm) for a cosine of the angle in air.
export function filmReflectance(p, lam, cosAir, d) {
  const n0 = p.n0, n1 = filmIndex(p, lam), n2 = p.n2, sa = Math.sqrt(Math.max(0, 1 - cosAir * cosAir));
  const s0 = sa / n0, c0 = Math.sqrt(1 - s0 * s0), s1 = sa / n1, c1 = Math.sqrt(1 - s1 * s1), s2 = sa / n2, c2 = Math.sqrt(1 - s2 * s2);
  const delta = (4 * Math.PI * n1 * d * c1) / lam, cd = Math.cos(delta);
  const airy = (r01, r12) => (r01 * r01 + r12 * r12 + 2 * r01 * r12 * cd) / (1 + r01 * r01 * r12 * r12 + 2 * r01 * r12 * cd);
  const rs = airy((n0 * c0 - n1 * c1) / (n0 * c0 + n1 * c1), (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2));
  const rp = airy((n1 * c0 - n0 * c1) / (n1 * c0 + n0 * c1), (n2 * c1 - n1 * c2) / (n2 * c1 + n1 * c2));
  return 0.5 * (rs + rp);
}

// Smooth 3D value noise in [0, 1] on the surface's world position (so the film sticks to the
// surface as the camera moves): trilinear over hashed lattice values with a quintic fade, two
// octaves. A first version used 2D screen-space noise with a cubic fade; its lattice showed as
// squares through the interference colours and it swam under camera motion.
const fade5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function vnoise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade5(x - xi), v = fade5(y - yi), w = fade5(z - zi);
  const h = (i, j, k) => hash3((i + 4096) >>> 0, (j + 4096) >>> 0, ((k + 4096) * 131 + seed) >>> 0);
  const lx = (j, k) => h(xi, j, k) * (1 - u) + h(xi + 1, j, k) * u, ly = (k) => lx(yi, k) * (1 - v) + lx(yi + 1, k) * v;
  return ly(zi) * (1 - w) + ly(zi + 1) * w;
}
export const thicknessAt = (p, q) => p.d0 + p.dVar * ((0.65 * vnoise3(q[0] / p.noiseScale, q[1] / p.noiseScale, q[2] / p.noiseScale, 17) + 0.35 * vnoise3(q[0] / (0.37 * p.noiseScale), q[1] / (0.37 * p.noiseScale), q[2] / (0.37 * p.noiseScale), 29)) - 0.5) * 2;

// Body reflectance spectrum of a latent's concentrations.
export function bodySpectrum(c) {
  const R = new Float64Array(LAMBDA.length);
  for (let w = 0; w < LAMBDA.length; w++) {
    let K = 0, S = 0; for (let i = 0; i < 4; i++) { K += c[i] * K_TAB[w][i]; S += c[i] * S_TAB[w][i]; }
    const q = K / Math.max(S, 1e-9); R[w] = 1 + q - Math.sqrt(q * q + 2 * q);
  }
  return R;
}

// The glazed colour of one pixel: albedo (linear RGB), view cosine, film thickness (nm).
export function glazeColour(p, alb, cosAir, d) {
  const a = latentOf(alb), Rb = bodySpectrum(a.c), out = [alb[0], alb[1], alb[2]];
  for (let w = 0; w < LAMBDA.length; w++) {
    const Rf = p.coverage * filmReflectance(p, LAMBDA[w], cosAir, d), Rt = Rf + ((1 - Rf) * (1 - Rf) * Rb[w]) / (1 - Rf * Rb[w]);
    for (let k = 0; k < 3; k++) out[k] += W_TAB[w][k] * (Rt - Rb[w]);
  }
  return out;
}

// A frame from the street fixture: lit pixels get the glaze, under the same irradiance.
export function runGlaze(plan, src) {
  const p = plan.p, { width: w, height: h, camera: cam } = src, out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4, E = [src.light[o], src.light[o + 1], src.light[o + 2]];
    let c = E;
    if (src.kind[i] === 2) {
      const sx = ((x + 0.5) / w - 0.5) * 2 * cam.aspect * cam.tan, sy = (0.5 - (y + 0.5) / h) * 2 * cam.tan;
      const r = [cam.fwd[0] + cam.right[0] * sx + cam.up[0] * sy, cam.fwd[1] + cam.right[1] * sx + cam.up[1] * sy, cam.fwd[2] + cam.right[2] * sx + cam.up[2] * sy];
      const rl = Math.hypot(r[0], r[1], r[2]), cosAir = Math.min(1, Math.abs(src.normals[o] * r[0] + src.normals[o + 1] * r[1] + src.normals[o + 2] * r[2]) / rl);
      const t = src.depth[i] / rl, q = [cam.eye[0] + r[0] * t, cam.eye[1] + r[1] * t, cam.eye[2] + r[2] * t];
      const g = glazeColour(p, [src.albedo[o], src.albedo[o + 1], src.albedo[o + 2]], cosAir, thicknessAt(p, q));
      c = [g[0] * E[0], g[1] * E[1], g[2] * E[2]];
    }
    const f = src.fogT[i];
    for (let k = 0; k < 3; k++) out[o + k] = c[k] * (1 - f) + src.fogColor[k] * f;
    out[o + 3] = 1;
  }
  return { width: w, height: h, data: out };
}
