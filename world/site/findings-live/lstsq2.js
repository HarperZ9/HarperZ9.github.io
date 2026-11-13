// lstsq2.js: the least-squares solve numpy.linalg.lstsq performs for a two-column system, in the same operation
// order as LAPACK dgelsd on OpenBLAS 0.3.31 (Haswell kernels): Householder QR of the m-by-2 matrix, the 2-by-2
// singular value step (dlasv2), then the back substitution. Each helper names the routine it follows.
// It mirrors src/lstsq2.bld function for function. m is 3 or more and both columns are non-zero.
import { fma, nrm2 } from "./fpx.js";

const EPS = 2.220446049250313e-16;
const sign = (a, b) => (b < 0 ? -Math.abs(a) : Math.abs(a));

// dgemv 'T' for one column: sum of a[i]*x[i], four running sums over whole blocks of four, fused tail.
function dotT(a, ao, x, xo, m) {
  const m4 = m - (m % 4), m3 = m % 4;
  let l0 = 0, h0 = 0, l1 = 0, h1 = 0;
  for (let i = 0; i < m4; i += 4) {
    l0 += a[ao + i] * x[xo + i]; h0 += a[ao + i + 1] * x[xo + i + 1];
    l1 += a[ao + i + 2] * x[xo + i + 2]; h1 += a[ao + i + 3] * x[xo + i + 3];
  }
  const y = 0.0 + ((l0 + l1) + (h0 + h1)), p = ao + m4, q = xo + m4;
  if (m3 === 1) return fma(a[p], x[q], y);
  if (m3 === 2) return y + fma(a[p], x[q], a[p + 1] * x[q + 1]);
  if (m3 === 3) return y + fma(a[p + 2], x[q + 2], fma(a[p], x[q], a[p + 1] * x[q + 1]));
  return y;
}

function lapy2(x, y) {
  const xa = Math.abs(x), ya = Math.abs(y), w = Math.max(xa, ya), z = Math.min(xa, ya);
  if (z === 0) return w;
  const t = z / w;
  return w * Math.sqrt(1 + t * t);
}

// dlarfg on a[off .. off+m): leaves beta at a[off] and the reflector tail below it, returns tau.
function larfg(a, off, m) {
  if (m <= 1) return 0;
  const alpha = a[off], xn = nrm2(a, off + 1, m - 1);
  if (xn === 0) return 0;
  const beta = -sign(lapy2(alpha, xn), alpha), sc = 1 / (alpha - beta);
  for (let i = 1; i < m; i++) a[off + i] *= sc;
  a[off] = beta;
  return (beta - alpha) / beta;
}

// dlarf from the left on one column c[co .. co+m), reflector v[vo .. vo+m) with v[vo] read as 1.
function larf(v, vo, m, tau, c, co) {
  if (tau === 0) return;
  const keep = v[vo];
  v[vo] = 1;
  let lastv = m, any = false;
  while (lastv > 0 && v[vo + lastv - 1] === 0) lastv--;
  for (let i = 0; i < lastv; i++) if (c[co + i] !== 0) any = true;
  if (any) {
    const t = -tau * dotT(c, co, v, vo, lastv);
    for (let i = 0; i < lastv; i++) c[co + i] += t * v[vo + i];
  }
  v[vo] = keep;
}

// dlasv2: singular values and rotations of the upper triangular [[f, g], [0, h]].
// Returns [ssmin, ssmax, snr, csr, snl, csl].
function lasv2(f, g, h) {
  let ft = f, fa = Math.abs(f), ht = h, ha = Math.abs(h), pmax = 1, t;
  const swap = ha > fa;
  if (swap) { pmax = 3; t = ft; ft = ht; ht = t; t = fa; fa = ha; ha = t; }
  const gt = g, ga = Math.abs(g);
  let ssmin, ssmax, clt, crt, slt, srt;
  if (ga === 0) { ssmin = ha; ssmax = fa; clt = 1; crt = 1; slt = 0; srt = 0; } else {
    let gasmal = true;
    if (ga > fa) {
      pmax = 2;
      if (fa / ga < EPS / 2) {
        gasmal = false; ssmax = ga; ssmin = ha > 1 ? fa / (ga / ha) : (fa / ga) * ha;
        clt = 1; slt = ht / gt; srt = 1; crt = ft / gt;
      }
    }
    if (gasmal) {
      const d = fa - ha, m = gt / ft, mm = m * m;
      let l = d === fa ? 1 : d / fa, tt = 2 - l;
      const s = Math.sqrt(tt * tt + mm), r = l === 0 ? Math.abs(m) : Math.sqrt(l * l + mm), a = 0.5 * (s + r);
      ssmin = ha / a; ssmax = fa * a;
      if (mm === 0) tt = l === 0 ? sign(2, ft) * sign(1, gt) : gt / sign(d, ft) + m / tt;
      else tt = (m / (s + tt) + m / (r + l)) * (1 + a);
      l = Math.sqrt(tt * tt + 4);
      crt = 2 / l; srt = tt / l; clt = (crt + srt * m) / a; slt = (ht / ft) * srt / a;
    }
  }
  const csl = swap ? srt : clt, snl = swap ? crt : slt, csr = swap ? slt : crt, snr = swap ? clt : srt;
  let ts;
  if (pmax === 1) ts = sign(1, csr) * sign(1, csl) * sign(1, f);
  else if (pmax === 2) ts = sign(1, snr) * sign(1, csl) * sign(1, g);
  else ts = sign(1, snr) * sign(1, snl) * sign(1, h);
  return [sign(ssmin, ts * sign(1, f) * sign(1, h)), sign(ssmax, ts), snr, csr, snl, csl];
}

