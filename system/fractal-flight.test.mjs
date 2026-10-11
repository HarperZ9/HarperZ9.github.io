// fractal-flight.test.mjs: flight interpolation and the WebM writer.
// Run: node --test system/fractal-flight.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { between, flightView, muxWebM } from "./fractal-flight.js";
import { decDiff } from "./fractal-hp.js";

const A = { type: "mandelbrot", re: "-0.75", im: "0", cx: -0.75, cy: 0, scale: 3.5, maxIter: 500, palette: "ocean" };
const B = { type: "mandelbrot", re: "-0.7436227627792091903930625607721105561797006142687856921130208924", im: "0.1318305311337870112915195543947448074486402760798047827036608098", cx: -0.74362276, cy: 0.13183, scale: 2e-38, maxIter: 12000, palette: "ember" };

test("the zoom is geometric and lands exactly on both keyframes", () => {
  const a = between(A, B, 0), b = between(A, B, 1), m = between(A, B, 0.5);
  assert.equal(a.scale, 3.5);
  assert.ok(Math.abs(b.scale / 2e-38 - 1) < 1e-9);
  assert.ok(Math.abs(Math.log10(m.scale) - (Math.log10(3.5) + Math.log10(2e-38)) / 2) < 1e-9, "halfway in log width");
  assert.ok(Math.abs(decDiff(b.re, B.re, 300)) < 1e-45 && Math.abs(decDiff(b.im, B.im, 300)) < 1e-45, "the last frame is the keyframe's centre");
});

test("the destination stays in frame all the way down", () => {
  for (let e = 0.05; e < 1; e += 0.05) {
    const v = between(A, B, e);
    const off = Math.hypot(decDiff(B.re, v.re, 300), decDiff(B.im, v.im, 300));
    assert.ok(off <= v.scale, `at ${e.toFixed(2)} the target is ${off / v.scale} widths from centre`);
  }
});

test("palettes blend and the budget interpolates; flightView eases between keys", () => {
  const m = between(A, B, 0.5);
  assert.ok(Array.isArray(m.gradient) && m.gradient.length === 6, "a blended gradient");
  assert.ok(m.maxIter > 500 && m.maxIter < 12000);
  assert.equal(flightView([A, B], 0, 6).scale, 3.5);
  assert.ok(Math.abs(flightView([A, B], 6, 6).scale / 2e-38 - 1) < 1e-9);
});

test("the WebM writer emits an EBML header, a webm DocType and one block per chunk", () => {
  const chunks = [0, 33, 66].map((t, i) => ({ data: new Uint8Array([1, 2, 3, i]), timestampMs: t, key: i === 0 }));
  return muxWebM({ width: 64, height: 48, codec: "V_VP9", chunks, durationMs: 100 }).arrayBuffer().then((ab) => {
    const b = new Uint8Array(ab);
    assert.deepEqual([...b.slice(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
    assert.ok(Buffer.from(b).includes(Buffer.from("webm")));
    // Walk the element tree: Segment and Cluster are masters; count SimpleBlocks (0xA3).
    const vint = (o, keep) => { let len = 1; while (!(b[o] & (0x80 >> (len - 1)))) len++; let v = keep ? b[o] : b[o] & (0xff >> len); for (let i = 1; i < len; i++) v = v * 256 + b[o + i]; return [v, len]; };
    let blocks = 0;
    const walk = (s, e) => { let o = s; while (o < e) { const [id, il] = vint(o, true), [sz, sl] = vint(o + il, false); const body = o + il + sl; if (id === 0xa3) blocks++; if (id === 0x18538067 || id === 0x1f43b675) walk(body, body + sz); o = body + sz; } };
    walk(0, b.length);
    assert.equal(blocks, 3);
  });
});
