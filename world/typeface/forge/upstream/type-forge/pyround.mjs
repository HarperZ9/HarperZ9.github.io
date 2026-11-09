// system/type-forge/pyround.mjs
// Python's round(x, nd) in JavaScript, exactly. The forge was written in Python, and its outlines are
// rounded to 2 decimals and then to whole font units; Python rounds the exact binary value half to
// even, and Math.round rounds half up. On a font that difference moves points, so the port does the
// rounding with exact rational arithmetic on the double's bits.

const buf = new DataView(new ArrayBuffer(8));

// The double as an exact fraction num / 2^shift (num a BigInt, shift >= 0).
function exact(x) {
  buf.setFloat64(0, x);
  const hi = buf.getUint32(0), lo = buf.getUint32(4);
  const sign = hi >>> 31 ? -1n : 1n;
  const expBits = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e;
  if (expBits === 0) e = -1074; else { mant |= 1n << 52n; e = expBits - 1075; }
  if (e >= 0) return { num: sign * (mant << BigInt(e)), shift: 0n };
  return { num: sign * mant, shift: BigInt(-e) };
}

export function pyRound(x, nd = 0) {
  if (!Number.isFinite(x) || x === 0) return x;
  const { num, shift } = exact(x);
  const scale = 10n ** BigInt(nd);
  const scaled = num * scale;                 // x * 10^nd = scaled / 2^shift, exactly
  const den = 1n << shift;
  const neg = scaled < 0n;
  const a = neg ? -scaled : scaled;
  let q = a / den;
  const rem2 = (a % den) * 2n;
  if (rem2 > den || (rem2 === den && (q & 1n) === 1n)) q += 1n;
  const r = Number(neg ? -q : q) / Number(scale);
  return r === 0 ? (neg ? -0 : 0) + 0 : r;
}
