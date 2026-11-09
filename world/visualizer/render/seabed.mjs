// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// seabed.mjs: looking down through moving water at a sand floor. Two optical effects of one surface h(x, y):
//   refraction  the floor is seen displaced by the surface slope: offset = -depth * grad h (small-angle Snell,
//               the lateral shift a slab of water of that depth gives)
//   caustics    light focused by the same surface: irradiance on the floor is the inverse area change of the
//               refracted ray bundle, 1 / |det(I + d * Hess h)|, clamped, then normalised so open floor averages 1
//               (energy moves; it is not created)
// h is the wave-equation surface from water.mjs (the drops, at grid scale) plus six seeded directional
// ripples at render scale (the fine net), whose amplitude the sound can drive.
//
//   seabed(plate, surface, t, P) -> raster          plate: raster (linear light), the floor seen from above
//   P: { depth (share of height), caustic (0..2), focus (share of height), fine (0..2), fineScale (share of
//        height), exposure, sun: hex, causticRes (share of the frame the caustic map is solved at),
//        crest (0..2): the wavefronts of the drops drawn as thin light where the simulated surface crosses
//        crestLevel, a contour located by distance over gradient so the line stays one pixel wide at any size }
//   SPEC: at 1920 x 1080 about 120 ms on one core (caustic map at half size).
import { raster, sample, clamp, hexLin, boxBlur, random } from '../../glass/lib/raster.js';

export const SEABED = Object.freeze({ depth: 0.05, caustic: 0.85, focus: 1.0, fine: 1, fineScale: 0.13, fineSpeed: 0.35, exposure: 1, sun: '#dbe7ff', causticRes: 0.5, simGain: 1, seed: 47, floor: 0.1, contrast: 1.3, crest: 0.55, crestLevel: 0.22, crestColour: '#cfe0ff' });

// The fine surface: a random-phase sum of 32 gravity-like waves, directions uniform, wavelengths log-uniform over
// 0.55 to 1.8 of the feature size, amplitude proportional to wavelength (equal slope), each moving at a speed that
// grows with the square root of its wavelength (deep-water dispersion). A few sines make a lattice of caustics;
// 32 with random directions make the irregular net that water shows.
export function spectrum(seed) {
  const r = random(`sea-spectrum/${seed}`);
  return Array.from({ length: 32 }, () => { const a = 2 * Math.PI * r(), L = 0.55 * (1.8 / 0.55) ** r(); return { kx: Math.cos(a), ky: Math.sin(a), L, ph: 2 * Math.PI * r(), amp: L * (0.6 + 0.4 * r()) }; });
}
const SPEC = new Map();
function fineHeight(x, y, t, lam, speed, seed) {
  if (!SPEC.has(seed)) SPEC.set(seed, spectrum(seed));
  let v = 0;
  for (const q of SPEC.get(seed)) v += q.amp * Math.sin(2 * Math.PI * ((q.kx * x + q.ky * y) / (q.L * lam) - speed * t / Math.sqrt(q.L)) + q.ph);
  return v / 5.6;
}

// Cubic B-spline sample of the simulation grid (C2, so the Hessian taken from it is smooth: a bilinear sample has
// zero curvature inside cells and spikes on the grid lines, which drew stripes of false caustics)
function bspline(t) { const t2 = t * t, t3 = t2 * t; return [(1 - 3 * t + 3 * t2 - t3) / 6, (4 - 6 * t2 + 3 * t3) / 6, (1 + 3 * t + 3 * t2 - 3 * t3) / 6, t3 / 6]; }
function grid(S, gx, gy) {
  const { nx, ny, u } = S, x0 = Math.floor(gx), y0 = Math.floor(gy), wx = bspline(gx - x0), wy = bspline(gy - y0);
  let v = 0;
  for (let j = 0; j < 4; j++) { const yy = Math.min(ny - 1, Math.max(0, y0 + j - 1)) * nx; let r = 0; for (let i = 0; i < 4; i++) r += wx[i] * u[yy + Math.min(nx - 1, Math.max(0, x0 + i - 1))]; v += wy[j] * r; }
  return v;
}

