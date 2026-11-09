// plates-surface.mjs: plates that model a surface under light. Each plate is (w, h, material, ctx) -> Layer.
// ctx: { seed, mask (Float32Array w*h word coverage, or null), u (px per thousandth of the width), drive }.
// Sizes are in u, so the 4K export and the preview draw the same picture at different resolution.
import { Layer, colour, chladni as chladniSource } from '../../feed-25/build/compose.mjs';
import { normalAt, shade } from '../../techniques/lib/raking.js';
import { filmLinear } from '../../substrate/lib/thinfilm.mjs';
import { field, ramp, noiseField, boxBlur, clamp, smooth, band, disc, rng, fbm } from './field.mjs';

const RAD = Math.PI / 180;

// Raked relief: a height field (aggregate, pits, the word pressed in with a chamfer), lit by a low lamp.
export function relief(w, h, m, ctx) {
  const c = m.core, u = ctx.u, R = rng(ctx.seed * 31 + 7);
  const big = noiseField(w, h, 90 * u, ctx.seed + 1, 4), fine = noiseField(w, h, 14 * u, ctx.seed + 2, 4);
  const H = field(w, h, (x, y, i) => 0.3 * big[i] + 0.1 * fine[i]);
  const pits = Math.round(c.particles * w * h / (900 * u * u));
  for (let k = 0; k < pits; k++) disc(H, w, h, R() * w, R() * h, (1 + 4 * R() ** 3) * u * 2, -0.12);
  if (ctx.mask) {
    // pressed letters: a chamfered wall (the blurred mask) and a burnished floor where the aggregate is trowelled flat
    const M = boxBlur(ctx.mask, w, h, Math.max(1, Math.round(4 * u)));
    for (let i = 0; i < H.length; i++) H[i] = H[i] * (1 - 0.75 * ctx.mask[i]) - 0.6 * M[i] * c.relief;
  }
  const az = c.lampAzDeg * RAD, el = c.lampDeg * RAD, k = c.relief * 22 / Math.max(0.5, u), amb = 0.22;
  const ground = colour(m.palette.ground), hi = colour(m.palette.accent), L = new Layer(w, h, { seed: ctx.seed }), p = L.px;
  const flat = shade([0, 0, 1], az, el) || 1;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const n = normalAt(H, w, h, x, y, k), s = amb + (1 - amb) * Math.tanh(0.75 * shade(n, az, el) / flat);
    const alb = (0.82 + 0.3 * (big[i] - 0.5)) * (ctx.mask ? 1 - 0.25 * ctx.mask[i] : 1), spec = Math.pow(Math.max(0, n[2] * 0.2 + s * 0.8 - 0.92), 2) * 6;
    for (let ch = 0; ch < 3; ch++) p[3 * i + ch] = clamp(ground[ch] * alb * s * 0.9 + hi[ch] * spec, 0, 0.985);
  }
  return L;
}

// Spray: log-normal droplets in a nozzle cone, Beer-Lambert build-up, drips where the coat pools.
export function droplets(w, h, m, ctx) {
  const c = m.core, u = ctx.u, R = rng(ctx.seed * 13 + 5), D = new Float32Array(w * h), M = ctx.mask;
  const count = Math.round((0.3 + 2.2 * c.particles) * w * h / (60 * u * u));
  const passes = M ? 3 : 2, cx = w * 0.5, cy = h * 0.48;
  for (let k = 0; k < count; k++) {
    let x = R() * w, y = R() * h;
    if (M) { for (let t = 0; t < passes && M[(y | 0) * w + (x | 0)] < 0.5; t++) { x = R() * w; y = R() * h; } }
    else { const a = R() * 6.2832, rr = Math.sqrt(-2 * Math.log(1 - R() * 0.999)) * w * 0.17; x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr * 0.62; }
    const r = Math.exp(Math.log(0.7 * u) + 0.55 * gaussian(R)) * (1 + c.flow * 0.5);
    disc(D, w, h, x, y, r, 0.55 + 0.3 * R());
  }
  // overspray halo: a soft, low-density mist around everything already laid
  const halo = boxBlur(D, w, h, Math.max(2, Math.round(14 * u)));
  for (let i = 0; i < D.length; i++) D[i] += 0.35 * halo[i];
  // drips: walk down from columns where the coat is thickest
  const step = Math.max(2, Math.round(9 * u));
  for (let x = step; x < w - step; x += step) {
    let best = 0, by = 0; for (let y = 0; y < h * 0.8; y += 2) { const v = halo[y * w + x]; if (v > best) { best = v; by = y; } }
    if (best < 0.9 - 0.4 * c.flow || R() > 0.55) continue;
    const len = (40 + 160 * R() * c.flow) * u, rw = (0.9 + R()) * u;
    for (let t = 0; t < len; t += 0.7) disc(D, w, h, x + Math.sin(t * 0.03) * u, by + t, rw * (1 - 0.4 * t / len), 0.5);
    disc(D, w, h, x, by + len, rw * 1.6, 0.9);
  }
  const ink = colour(m.palette.ink), acc = colour(m.palette.accent), g = colour(m.palette.ground), L = new Layer(w, h, { seed: ctx.seed }), p = L.px;
  for (let i = 0; i < D.length; i++) {
    const T = Math.exp(-1.6 * D[i]), a = M ? smooth(0.1, 0.9, M[i]) : 0.5;
    for (let ch = 0; ch < 3; ch++) { const coat = acc[ch] * a + ink[ch] * (1 - a); p[3 * i + ch] = coat + (g[ch] - coat) * T; }
  }
  return L;
}
const gaussian = R => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(6.2832 * R());

