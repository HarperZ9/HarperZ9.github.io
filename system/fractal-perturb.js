// fractal-perturb.js: the CPU half of the Studio's deep-zoom renderer.
//
// Perturbation theory (K. I. Martin, "SuperFractalThing Maths", 2013): iterate ONE point, the
// reference, at whatever precision the depth needs, then iterate every pixel as a small difference
// dz from it in plain floating point. For the Mandelbrot set z -> z^2 + c, with Z the reference and
// z = Z + dz, c = C + dc:
//
//     dz' = 2 Z dz + dz^2 + dc
//
// which has no large-minus-large cancellation in it, so float32 carries it at any depth as long as
// the numbers themselves are in range (fractal-glsl-deep.js keeps them in range by rescaling).
//
// Two refinements make it robust and fast, both from the deep-zoom literature as gathered by
// Claude Heiland-Allen (mathr.co.uk, "Deep zoom theory and practice", 2021 and 2022):
//
// Rebasing (Zhuoran, fractalforums.org, 2021). When the pixel's orbit passes closer to the start of
// the reference than to the reference itself, |Z_m + dz| < |dz|, continue from the start with
// dz = Z_m + dz - Z_0. This removes the precision-loss "glitches" that earlier renderers had to
// detect and re-render with extra references, and it also handles a reference that escapes early.
//
// Bilinear approximation, BLA (Zhuoran, 2021). While dz is small next to Z, dz^2 is negligible and
// the step is linear in (dz, dc): dz' = A dz + B dc with A = 2 Z, B = 1. Linear steps compose, so a
// table of merged steps lets a pixel skip 2^k iterations at once wherever the table says the
// approximation still holds. That table is built here, once per reference.
//
// This file computes the reference orbit in BigInt fixed point, builds the BLA table, and packs both
// into Float32Arrays for the GPU. It also carries perturbPixel(), a double-precision twin of the
// shader's loop, which the tests check against direct BigInt iteration.

import { decToFixed, bitsForScale, offsetDec } from "./fractal-hp.js";

export const BAILOUT2 = 65536;   // R = 256, the same bailout as the shallow programs

// Kinds the deep path supports, and which of them have a BLA (holomorphic maps only: the
// Burning Ship's |.| and the Tricorn's conjugate are not linear in dz over a disk).
export const DEEP_KINDS = { mandelbrot: 0, julia: 1, burningship: 2, tricorn: 3 };
export function hasBLA(kind) { return kind === "mandelbrot" || kind === "julia"; }

/**
 * Iterate the reference point in fixed point. Returns { len, data, z } where data is a Float32Array
 * of 4 floats per iteration (Z.x, Z.y, D.x, D.y) with D = Z_n - Z_0 rounded once from the exact
 * difference, len is the index of the last entry (the first escaped iterate, or maxIter), and z is a
 * Float64Array of Z for CPU use.
 *
 * kind: mandelbrot (Z_0 = 0, C = centre), julia (Z_0 = centre, C = julia constant), burningship,
 * tricorn. cRe/cIm are decimal strings (or numbers); jRe/jIm likewise for Julia.
 */
