// oklab-int.mjs: the integer OKLab path, project-telos.oklab-int/v2.
//
// Float OKLab needs a cube root, and ECMAScript leaves Math.cbrt and Math.pow implementation-
// approximated, so a value on a quantisation edge could land in different bins in V8, SpiderMonkey and
// numpy. This path uses exact integer arithmetic, so Node, every browser and the Python twin
// (oklab_int.py in the site repository) produce the same bins and the same layer text, byte for byte.
//
//   sRGB byte -> linear:  a 256-entry table of round(lin(i / 255) * 2^24), computed once at 60-digit
//                         precision (gen_oklab_int_constants.py in the site repository) and embedded.
//   linear -> LMS:        Ottosson's M1 with coefficients round(c * 2^20); LMS kept unrounded in Q44.
//   cube root:            the integer nearest cbrt(x / 2^44) * 2^16, i.e. the nearest integer cube root of
//                         16 x. A Math.cbrt first guess is corrected with integer comparisons until
//                         f^3 <= 16 x < (f + 1)^3, so the result never depends on the engine's cbrt.
//   LMS' -> OKLab:        Ottosson's M2 with coefficients round(c * 2^20); L, a, b in Q36, unrounded.
//   bins:                 bin = clamp(floor((2 (V - LO) n + S) / (2 S)), 0, n), n = 2^bits - 1, S = HI - LO.
//
// v1 rounded LMS to Q16 before a table cube root and deviated from float OKLab by up to 2.0e-3 near
// black; v2 removes that rounding. Every intermediate stays below 2^53, so plain Numbers hold exact
// integers; floorDiv() corrects the one place where float division could round across an integer.
// ASCII only.

export const OKLAB_INT_SCHEMA = "project-telos.oklab-int/v2";

export const LIN_Q24 = Object.freeze([
  0, 5092, 10185, 15277, 20369, 25462, 30554, 35646, 40739, 45831,
  50923, 56146, 61682, 67524, 73676, 80144, 86931, 94043, 101483, 109255,
  117364, 125813, 134607, 143749, 153244, 163095, 173306, 183880, 194821, 206133,
  217819, 229883, 242327, 255157, 268373, 281981, 295983, 310382, 325182, 340386,
  355996, 372016, 388449, 405298, 422565, 440255, 458369, 476910, 495881, 515286,
  535127, 555406, 576126, 597291, 618902, 640963, 663476, 686443, 709868, 733752,
  758099, 782910, 808189, 833938, 860159, 886854, 914027, 941680, 969814, 998433,
  1027538, 1057133, 1087218, 1117798, 1148873, 1180447, 1212520, 1245097, 1278179, 1311767,
  1345865, 1380475, 1415598, 1451237, 1487394, 1524071, 1561270, 1598994, 1637244, 1676023,
  1715332, 1755173, 1795550, 1836463, 1877915, 1919907, 1962442, 2005522, 2049149, 2093324,
  2138049, 2183328, 2229161, 2275550, 2322497, 2370005, 2418074, 2466708, 2515908, 2565675,
  2616012, 2666920, 2718402, 2770458, 2823092, 2876304, 2930097, 2984472, 3039432, 3094977,
  3151110, 3207832, 3265145, 3323052, 3381553, 3440650, 3500346, 3560641, 3621538, 3683038,
  3745144, 3807855, 3871176, 3935106, 3999648, 4064803, 4130573, 4196960, 4263965, 4331589,
  4399836, 4468706, 4538200, 4608321, 4679069, 4750448, 4822457, 4895099, 4968376, 5042288,
  5116838, 5192027, 5267856, 5344328, 5421443, 5499204, 5577611, 5656667, 5736372, 5816729,
  5897738, 5979402, 6061722, 6144699, 6228335, 6312631, 6397589, 6483210, 6569496, 6656448,
  6744068, 6832357, 6921317, 7010948, 7101253, 7192233, 7283889, 7376223, 7469237, 7562930,
  7657306, 7752366, 7848110, 7944540, 8041658, 8139465, 8237963, 8337152, 8437035, 8537612,
  8638885, 8740855, 8843524, 8946893, 9050964, 9155737, 9261215, 9367397, 9474287, 9581885,
  9690192, 9799210, 9908940, 10019383, 10130542, 10242416, 10355008, 10468318, 10582349, 10697100,
  10812575, 10928773, 11045697, 11163346, 11281724, 11400831, 11520668, 11641236, 11762538, 11884573,
  12007344, 12130852, 12255098, 12380082, 12505807, 12632274, 12759484, 12887438, 13016137, 13145583,
  13275776, 13406719, 13538412, 13670857, 13804054, 13938006, 14072712, 14208175, 14344396, 14481375,
  14619114, 14757615, 14896878, 15036905, 15177696, 15319253, 15461578, 15604671, 15748533, 15893166,
  16038571, 16184750, 16331702, 16479430, 16627934, 16777216,
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

// The integer nearest cbrt(x / 2^44) * 2^16 for an integer 0 <= x <= 2^44 + 2^25: the floor cube root f
// of n = 16 x (n <= 2^48.0001), then f + 1 when 8 n >= (2f + 1)^3 (the true root is >= f + 1/2).
export function cbrtQ44toQ16(x) {
  const n = x * 16;
  let f = Math.round(Math.cbrt(n));
  while (f > 0 && f * f * f > n) f -= 1;
  while ((f + 1) * (f + 1) * (f + 1) <= n) f += 1;
  const t = 2 * f + 1;
  return n * 8 >= t * t * t ? f + 1 : f;
}

// Linear RGB in Q24 -> OKLab in Q36, as [L, a, b] integers.
export function oklabQ36FromLinearQ24(r, g, b) {
  const m = M1_Q20, p = M2_Q20;
  const l = Math.max(0, m[0][0] * r + m[0][1] * g + m[0][2] * b);
  const mm = Math.max(0, m[1][0] * r + m[1][1] * g + m[1][2] * b);
  const s = Math.max(0, m[2][0] * r + m[2][1] * g + m[2][2] * b);
  const l_ = cbrtQ44toQ16(l), m_ = cbrtQ44toQ16(mm), s_ = cbrtQ44toQ16(s);
  return [
    p[0][0] * l_ + p[0][1] * m_ + p[0][2] * s_,
    p[1][0] * l_ + p[1][1] * m_ + p[1][2] * s_,
    p[2][0] * l_ + p[2][1] * m_ + p[2][2] * s_,
  ];
}

// sRGB bytes -> OKLab in Q36.
export function oklabQ36FromSrgb8(r8, g8, b8) {
  return oklabQ36FromLinearQ24(LIN_Q24[r8], LIN_Q24[g8], LIN_Q24[b8]);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

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
  const lut = LIN_Q24;
  for (let r = 0; r < 256; r++) for (let g = 0; g < 256; g++) for (let b = 0; b < 256; b++) {
    const [L, A, B] = oklabQ36FromLinearQ24(lut[r], lut[g], lut[b]);
    const o = ((r << 16) | (g << 8) | b) * 4;
    out[o] = binQ36(L, "L", 6); out[o + 1] = binQ36(A, "a", 6); out[o + 2] = binQ36(B, "b", 6); out[o + 3] = binQ36(L, "L", 8);
  }
  return out;
}