// Thin film: thickness from slow noise and the word (a thicker film where the letters are), colour from optics.
export function film(w, h, m, ctx) {
  const c = m.core, u = ctx.u, N = noiseField(w, h, 220 * u, ctx.seed + 9, 4), N2 = noiseField(w, h, 40 * u, ctx.seed + 3, 3), M = ctx.mask;
  const L = new Layer(w, h, { seed: ctx.seed }), p = L.px, g = colour(m.palette.ground);
  for (let i = 0; i < w * h; i++) {
    const d = c.filmMinNm + (c.filmMaxNm - c.filmMinNm) * clamp(0.7 * N[i] + 0.3 * N2[i] + (M ? 0.25 * M[i] : 0) - 0.1);
    // the film shows where it is thin enough to interfere strongly: a soft band of the noise, and the word
    const sheet = Math.max(Math.exp(-(((N2[i] - 0.5) / 0.07) ** 2)) * 0.55, M ? M[i] : 0), rgb = filmLinear(d, { n: 1.33 }), k = c.sheen * sheet * 0.75;
    const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    for (let ch = 0; ch < 3; ch++) p[3 * i + ch] = clamp(g[ch] + (lum + (rgb[ch] - lum) * 0.7) * k, 0, 0.97);
  }
  return L;
}

// Chladni: sand on the nodal lines of a plate mode; the mode comes from the material's pitch (order sets the mix).
export function chladni(w, h, m, ctx) {
  const c = m.core, n = 2 + (Math.round(c.pitch) % 5), mm = n + 1 + (Math.round(c.resonanceHz) % 3);
  const sand = 0.25 + 0.7 * c.particles, size = Math.max(w, h);
  const S = chladniSource(size, size, { n, m: mm, mix: 15 + 30 * (1 - c.order), width: 0.05 + 0.05 * (1 - c.order), sand, seed: ctx.seed });
  const F = new Float32Array(w * h), ox = (size - w) >> 1, oy = (size - h) >> 1, M = ctx.mask, sandR = rng(ctx.seed * 5 + 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = S.luma((y + oy) * size + x + ox);
    // inside the word the sand settles as a stipple: grains with probability set by the coverage
    const q = M ? M[y * w + x] : 0, grain = q > 0 && sandR() < 0.42 * q ? 0.7 + 0.3 * sandR() : 0;
    F[y * w + x] = Math.max(v * (1 - 0.6 * q), grain);
  }
  return ramp(w, h, F, [m.palette.ground, m.palette.accent, m.palette.ink], { seed: ctx.seed });
}

// Hatch: engraved lines at the material's angle, width by tone, bent along the height contours; cross-hatch in shadow.
export function hatch(w, h, m, ctx) {
  const c = m.core, u = ctx.u, sp = Math.max(2.2, (4 + 6 * (1 - c.line)) * u), M = ctx.mask;
  const T = noiseField(w, h, 180 * u, ctx.seed + 4, 4), W = noiseField(w, h, 60 * u, ctx.seed + 8, 3);
  const a = c.lineDeg * RAD, nx = -Math.sin(a), ny = Math.cos(a), b = a + Math.PI / 2.6, mx = -Math.sin(b), my = Math.cos(b);
  const cover = field(w, h, (x, y, i) => {
    const tone = clamp(0.25 + 0.5 * (T[i] - 0.5) * 2 + (M ? 0.55 * M[i] : 0)), warp = (W[i] - 0.5) * sp * 6 * c.order;
    const s1 = x * nx + y * ny + warp, d1 = s1 - Math.round(s1 / sp) * sp, hw = 0.5 * sp * tone;
    let v = band(d1, Math.max(0.5, hw));
    if (tone < 0.18) v *= tone / 0.18;
    if (tone > 0.55) { const s2 = x * mx + y * my + warp * 0.5, d2 = s2 - Math.round(s2 / sp) * sp; v = Math.max(v, band(d2, Math.max(0.5, 0.5 * sp * (tone - 0.55) * 1.6))); }
    return v;
  });
  const L = new Layer(w, h, { seed: ctx.seed }).fill(m.palette.ground), ink = new Layer(w, h).fill(m.palette.ink);
  L.place(ink, 0, 0, { mask: cover });
  return L;
}

// Paper or plaster ground: low-contrast fractal noise between the ground and a lifted ground.
export function noise(w, h, m, ctx) {
  const N = field(w, h, (x, y) => fbm(x / (70 * ctx.u), y / (70 * ctx.u), ctx.seed + 21, 5));
  return ramp(w, h, N, [m.palette.ink, m.palette.ground, m.palette.accent].map((hx, i) => (i === 1 ? hx : mixLin(hx, m.palette.ground, 0.82))), { seed: ctx.seed });
}
function mixLin(a, b, t) { const A = colour(a), B = colour(b); return A.map((v, i) => v + (B[i] - v) * t); }
