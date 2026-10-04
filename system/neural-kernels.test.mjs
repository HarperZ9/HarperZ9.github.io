// The worker's kernels must draw exactly what studio-neural.js draws. These checks compare the
// fast forward pass with the networks' own eval bit for bit, and the field kernel's pixels with
// renderField's fillRect calls rasterised in node. The browser check (canvas SHA-256 against
// renderNeuralFrame at 160 settings) lives with the evidence for the change.
import test from "node:test";
import assert from "node:assert/strict";
import { buildCppn, buildNeuralSdf, neuralSeed } from "./neural.js";
import { compileMlp, fastCppn, referenceCppn, fastSdf, fieldPixels, fieldGrid, solidPixels, solidSize } from "./neural-kernels.mjs";
import { renderNeuralFrame } from "./studio-neural.js";

const SEEDS = ["living", "aurora", "cinder", "nz-q7k2m1", "a", "0"];
const TINT = [[80, 196, 185], [167, 115, 255], [239, 171, 48]];

test("the fast CPPN returns the same doubles as the network's own eval", () => {
  for (const s of SEEDS) {
    const cppn = buildCppn(neuralSeed(s));
    const fast = fastCppn(cppn), ref = referenceCppn(cppn);
    const a = new Float64Array(3), b = new Float64Array(3);
    for (let i = 0; i <= 60; i += 1) {
      for (let j = 0; j <= 60; j += 1) {
        const x = (i / 60) * 2.6 - 1.3, y = (j / 60) * 2.6 - 1.3;
        fast(x, y, a); ref(x, y, b);
        for (let k = 0; k < 3; k += 1) assert.ok(Object.is(a[k], b[k]), `${s} (${x}, ${y}) channel ${k}: ${a[k]} vs ${b[k]}`);
      }
    }
  }
});

test("the fast SDF returns the same distance as the network's own dist", () => {
  for (const s of SEEDS) {
    const sdf = buildNeuralSdf(neuralSeed(s));
    const fast = fastSdf(sdf);
    for (let i = 0; i < 4000; i += 1) {
      const x = Math.sin(i * 1.7) * 2.5, y = Math.cos(i * 0.9) * 2.5, z = Math.sin(i * 0.31 + 1) * 2.5;
      assert.ok(Object.is(fast(x, y, z), sdf.dist(x, y, z)), `${s} at ${i}`);
    }
  }
});

test("compileMlp refuses an activation it does not know", () => {
  const mlp = { layers: [1, 1, 1], W: [new Float32Array(1), new Float32Array(1)], B: [new Float32Array(1), new Float32Array(1)], acts: ["relu"] };
  assert.throws(() => compileMlp(mlp), /unknown activation relu/);
});

// Rasterise renderField's calls: integer fillRects with rgb()/rgba() fill strings.
function rasterCtx(W, H) {
  const px = new Uint8ClampedArray(W * H * 4);
  let fill = [0, 0, 0, 255];
  const ctx = {
    save() {}, restore() {}, globalCompositeOperation: "source-over",
    set fillStyle(v) {
      const m = /^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/.exec(v);
      if (!m) throw new Error("unparsed fill " + v);
      fill = [+m[1], +m[2], +m[3], m[4] === undefined ? 255 : Math.round(+m[4] * 255)];
    },
    fillRect(x, y, w, h) {
      for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy += 1) {
        for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx += 1) {
          const o = (yy * W + xx) * 4;
          px[o] = fill[0]; px[o + 1] = fill[1]; px[o + 2] = fill[2]; px[o + 3] = fill[3];
        }
      }
    },
  };
  return { ctx, px };
}

test("the field kernel paints renderField's pixels", () => {
  for (const [W, H] of [[240, 160], [333, 517], [726, 568]]) {
    for (const s of ["living", "cinder"]) {
      for (const time of [0, 1.5, 31.4]) {
        const { ctx, px } = rasterCtx(W, H);
        renderNeuralFrame(ctx, W, H, { seed: s, instrument: "field", time });
        const out = new Uint8ClampedArray(W * H * 4);
        assert.equal(fieldPixels(fastCppn(buildCppn(neuralSeed(s))), W, H, time, TINT, out), true);
        assert.deepEqual(out, px, `${s} ${W}x${H} t=${time}`);
      }
    }
  }
});

test("the field kernel declines a grid too small for renderField's spacing", () => {
  assert.deepEqual(fieldGrid(3, 3), { cell: 2, cols: 2, rows: 2 });
  assert.equal(fieldPixels(() => {}, 2, 2, 0, TINT, new Uint8ClampedArray(16)), false);
});

test("the solid kernel draws the same buffer with the fast and the reference distance", () => {
  for (const s of ["living", "aurora"]) {
    const seedNum = neuralSeed(s);
    const sdf = buildNeuralSdf(seedNum);
    for (const [W, H, time] of [[726, 568, 0], [400, 400, 3.2], [333, 517, 9.75]]) {
      const { RW, RH } = solidSize(W, H);
      const a = new Uint8ClampedArray(RW * RH * 4), b = new Uint8ClampedArray(RW * RH * 4);
      solidPixels(fastSdf(sdf), W, H, time, TINT, seedNum, a);
      solidPixels((x, y, z) => sdf.dist(x, y, z), W, H, time, TINT, seedNum, b);
      assert.deepEqual(a, b, `${s} ${W}x${H} t=${time}`);
      assert.ok(a.some((v, i) => i % 4 === 3 && v === 255), "the solid hits the surface somewhere");
    }
  }
});
