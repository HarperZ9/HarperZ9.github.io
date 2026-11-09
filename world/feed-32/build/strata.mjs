// strata.mjs: decompose a sequence into coordinates and plot its strata, with one hot line.
//
// The decomposition (weight x level + jump) follows the published idea credited to R. Eismann (decompwlj.com), which
// the author shared as a still on 2026-10-24. The definition here is our reconstruction from that still and its caption,
// checked by the property the caption states (weight 3 among the primes is the same as a lower twin prime above 3):
//   for consecutive terms a(n) < a(n+1): jump d = a(n+1) - a(n); m = a(n) - d;
//   weight k = the smallest divisor of m that is greater than d; level L = m / k; so a(n) = k * L + d.
//   A term is undecomposable when m <= d (no divisor of m exceeds d) or when it is the last term.
// The plotting, projection, tone and layout are our own. Nothing from the reference images is used.
//
// SPEC
//   decompose(seq, { spfLimit }) -> { n, k: Float64Array, L: Float64Array, d: Float64Array, ok: Uint8Array, count }
//   coords(D, A)  -> Float32Array(3n) in [0, 1]: x = log k / log A, y = log L / log A, z = log d / log dMax
//   render({ w, h, seq, D, hot, yaw (rad, -pi..pi), pitch (rad, -1.2..1.2), persp (0..0.6), fit (bool, default true:
//            scale to the drawn points, not the unit cube), ground, ink, hotInk,
//            gain (0.2..8, ink per point at 1x) }) -> feed-29 raster (linear RGB); grain is added at encode
//   determinism : same inputs give the same pixels (no clock, no Math.random)
//   cost (measured 2026-10-25, out/render.log.strata.json): the 664,579 primes below 1e7 sieve, decompose and draw at
//   1600 x 1600: sieve 214 ms, decompose 467 ms, draw 240 ms
import { spfSieve } from './sequences.mjs';
import { raster, clamp } from '../../feed-29/build/lib/field.mjs';
import { hexLin } from '../../feed-29/build/lib/color.mjs';

// Smallest divisor of m greater than d. With an spf table covering m, enumerate divisors from the factorisation;
// otherwise trial-divide (fine for the small d of real sequences and m up to about 1e12).
export function smallestDivisorAbove(m, d, spf = null) {
  if (m <= d) return 0;
  if (spf && m < spf.length) {
    let divs = [1], x = m;
    while (x > 1) {
      const p = spf[x]; let e = 0; while (x % p === 0) { x /= p; e++; }
      const next = []; for (const q of divs) { let pp = 1; for (let i = 0; i <= e; i++) { next.push(q * pp); pp *= p; } }
      divs = next;
    }
    let best = m; for (const q of divs) if (q > d && q < best) best = q;
    return best;
  }
  const r = Math.floor(Math.sqrt(m));
  for (let k = d + 1; k <= r; k++) if (m % k === 0) return k;
  for (let j = Math.min(d, r); j >= 1; j--) if (m % j === 0 && m / j > d) return m / j;
  return m;
}

export function decompose(seq, { spfLimit = 2e7 } = {}) {
  const n = seq.length, k = new Float64Array(n), L = new Float64Array(n), d = new Float64Array(n), ok = new Uint8Array(n);
  let maxM = 0; for (let i = 0; i + 1 < n; i++) maxM = Math.max(maxM, seq[i] - (seq[i + 1] - seq[i]));
  const spf = maxM > 1 && maxM <= spfLimit ? spfSieve(maxM) : null;
  let count = 0;
  for (let i = 0; i + 1 < n; i++) {
    const di = seq[i + 1] - seq[i], m = seq[i] - di;
    if (!(di > 0) || m <= di) continue;
    const ki = smallestDivisorAbove(m, di, spf);
    k[i] = ki; L[i] = m / ki; d[i] = di; ok[i] = 1; count++;
  }
  return { n, k, L, d, ok, count };
}

export function coords(D, A) {
  const la = Math.log(Math.max(A, 3)); let dMax = 1;
  for (let i = 0; i < D.n; i++) if (D.ok[i]) dMax = Math.max(dMax, D.d[i]);
  const ld = Math.log(Math.max(dMax, 2)), P = new Float32Array(3 * D.n);
  for (let i = 0; i < D.n; i++) {
    if (!D.ok[i]) { P[3 * i] = NaN; continue; }
    P[3 * i] = Math.log(D.k[i]) / la; P[3 * i + 1] = Math.log(D.L[i]) / la; P[3 * i + 2] = Math.log(D.d[i]) / ld;
  }
  return P;
}

// Hot lines: a predicate on one decomposed term, a statement, and its status. Status is one of
// 'proved', 'conjecture' (believed, unproved), 'computed' (true for the terms drawn; nothing claimed beyond them).
export const HOT = {
  weight3: { test: (k) => k === 3, statement: 'weight 3 marks a twin prime: infinitely many is the twin prime conjecture', status: 'conjecture' },
  level1: { test: (k, L) => L === 1, statement: 'level 1: for the counting numbers, n - 1 is prime, and Euclid proved there are infinitely many', status: 'proved' },
  jump2: { test: (k, L, d) => d === 2, statement: 'jump 2: consecutive terms two apart', status: 'computed' },
  weightEqLevel: { test: (k, L) => k === L, statement: 'weight equals level: a(n) minus the jump is a square', status: 'computed' },
};

