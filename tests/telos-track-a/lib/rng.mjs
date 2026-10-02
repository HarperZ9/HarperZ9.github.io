// rng.mjs: xorshift32, the seeded generator every Track A fixture uses. Integer-exact, so the Python
// twin (py/rng.py) produces the same stream bit for bit.
export function xorshift32(seed) {
  let x = seed >>> 0;
  if (x === 0) throw new Error("xorshift32 seed must be non-zero");
  return function next() {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x;
  };
}

// Integer in [lo, hi] inclusive from one draw (modulo bias is irrelevant for fixtures and matches the
// Python twin exactly).
export function randInt(next, lo, hi) {
  return lo + (next() % (hi - lo + 1));
}
