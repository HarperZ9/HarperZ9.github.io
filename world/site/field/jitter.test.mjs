// node --test world/site/field/jitter.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ign, jit, blueMask, MASK_N, GOLDEN, PLASTIC } from "./jitter.mjs";
import { SCENE_FRAG, POST_FRAG } from "./scene.glsl.js";
const M = blueMask();
// computed once with this file's path; a change to the mask, the constants or the operation order must change these
const GOLDEN_VECTORS = [0.270263671875, 0.688720703125, 0.024658203125, 0.94189453125, 0.33186912536621094, 0.5658812522888184, 0.052588462829589844];
const vectors = () => [M[0], M[1], M[64], M[4095], jit(M, 7, 11, 5, 0), jit(M, 7, 11, 5, 0.31), jit(M, 1919, 1079, 3, 0)];

// energy of a 64 by 64 tile at the low spatial frequencies (1 to 4 cycles per tile), mean removed
function lowEnergy(val) {
  let mean = 0; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) mean += val(x, y) / 4096;
  let e = 0;
  for (let ky = -4; ky <= 4; ky++) for (let kx = 0; kx <= 4; kx++) {
    if (kx === 0 && ky <= 0) continue;
    let re = 0, im = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const a = 2 * Math.PI * (kx * x + ky * y) / 64, v = val(x, y) - mean; re += v * Math.cos(a); im += v * Math.sin(a); }
    e += (re * re + im * im) / 4096;
  }
  return e / 40; // per frequency; white noise of the same range gives 1 / 12
}

test("the mask is a permutation of rank / 4096", () => {
  assert.equal(M.length, MASK_N * MASK_N);
  const seen = new Uint8Array(4096); for (const v of M) { const r = Math.round(v * 4096); assert.ok(r >= 0 && r < 4096 && !seen[r], `rank ${r}`); seen[r] = 1; }
});

test("values stay in [0, 1)", () => {
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) for (const s of [0, 1, 17, 63]) {
    const v = jit(M, x, y, s, 3.5); assert.ok(v >= 0 && v < 1, `jit(${x},${y},${s}) = ${v}`);
  }
});

test("fixed vectors (float32, shader operation order) and determinism", () => {
  vectors().forEach((v, i) => assert.equal(v, GOLDEN_VECTORS[i], `vector ${i}`));
  const again = blueMask(); for (let i = 0; i < 4096; i += 97) assert.equal(again[i], M[i]);
});

test("one pixel over 16 and 64 samples covers [0, 1) evenly", () => {
  for (const n of [16, 64]) for (const [x, y] of [[0, 0], [311, 97], [1919, 1079]]) {
    const v = Array.from({ length: n }, (_, s) => jit(M, x, y, s, 0)).sort((a, b) => a - b);
    let gap = v[0] + 1 - v[n - 1]; for (let i = 1; i < n; i++) gap = Math.max(gap, v[i] - v[i - 1]);
    assert.ok(gap < 3 / n, `largest gap ${gap} at n=${n}`);
    const mean = v.reduce((a, b) => a + b, 0) / n; assert.ok(Math.abs(mean - 0.5) < 1.5 / n, `mean ${mean} at n=${n}`);
  }
});

test("one frame over the tile: neighbours differ, in every direction", () => {
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let same = 0, diff = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.abs(M[y * 64 + x] - M[((y + dy + 64) & 63) * 64 + ((x + dx) & 63)]); diff += d / 4096; if (d < 0.02) same++; }
    assert.ok(same < 4096 * 0.03, `${same} near-equal neighbours along ${dx},${dy}`);
    // independent values differ by 1/3 on average; a blue mask pushes neighbours further apart
    assert.ok(diff > 0.36, `mean neighbour difference ${diff} along ${dx},${dy}`);
  }
});

test("the mask has under a tenth of white noise's energy at low frequency; the old kernel is the planted comparison", () => {
  const blue = lowEnergy((x, y) => M[y * 64 + x]), white = 1 / 12;
  assert.ok(blue < white / 10, `blue ${blue} against white ${white}`);
  // a seeded white tile must fail the same bound, or the bound proves nothing
  let h = 7; const w = Float32Array.from({ length: 4096 }, () => { h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return h / 4294967296; });
  assert.ok(lowEnergy((x, y) => w[y * 64 + x]) > white / 10, "white noise passed the blue bound");
  assert.ok(Number.isFinite(lowEnergy(ign)));
});

test("the shader carries the same kernel text and constants", () => {
  const walk = `float jit(float dim) { return fract(texelFetch(uBlue, ivec2(gl_FragCoord.xy) & ${MASK_N - 1}, 0).r + ${GOLDEN} * uSeq + ${PLASTIC} * dim); }`;
  for (const [name, src] of [["scene", SCENE_FRAG], ["post", POST_FRAG]]) {
    assert.ok(src.includes(walk), `${name}: jit differs from the reference`);
    assert.ok(src.includes("uniform float uSeq") && src.includes("uniform sampler2D uBlue"), `${name}: uSeq or uBlue missing`);
    assert.ok(!src.includes("52.9829189"), `${name}: the old hatch kernel is still in the shader`);
  }
});
