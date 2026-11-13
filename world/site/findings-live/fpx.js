// fpx.js: exact floating-point helpers the least-squares port needs to match the study's numpy bit for bit.
// fma: a fused multiply-add built from error-free transforms and rounding to odd (Boldo and Melquiond, 2008).
// nrm2: the Euclidean norm in the order OpenBLAS sums it on x86-64. logdd: the natural log evaluated in
// double-double. It mirrors src/fpx.bld function for function.
const f = new Float64Array(1), u = new Uint32Array(f.buffer);
const SPLIT = 134217729;
let lo = 0; // low word of the last two-word result

function twoSum(a, b) { const s = a + b, bb = s - a; lo = (a - (s - bb)) + (b - bb); return s; }
function twoProd(a, b) {
  const p = a * b, ca = SPLIT * a, cb = SPLIT * b;
  const ah = ca - (ca - a), al = a - ah, bh = cb - (cb - b), bl = b - bh;
  lo = ((ah * bh - p) + ah * bl + al * bh) + al * bl;
  return p;
}

// step x one representable double toward larger magnitude (dir > 0) or smaller magnitude (dir < 0)
function stepMag(x, dir) {
  f[0] = x;
  if (dir > 0) { u[0] += 1; if (u[0] === 0) u[1] += 1; } else { if (u[0] === 0) u[1] -= 1; u[0] -= 1; }
  return f[0];
}

export function fma(a, b, c) {
  const p = twoProd(a, b), pe = lo;
  const th = twoSum(c, pe), tl = lo;
  const vh = twoSum(p, th), vl = lo;
  let z = twoSum(tl, vl);
  const w = lo;
  if (w !== 0) {
    f[0] = z;
    if ((u[0] & 1) === 0) z = stepMag(z, (w > 0) === (z > 0) ? 1 : -1);
  }
  return vh + z;
}

// dnrm2 of x[off .. off+n) as the OpenBLAS x86-64 kernel computes it under the Windows default of 53-bit x87
// precision: plain double sums of squares, four running sums over whole blocks of eight, then one square root.
export function nrm2(x, off, n) {
  const n8 = n - (n % 8);
  let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
  for (let i = 0; i < n8; i += 4) {
    a0 += x[off + i] * x[off + i]; a1 += x[off + i + 1] * x[off + i + 1];
    a2 += x[off + i + 2] * x[off + i + 2]; a3 += x[off + i + 3] * x[off + i + 3];
  }
  for (let i = n8; i < n; i++) a0 += x[off + i] * x[off + i];
  return Math.sqrt(((a0 + a2) + a1) + a3);
}

// ---- double-double log
function ddMul(ah, al, bh, bl) { const p = twoProd(ah, bh), e = lo + (ah * bl + al * bh); const h = p + e; lo = e - (h - p); return h; }
function ddAdd(ah, al, bh, bl) { const s = twoSum(ah, bh), e = lo + (al + bl); const h = s + e; lo = e - (h - s); return h; }
function ddDiv(a, bh, bl) { // double a over double-double b
  const q1 = a / bh, p = twoProd(q1, bh), q2 = (((a - p) - lo) - q1 * bl) / bh, h = q1 + q2;
  lo = q2 - (h - q1);
  return h;
}
const LN2H = 0.6931471805599453, LN2L = 2.3190468138462996e-17;

// log(x) for a positive, normal double: 2 atanh((m-1)/(m+1)) + k ln 2, all in double-double, then rounded once.
export function logdd(x) {
  f[0] = x;
  let k = ((u[1] >>> 20) & 0x7ff) - 1023;
  u[1] = (u[1] & 0xfffff) | 0x3ff00000;
  let m = f[0];
  if (m > 1.4142135623730951) { m *= 0.5; k += 1; }
  const dh = twoSum(m, 1), dl = lo;
  const fh = ddDiv(m - 1, dh, dl), fl = lo;
  const zh = ddMul(fh, fl, fh, fl), zl = lo;
  let sh = 0, sl = 0;
  for (let j = 24; j >= 0; j--) {
    const th = ddMul(sh, sl, zh, zl), tl = lo;
    const ch = ddDiv(1, 2 * j + 1, 0), cl = lo;
    sh = ddAdd(th, tl, ch, cl); sl = lo;
  }
  const lh = ddMul(sh, sl, 2 * fh, 2 * fl), ll = lo;
  const kh = twoProd(k, LN2H), kl = lo + k * LN2L;
  return ddAdd(kh, kl, lh, ll);
}