// Orthographic camera with an optional perspective term; the cube [0,1]^3 is centred and fitted to the frame.
export function camera(w, h, { yaw = -0.6, pitch = 0.35, persp = 0.18, margin = 0.12 } = {}) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const s = Math.min(w, h) * (1 - 2 * margin) / 1.75;
  return (x, y, z) => {
    const X = x - 0.5, Y = y - 0.5, Z = z - 0.5;
    const rx = cy * X - sy * Z, rz = sy * X + cy * Z;
    const ry = cp * Y - sp * rz, depth = sp * Y + cp * rz;
    const f = 1 / (1 + persp * depth);
    return [w / 2 + rx * s * f, h / 2 - ry * s * f, depth];
  };
}

// Refit a camera so the drawn points and the axes' origin fill the frame with a fixed margin (the cube fit leaves the
// data in one corner, because real sequences occupy a thin slab of it). Same projection, one scale and shift.
function fitted(D, P, w, h, cam, on, margin = 0.1) {
  if (!on) return cam;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = ([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  take(cam(0, 0, 0));
  for (let i = 0; i < D.n; i++) if (D.ok[i]) take(cam(P[3 * i], P[3 * i + 1], P[3 * i + 2]));
  const s = Math.min((w * (1 - 2 * margin)) / Math.max(1, x1 - x0), (h * (1 - 2 * margin)) / Math.max(1, y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return (x, y, z) => { const [a, b, d] = cam(x, y, z); return [w / 2 + (a - cx) * s, h / 2 + (b - cy) * s, d]; };
}

// Bilinear splat of weight `v` into a density buffer (anti-aliased points, QUALITY-SPEC R3).
export function splat(buf, w, h, x, y, v) {
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) return;
  const i = y0 * w + x0;
  buf[i] += v * (1 - fx) * (1 - fy); buf[i + 1] += v * fx * (1 - fy); buf[i + w] += v * (1 - fx) * fy; buf[i + w + 1] += v * fx * fy;
}

// A hairline from a to b as splats every 0.5 px (1 device px wide, alpha by width, R3b).
function line(buf, w, h, a, b, v) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(len * 2));
  for (let s = 0; s <= steps; s++) { const t = s / steps; splat(buf, w, h, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, v); }
}

function axes(buf, w, h, cam, v) {
  const P = (x, y, z) => cam(x, y, z);
  line(buf, w, h, P(0, 0, 0), P(1, 0, 0), v); line(buf, w, h, P(0, 0, 0), P(0, 1, 0), v); line(buf, w, h, P(0, 0, 0), P(0, 0, 1), v);
  for (const q of [0.25, 0.5, 0.75, 1]) { // ticks at A^(1/4) steps on the weight and level axes
    const t = 0.012; line(buf, w, h, P(q, 0, 0), P(q, -t, 0), v); line(buf, w, h, P(0, q, 0), P(-t, q, 0), v);
  }
  for (let s = 0; s <= 200; s += 2) { const t0 = s / 200, t1 = (s + 1) / 200; line(buf, w, h, P(t0, t0, 0), P(t1, t1, 0), v * 0.6); } // k = L, dashed
}

export function render({ w, h, D, A, hot = null, yaw, pitch, persp, fit = true, ground = '#ece7dc', ink = '#1b1a17', hotInk = '#c8442a', gain = 1 } = {}) {
  const P = coords(D, A), cam = fitted(D, P, w, h, camera(w, h, { yaw, pitch, persp }), fit);
  const dens = new Float32Array(w * h), hotD = new Float32Array(w * h), ax = new Float32Array(w * h);
  const pt = gain * Math.min(1, (w * h) / (6 * Math.max(1, D.count)) + 0.18);
  const H = hot ? HOT[hot] : null;
  for (let i = 0; i < D.n; i++) {
    if (!D.ok[i]) continue;
    const [x, y] = cam(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
    if (H && H.test(D.k[i], D.L[i], D.d[i])) splat(hotD, w, h, x, y, 1); else splat(dens, w, h, x, y, pt);
  }
  axes(ax, w, h, cam, 0.55);
  const R = raster(w, h, hexLin(ground)), I = hexLin(ink), Hc = hexLin(hotInk);
  for (let j = 0; j < w * h; j++) {
    const a = clamp(1 - Math.exp(-dens[j] * 1.6)) * 0.92, b = clamp(ax[j]) * 0.5, c = clamp(hotD[j] * 1.4);
    for (let ch = 0; ch < 3; ch++) {
      let v = R.px[3 * j + ch];
      v += (I[ch] - v) * Math.max(a, b);
      v += (Hc[ch] - v) * c;
      R.px[3 * j + ch] = v;
    }
  }
  return R;
}

// Counts for the caption: how many terms, how many decomposed, how many on the hot line.
export function tally(D, hot) {
  const H = HOT[hot]; let on = 0;
  if (H) for (let i = 0; i < D.n; i++) if (D.ok[i] && H.test(D.k[i], D.L[i], D.d[i])) on++;
  return { terms: D.n, decomposed: D.count, hot: on, statement: H?.statement ?? '', status: H?.status ?? '' };
}