export function seabed(plate, surface, t, P = {}) {
  const p = { ...SEABED, ...P }, { w, h } = plate;
  const cw = Math.max(16, Math.round(w * p.causticRes)), ch = Math.max(9, Math.round(h * p.causticRes)), s = w / cw;
  const lam = p.fineScale * h / s;            // fine feature size in caustic-map pixels
  // height on the caustic grid: simulation (upsampled) plus the fine ripples, in units of caustic-map pixels
  const H = new Float32Array(cw * ch), simScale = surface ? p.simGain * 2.2 * (surface.nx / cw) : 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let v = surface ? simScale * grid(surface, (x + 0.5) / cw * surface.nx - 0.5, (y + 0.5) / ch * surface.ny - 0.5) : 0;
    v += p.fine * 0.1 * lam * fineHeight(x, y, t, lam, p.fineSpeed, p.seed);
    H[y * cw + x] = v;
  }
  // slopes and the Jacobian of the refracted bundle
  const d = p.focus * h / s / 40, I = new Float32Array(cw * ch), SX = new Float32Array(cw * ch), SY = new Float32Array(cw * ch);
  // reflect at the edges, so one-sided differences do not draw a bright line along the frame
  const rf = (i, n) => (i < 0 ? -i : i >= n ? 2 * n - 2 - i : i), at = (x, y) => H[rf(y, ch) * cw + rf(x, cw)];
  let mean = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x, c = at(x, y);
    const hx = 0.5 * (at(x + 1, y) - at(x - 1, y)), hy = 0.5 * (at(x, y + 1) - at(x, y - 1));
    const hxx = at(x + 1, y) - 2 * c + at(x - 1, y), hyy = at(x, y + 1) - 2 * c + at(x, y - 1);
    const hxy = 0.25 * (at(x + 1, y + 1) - at(x - 1, y + 1) - at(x + 1, y - 1) + at(x - 1, y - 1));
    const det = (1 + d * hxx) * (1 + d * hyy) - d * d * hxy * hxy;
    I[i] = Math.min(1 / p.floor, 1 / Math.max(p.floor, Math.abs(det))); mean += I[i]; SX[i] = hx; SY[i] = hy;
  }
  mean /= cw * ch;
  const Ib = I;
  const sun = hexLin(p.sun), crestC = hexLin(p.crestColour), out = raster(w, h), depthPx = p.depth * h;
  const C = { w: cw, h: ch, data: Ib }, GX = { w: cw, h: ch, data: SX }, GY = { w: cw, h: ch, data: SY };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / s, v = (y + 0.5) / s;
    const gx = bil(GX, u, v), gy = bil(GY, u, v), L = (bil(C, u, v) / mean) ** p.contrast;
    const sx = x + 0.5 - depthPx * gx * 0.08, sy = y + 0.5 - depthPx * gy * 0.08, j = (y * w + x) * 4;
    // caustics fade with depth toward the bottom of the frame, where the floor falls away from the light
    const k = p.exposure * (1 + p.caustic * (1 - 0.55 * (y / h) ** 1.3) * (L - 1));
    let crest = 0;
    if (surface && p.crest > 0) {
      // the drop rings: a contour of the simulated surface at crestLevel, one device pixel wide
      const gxs = (x + 0.5) / w * surface.nx - 0.5, gys = (y + 0.5) / h * surface.ny - 0.5, cell = w / surface.nx;
      const u0 = grid(surface, gxs, gys), dux = (grid(surface, gxs + 0.25, gys) - grid(surface, gxs - 0.25, gys)) * 2 / cell, duy = (grid(surface, gxs, gys + 0.25) - grid(surface, gxs, gys - 0.25)) * 2 / cell;
      const d = Math.abs(u0 - p.crestLevel) / Math.max(1e-6, Math.hypot(dux, duy));
      crest = p.crest * Math.max(0, 1 - d / 0.9) * Math.min(1, Math.hypot(dux, duy) * cell * 4);
    }
    for (let c = 0; c < 3; c++) out.data[j + c] = Math.max(0, sample(plate, sx, sy, c) * k * (c === 2 ? 1 : 0.92 + 0.08 * sun[c] / Math.max(1e-6, sun[2])) + crest * crestC[c]);
    out.data[j + 3] = 1;
  }
  return out;
}
function bil(F, x, y) {
  const { w, h, data } = F; x = clamp(x - 0.5, 0, w - 1.001); y = clamp(y - 0.5, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (data[i] * (1 - fx) + data[i + 1] * fx) * (1 - fy) + (data[i + w] * (1 - fx) + data[i + w + 1] * fx) * fy;
}

// The floor itself: a shaded relief field (from the superframe plate chain) coloured through three stops of one
// hue and lit from the top of the frame, so the picture keeps one blue as image 47 does without its pixels.
export function tintPlate(field, w, h, { stops = ['#02040b', '#0b1d4a', '#1d4fae', '#b4cdf5'], light = 0.8, gain = 1, relief = 0.16, blur = 0.004 } = {}) {
  // stops are mixed in sRGB (so the mid-tones keep their saturation) and converted to linear light per pixel
  const S = stops.map(hx => { const n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255); }), R = raster(w, h), F = field;
  const lin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), seg = S.length - 1;
  // the relief only modulates (a floor seen through metres of water is soft), and a little defocus softens it more
  let V = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) V[y * w + x] = 0.5 + relief * (bil(F, (x + 0.5) / w * F.w, (y + 0.5) / h * F.h) - 0.5);
  const br = Math.round(blur * h); if (br > 0) V = boxBlur(V, w, h, br, { passes: 2 });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // light falls from the top of the frame and fades with depth toward the bottom; a broad pool sits off centre
    const u = x / w, v = y / h, pool = Math.exp(-(((u - 0.62) / 0.5) ** 2 + ((v - 0.2) / 0.55) ** 2));
    const top = (1 - light * v ** 0.9) * (0.55 + 0.45 * pool);
    const q = clamp(gain * 1.45 * V[y * w + x] * top) * seg, i0 = Math.min(seg - 1, Math.floor(q)), f = q - i0, j = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) R.data[j + k] = lin(S[i0][k] + (S[i0 + 1][k] - S[i0][k]) * f);
    R.data[j + 3] = 1;
  }
  return R;
}
