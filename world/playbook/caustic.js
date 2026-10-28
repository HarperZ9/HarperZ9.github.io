// caustic.js: dispersion and caustics from wavelength-sampled photons through a height-field lens.
//
// Light falls on a slab of glass whose top surface is a height field h(x, y). Each photon carries one wavelength.
// It refracts at the top surface with Snell's law in vector form, crosses the slab, refracts out of the flat
// bottom and lands on a receiving plane, where it is splatted (bilinear) into a float buffer. The index follows
// Cauchy's equation n(lambda) = A + B / lambda^2, fitted to the glass's n_d (587.56 nm) and Abbe number V_d
// (F 486.13 nm, C 656.27 nm), so low-Abbe flint splits colour on every cusp and crown barely does.
//
// Colour: each wavelength maps to CIE 1931 XYZ through the multi-lobe Gaussian fit of Wyman, Sloan and Shirley
// (2013, JCGT 2(2)), then to linear sRGB (IEC 61966-2-1 matrix). The sum over the sampled band is scaled to
// neutral, so a flat lens lands as white light. Signed sRGB values are kept through the sum and clamped after.
// Develop: luminance tone shoulder (extended Reinhard), a hue-keeping ceiling below code 255 (QUALITY-SPEC R6),
// float throughout, TPDF dither at output (R2), clumped grain (R4).
//
// One flare per view (the art direction's single spectral flare): a four-point star at the brightest caustic,
// whose spikes scale with wavelength as diffraction spikes do, and one lens ghost mirrored through the centre,
// tinted by the anti-reflection coating's thin-film colour from substrate/lib/thinfilm.mjs (MgF2, n 1.38, between
// air and glass, so neither reflection flips: flip false). Synthesized from the substrate's thin film, the photon
// method of the Shadytracer direction (ideas only), the four-point stamp of the July caustic family and the
// one-flare rule. The gibkun1 light-leak overlays stay unused.
import { image, grain } from './lib/raster.js';
import { hash01, toSrgb, clamp } from './lib/util.js';
import { defineNode } from './lib/node.js';
import { filmLinear } from '../substrate/lib/thinfilm.mjs';

export const FRAUNHOFER = Object.freeze({ F: 486.13, d: 587.56, C: 656.27 });
export const GLASS = Object.freeze({ water: { nd: 1.333, abbe: 55.7 }, crown: { nd: 1.5168, abbe: 64.17 }, flint: { nd: 1.7552, abbe: 27.58 } });

export function cauchy({ nd = 1.5168, abbe = 64.17 } = {}) {
  const { F, d, C } = FRAUNHOFER, B = (nd - 1) / (abbe * (1 / (F * F) - 1 / (C * C))), A = nd - B / (d * d);
  return { A, B, n: (l) => A + B / (l * l) };
}

// Vector refraction, GLSL convention: I incident unit, N unit facing against I, eta = n_from / n_to. Null on TIR.
export function refract(I, N, eta) {
  const c = I[0] * N[0] + I[1] * N[1] + I[2] * N[2], k = 1 - eta * eta * (1 - c * c);
  if (k < 0) return null;
  const s = eta * c + Math.sqrt(k);
  return [eta * I[0] - s * N[0], eta * I[1] - s * N[1], eta * I[2] - s * N[2]];
}

// CIE 1931 2-degree observer, Wyman, Sloan and Shirley (2013) multi-lobe fit.
const g = (l, m, s1, s2) => { const t = (l - m) / (l < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
export function cie(l) {
  return [1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
    0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
    1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)];
}
export const xyzToLinear = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];

// Stratified wavelengths over a band with their linear sRGB weights, normalised so the band sums to white.
export function spectrum(M = 16, lo = 400, hi = 700) {
  const ls = Array.from({ length: M }, (_, i) => lo + ((i + 0.5) * (hi - lo)) / M), rgb = ls.map((l) => xyzToLinear(cie(l)));
  const sum = [0, 1, 2].map((c) => rgb.reduce((s, v) => s + v[c], 0));
  return ls.map((l, i) => ({ l, rgb: rgb[i].map((v, c) => (v * M) / sum[c]) }));
}

