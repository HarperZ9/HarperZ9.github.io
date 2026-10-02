// oklab-int.mjs: the integer OKLab path, project-telos.oklab-int/v1 (Telos Track A step T3).
//
// Float OKLab needs a cube root, and ECMAScript leaves Math.cbrt and Math.pow implementation-
// approximated, so a value on a quantisation edge can land in different bins in V8, SpiderMonkey and
// numpy. This path uses integers only, so Node, every browser and the Python twin
// (tests/telos-track-a/py/oklab_int.py) produce the same bins and the same layer text, byte for byte.
//
//   sRGB byte -> linear:  a 256-entry table of round(lin(i / 255) * 2^20), computed once at 60-digit
//                         precision (tests/telos-track-a/py/gen_oklab_int_constants.py) and embedded.
//   linear -> LMS:        Ottosson's M1 with coefficients round(c * 2^20); Q20 = floor((sum + 2^19) / 2^20);
//                         Q16 = floor((Q20 + 8) / 16), clamped to [0, 65536].
//   cube root:            a 65,537-entry table of the integer nearest cbrt(x / 65536) * 65536, built here
//                         by an exact integer routine (no floating point).
//   LMS' -> OKLab:        Ottosson's M2 with coefficients round(c * 2^20); L, a, b in Q36, unrounded.
//   bins:                 bin = clamp(floor((2 (V - LO) n + S) / (2 S)), 0, n), n = 2^bits - 1, S = HI - LO.
//
// Every intermediate stays below 2^53, so plain Numbers hold exact integers; floorDiv() corrects the
// one place where float division could round across an integer. ASCII only.

export const OKLAB_INT_SCHEMA = "project-telos.oklab-int/v1";

export const LIN_Q20 = Object.freeze([
  0, 318, 637, 955, 1273, 1591, 1910, 2228, 2546, 2864, 3183, 3509,
  3855, 4220, 4605, 5009, 5433, 5878, 6343, 6828, 7335, 7863, 8413, 8984,
  9578, 10193, 10832, 11492, 12176, 12883, 13614, 14368, 15145, 15947, 16773, 17624,
  18499, 19399, 20324, 21274, 22250, 23251, 24278, 25331, 26410, 27516, 28648, 29807,
  30993, 32205, 33445, 34713, 36008, 37331, 38681, 40060, 41467, 42903, 44367, 45860,
  47381, 48932, 50512, 52121, 53760, 55428, 57127, 58855, 60613, 62402, 64221, 66071,
  67951, 69862, 71805, 73778, 75783, 77819, 79886, 81985, 84117, 86280, 88475, 90702,
  92962, 95254, 97579, 99937, 102328, 104751, 107208, 109698, 112222, 114779, 117370, 119994,
  122653, 125345, 128072, 130833, 133628, 136458, 139323, 142222, 145156, 148125, 151130, 154169,
  157244, 160355, 163501, 166683, 169900, 173154, 176443, 179769, 183131, 186530, 189964, 193436,
  196944, 200489, 204072, 207691, 211347, 215041, 218772, 222540, 226346, 230190, 234071, 237991,
  241948, 245944, 249978, 254050, 258161, 262310, 266498, 270724, 274990, 279294, 283637, 288020,
  292442, 296903, 301404, 305944, 310523, 315143, 319802, 324502, 329241, 334021, 338840, 343700,
  348601, 353542, 358523, 363546, 368609, 373713, 378858, 384044, 389271, 394539, 399849, 405201,
  410594, 416028, 421504, 427022, 432582, 438184, 443828, 449515, 455243, 461014, 466827, 472683,
  478582, 484523, 490507, 496534, 502604, 508717, 514873, 521072, 527315, 533601, 539930, 546303,
  552720, 559181, 565685, 572234, 578826, 585462, 592143, 598868, 605637, 612451, 619309, 626211,
  633159, 640151, 647188, 654270, 661397, 668569, 675786, 683048, 690356, 697709, 705108, 712552,
  720042, 727577, 735159, 742786, 750459, 758178, 765944, 773755, 781613, 789517, 797468, 805465,
  813509, 821599, 829736, 837920, 846151, 854429, 862753, 871125, 879545, 888011, 896525, 905086,
  913695, 922351, 931055, 939807, 948606, 957453, 966349, 975292, 984283, 993323, 1002411, 1011547,
  1020731, 1029964, 1039246, 1048576,
]);
export const M1_Q20 = Object.freeze([[432246, 562385, 53945], [222197, 713765, 112614], [92592, 295404, 660581]]);
export const M2_Q20 = Object.freeze([[220677, 832169, -4270], [2074082, -2546563, 472482], [27162, 820796, -847958]]);
// round(x * 2^36) of the per-channel OKLab ranges L [0, 1], a [-0.234, 0.277], b [-0.312, 0.199].
export const RANGES_Q36 = Object.freeze({ L: [0, 68719476736], a: [-16080357556, 19035295056], b: [-21440476742, 13675175870] });

