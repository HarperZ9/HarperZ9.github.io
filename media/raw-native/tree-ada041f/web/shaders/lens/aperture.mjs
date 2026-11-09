// The aperture: an iris of N straight blades, optionally rounded, and what it does to light.
//   edge(phi): the boundary radius (circumradius 1) in direction phi. The ghost shapes use it.
//   starburstTable(): the far-field diffraction pattern (Fraunhofer: |FT(aperture)|^2) of the
//     iris, summed over the wavelength bins with each bin scaled by lambda (a longer wavelength
//     diffracts wider), as an RGB table the GPU samples. The spikes come from the straight
//     blade edges: an even blade count gives N spikes, an odd count 2N.
import { BINS, BIN_NM, BIN_RGB } from "./spectrum.mjs";

export const IRIS = { blades: 6, roundness: 0.15, rotation: 0.3 };

// Boundary radius of a regular N-gon of circumradius 1 at angle phi, blended toward the circle.
export function edge(phi, iris = IRIS) {
  const N = iris.blades, seg = (2 * Math.PI) / N;
  let a = (phi - iris.rotation) % seg; if (a < 0) a += seg;
  const poly = Math.cos(Math.PI / N) / Math.cos(a - Math.PI / N);
  return poly + (1 - poly) * iris.roundness;
}
// Area of the shape of circumradius 1: (1/2) integral of edge^2 dphi.
export function shapeArea(iris = IRIS, steps = 4096) {
  let s = 0; for (let k = 0; k < steps; k++) { const e = edge(((k + 0.5) * 2 * Math.PI) / steps, iris); s += e * e; }
  return (0.5 * s * 2 * Math.PI) / steps;
}

// In-place radix-2 complex FFT of length n (a power of two) on interleaved re, im arrays.
export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
// Monochrome PSF of the iris: aperture radius `rad` cells on an n x n grid (4 x 4 supersampled
// coverage), |FFT|^2, centred. Returns Float64Array n*n, summing to 1.
export function psfMono(iris = IRIS, n = 256, rad = 24) {
  const re = new Float64Array(n * n), im = new Float64Array(n * n), c = n / 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let cov = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const u = (x + (sx + 0.5) / 4 - c) / rad, v = (y + (sy + 0.5) / 4 - c) / rad, r = Math.hypot(u, v);
      if (r <= edge(Math.atan2(v, u), iris)) cov++;
    }
    re[y * n + x] = cov / 16;
  }
  const rr = new Float64Array(n), ri = new Float64Array(n);
  for (let y = 0; y < n; y++) { for (let x = 0; x < n; x++) { rr[x] = re[y * n + x]; ri[x] = im[y * n + x]; } fft(rr, ri); for (let x = 0; x < n; x++) { re[y * n + x] = rr[x]; im[y * n + x] = ri[x]; } }
  for (let x = 0; x < n; x++) { for (let y = 0; y < n; y++) { rr[y] = re[y * n + x]; ri[y] = im[y * n + x]; } fft(rr, ri); for (let y = 0; y < n; y++) { re[y * n + x] = rr[y]; im[y * n + x] = ri[y]; } }
  const out = new Float64Array(n * n); let s = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const sx = (x + c) % n, sy = (y + c) % n, p = re[sy * n + sx] ** 2 + im[sy * n + sx] ** 2; out[y * n + x] = p; s += p; }
  for (let i = 0; i < out.length; i++) out[i] /= s;
  return out;
}
function bilinear(t, n, x, y) {
  if (x < 0 || y < 0 || x > n - 1 || y > n - 1) return 0;
  const x0 = Math.min(n - 2, Math.floor(x)), y0 = Math.min(n - 2, Math.floor(y)), fx = x - x0, fy = y - y0, i = y0 * n + x0;
  return (t[i] * (1 - fx) + t[i + 1] * fx) * (1 - fy) + (t[i + n] * (1 - fx) + t[i + n + 1] * fx) * fy;
}
// The starburst table: M x M cells (M odd), centre at (M-1)/2, RGB interleaved, f64. The core
// (the Airy disc, which the image already holds as the source itself) is suppressed by a
// window 1 - exp(-(r / core)^2), a stated handle and not part of the optics. Each channel sums
// to 1 over the table, so a source of energy E adds E * gain of starburst light.
export function starburstTable({ iris = IRIS, n = 256, rad = 24, M = 129, core = 6, lambdaRef = 560, mono = null } = {}) {
  const p = mono || psfMono(iris, n, rad), c = n / 2, h = (M - 1) / 2, out = new Float64Array(M * M * 3);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const dx = x - h, dy = y - h, win = 1 - Math.exp(-(dx * dx + dy * dy) / (core * core));
    for (let l = 0; l < BINS; l++) {
      const s = lambdaRef / BIN_NM[l], v = bilinear(p, n, c + dx * s, c + dy * s) * s * s * win;
      for (let k = 0; k < 3; k++) out[(y * M + x) * 3 + k] += BIN_RGB[l][k] * v;
    }
  }
  const sum = [0, 0, 0]; for (let i = 0; i < M * M; i++) for (let k = 0; k < 3; k++) sum[k] += out[i * 3 + k];
  for (let i = 0; i < M * M; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] /= sum[k];
  return { M, data: out };
}
// Spikes: sample a table centred at `centre` (n / 2 for the FFT table) along a ring of radius r, count local maxima that stand more
// than `prominence` times above the ring's median. Used by the study and the tests.
export function countSpikes(table, n, r, { samples = 1440, prominence = 3, centre = n / 2 } = {}) {
  const c = centre, v = new Float64Array(samples);
  for (let k = 0; k < samples; k++) { const a = (2 * Math.PI * k) / samples; v[k] = bilinear(table, n, c + r * Math.cos(a), c + r * Math.sin(a)); }
  const med = Float64Array.from(v).sort()[samples >> 1], w = Math.round(samples / 72);
  let count = 0;
  for (let k = 0; k < samples; k++) {
    let peak = v[k] > prominence * med;
    for (let j = -w; j <= w && peak; j++) if (j && v[(k + j + samples) % samples] > v[k]) peak = false;
    if (peak) count++;
  }
  return count;
}
// Angular harmonics of a centred table over a radial band: amplitude of each harmonic k of the
// angular profile, relative to its mean (k = 0). A pattern with N-fold spikes peaks at k = N.
export function angularHarmonics(table, n, [r0, r1], { samples = 1440, kMax = 40, radial = 41, centre = n / 2 } = {}) {
  const c = centre, prof = new Float64Array(samples);
  for (let s = 0; s < samples; s++) {
    const a = (2 * Math.PI * s) / samples, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < radial; j++) { const r = r0 + ((r1 - r0) * j) / (radial - 1); prof[s] += bilinear(table, n, c + r * ca, c + r * sa) * r; }
  }
  const mean = prof.reduce((x, y) => x + y, 0) / samples, amp = [1];
  for (let k = 1; k <= kMax; k++) {
    let re = 0, im = 0; for (let s = 0; s < samples; s++) { const a = (2 * Math.PI * k * s) / samples; re += prof[s] * Math.cos(a); im += prof[s] * Math.sin(a); }
    amp.push((2 * Math.hypot(re, im)) / samples / mean);
  }
  return amp;
}