const TOLMUL = 98.70149282610436, UNFL = 2.2250738585072014e-308; // eps^(-1/8) with eps = 2^-53; safe minimum

// dlalsd for the 2-by-2 upper bidiagonal [[d1, e], [0, d2]] and right side (b1, b2). Returns [w0, w1].
function bidiagSolve(d1, d2, e, b1, b2, rcond) {
  const orgnrm = Math.max(Math.abs(d1), Math.abs(d2), Math.abs(e)), mul = 1 / orgnrm;
  d1 *= mul; d2 *= mul; e *= mul;
  let smin = Math.abs(d1);
  if (smin !== 0) smin = Math.min(smin, Math.abs(d2) * (smin / (smin + Math.abs(e))));
  const thresh = Math.max(TOLMUL * (EPS / 2) * (smin / Math.sqrt(2)), 6 * (2 * (2 * UNFL)));
  let v00 = 1, v01 = 0, v10 = 0, v11 = 1; // rows of VT
  if (Math.abs(e) > thresh) {
    const [smn, smx, snr, csr, snl, csl] = lasv2(d1, e, d2);
    d1 = smx; d2 = smn; v00 = csr; v01 = snr; v10 = -snr; v11 = csr;
    const t = fma(csl, b1, snl * b2);
    b2 = fma(csl, b2, -(snl * b1)); b1 = t;
  }
  if (d1 < 0) { d1 = -d1; v00 = -v00; v01 = -v01; }
  if (d2 < 0) { d2 = -d2; v10 = -v10; v11 = -v11; }
  if (d2 > d1) {
    let t = d1; d1 = d2; d2 = t; t = b1; b1 = b2; b2 = t;
    t = v00; v00 = v10; v10 = t; t = v01; v01 = v11; v11 = t;
  }
  const tol = rcond * d1;
  b1 = d1 <= tol ? 0 : b1 * (1 / d1);
  b2 = d2 <= tol ? 0 : b2 * (1 / d2);
  return [fma(v00, b1, v10 * b2) * mul, fma(v01, b1, v11 * b2) * mul];
}

// lstsq([c1 c2], y). The three arrays are overwritten. rcond as numpy passes it.
export function lstsq2(c1, c2, y, m, rcond) {
  const tau1 = larfg(c1, 0, m);
  larf(c1, 0, m, tau1, c2, 0);
  const tau2 = larfg(c2, 1, m - 1);
  larf(c1, 0, m, tau1, y, 0);
  larf(c2, 1, m - 1, tau2, y, 1);
  return bidiagSolve(c1[0], c2[1], c2[0], y[0], y[1], rcond);
}

export const RCOND = EPS; // times the row count, for both lstsq(rcond=None) and polyfit

// numpy.polyfit(x, y, 1): columns [x, 1] scaled to unit length, the solve, then the scale divided back out.
// Returns [slope, intercept]. x and y are read only.
export function polyfit1(x, y, m, w1, w2, w3) {
  let s1 = 0, s2 = 0;
  for (let i = 0; i < m; i++) { s1 += x[i] * x[i]; s2 += 1; }
  s1 = Math.sqrt(s1); s2 = Math.sqrt(s2);
  for (let i = 0; i < m; i++) { w1[i] = x[i] / s1; w2[i] = 1 / s2; w3[i] = y[i]; }
  const c = lstsq2(w1, w2, w3, m, m * EPS);
  return [c[0] / s1, c[1] / s2];
}