// Exact floor(a / b) for integers a and b > 0 with |a| < 2^53.
export function floorDiv(a, b) {
  let q = Math.floor(a / b);
  if (q * b > a) q -= 1;
  else if ((q + 1) * b <= a) q += 1;
  return q;
}

// Exact floor square root of a non-negative integer below 2^53.
export function isqrt(n) {
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r -= 1;
  while ((r + 1) * (r + 1) <= n) r += 1;
  return r;
}

// The integer nearest cbrt(x / 65536) * 65536 for x in [0, 65536]: floor cube root of x * 2^32 by
// binary search, then round up when 8 x 2^32 >= (2f + 1)^3 (i.e. when the true root is >= f + 1/2).
function cbrtQ16Exact(x) {
  const n = x * 4294967296; // x * 2^32 <= 2^48
  let lo = 0, hi = 65537;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (mid * mid * mid <= n) lo = mid; else hi = mid - 1;
  }
  const t = 2 * lo + 1;
  return n * 8 >= t * t * t ? lo + 1 : lo;
}
export const CBRT_Q16 = (() => {
  const t = new Int32Array(65537);
  for (let x = 0; x <= 65536; x++) t[x] = cbrtQ16Exact(x);
  return t;
})();

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Linear RGB in Q20 -> OKLab in Q36, as [L, a, b] integers.
export function oklabQ36FromLinearQ20(r, g, b) {
  const m = M1_Q20, p = M2_Q20, cb = CBRT_Q16;
  const l = clamp(floorDiv(floorDiv(m[0][0] * r + m[0][1] * g + m[0][2] * b + 524288, 1048576) + 8, 16), 0, 65536);
  const mm = clamp(floorDiv(floorDiv(m[1][0] * r + m[1][1] * g + m[1][2] * b + 524288, 1048576) + 8, 16), 0, 65536);
  const s = clamp(floorDiv(floorDiv(m[2][0] * r + m[2][1] * g + m[2][2] * b + 524288, 1048576) + 8, 16), 0, 65536);
  const l_ = cb[l], m_ = cb[mm], s_ = cb[s];
  return [
    p[0][0] * l_ + p[0][1] * m_ + p[0][2] * s_,
    p[1][0] * l_ + p[1][1] * m_ + p[1][2] * s_,
    p[2][0] * l_ + p[2][1] * m_ + p[2][2] * s_,
  ];
}

// sRGB bytes -> OKLab in Q36.
export function oklabQ36FromSrgb8(r8, g8, b8) {
  return oklabQ36FromLinearQ20(LIN_Q20[r8], LIN_Q20[g8], LIN_Q20[b8]);
}

// The bin of a Q36 channel value at `bits` bits over that channel's range (round half up, clamped).
export function binQ36(v, channel, bits) {
  const [lo, hi] = RANGES_Q36[channel];
  const n = (1 << bits) - 1, span = hi - lo;
  return clamp(floorDiv(2 * (v - lo) * n + span, 2 * span), 0, n);
}

// Bins of one sRGB colour at L6/ab6 plus its L8 bin: [L6, a6, b6, L8].
export function binsOfSrgb8(r8, g8, b8) {
  const [L, a, b] = oklabQ36FromSrgb8(r8, g8, b8);
  return [binQ36(L, "L", 6), binQ36(a, "a", 6), binQ36(b, "b", 6), binQ36(L, "L", 8)];
}

// Encode the full 8-bit sRGB cube: 4 bytes per colour (L6, a6, b6, L8), colour index (r << 16) | (g << 8) | b.
export function encodeCube() {
  const out = new Uint8Array(16777216 * 4);
  const lut = LIN_Q20;
  for (let r = 0; r < 256; r++) for (let g = 0; g < 256; g++) for (let b = 0; b < 256; b++) {
    const [L, A, B] = oklabQ36FromLinearQ20(lut[r], lut[g], lut[b]);
    const o = ((r << 16) | (g << 8) | b) * 4;
    out[o] = binQ36(L, "L", 6); out[o + 1] = binQ36(A, "a", 6); out[o + 2] = binQ36(B, "b", 6); out[o + 3] = binQ36(L, "L", 8);
  }
  return out;
}
