// fractal-hp.test.mjs: the deep-zoom centre arithmetic and the location box.
// Run: node --test system/fractal-hp.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { decToFixed, fixedToDec, doubleToFixed, fixedToDouble, shiftView, zoomViewAbout, bitsForScale, decDiff, offsetDec } from "./fractal-hp.js";
import { parseLocation, formatLocation, formatDepth } from "./studio-fractal-deep.js";

test("decimal strings round-trip through fixed point", () => {
  for (const s of ["-0.7436227627792091903930625607721105561797006142687856921130208924", "0.5", "-2", "1.25e-3"]) {
    const bits = 256;
    const back = fixedToDec(decToFixed(s, bits), bits);
    assert.ok(Math.abs(parseFloat(back) - parseFloat(s)) <= Math.abs(parseFloat(s)) * 1e-15, `${s} -> ${back}`);
  }
  const long = "-0.7436227627792091903930625607721105561797006142687856921130208924";
  const err = decToFixed(fixedToDec(decToFixed(long, 256), 256), 300) - decToFixed(long, 300);
  assert.ok((err < 0n ? -err : err) < (1n << 46n), "64 digits survive at 256 bits (error below 2^-254)");
});

test("doubles convert exactly, at any exponent", () => {
  for (const x of [0.1, -1.75, 3e-200, -7.1e-290, 123.456]) {
    const bits = 1100;
    assert.equal(fixedToDouble(doubleToFixed(x, bits), bits), x);
  }
});

test("shiftView moves the centre by offsets far below a double's resolution", () => {
  const v = { cx: -0.75, cy: 0.5, scale: 1e-40 };
  for (let i = 0; i < 1000; i++) shiftView(v, 1e-42, -1e-42);
  // 1000 steps of 1e-42 is 1e-39: invisible to the doubles, exact in the strings.
  assert.equal(v.cx, -0.75, "the double centre cannot see the move");
  const bits = bitsForScale(1e-45);
  assert.ok(Math.abs(decDiff(v.re, "-0.75", bits) - 1e-39) < 1e-52, "the decimal centre moved by exactly 1e-39");
  assert.ok(Math.abs(decDiff(v.im, "0.5", bits) + 1e-39) < 1e-52);
});

test("zoomViewAbout keeps the point under the cursor fixed", () => {
  const v = { re: "-0.5", im: "0.25", cx: -0.5, cy: 0.25, scale: 1e-30 };
  const off = { re: 0.3e-30, im: -0.2e-30 };
  const P = { re: offsetDec(v.re, off.re, 1e-33), im: offsetDec(v.im, off.im, 1e-33) };
  zoomViewAbout(v, off.re, off.im, 0.5);
  // The cursor point is now half as far from the new centre, and it is the same point.
  const after = { re: offsetDec(v.re, off.re * 0.5, 1e-33), im: offsetDec(v.im, off.im * 0.5, 1e-33) };
  const bits = bitsForScale(1e-33);
  assert.ok(Math.abs(decDiff(after.re, P.re, bits)) < 1e-45 && Math.abs(decDiff(after.im, P.im, bits)) < 1e-45,
    "the point under the cursor did not move");
  assert.equal(v.scale, 5e-31);
});

test("locations parse in both forms and round-trip", () => {
  const a = parseLocation("re -0.75\nim 0.1\nwidth 3.5e-20\niterations 4000");
  assert.deepEqual([a.re, a.im, a.scale, a.maxIter], ["-0.75", "0.1", 3.5e-20, 4000]);
  const b = parseLocation("Re: -1.25\nIm: 0.0\nZoom: 4E10");
  assert.equal(b.scale, 1e-10);
  const v = { re: "-0.7436227627792091903930625607721105561797006142687856921130208924", im: "0.131830531133787011291519554394744807448640276079804782703660809", scale: 2e-38, maxIter: 12000 };
  const back = parseLocation(formatLocation(v));
  assert.ok(back.re.length >= 46, "enough digits for the width");
  assert.equal(back.maxIter, 12000);
  assert.throws(() => parseLocation("re 1"), /re and im/);
  assert.throws(() => parseLocation("re 1\nim 2"), /width/);
});

test("depth reads as a zoom factor", () => {
  assert.equal(formatDepth(3.5), "1.0x");
  assert.equal(formatDepth(3.5e-38), "1.0e38x");
});
