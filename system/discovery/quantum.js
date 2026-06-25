// quantum.js: a 1D time-dependent Schrodinger solver (split-step Fourier, unitary) and its
// observables, as the R2 quantum substrate for the discovery engine. Units hbar = m = 1.
//
// The split-step Fourier method is norm-conserving by construction (each factor is a unitary
// phase), so norm (unitarity) is an exact invariant and energy <H> is conserved for a
// time-independent potential. The model will later rediscover these from the perceived
// observable time-series, exactly as it does for the classical systems. Zero dependencies.

import { jacobiEigen } from "./reference.js";

// Time-INDEPENDENT Schrodinger: diagonalize H = -1/2 d^2/dx^2 + V(x) on the grid (3-point
// finite-difference Laplacian) and return the lowest `k` energy eigenvalues (the spectrum).
export function spectrum(grid, Vfn, k = 6) {
  const { N, dx, x } = grid, V = x.map(Vfn), t = 1 / (dx * dx);
  const H = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    H[i][i] = t + V[i];
    if (i > 0) H[i][i - 1] = -0.5 * t;
    if (i < N - 1) H[i][i + 1] = -0.5 * t;
  }
  return jacobiEigen(H).values.slice().sort((a, b) => a - b).slice(0, k);
}

// Fit E ~ a*f(n) + b by least squares; return {a, b, rmse}.
function linfit(E, f) {
  const n = E.length, xs = E.map((_, i) => f(i));
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = E.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (E[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
  const a = sxx > 1e-12 ? sxy / sxx : 0, b = my - a * mx;
  let se = 0; for (let i = 0; i < n; i++) { const r = E[i] - (a * xs[i] + b); se += r * r; }
  return { a, b, rmse: Math.sqrt(se / n) };
}

// Discover the quantization RULE from a spectrum: is E_n linear in n (equally spaced, like the
// harmonic oscillator) or quadratic (like a box)? Returns both fits and the better-fitting rule.
export function fitSpectrum(E) {
  const linear = linfit(E, (n) => n), quadratic = linfit(E, (n) => (n + 1) * (n + 1));
  const scale = Math.abs(E[E.length - 1] - E[0]) + 1e-12;
  return {
    linear, quadratic,
    rule: linear.rmse <= quadratic.rmse ? "linear" : "quadratic",
    linRelErr: linear.rmse / scale, quadRelErr: quadratic.rmse / scale,
  };
}

// In-place radix-2 FFT. dir = -1 forward, +1 inverse (inverse divides by N). n must be a power of 2.
export function fft(re, im, dir) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (dir * 2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] += vr; im[a] += vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (dir === 1) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// A grid of N points on [-L/2, L/2) with the matching FFT wavenumbers k.
export function makeGrid(N = 256, L = 20) {
  const dx = L / N, x = new Array(N), k = new Array(N);
  for (let i = 0; i < N; i++) {
    x[i] = -L / 2 + i * dx;
    const j = i < N / 2 ? i : i - N;
    k[i] = (2 * Math.PI * j) / L;
  }
  return { N, L, dx, x, k };
}

// A normalized Gaussian wave packet centered at x0 with width sigma and momentum p0.
export function gaussianPacket(grid, { x0 = 0, sigma = 1, p0 = 0 } = {}) {
  const { N, x, dx } = grid, re = new Array(N), im = new Array(N);
  let norm = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.exp(-((x[i] - x0) ** 2) / (4 * sigma * sigma));
    re[i] = a * Math.cos(p0 * x[i]); im[i] = a * Math.sin(p0 * x[i]);
    norm += (re[i] * re[i] + im[i] * im[i]) * dx;
  }
  const s = 1 / Math.sqrt(norm);
  for (let i = 0; i < N; i++) { re[i] *= s; im[i] *= s; }
  return { re, im };
}

// One split-step: half potential, full kinetic (in k-space), half potential. Unitary.
export function step(psi, grid, V, dt) {
  const { N, k } = grid, re = psi.re, im = psi.im;
  halfPotential(re, im, V, dt, N);
  fft(re, im, -1);
  for (let i = 0; i < N; i++) {
    const ph = -0.5 * k[i] * k[i] * dt, c = Math.cos(ph), s = Math.sin(ph);
    const r = re[i] * c - im[i] * s; im[i] = re[i] * s + im[i] * c; re[i] = r;
  }
  fft(re, im, 1);
  halfPotential(re, im, V, dt, N);
  return psi;
}

function halfPotential(re, im, V, dt, N) {
  for (let i = 0; i < N; i++) {
    const ph = -0.5 * V[i] * dt, c = Math.cos(ph), s = Math.sin(ph);
    const r = re[i] * c - im[i] * s; im[i] = re[i] * s + im[i] * c; re[i] = r;
  }
}

// Quantum observables of psi on the grid: norm, <x>, <x^2>, <p>, <p^2>, <V>, energy <H>.
export function observables(psi, grid, V) {
  const { N, dx, x, k } = grid;
  const re = psi.re, im = psi.im;
  let norm = 0, mx = 0, mx2 = 0, vexp = 0;
  for (let i = 0; i < N; i++) {
    const d = (re[i] * re[i] + im[i] * im[i]) * dx;
    norm += d; mx += x[i] * d; mx2 += x[i] * x[i] * d; vexp += V[i] * d;
  }
  // momentum moments in k-space (on a copy, FFT is in place)
  const kr = re.slice(), ki = im.slice();
  fft(kr, ki, -1);
  let mp = 0, mp2 = 0, kn = 0;
  for (let i = 0; i < N; i++) {
    const d = kr[i] * kr[i] + ki[i] * ki[i];
    kn += d; mp += k[i] * d; mp2 += k[i] * k[i] * d;
  }
  mp /= kn; mp2 /= kn;                    // normalized momentum moments
  const T = 0.5 * mp2;                    // <p^2>/2m, m=1
  return {
    norm, x: mx / norm, x2: mx2 / norm, p: mp, p2: mp2,
    V: vexp / norm, H: T + vexp / norm,
  };
}

// Evolve a packet under potential V(x) and return the observable time-series (the perceived data).
export function evolve(grid, Vfn, { x0 = 1.5, sigma = 1, p0 = 0, dt = 0.01, n = 600, sample = 1 } = {}) {
  const V = grid.x.map(Vfn);
  const psi = gaussianPacket(grid, { x0, sigma, p0 });
  const series = [observables(psi, grid, V)];
  for (let s = 0; s < n; s++) {
    step(psi, grid, V, dt);
    if ((s + 1) % sample === 0) series.push(observables(psi, grid, V));
  }
  return series;
}