// Height fields with analytic gradients. waves: plane waves; rings: circular waves; wedge: a prism face; cap: a lens.
export function field(def) {
  const { waves = [], rings = [], wedge = 0, cap = 0, t = 0 } = def;
  return {
    h(x, y) {
      let v = wedge * x + (cap ? cap * (1 - x * x - y * y) : 0);
      for (const w of waves) v += w.a * Math.sin((w.dx * x + w.dy * y) * w.k - w.w * t + w.phi);
      for (const r of rings) { const d = Math.hypot(x - r.cx, y - r.cy); v += r.a * Math.sin(d * r.k - r.w * t + r.phi); }
      return v;
    },
    grad(x, y) {
      let gx = wedge - (cap ? 2 * cap * x : 0), gy = cap ? -2 * cap * y : 0;
      for (const w of waves) { const c = w.a * w.k * Math.cos((w.dx * x + w.dy * y) * w.k - w.w * t + w.phi); gx += c * w.dx; gy += c * w.dy; }
      for (const r of rings) { const dx = x - r.cx, dy = y - r.cy, d = Math.hypot(dx, dy) || 1e-9, c = (r.a * r.k * Math.cos(d * r.k - r.w * t + r.phi)) / d; gx += c * dx; gy += c * dy; }
      return [gx, gy];
    },
  };
}

// A seeded water-like surface: plane waves in several directions plus two slow rings.
export function surface(seed = 3, t = 0, amp = 1) {
  const waves = [], rings = [];
  for (let i = 0; i < 6; i++) { const a = 2 * Math.PI * hash01(seed, i), k = 3 + 7 * hash01(seed, i + 40); waves.push({ dx: Math.cos(a), dy: Math.sin(a), k, a: (amp * 0.022) / (1 + 0.25 * k), w: 0.6 + 0.9 * hash01(seed, i + 80), phi: 6.283 * hash01(seed, i + 120) }); }
  for (let i = 0; i < 2; i++) rings.push({ cx: hash01(seed, i + 200) * 1.6 - 0.8, cy: hash01(seed, i + 240) * 1.6 - 0.8, k: 9 + 5 * hash01(seed, i + 280), a: amp * 0.006, w: 1.3, phi: 0 });
  return { waves, rings, t };
}

// Trace one photon. Returns { x, y } on the plane at depth D below the slab, or null on total internal reflection.
export function trace(F, x, y, n, { T = 0.2, D = 1.2, L = [0, 0, -1] } = {}) {
  const [gx, gy] = F.grad(x, y), m = Math.hypot(gx, gy, 1), N = [-gx / m, -gy / m, 1 / m];
  const d1 = refract(L, N, 1 / n); if (!d1 || d1[2] >= 0) return null;
  const s1 = (T + F.h(x, y)) / -d1[2], bx = x + d1[0] * s1, by = y + d1[1] * s1;
  const d2 = refract(d1, [0, 0, 1], n); if (!d2 || d2[2] >= 0) return null;
  const s2 = D / -d2[2];
  return { x: bx + d2[0] * s2, y: by + d2[1] * s2, dir: d2 };
}

// Splat photons into a linear RGB accumulation, normalised so a flat lens gives 1 everywhere it lands.
// The lens rectangle defaults to the view plus a 30% margin, so the light covers the whole plane with no lens edge.
export function splat(F, { w = 320, h = 200, n = 400, M = 12, glass = GLASS.flint, T = 0.2, D = 1.2, view = 1, lens = null, L = [0, 0, -1], seed = 1, lambdas = null } = {}) {
  const acc = new Float32Array(w * h * 3), cy = cauchy(glass), spec = lambdas ? lambdas.map((l) => ({ l, rgb: [1, 1, 1] })) : spectrum(M);
  const sx = w / (2 * view * (w / h > 1 ? w / h : 1)), sy = sx, [lx, ly] = lens || [(w / sx / 2) * 1.3, (h / sy / 2) * 1.3], E0 = (n * n * spec.length) / (4 * lx * ly) / (sx * sy);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const id = j * n + i;
    for (let m = 0; m < spec.length; m++) {
      const x = lx * (-1 + (2 * (i + hash01(seed, id * 7 + m))) / n), y = ly * (-1 + (2 * (j + hash01(seed ^ 0x9e37, id * 7 + m))) / n);
      const p = trace(F, x, y, cy.n(spec[m].l), { T, D, L }); if (!p) continue;
      const fx = p.x * sx + w / 2 - 0.5, fy = -p.y * sy + h / 2 - 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, c = spec[m].rgb;
      for (const [ox, oy, wt] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
        const X = ix + ox, Y = iy + oy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const k = (Y * w + X) * 3; acc[k] += c[0] * wt; acc[k + 1] += c[1] * wt; acc[k + 2] += c[2] * wt;
      }
    }
  }
  for (let i = 0; i < acc.length; i++) acc[i] /= E0;
  return { acc, w, h, sx, sy };
}