export function referenceOrbit({ kind = "mandelbrot", cRe, cIm, jRe = 0, jIm = 0, maxIter = 1000, scale = 1e-10, bits }) {
  const B = bits || bitsForScale(scale);
  const BB = BigInt(B);
  const one = 1n << BB;
  const julia = kind === "julia";
  let x, y, cx, cy;
  const px = decToFixed(cRe, B), py = decToFixed(cIm, B);
  if (julia) { x = px; y = py; cx = decToFixed(jRe, B); cy = decToFixed(jIm, B); }
  else { x = 0n; y = 0n; cx = px; cy = py; }
  const x0 = x, y0 = y;
  // Doubles from fixed point. Z stays below the bailout (|Z| < 2^9 with margin), so a shift down
  // to 52 fractional bits fits a double exactly enough.
  const SH = BigInt(Math.max(0, B - 52)), DIV = 2 ** Math.min(52, B);
  const toD = (v) => Number(v >> SH) / DIV;
  // The difference D = Z - Z_0 can be far smaller than Z, so it converts through its own exponent.
  const toDsmall = (v) => {
    if (v === 0n) return 0;
    const neg = v < 0n, a = neg ? -v : v;
    const len = a.toString(2).length, sh = Math.max(0, len - 60);
    const d = Number(a >> BigInt(sh)) * 2 ** (sh - B);
    return neg ? -d : d;
  };
  const cap = maxIter + 1;
  const data = new Float32Array(cap * 4);
  const z = new Float64Array(cap * 2);
  const d = julia ? new Float64Array(cap * 2) : z;   // Z_n - Z_0 in doubles, for the CPU loop
  let n = 0;
  for (;;) {
    const zx = toD(x), zy = toD(y);
    data[n * 4] = zx; data[n * 4 + 1] = zy;
    data[n * 4 + 2] = zx;
    data[n * 4 + 3] = zy;
    z[n * 2] = zx; z[n * 2 + 1] = zy;
    if (julia) { d[n * 2] = data[n * 4 + 2] = toDsmall(x - x0); d[n * 2 + 1] = toDsmall(y - y0); data[n * 4 + 3] = d[n * 2 + 1]; }
    if (n >= maxIter || zx * zx + zy * zy > BAILOUT2) break;
    const xx = (x * x) >> BB, yy = (y * y) >> BB, xy = (x * y) >> BB;
    let nx, ny;
    if (kind === "burningship") { nx = xx - yy + cx; ny = 2n * (xy < 0n ? -xy : xy) + cy; }
    else if (kind === "tricorn") { nx = xx - yy + cx; ny = -2n * xy + cy; }
    else { nx = xx - yy + cx; ny = 2n * xy + cy; }
    x = nx; y = ny;
    // A runaway reference has escaped long before this; the guard only stops BigInt growth.
    if (x > 1024n * one || x < -1024n * one || y > 1024n * one || y < -1024n * one) { n++; continue; }
    n++;
  }
  return { len: n, data: data.subarray(0, (n + 1) * 4), z: z.subarray(0, (n + 1) * 2), d: d.subarray(0, (n + 1) * 2), bits: B, kind };
}

// ── Complex numbers with a separate exponent ("floatexp") ─────────────────────────────────────
// BLA coefficients are products of thousands of 2Z factors and run far outside the double range at
// depth. Each is held as (x, y) * 2^e with max(|x|, |y|) in [0.5, 1).
function norm(x, y, e) {
  const m = Math.max(Math.abs(x), Math.abs(y));
  if (m === 0 || !Number.isFinite(m)) return { x: 0, y: 0, e: 0, zero: true };
  const k = Math.floor(Math.log2(m)) + 1;
  const s = 2 ** -k;
  let nx = x * s, ny = y * s, ne = e + k;
  // Settle the log2 rounding at an exact power of two.
  const mm = Math.max(Math.abs(nx), Math.abs(ny));
  if (mm >= 1) { nx *= 0.5; ny *= 0.5; ne += 1; }
  else if (mm < 0.5) { nx *= 2; ny *= 2; ne -= 1; }
  return { x: nx, y: ny, e: ne, zero: false };
}
function fxMul(a, b) {
  if (a.zero || b.zero) return { x: 0, y: 0, e: 0, zero: true };
  return norm(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x, a.e + b.e);
}
function fxAdd(a, b) {
  if (a.zero) return b;
  if (b.zero) return a;
  const e = Math.max(a.e, b.e);
  const sa = 2 ** Math.max(-1100, a.e - e), sb = 2 ** Math.max(-1100, b.e - e);
  return norm(a.x * sa + b.x * sb, a.y * sa + b.y * sb, e);
}
function fxLog2Abs(a) { return a.zero ? -Infinity : a.e + Math.log2(Math.hypot(a.x, a.y)); }
// log2(2^p - 2^q), or -Infinity when the difference is not positive.
function log2Sub(p, q) {
  if (q === -Infinity) return p;
  if (!(p > q)) return -Infinity;
  return p + Math.log2(1 - 2 ** (q - p));
}

// The BLA tolerance: a step is linear while the dropped dz^2 term stays below 2^-32 of the kept
// 2 Z dz term. Measured on a 1e-35 view over 200 pixels against plain perturbation in doubles:
// 2^-24 shifted the escape count by 7.6 iterations on average, 2^-30 by 1.3, 2^-53 by 0. The GPU
// carries dz in float32, so 2^-32 keeps the approximation's own error below the arithmetic's.
export const BLA_EPS_LOG2 = -32;

