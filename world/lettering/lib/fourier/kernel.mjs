// lib/fourier/kernel.mjs: the Fourier descriptor kernel, the JS twin of lettering/native/fourier.bld.
// A closed contour becomes a sum of rotating vectors (Fourier descriptors, Zahn and Roskies 1972; Kuhl and
// Giardina 1982): resample it by arc length, take its complex DFT, keep only the terms a screen can show.
// BuildLang's wasm target cannot carry sqrt yet, so the browser runs this file; tests/fourier-native.test.mjs
// holds it equal to the BuildLang kernel bit for bit. Change one and change the other in the same commit.
// DETMATH rules (games/low-water/design/DETMATH.md): only + - * / sqrt floor and comparisons, in the order written.
//   resample(p, N)              closed polyline [x0, y0, ...] to N points equally spaced by arc length
//   dft(z, K)                   N points to 2K + 1 descriptors, ordered k = 0, 1, -1, 2, -2, ...
//   truncate(c, scale, tolPx)   drop the smallest terms while their summed amplitude on screen stays under tolPx
//   align(a, b)                 the start shift and direction of b that best matches a (centroids removed)

export const DPI = 3.141592653589793;
const TAU = 2 * DPI;
const PIO2_HI = 1.57079632673412561417, PIO2_LO = 6.07710050650619224932e-11, INV_PIO2 = 6.36619772367581382433e-1;
const S1 = -1.66666666666666324348e-1, S2 = 8.33333333332248946124e-3, S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6, S5 = -2.50507602534068634195e-8, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2, C2 = -1.38888888888741095749e-3, C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7, C5 = 2.08757232129817482790e-9, C6 = -1.13596475577881948265e-11;
const ksin = (r) => { const z = r * r; return r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6))))); };
const kcos = (r) => { const z = r * r; return 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6))))); };
function quad(x) { const k = Math.floor(x * INV_PIO2 + 0.5); return [(x - k * PIO2_HI) - k * PIO2_LO, ((k % 4) + 4) % 4]; }
export function dsin(x) { const [r, q] = quad(x); return q === 0 ? ksin(r) : q === 1 ? kcos(r) : q === 2 ? -ksin(r) : -kcos(r); }
export function dcos(x) { const [r, q] = quad(x); return q === 0 ? kcos(r) : q === 1 ? -ksin(r) : q === 2 ? -kcos(r) : ksin(r); }

export function resample(p, N) {
  const n = p.length / 2, cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const j = i + 1 < n ? i + 1 : 0, dx = p[2 * j] - p[2 * i], dy = p[2 * j + 1] - p[2 * i + 1];
    cum[i + 1] = cum[i] + Math.sqrt(dx * dx + dy * dy);
  }
  const per = cum[n], out = new Float64Array(2 * N);
  let i = 0;
  for (let m = 0; m < N; m++) {
    const s = (per * m) / N;
    while (i < n - 1 && cum[i + 1] <= s) i++;
    const j = i + 1 < n ? i + 1 : 0, L = cum[i + 1] - cum[i], t = L > 0 ? (s - cum[i]) / L : 0;
    out[2 * m] = p[2 * i] + (p[2 * j] - p[2 * i]) * t;
    out[2 * m + 1] = p[2 * i + 1] + (p[2 * j + 1] - p[2 * i + 1]) * t;
  }
  return out;
}

const tables = new Map();
export function twiddles(N) {
  let t = tables.get(N);
  if (!t) { const cs = new Float64Array(N), sn = new Float64Array(N); for (let m = 0; m < N; m++) { const a = (TAU * m) / N; cs[m] = dcos(a); sn[m] = dsin(a); } tables.set(N, (t = { cs, sn })); }
  return t;
}

// k for the j-th descriptor: 0, 1, -1, 2, -2, ... so the first H terms are always the H lowest frequencies
export const freqOf = (j) => (j === 0 ? 0 : j % 2 ? (j + 1) / 2 : -j / 2);

export function dft(z, K) {
  const N = z.length / 2, T = 2 * K + 1, { cs, sn } = twiddles(N), k = new Int32Array(T), re = new Float64Array(T), im = new Float64Array(T);
  for (let j = 0; j < T; j++) {
    const f = freqOf(j); let a = 0, b = 0;
    for (let n = 0; n < N; n++) {
      const m = (((f * n) % N) + N) % N, x = z[2 * n], y = z[2 * n + 1];
      a = a + (x * cs[m] + y * sn[m]);
      b = b + (y * cs[m] - x * sn[m]);
    }
    k[j] = f; re[j] = a / N; im[j] = b / N;
  }
  return { N, K, k, re, im };
}

