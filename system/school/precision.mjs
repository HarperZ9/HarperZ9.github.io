// Lesson K24, "fp16, bf16 and tensor cores". Pure ES module, no DOM and no
// dependencies: the lab page, a worker and the Node fill script share it.
//
// Two ways to round a number to a narrow binary format, written
// independently so each checks the other:
//   roundTo(x, F)   value level: works on any double x. The exponent e of x
//                   (read from the double's bits) fixes the quantum
//                   q = 2^(max(e, emin) - p + 1); x / q is rounded to an
//                   integer, ties to even (IEEE 754-2019's roundTiesToEven, the
//                   default for binary formats), and multiplied back. Below 2^emin the quantum stays 2^(emin -
//                   p + 1): that is gradual underflow (subnormals). A result
//                   above the largest finite value becomes infinity.
//   f16Bits / bf16Bits   bit level: from the bits of a float32 value, the
//                   classic shift and round of the significand.
// Formats (p = significand bits including the hidden one):
//   fp16 = IEEE 754 binary16: p 11, emin -14, emax 15, max 65504,
//          smallest normal 2^-14, smallest subnormal 2^-24, u = 2^-11;
//   bf16 = bfloat16 (defined by Google and Intel, not by IEEE 754): float32's 8 exponent bits with 7
//          stored significand bits, p 8, emin -126, emax 127, u = 2^-8;
//   fp32 = binary32 for comparison: p 24, u = 2^-24.
// mode "truncate" (round toward zero by dropping bits) is a control only: a
// plausible-looking wrong conversion the bit-pattern tests must catch.

const fmt = (name, p, emin, emax, bits) => Object.freeze({ name, p, emin, emax, bits, max: (2 - 2 ** (1 - p)) * 2 ** emax, minNormal: 2 ** emin, minSub: 2 ** (emin - p + 1), u: 2 ** -p, eps: 2 ** (1 - p) });
export const FORMATS = Object.freeze({ fp16: fmt("fp16", 11, -14, 15, 16), bf16: fmt("bf16", 8, -126, 127, 16), fp32: fmt("fp32", 24, -126, 127, 32) });

const F64 = new Float64Array(1), W64 = new Uint32Array(F64.buffer), F32 = new Float32Array(1), W32 = new Uint32Array(F32.buffer);
const POW2 = Float64Array.from({ length: 2200 }, (_, i) => 2 ** (i - 1100));
const pow2 = (k) => POW2[k + 1100];

// floor(log2 a) for a positive finite double, read from its exponent bits.
function exponentOf(a) {
  F64[0] = a;
  const e = (W64[1] >>> 20) & 0x7ff;
  return e === 0 ? Math.floor(Math.log2(a)) : e - 1023;
}

// Round to nearest integer, ties to even, for |y| < 2^52.
export function rint(y) {
  const r = Math.round(y);
  return r - y === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export function roundTo(x, F, mode = "nearest") {
  if (x === 0 || !Number.isFinite(x)) return x;
  const a = Math.abs(x), q = pow2(Math.max(exponentOf(a), F.emin) - F.p + 1), y = a / q;
  let v = (mode === "truncate" ? Math.floor(y) : rint(y)) * q;
  if (v > F.max) v = mode === "truncate" ? F.max : Infinity;
  return x < 0 ? -v : v;
}

export const round16 = (x) => roundTo(x, FORMATS.fp16);
export const roundBf16 = (x) => roundTo(x, FORMATS.bf16);
export const rounder = (name, mode = "nearest") => (name === "fp32" ? Math.fround : (x) => roundTo(x, FORMATS[name], mode));

// Spacing between neighbouring values of format F around x (one ulp).
export function spacing(x, F) {
  const a = Math.abs(x);
  return a === 0 ? F.minSub : pow2(Math.max(exponentOf(a), F.emin) - F.p + 1);
}

// ---- bit level ----

export function f32Bits(x) { F32[0] = x; return W32[0]; }

// binary16 bits of the float32 value x. mode "truncate" drops the low bits.
export function f16Bits(x, mode = "nearest") {
  const b = f32Bits(x), sign = (b >>> 16) & 0x8000, exp = (b >>> 23) & 0xff;
  let man = b & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (man ? 0x200 : 0);
  const e = exp - 112;
  if (e >= 0x1f) return mode === "truncate" ? sign | 0x7bff : sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    man |= 0x800000;
    const shift = 14 - e, half = 2 ** (shift - 1), rem = man % 2 ** shift;
    let h = Math.floor(man / 2 ** shift);
    if (mode !== "truncate" && (rem > half || (rem === half && h % 2 === 1))) h++;
    return sign | h;
  }
  let h = (e << 10) | (man >>> 13);
  const rem = man & 0x1fff;
  if (mode !== "truncate" && (rem > 0x1000 || (rem === 0x1000 && (h & 1)))) h++;
  return sign | h;
}