/**
 * Build the BLA table for a reference. lDc is log2 of the largest |dc| in the view (Julia: pass
 * -Infinity, as dc is zero there). Returns { levels: [{ offset, count }], entries: [...] } where each
 * entry is { A, B, lr, l, trap }: dz advances by A dz + B dc over l iterations, valid while
 * log2|dz| < lr; trap is the cross orbit trap of the reference over those iterations.
 *
 * Single step at m (1 <= m < len): A = 2 Z_m, B = 1, radius eps * |A| (the dz^2 term stays below
 * eps of the 2 Z dz term). Merging x then y: A = A_y A_x, B = A_y B_x + B_y, and the radius is the
 * smaller of r_x and the largest |dz| for which the first step lands inside the second's radius,
 * (r_y - |B_x| |dc|) / |A_x|.
 */
export function buildBLA(ref, lDc, { julia = false, epsLog2 = BLA_EPS_LOG2 } = {}) {
  const K = ref.len, z = ref.z;
  const level0 = [];
  const oneB = julia ? { x: 0, y: 0, e: 0, zero: true } : norm(1, 0, 0);
  for (let m = 1; m < K; m++) {
    const A = norm(2 * z[m * 2], 2 * z[m * 2 + 1], 0);
    const lr = A.zero ? -Infinity : fxLog2Abs(A) + epsLog2;
    const zx = z[(m + 1) * 2], zy = z[(m + 1) * 2 + 1];
    level0.push({ A, B: oneB, lr, l: 1, trap: Math.min(Math.abs(zx), Math.abs(zy)) });
  }
  const levels = [{ offset: 0, count: level0.length }];
  const entries = level0.slice();
  let prev = level0;
  while (prev.length > 1) {
    const next = [];
    for (let j = 0; j < prev.length; j += 2) {
      const x = prev[j], y = prev[j + 1];
      if (!y) { next.push(x); continue; }
      const A = fxMul(y.A, x.A);
      const B = julia ? oneB : fxAdd(fxMul(y.A, x.B), y.B);
      const lAx = fxLog2Abs(x.A);
      const lBxDc = julia ? -Infinity : fxLog2Abs(x.B) + lDc;
      const ry = log2Sub(y.lr, lBxDc) - lAx;
      const lr = Math.min(x.lr, Number.isFinite(lAx) ? ry : -Infinity);
      next.push({ A, B, lr, l: x.l + y.l, trap: Math.min(x.trap, y.trap) });
    }
    levels.push({ offset: entries.length, count: next.length });
    for (const e of next) entries.push(e);
    prev = next;
  }
  return { levels, entries, lDc };
}

export const BLA_TEXELS = 3;   // texels per entry in the packed table

/** Pack a BLA table into RGBA float32 texels: (ax, ay, ea, lr) (bx, by, eb, l) (trap, 0, 0, 0). */
export function packBLA(bla) {
  const out = new Float32Array(bla.entries.length * BLA_TEXELS * 4);
  let o = 0;
  for (const en of bla.entries) {
    out[o++] = en.A.x; out[o++] = en.A.y; out[o++] = en.A.e; out[o++] = Number.isFinite(en.lr) ? Math.max(-1e30, en.lr) : -1e30;
    out[o++] = en.B.x; out[o++] = en.B.y; out[o++] = en.B.e; out[o++] = en.l;
    out[o++] = en.trap; out[o++] = 0; out[o++] = 0; out[o++] = 0;
  }
  return out;
}

// x * 2^k for any integer k, without the intermediate 2^k overflowing a double.
function scale2(x, k) {
  while (k > 1000) { x *= 2 ** 1000; k -= 1000; }
  while (k < -1000) { x *= 2 ** -1000; k += 1000; }
  return x * 2 ** k;
}

/**
 * The shader's per-pixel loop in double precision: the tests' twin of the GPU program and the CPU
 * renderer's deep path. dcx/dcy is the pixel's offset from the reference in plane units (for Julia
 * it is the starting dz). Returns { n, zx, zy, rebases, blaSteps, glitches } and, with
 * opts.derive, the derivative dz/dc (dre, dim), the gradient of log|z| (gx, gy, from the whole
 * Jacobian, for the Burning Ship), and the cross orbit trap.
 *
 * glitches counts Pauldelbrot's criterion, |Z_m + dz| < 1e-3 |Z_m|, the classic test for a pixel
 * whose orbit lost its precision against the reference. Rebasing is the correction, and it fires
 * before the criterion can matter; the count is kept so a test can see both.
 */