export function truncate(c, scale, tolPx = 0.25) {
  const T = c.re.length, amp = new Float64Array(T), order = [], keep = new Uint8Array(T).fill(1);
  for (let j = 1; j < T; j++) { amp[j] = Math.sqrt(c.re[j] * c.re[j] + c.im[j] * c.im[j]) * scale; order.push(j); }
  // insertion sort, ascending amplitude, ties kept in index order (the BuildLang kernel sorts the same way)
  for (let a = 1; a < order.length; a++) { const v = order[a]; let b = a - 1; while (b >= 0 && amp[order[b]] > amp[v]) { order[b + 1] = order[b]; b--; } order[b + 1] = v; }
  let sum = 0, dropped = 0;
  for (const j of order) { if (sum + amp[j] < tolPx) { sum = sum + amp[j]; keep[j] = 0; dropped++; } else break; }
  return { keep, kept: T - dropped, bound: sum };
}

export function align(a, b) {
  const N = a.length / 2;
  let ax = 0, ay = 0, bx = 0, by = 0;
  for (let n = 0; n < N; n++) { ax = ax + a[2 * n]; ay = ay + a[2 * n + 1]; bx = bx + b[2 * n]; by = by + b[2 * n + 1]; }
  ax = ax / N; ay = ay / N; bx = bx / N; by = by / N;
  let best = Infinity, shift = 0, rev = 0;
  for (let d = 0; d < 2; d++) for (let s = 0; s < N; s++) {
    let c = 0;
    for (let n = 0; n < N; n++) {
      const m = d === 0 ? (n + s) % N : (s - n + N) % N;
      const dx = (a[2 * n] - ax) - (b[2 * m] - bx), dy = (a[2 * n + 1] - ay) - (b[2 * m + 1] - by);
      c = c + (dx * dx + dy * dy);
    }
    if (c < best) { best = c; shift = s; rev = d; }
  }
  return { shift, rev, cost: best };
}

// b reordered by an alignment, so its m-th point corresponds to a's m-th point
export function reorder(b, { shift, rev }) {
  const N = b.length / 2, out = new Float64Array(2 * N);
  for (let n = 0; n < N; n++) { const m = rev === 0 ? (n + shift) % N : (shift - n + N) % N; out[2 * n] = b[2 * m]; out[2 * n + 1] = b[2 * m + 1]; }
  return out;
}

// ------------------------------------------------------------------ evaluation (render side, not in the parity run)
// The curve at M points by phase rotation: z_k(j + 1) = z_k(j) e^(2 pi i k / M), one complex multiply per term per
// point and no sin or cos inside the loop. H is the harmonic count (the first H descriptors); a fractional H fades
// the last term in, so the count can move smoothly. Returns [x0, y0, ...].
export function trace(c, H, M, out = new Float64Array(2 * M)) {
  const T = Math.min(Math.ceil(H), c.re.length), whole = Math.floor(H), { cs, sn } = twiddles(M), sr = new Float64Array(T), si = new Float64Array(T), rr = new Float64Array(T), ri = new Float64Array(T);
  for (let j = 0; j < T; j++) {
    const g = j < whole ? 1 : H - whole; sr[j] = c.re[j] * g; si[j] = c.im[j] * g;
    const m = ((c.k[j] % M) + M) % M; rr[j] = cs[m]; ri[j] = sn[m];
  }
  for (let p = 0; p < M; p++) {
    let x = 0, y = 0;
    for (let j = 0; j < T; j++) { const a = sr[j], b = si[j]; x += a; y += b; sr[j] = a * rr[j] - b * ri[j]; si[j] = a * ri[j] + b * rr[j]; }
    out[2 * p] = x; out[2 * p + 1] = y;
  }
  return out;
}

// The arms of the machine at phase u in [0, 1): joint positions [x0, y0, ...] for the first H terms, largest first.
// order: term indices largest first (armOrder), computed once per contour rather than every frame.
export const armOrder = (c) => Array.from({ length: c.re.length - 1 }, (_, i) => i + 1).sort((p, q) => Math.hypot(c.re[q], c.im[q]) - Math.hypot(c.re[p], c.im[p]));
export function arms(c, H, u, order = armOrder(c), most = Infinity) {
  const out = [c.re[0], c.im[0]]; let x = c.re[0], y = c.im[0], n = 0;
  for (const j of order) {
    if (j >= H) continue; if (n++ >= most) break; const a = TAU * c.k[j] * u, ca = Math.cos(a), sa = Math.sin(a); x += c.re[j] * ca - c.im[j] * sa; y += c.re[j] * sa + c.im[j] * ca; out.push(x, y); }
  return out;
}
