// fractal-hp.js: high-precision coordinates for deep fractal zooms.
//
// A JS double carries 53 bits, so a view centre stored as one stops moving in steps finer than about
// 1e-16 of its own size. Past that depth a wheel zoom or a drag cannot address the pixel under the
// cursor. This module keeps the centre as a decimal string, does the arithmetic in BigInt fixed
// point at however many bits the depth needs, and hands back doubles only for what a double can
// hold: offsets, which are the size of the view, and approximations for display.
//
// Fixed point: a value v is the BigInt round(v * 2^bits). Every function takes the bit count, so a
// caller sizes it from the scale (bitsForScale) and nothing is lost in the round trip.

const LOG10_2 = Math.log10(2);

// Precision a view of this width needs: enough bits for one pixel of a 16384-wide frame, plus
// 64 guard bits for the reference orbit's own rounding. Never below 128.
export function bitsForScale(scale) {
  const s = Math.abs(scale) || 1;
  const need = Math.ceil(-Math.log2(s)) + 14 + 64;
  return Math.max(128, need);
}

// 2^k as a double, for |k| past the 1023 a single Math.pow can reach. Exact for any k that lands
// inside the double range, because every factor is a power of two.
function pow2(k) {
  let r = 1;
  while (k > 1000) { r *= 2 ** 1000; k -= 1000; }
  while (k < -1000) { r *= 2 ** -1000; k += 1000; }
  return r * 2 ** k;
}

const DEC_RE = /^\s*([+-])?(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?\s*$/;

/** Parse a decimal string (or a number) into fixed point at `bits`. Round half up. */
export function decToFixed(str, bits) {
  if (typeof str === "number") return doubleToFixed(str, bits);
  const m = DEC_RE.exec(String(str));
  if (!m) throw new Error("fractal-hp: not a decimal number: " + str);
  const neg = m[1] === "-";
  const ip = m[2] || "", fp = m[3] || "";
  const digits = (ip + fp).replace(/^0+(?=\d)/, "") || "0";
  const exp10 = (m[4] ? parseInt(m[4], 10) : 0) - fp.length;
  const N = BigInt(digits);
  const B = BigInt(bits);
  let v;
  if (exp10 >= 0) v = (N * 10n ** BigInt(exp10)) << B;
  else {
    const den = 10n ** BigInt(-exp10);
    v = ((N << B) + den / 2n) / den;
  }
  return neg ? -v : v;
}

/** Format fixed point as a decimal string with enough digits to round-trip at `bits`. */
export function fixedToDec(v, bits) {
  const neg = v < 0n;
  let a = neg ? -v : v;
  const B = BigInt(bits);
  const D = Math.ceil(bits * LOG10_2) + 1;
  let ip = a >> B;
  const frac = a - (ip << B);
  let fd = ((frac * 10n ** BigInt(D)) + (1n << (B - 1n))) >> B;
  if (fd >= 10n ** BigInt(D)) { fd -= 10n ** BigInt(D); ip += 1n; }
  let fs = fd.toString().padStart(D, "0").replace(/0+$/, "");
  const s = ip.toString() + (fs ? "." + fs : "");
  return (neg && s !== "0" ? "-" : "") + s;
}

/** A double into fixed point, exactly (every finite double is a dyadic rational). */
export function doubleToFixed(x, bits) {
  if (!x || !Number.isFinite(x)) return 0n;
  const neg = x < 0;
  const ax = Math.abs(x);
  let e = Math.floor(Math.log2(ax));
  // log2 can be off by one at a power-of-two boundary; settle it so ax / 2^e is in [1, 2).
  if (ax * pow2(-e) >= 2) e += 1;
  if (ax * pow2(-e) < 1) e -= 1;
  const mant = ax * pow2(52 - e);              // an integer below 2^53, exact
  let v = BigInt(mant);
  const sh = bits - 52 + e;
  v = sh >= 0 ? v << BigInt(sh) : v >> BigInt(-sh);
  return neg ? -v : v;
}

/** Fixed point to the nearest double (within one ulp). */
export function fixedToDouble(v, bits) {
  if (v === 0n) return 0;
  const neg = v < 0n;
  const a = neg ? -v : v;
  const len = a.toString(2).length;
  const sh = Math.max(0, len - 60);
  const d = Number(a >> BigInt(sh)) * pow2(sh - bits);
  return neg ? -d : d;
}

/**
 * The view's centre as two decimal strings. A view carries `re`/`im` once it has gone deep; before
 * that its doubles `cx`/`cy` are the centre, and they convert exactly.
 */
export function viewCentre(view) {
  const re = view.re != null ? String(view.re) : fixedToDec(doubleToFixed(view.cx || 0, 1100), 1100);
  const im = view.im != null ? String(view.im) : fixedToDec(doubleToFixed(view.cy || 0, 1100), 1100);
  return { re, im };
}

/**
 * Move a view's centre by (dre, dim) in plane units, in place. The offsets are doubles, which is
 * enough: they are the size of the view, so their own relative error is far below a pixel. The
 * centre gets the full precision the scale needs, and `cx`/`cy` stay as its nearest doubles so
 * every reader of the old fields still sees the right place to 16 digits.
 */
export function shiftView(view, dre, dim) {
  const bits = bitsForScale(view.scale);
  const c = viewCentre(view);
  const re = decToFixed(c.re, bits) + doubleToFixed(dre, bits);
  const im = decToFixed(c.im, bits) + doubleToFixed(dim, bits);
  view.re = fixedToDec(re, bits);
  view.im = fixedToDec(im, bits);
  view.cx = fixedToDouble(re, bits);
  view.cy = fixedToDouble(im, bits);
  return view;
}

/**
 * Zoom by `factor` about a point given as its offset from the centre in plane units (ore, oim).
 * The point stays under the cursor: the centre moves by offset * (1 - factor).
 */
export function zoomViewAbout(view, ore, oim, factor) {
  view.scale *= factor;
  return shiftView(view, ore * (1 - factor), oim * (1 - factor));
}

/** Difference a - b of two decimal strings, as a double. Exact to a double's precision. */
export function decDiff(a, b, bits) {
  return fixedToDouble(decToFixed(a, bits) - decToFixed(b, bits), bits);
}

/** A decimal string moved by a double offset, at the precision a view of `scale` needs. */
export function offsetDec(str, d, scale) {
  const bits = bitsForScale(scale);
  return fixedToDec(decToFixed(str, bits) + doubleToFixed(d, bits), bits);
}