export function f16FromBits(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >>> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0x1f) return m ? NaN : s * Infinity;
  return e === 0 ? s * m * 2 ** -24 : s * (1 + m / 1024) * 2 ** (e - 15);
}

// bfloat16 bits: the top 16 bits of float32, rounded to nearest even.
export function bf16Bits(x, mode = "nearest") {
  const b = f32Bits(x);
  if ((b & 0x7f800000) === 0x7f800000 && b & 0x7fffff) return (b >>> 16) | 0x40;
  if (mode === "truncate") return b >>> 16;
  return ((b + 0x7fff + ((b >>> 16) & 1)) >>> 16) & 0xffff;
}

export function bf16FromBits(h) { W32[0] = (h & 0xffff) << 16; return F32[0]; }

export const hex = (h, w = 4) => "0x" + h.toString(16).padStart(w, "0");

// Known patterns: [value (exactly a float32), fp16 bits, bf16 bits]. Ties
// and subnormals are included so truncation and a missing round-to-even fail.
export const KNOWN = Object.freeze([
  [1, 0x3c00, 0x3f80], [-2, 0xc000, 0xc000], [65504, 0x7bff, 0x4780], [65520, 0x7c00, 0x4780], [65519, 0x7bff, 0x4780],
  [2 ** -14, 0x0400, 0x3880], [2 ** -24, 0x0001, 0x3380], [2 ** -25, 0x0000, 0x3300], [3 * 2 ** -26, 0x0001, 0x3340],
  [1 + 2 ** -11, 0x3c00, 0x3f80], [1 + 3 * 2 ** -11, 0x3c02, 0x3f80], [Math.fround(1 / 3), 0x3555, 0x3eab], [Math.fround(Math.PI), 0x4248, 0x4049],
  [110, 0x56e0, 0x42dc], [Math.fround(0.1), 0x2e66, 0x3dcd], [1 + 2 ** -8, 0x3c04, 0x3f80], [1 + 3 * 2 ** -8, 0x3c0c, 0x3f82], [-0, 0x8000, 0x8000],
]);

// Relative rounding error of format F across magnitudes: for every octave
// [2^k, 2^(k+1)) from 2^lo to 2^hi, `per` float32 values spread through it.
export function errorSweep(F, { lo = -30, hi = 20, per = 1031 } = {}) {
  const rows = [];
  for (let k = lo; k <= hi; k++) {
    let mx = 0, sum = 0, inf = 0, zero = 0;
    for (let i = 0; i < per; i++) {
      const x = Math.fround(2 ** k * (1 + i / per)), r = roundTo(x, F), e = Math.abs(r - x) / x;
      if (!Number.isFinite(r)) { inf++; continue; }
      if (r === 0) zero++;
      mx = Math.max(mx, e); sum += e;
    }
    rows.push({ octave: k, from: 2 ** k, spacing: spacing(2 ** k, F), maxRel: inf === per ? null : mx, meanRel: inf === per ? null : sum / (per - inf), overflow: inf, toZero: zero });
  }
  return rows;
}

// Which significand width is needed so that the worst rounding error near x
// is at most rel: half a spacing over x.
export function precisionNear(x, F) {
  const s = spacing(x, F);
  return { x, format: F.name, spacing: s, spacingRel: s / Math.abs(x), worstRel: s / 2 / Math.abs(x), rounded: roundTo(x, F) };
}
export function bitsNeeded(x, rel) {
  for (let p = 2; p <= 53; p++) if (pow2(exponentOf(Math.abs(x)) - p + 1) / 2 / Math.abs(x) <= rel) return p;
  return null;
}

// Repeatedly adding `step` to a running sum stored in format F (each sum
// rounded to F). Returns where it stops changing (stagnation) and the final
// sum against the exact one.
export function longSum(step, n, F) {
  const r = F.name === "fp32" ? Math.fround : (x) => roundTo(x, F), s0 = r(step);
  let s = 0, stuckAt = null, stuckIndex = null;
  for (let i = 0; i < n; i++) {
    const t = r(s + s0);
    if (t === s && stuckAt === null) { stuckAt = s; stuckIndex = i; }
    s = t;
  }
  return { format: F.name, step, stepStored: s0, n, sum: s, exact: s0 * n, relErr: Math.abs(s - s0 * n) / (s0 * n), stuckAt, stuckIndex, spacingAtStuck: stuckAt === null ? null : spacing(stuckAt, F) };
}
