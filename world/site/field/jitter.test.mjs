// node --test world/site/field/jitter.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ign, jit, IGN, GOLDEN, PLASTIC } from "./jitter.mjs";
import { SCENE_FRAG, POST_FRAG } from "./scene.glsl.js";
// computed once with this file's float32 path; a change to the constants or the operation order must change these
const GOLDEN_VECTORS = [0.9324913024902344, 0.4882040023803711, 0.2417604923248291, 0.35445737838745117, 0.3146171569824219, 0.5486292839050293];

test("values stay in [0, 1)", () => {
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) for (const s of [0, 1, 17, 63]) {
    const v = jit(x, y, s, 3.5); assert.ok(v >= 0 && v < 1, `jit(${x},${y},${s}) = ${v}`);
  }
});

test("fixed vectors (float32, shader operation order)", () => {
  const got = [ign(0, 0), ign(1, 0), ign(0, 1), ign(1919, 1079), jit(7, 11, 5, 0), jit(7, 11, 5, 0.31)];
  const want = GOLDEN_VECTORS;
  got.forEach((v, i) => assert.equal(v, want[i], `vector ${i}`));
});

test("one pixel over 16 and 64 samples covers [0, 1) evenly", () => {
  for (const n of [16, 64]) for (const [x, y] of [[0, 0], [311, 97], [1919, 1079]]) {
    const v = Array.from({ length: n }, (_, s) => jit(x, y, s, 0)).sort((a, b) => a - b);
    let gap = v[0] + 1 - v[n - 1]; for (let i = 1; i < n; i++) gap = Math.max(gap, v[i] - v[i - 1]);
    assert.ok(gap < 3 / n, `largest gap ${gap} at n=${n}`);
    const mean = v.reduce((a, b) => a + b, 0) / n; assert.ok(Math.abs(mean - 0.5) < 1.5 / n, `mean ${mean} at n=${n}`);
  }
});

test("one frame over a 64 by 64 tile is uniform and neighbours differ", () => {
  let sum = 0, same = 0; const bins = new Array(8).fill(0);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = ign(x, y); sum += v; bins[Math.floor(v * 8)]++;
    if (Math.abs(v - ign(x + 1, y)) < 0.02) same++;
  }
  assert.ok(Math.abs(sum / 4096 - 0.5) < 0.02, `mean ${sum / 4096}`);
  for (const b of bins) assert.ok(b > 512 * 0.8 && b < 512 * 1.2, `bin ${b}`);
  assert.ok(same < 4096 * 0.08, `${same} near-equal neighbours`);
});

test("the shader carries the same kernel text and constants", () => {
  const body = `float ign(vec2 p) { return fract(${IGN.scale} * fract(dot(p, vec2(${IGN.kx}, ${IGN.ky})))); }`;
  const walk = `float jit(float dim) { return fract(ign(gl_FragCoord.xy) + ${GOLDEN} * uSeq + ${PLASTIC} * dim); }`;
  for (const [name, src] of [["scene", SCENE_FRAG], ["post", POST_FRAG]]) {
    assert.ok(src.includes(body), `${name}: ign differs from the reference`);
    assert.ok(src.includes(walk), `${name}: jit differs from the reference`);
    assert.ok(src.includes("uniform float uSeq"), `${name}: uSeq missing`);
  }
});