const Y = (r, g2, b) => 0.2126 * r + 0.7152 * g2 + 0.0722 * b;

// The brightest point after a small box blur (the flare's home), in pixel coordinates, inside a margin.
export function peak({ acc, w, h }, margin = 0.18) { // the flare stays inside the composition, away from the frame edge
  let best = -1, bx = w / 2, by = h / 2; const mx = Math.max(2, Math.round(w * margin)), my = Math.max(2, Math.round(h * margin));
  for (let y = my; y < h - my; y += 1) for (let x = mx; x < w - mx; x += 1) {
    let s = 0; for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) { const k = ((y + v) * w + x + u) * 3; s += Y(acc[k], acc[k + 1], acc[k + 2]); }
    if (s > best) { best = s; bx = x; by = y; }
  }
  return [bx, by];
}

// The one flare: a four-point star whose arms scale with wavelength, and a coating ghost mirrored through the centre.
export function flare(acc, w, h, [px, py], { size = 0.11, gain = 24, ghost = 1.2, coatNm = [96, 138] } = {}) {
  const S = size * Math.min(w, h), spec = spectrum(8);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - px, dy = y - py, k = (y * w + x) * 3;
    for (const s of spec) {
      const len = (S * s.l) / 550, arm = (a, b) => Math.exp(-Math.abs(a) / len) * Math.exp(-(b * b) / 1.2);
      const v = (gain * (arm(dx, dy) + arm(dy, dx))) / spec.length;
      acc[k] += s.rgb[0] * v; acc[k + 1] += s.rgb[1] * v; acc[k + 2] += s.rgb[2] * v;
    }
    const rr = Math.hypot(dx, dy), core = gain * (0.7 * Math.exp(-(rr * rr) / (2 * (S * 0.035) ** 2)) + 0.12 * Math.exp(-rr / (S * 0.45))); // warm core, wide faint halo
    acc[k] += core; acc[k + 1] += core * 0.86; acc[k + 2] += core * 0.66;
    const gx = x - (w - px), gy = y - (h - py), r = Math.hypot(gx, gy) / (S * 0.55), ring = Math.exp(-((r - 1) ** 2) / 0.012) + 0.25 * Math.exp(-r * r * 3);
    if (ring > 1e-3) { const c = filmLinear(coatNm[0] + (coatNm[1] - coatNm[0]) * clamp(r), { n: 1.38, flip: false }); for (let q = 0; q < 3; q++) acc[k + q] += ghost * ring * c[q]; }
  }
  return acc;
}

// Develop the accumulation onto a ground: shoulder, hue-keeping ceiling, sRGB, grain, ready for toRGBA8 (TPDF dither).
export function develop({ acc, w, h }, { exposure = 0.1, white = 6, ground = [0.012, 0.012, 0.011], tint = [1, 0.97, 0.92], grainSd = 1.6, seed = 5 } = {}) {
  const im = image(w, h);
  for (let i = 0; i < w * h; i++) {
    let r = acc[i * 3] * exposure * tint[0], gg = acc[i * 3 + 1] * exposure * tint[1], b = acc[i * 3 + 2] * exposure * tint[2];
    const L0 = Math.max(1e-6, Y(r, gg, b)), L1 = (L0 * (1 + L0 / (white * white))) / (1 + L0), s = L1 / L0;
    r = Math.max(0, r * s) + ground[0]; gg = Math.max(0, gg * s) + ground[1]; b = Math.max(0, b * s) + ground[2];
    const m = Math.max(r, gg, b), cap = 0.94; if (m > cap) { const f = cap / m; r *= f; gg *= f; b *= f; }
    im.data[i * 4] = toSrgb(r); im.data[i * 4 + 1] = toSrgb(gg); im.data[i * 4 + 2] = toSrgb(b); im.data[i * 4 + 3] = 1;
  }
  return grainSd ? grain(im, { sd: grainSd, seed }) : im;
}

