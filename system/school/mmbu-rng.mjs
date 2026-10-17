// numpy's default random generator, ported so the browser draws the same numbers as the MMBU scorers:
// SeedSequence (numpy/random/bit_generator.pyx), PCG64 (XSL-RR 128/64, numpy/random/src/pcg64) and
// Generator.integers(0, n) for n under 2^32 (Lemire's bounded method on 32-bit draws, as numpy's
// random_bounded_uint64_fill does). Checked against numpy in mmbu-rng.test.mjs. 128-bit arithmetic
// runs on eight 16-bit limbs so every partial product is exact in a double.

const M32 = 0x100000000;
const mul32 = (a, b) => Math.imul(a, b) >>> 0;

// SeedSequence.generate_state(nWords, uint32) for an integer entropy and no spawn key.
export function seedSequence(entropy, nWords) {
  const INIT_A = 0x43b0d7e5, MULT_A = 0x931e8875, INIT_B = 0x8b51f9dd, MULT_B = 0x58f38ded, MIX_L = 0xca01f9dd, MIX_R = 0x4973f715;
  const words = [];
  let e = BigInt(entropy);
  do { words.push(Number(e & 0xffffffffn)); e >>= 32n; } while (e > 0n);
  let hashA = INIT_A;
  const hashmix = (v) => { v = (v ^ hashA) >>> 0; hashA = mul32(hashA, MULT_A); v = mul32(v, hashA); return (v ^ (v >>> 16)) >>> 0; };
  const mix = (x, y) => { let r = (mul32(MIX_L, x) - mul32(MIX_R, y)) >>> 0; return (r ^ (r >>> 16)) >>> 0; };
  const pool = [0, 0, 0, 0].map((_, i) => hashmix(i < words.length ? words[i] : 0));
  for (let s = 0; s < 4; s++) for (let d = 0; d < 4; d++) if (s !== d) pool[d] = mix(pool[d], hashmix(pool[s]));
  for (let s = 4; s < words.length; s++) for (let d = 0; d < 4; d++) pool[d] = mix(pool[d], hashmix(words[s]));
  let hashB = INIT_B;
  const out = new Uint32Array(nWords);
  for (let i = 0; i < nWords; i++) {
    let v = (pool[i % 4] ^ hashB) >>> 0; hashB = mul32(hashB, MULT_B); v = mul32(v, hashB); out[i] = (v ^ (v >>> 16)) >>> 0;
  }
  return out;
}

// 128-bit values as eight 16-bit limbs, least significant first.
const fromWords = (hi64hi, hi64lo, lo64hi, lo64lo) => [lo64lo & 0xffff, lo64lo >>> 16, lo64hi & 0xffff, lo64hi >>> 16, hi64lo & 0xffff, hi64lo >>> 16, hi64hi & 0xffff, hi64hi >>> 16];
const MULT = fromWords(0x2360ed05, 0x1fc65da4, 0x4385df64, 0x9fccf645);

function mulAdd(a, m, c, r = new Array(8)) {   // (a * m + c) mod 2^128, all limb arrays; r may be a scratch array
  const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7];
  const p = [
    a0 * m[0],
    a0 * m[1] + a1 * m[0],
    a0 * m[2] + a1 * m[1] + a2 * m[0],
    a0 * m[3] + a1 * m[2] + a2 * m[1] + a3 * m[0],
    a0 * m[4] + a1 * m[3] + a2 * m[2] + a3 * m[1] + a4 * m[0],
    a0 * m[5] + a1 * m[4] + a2 * m[3] + a3 * m[2] + a4 * m[1] + a5 * m[0],
    a0 * m[6] + a1 * m[5] + a2 * m[4] + a3 * m[3] + a4 * m[2] + a5 * m[1] + a6 * m[0],
    a0 * m[7] + a1 * m[6] + a2 * m[5] + a3 * m[4] + a4 * m[3] + a5 * m[2] + a6 * m[1] + a7 * m[0],
  ];
  let carry = 0;
  for (let k = 0; k < 8; k++) { const v = p[k] + c[k] + carry; r[k] = v % 65536; carry = Math.floor(v / 65536); }
  return r;
}

export class PCG64 {
  constructor(seed) {
    const w = seedSequence(seed, 8);          // four uint64 words, each little-endian (low 32 bits first)
    const u64 = (k) => [w[2 * k + 1], w[2 * k]];   // [hi32, lo32]
    const [s0h, s0l] = u64(0), [s1h, s1l] = u64(1), [i0h, i0l] = u64(2), [i1h, i1l] = u64(3);
    const init = fromWords(s0h, s0l, s1h, s1l), seq = fromWords(i0h, i0l, i1h, i1l);
    // inc = (seq << 1) | 1
    const inc = new Array(8); let carry = 0;
    for (let k = 0; k < 8; k++) { const v = seq[k] * 2 + carry; inc[k] = v % 65536; carry = Math.floor(v / 65536); }
    inc[0] |= 1;
    this.inc = inc;
    this.s = mulAdd(new Array(8).fill(0), MULT, inc);   // state = 0; step
    let c = 0;                                           // state += initstate
    for (let k = 0; k < 8; k++) { const v = this.s[k] + init[k] + c; this.s[k] = v % 65536; c = Math.floor(v / 65536); }
    this.s = mulAdd(this.s, MULT, inc);                  // step
    this.half = -1;
  }
  // One 64-bit output as [hi32, lo32]: step, then XSL-RR.
  next64() {
    const s = mulAdd(this.s, MULT, this.inc, this.s);
    const hiH = (s[7] * 65536 + s[6]) >>> 0, hiL = (s[5] * 65536 + s[4]) >>> 0, loH = (s[3] * 65536 + s[2]) >>> 0, loL = (s[1] * 65536 + s[0]) >>> 0;
    let xh = (hiH ^ loH) >>> 0, xl = (hiL ^ loL) >>> 0;
    const rot = hiH >>> 26;
    if (rot >= 32) { const t = xh; xh = xl; xl = t; }
    const r = rot & 31;
    if (r) { const nh = ((xh >>> r) | (xl << (32 - r))) >>> 0, nl = ((xl >>> r) | (xh << (32 - r))) >>> 0; xh = nh; xl = nl; }
    return [xh, xl];
  }
  // numpy's next_uint32 for PCG64: the low half of a 64-bit output, then its high half.
  next32() {
    if (this.half >= 0) { const v = this.half; this.half = -1; return v; }
    const [h, l] = this.next64();
    this.half = h;
    return l;
  }
  // Generator.integers(0, n) for 1 < n < 2^32, one value.
  bounded(n) {
    const rng = n - 1, threshold = (M32 - 1 - rng) % n;
    let m = this.next32() * n, left = m % M32;
    if (left < n) while (left < threshold) { m = this.next32() * n; left = m % M32; }
    return Math.floor(m / M32);
  }
}