export function perturbPixel(ref, dcx, dcy, maxIter, bla = null, opts = {}) {
  const { rebase = true, derive = false } = opts;
  const K = ref.len, Z = ref.z, D = ref.d;
  const kind = ref.kind;
  const julia = kind === "julia", ship = kind === "burningship", tri = kind === "tricorn";
  let dx = julia ? dcx : 0, dy = julia ? dcy : 0;
  const cx = julia ? 0 : dcx, cy = julia ? 0 : dcy;
  let m = 0, n = 0, rebases = 0, blaSteps = 0, glitches = 0;
  let zx = Z[0] + dx, zy = Z[1] + dy;
  // Derivative columns: (ur, ui) = dz/dcx, (vr, vi) = dz/dcy. A holomorphic map needs only the
  // first (the second is i times it). seed is the additive term, rescaled with them.
  let ur = julia ? 1 : 0, ui = 0, vr = 0, vi = julia ? 1 : 0, seed = julia ? 0 : 1;
  let trap = Infinity;
  while (n < maxIter) {
    let took = false;
    if (bla && m > 0) {
      const ldz = Math.log2(Math.hypot(dx, dy));
      const j0 = m - 1;
      for (let k = bla.levels.length - 1; k >= 0; k--) {
        if (j0 & ((1 << k) - 1)) continue;
        const idx = j0 >> k;
        if (idx >= bla.levels[k].count) continue;
        const en = bla.entries[bla.levels[k].offset + idx];
        if (!(ldz < en.lr) || n + en.l > maxIter) continue;
        const A = en.A, B = en.B;
        const sdx = scale2(dx, A.e), sdy = scale2(dy, A.e);
        const scx = B.zero ? 0 : scale2(cx, B.e), scy = B.zero ? 0 : scale2(cy, B.e);
        const nx = A.x * sdx - A.y * sdy + B.x * scx - B.y * scy;
        const ny = A.x * sdy + A.y * sdx + B.x * scy + B.y * scx;
        dx = nx; dy = ny;
        if (derive) {
          // D <- A D + B (per unit dc), in the derivative's own rescaled units.
          const sur = scale2(ur, A.e), sui = scale2(ui, A.e);
          const bs = B.zero ? 0 : scale2(seed, B.e);
          const nur = A.x * sur - A.y * sui + B.x * bs, nui = A.x * sui + A.y * sur + B.y * bs;
          ur = nur; ui = nui;
          if (en.trap < trap) trap = en.trap;
        }
        m += en.l; n += en.l; blaSteps++; took = true;
        break;
      }
    }
    if (!took) {
      const X = Z[m * 2], Y = Z[m * 2 + 1];
      if (derive) {
        // Derivative before z moves: it needs z_n.
        if (ship) {
          const sx = zx < 0 ? -1 : 1, sy = zy < 0 ? -1 : 1, ax = Math.abs(zx), ay = Math.abs(zy);
          const fur = sx * ur, fui = sy * ui, fvr = sx * vr, fvi = sy * vi;
          ur = 2 * (ax * fur - ay * fui) + seed; ui = 2 * (ax * fui + ay * fur);
          vr = 2 * (ax * fvr - ay * fvi); vi = 2 * (ax * fvi + ay * fvr) + seed;
        } else {
          const nur = 2 * (zx * ur - zy * ui) + seed, nui = 2 * (zx * ui + zy * ur);
          ur = nur; ui = tri ? -nui : nui;
        }
      }
      let nx, ny;
      if (ship) {
        nx = 2 * X * dx + dx * dx - 2 * Y * dy - dy * dy + cx;
        ny = 2 * diffabs(X * Y, X * dy + Y * dx + dx * dy) + cy;
      } else if (tri) {
        nx = 2 * (X * dx - Y * dy) + dx * dx - dy * dy + cx;
        ny = -(2 * (X * dy + Y * dx) + 2 * dx * dy) + cy;
      } else {
        nx = 2 * (X * dx - Y * dy) + dx * dx - dy * dy + cx;
        ny = 2 * (X * dy + Y * dx) + 2 * dx * dy + cy;
      }
      dx = nx; dy = ny; m++; n++;
    }
    const X = Z[m * 2], Y = Z[m * 2 + 1];
    zx = X + dx; zy = Y + dy;
    const r2 = zx * zx + zy * zy;
    if (derive) {
      if (!took) { const t = Math.min(Math.abs(zx), Math.abs(zy)); if (t < trap) trap = t; }
      if (Math.max(ur * ur + ui * ui, vr * vr + vi * vi) > 1e100) { ur *= 1e-50; ui *= 1e-50; vr *= 1e-50; vi *= 1e-50; seed *= 1e-50; }
    }
    if (r2 > BAILOUT2) break;
    if (r2 < 1e-6 * (X * X + Y * Y)) glitches++;
    if (rebase) {
      const rx = D[m * 2] + dx, ry = D[m * 2 + 1] + dy;
      if (rx * rx + ry * ry < dx * dx + dy * dy || m >= K) {
        dx = rx; dy = ry; m = 0; rebases++;
      }
    } else if (m >= K) {
      break;
    }
  }
  const out = { n, zx, zy, rebases, blaSteps, glitches };
  if (derive) {
    out.dre = ur; out.dim = ui; out.trap = trap;
    out.gx = zx * ur + zy * ui;
    out.gy = ship ? zx * vr + zy * vi : zx * (-ui) + zy * ur;
  }
  return out;
}

