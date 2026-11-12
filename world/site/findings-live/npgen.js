// npgen.js: numpy's default generator, ported routine for routine. SeedSequence, PCG64 (128-bit state, XSL-RR
// output), the buffered 32-bit draws, bounded integers the way numpy draws them, the ziggurat normal with numpy's
// tables, permutation and choice. It mirrors src/npgen.bld function for function. tests/findings-live.test.mjs
// checks every routine here against values recorded from numpy, as 64-bit patterns.
import { KI_HEX, WI_HEX, FI_HEX } from "./npgen-tables.js";

const M32 = 0xffffffffn, M64 = 0xffffffffffffffffn, M128 = (1n << 128n) - 1n;
const PCG_MULT = 0x2360ed051fc65da44385df649fccf645n;
const buf = new DataView(new ArrayBuffer(8));
export function bitsToF64(u) { buf.setBigUint64(0, u); return buf.getFloat64(0); }
export function f64ToBits(x) { buf.setFloat64(0, x); return buf.getBigUint64(0); }
const KI = KI_HEX.map((h) => Number(BigInt("0x" + h)));
const WI = WI_HEX.map((h) => bitsToF64(BigInt("0x" + h)));
const FI = FI_HEX.map((h) => bitsToF64(BigInt("0x" + h)));
const ZIG_R = 3.6541528853610087963519472518, ZIG_INV_R = 0.27366123732975827203338247596;

const mul32 = (a, b) => (a * b) & M32;

// SeedSequence: the four-word entropy pool numpy builds from an integer seed.
export function seedPool(seed) {
  let s = BigInt(seed);
  const entropy = [];
  do { entropy.push(s & M32); s >>= 32n; } while (s > 0n);
  let hc = 0x43b0d7e5n;
  const hashmix = (v) => {
    v ^= hc; hc = mul32(hc, 0x931e8875n); v = mul32(v, hc);
    return v ^ (v >> 16n);
  };
  const mix = (x, y) => {
    const r = (mul32(0xca01f9ddn, x) - mul32(0x4973f715n, y)) & M32;
    return r ^ (r >> 16n);
  };
  const pool = [0n, 0n, 0n, 0n];
  for (let i = 0; i < 4; i++) pool[i] = hashmix(i < entropy.length ? entropy[i] : 0n);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) pool[b] = mix(pool[b], hashmix(pool[a]));
  for (let a = 4; a < entropy.length; a++) for (let b = 0; b < 4; b++) pool[b] = mix(pool[b], hashmix(entropy[a]));
  return pool;
}

// SeedSequence.generate_state(4, uint64): eight 32-bit words, paired low word first.
export function seedState(pool) {
  let hc = 0x8b51f9ddn;
  const w = [];
  for (let i = 0; i < 8; i++) {
    let d = pool[i % 4] ^ hc;
    hc = mul32(hc, 0x58f38dedn); d = mul32(d, hc);
    w.push(d ^ (d >> 16n));
  }
  return [0, 1, 2, 3].map((i) => w[2 * i] | (w[2 * i + 1] << 32n));
}

// default_rng(seed): PCG64 seeded from the SeedSequence state.
export function genNew(seed) {
  const v = seedState(seedPool(seed));
  const g = { state: 0n, inc: ((((v[2] << 64n) | v[3]) << 1n) | 1n) & M128, has32: false, u32: 0 };
  g.state = (g.state * PCG_MULT + g.inc) & M128;
  g.state = (g.state + ((v[0] << 64n) | v[1])) & M128;
  g.state = (g.state * PCG_MULT + g.inc) & M128;
  return g;
}

export function nextU64(g) {
  g.state = (g.state * PCG_MULT + g.inc) & M128;
  const x = ((g.state >> 64n) ^ g.state) & M64, rot = g.state >> 122n;
  return ((x >> rot) | (x << ((64n - rot) & 63n))) & M64;
}

// numpy keeps the high half of a 64-bit draw for the next 32-bit request.
export function nextU32(g) {
  if (g.has32) { g.has32 = false; return g.u32; }
  const n = nextU64(g);
  g.has32 = true; g.u32 = Number(n >> 32n);
  return Number(n & M32);
}

export function nextDouble(g) { return Number(nextU64(g) >> 11n) * (1.0 / 9007199254740992.0); }

export function standardNormal(g) {
  for (;;) {
    const r = nextU64(g);
    const idx = Number(r & 0xffn), sign = Number((r >> 8n) & 1n), rabs = Number((r >> 9n) & 0xfffffffffffffn);
    let x = rabs * WI[idx];
    if (sign) x = -x;
    if (rabs < KI[idx]) return x;
    if (idx === 0) {
      for (;;) {
        const xx = -ZIG_INV_R * Math.log1p(-nextDouble(g)), yy = -Math.log1p(-nextDouble(g));
        if (yy + yy > xx * xx) return (Math.floor(rabs / 256) & 1) ? -(ZIG_R + xx) : ZIG_R + xx;
      }
    } else if ((FI[idx - 1] - FI[idx]) * nextDouble(g) + FI[idx] < Math.exp(-0.5 * x * x)) return x;
  }
}

export function normal(g, loc, scale) { return loc + scale * standardNormal(g); }

// random_interval(max): masked rejection on 32-bit draws (max below 2^32).
export function interval(g, max) {
  if (max === 0) return 0;
  let mask = max;
  mask |= mask >>> 1; mask |= mask >>> 2; mask |= mask >>> 4; mask |= mask >>> 8; mask |= mask >>> 16;
  mask >>>= 0;
  for (;;) {
    const v = (nextU32(g) & mask) >>> 0;
    if (v <= max) return v;
  }
}

// Lemire's bounded draw on 32-bit words, as Generator.integers uses for a range below 2^32. rng is inclusive.
export function lemire32(g, rng) {
  const excl = BigInt(rng) + 1n;
  let m = BigInt(nextU32(g)) * excl, left = m & M32;
  if (left < excl) {
    const threshold = (M32 - BigInt(rng)) % excl;
    while (left < threshold) { m = BigInt(nextU32(g)) * excl; left = m & M32; }
  }
  return Number(m >> 32n);
}

// Generator.permutation of a 1-D array: copy, then the Fisher-Yates walk from the top index down.
export function permutation(g, a) {
  const out = a.slice();
  for (let i = out.length - 1; i >= 1; i--) {
    const j = interval(g, i), t = out[i];
    out[i] = out[j]; out[j] = t;
  }
  return out;
}

// Generator.choice(pool, k) with replacement: k bounded index draws.
export function choice(g, pool, k) {
  const out = new Array(k);
  for (let i = 0; i < k; i++) out[i] = pool[lemire32(g, pool.length - 1)];
  return out;
}

export function stateHex(g) {
  return { state: g.state.toString(16).padStart(32, "0"), inc: g.inc.toString(16).padStart(32, "0") };
}