// The whole CPU reference: surface, photons, the one flare, develop.
export function render({ w = 320, h = 200, n = 360, M = 12, seed = 3, t = 0, glass = GLASS.flint, T = 0.2, D = 1.6, L, amp = 1.6, flareOn = true } = {}) {
  const F = field(surface(seed, t, amp)), buf = splat(F, { w, h, n, M, glass, T, D, L, seed });
  if (flareOn) flare(buf.acc, w, h, peak(buf));
  return develop(buf, { seed });
}

// Prism by vector refraction: deviation in degrees for apex angle A and incidence i (both degrees).
export function prismDeviation(lambda, { apexDeg = 60, incidenceDeg = 50, glass = GLASS.flint } = {}) {
  const n = cauchy(glass).n(lambda), A = apexDeg * Math.PI / 180, o1 = [-Math.cos(A / 2), 0, Math.sin(A / 2)], o2 = [Math.cos(A / 2), 0, Math.sin(A / 2)];
  const i = incidenceDeg * Math.PI / 180, inN = [-o1[0], 0, -o1[2]], perp = [-inN[2], 0, inN[0]]; // the ray arrives rotated by i from the inward normal, toward the apex
  const d0 = [inN[0] * Math.cos(i) + perp[0] * Math.sin(i), 0, inN[2] * Math.cos(i) + perp[2] * Math.sin(i)];
  const d1 = refract(d0, o1, 1 / n), d2 = d1 && refract(d1, [-o2[0], 0, -o2[2]], n);
  if (!d2) return null;
  return Math.acos(clamp(d0[0] * d2[0] + d0[2] * d2[2], -1, 1)) * 180 / Math.PI;
}

export const SPEC = Object.freeze({
  inputs: { surface: 'height-field def {waves, rings, wedge, cap, t}', light: 'unit vector, incoming' },
  params: {
    nd: { range: [1.3, 2.0], unit: 'refractive index at 587.56 nm', default: 1.7552 }, abbe: { range: [15, 95], unit: 'Abbe number V_d', default: 27.58 },
    thickness: { range: [0.01, 1], unit: 'lens half-widths', default: 0.2 }, distance: { range: [0.1, 4], unit: 'lens half-widths to the plane', default: 1.6 },
    photons: { range: [16, 2048], unit: 'lens samples per side', default: 360 }, wavelengths: { range: [1, 64], unit: 'stratified samples, 400 to 700 nm', default: 12 },
    amplitude: { range: [0, 3], unit: 'share of the seeded wave height', default: 1.6 }, exposure: { range: [0.02, 2], unit: 'multiple of flat irradiance', default: 0.1 },
    coatNm: { range: [60, 300], unit: 'nm, MgF2 coating thickness for the ghost', default: 110 },
  },
  determinism: 'photon jitter is hash01(seed, index): the same seed gives the same buffer, byte for byte',
  budget: 'CPU reference 320 x 200, 360^2 x 12 photons: about 1.5 s in node; the page uses the WebGL2 path (lib/caustic-gl.js), 896^2 x 12 photons into a 0.4-scale half-float target',
});

export const node = defineNode({
  id: 'caustic', ports: { in: { surface: 'data' }, out: { image: 'image' } }, params: SPEC.params, seed: 3,
  render: ({ seed, t = 0, w = 160, h = 100, params }) => render({ w, h, seed, t, n: Math.min(params.photons, 400), M: params.wavelengths, glass: { nd: params.nd, abbe: params.abbe }, T: params.thickness, D: params.distance, amp: params.amplitude }),
});