/** |c + d| - |c|, without the cancellation (the Burning Ship's perturbed fold). */
export function diffabs(c, d) {
  if (c >= 0) return c + d >= 0 ? d : -(2 * c + d);
  return c + d > 0 ? 2 * c + d : -d;
}

/** Direct iteration in BigInt fixed point: the ground truth the tests compare against. */
export function directIterate({ kind = "mandelbrot", re, im, jRe = 0, jIm = 0, maxIter, bits }) {
  const BB = BigInt(bits);
  let x, y, cx, cy;
  if (kind === "julia") { x = decToFixed(re, bits); y = decToFixed(im, bits); cx = decToFixed(jRe, bits); cy = decToFixed(jIm, bits); }
  else { x = 0n; y = 0n; cx = decToFixed(re, bits); cy = decToFixed(im, bits); }
  const lim = BigInt(BAILOUT2) << (2n * BB);
  let n = 0;
  while (n < maxIter) {
    const xx = x * x, yy = y * y;
    if (xx + yy > lim) break;
    const xy = (x * y) >> BB;
    if (kind === "burningship") { x = ((xx - yy) >> BB) + cx; y = 2n * (xy < 0n ? -xy : xy) + cy; }
    else if (kind === "tricorn") { x = ((xx - yy) >> BB) + cx; y = -2n * xy + cy; }
    else { x = ((xx - yy) >> BB) + cx; y = 2n * xy + cy; }
    n++;
  }
  return { n };
}

/**
 * Pick the reference. The centre comes first; when its orbit escapes before the budget, pixels that
 * outlive it must restart from Z_0 with their full value in float32, and pixels that are still
 * within float32's resolution of each other at that moment merge into blocks. A longer reference
 * pushes that moment past their own escape. So: probe a grid of the view against the current
 * reference on the CPU, move the reference to the longest-lived probe, and repeat while that
 * helps. This is the "reference from the highest-iteration pixel" choice deep-zoom renderers make.
 */
export function chooseReference({ kind, re, im, jRe, jIm, scale, w, h, maxIter, tries = 3, grid = 12 }) {
  let best = { re, im, offX: 0, offY: 0 };
  let ref = referenceOrbit({ kind, cRe: re, cIm: im, jRe, jIm, maxIter, scale });
  const px = scale / w, gw = grid, gh = Math.max(2, Math.round(grid * h / w));
  for (let t = 0; t < tries && ref.len < maxIter; t++) {
    let top = { n: ref.len, x: 0, y: 0 };
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      // Probe positions relative to the view centre; pixel offsets from the reference follow.
      const x = ((i + 0.5) / gw - 0.5) * w * px, y = ((j + 0.5) / gh - 0.5) * h * px;
      const r = perturbPixel(ref, x - best.offX, y - best.offY, maxIter);
      if (r.n > top.n) top = { n: r.n, x, y };
    }
    if (top.n <= ref.len) break;
    best = { re: offsetDec(re, top.x, scale), im: offsetDec(im, top.y, scale), offX: top.x, offY: top.y };
    const next = referenceOrbit({ kind, cRe: best.re, cIm: best.im, jRe, jIm, maxIter, scale });
    if (next.len <= ref.len) break;
    ref = next;
  }
  return { ref, re: best.re, im: best.im };
}
