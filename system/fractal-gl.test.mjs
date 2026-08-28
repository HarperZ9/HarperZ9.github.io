// fractal-gl.test.mjs — pure-ish unit tests for the GPU 2D fractal module.
// The actual GPU render needs a WebGL context (browser-only), so this file only exercises the parts
// that run without one: the capability probe degrades safely in node, the iteration ceiling is sane,
// and renderFractalGL fails CLEANLY (throws) when no GL context is obtainable — which is exactly the
// signal the Studio uses to fall back to the CPU renderFractal. Run: node --test system/fractal-gl.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderFractalGL, isFractalGLAvailable, _MAX_ITERS, _buildFragment,
  splitDouble, fractalPrecisionMode,
} from "./fractal-gl.js";

test("isFractalGLAvailable() is false in a no-DOM (node) environment, never throws", () => {
  assert.equal(typeof isFractalGLAvailable, "function");
  assert.equal(isFractalGLAvailable(), false);   // no document/WebGL in node
});

test("the GLSL escape-loop ceiling covers the deepest CPU preset (>= 2000)", () => {
  assert.ok(_MAX_ITERS >= 2000, "MAX_ITERS must be >= the deepest preset's maxIter");
});

test("renderFractalGL throws a clear Error when the canvas yields no WebGL context", () => {
  // A stub canvas whose getContext returns null (mirrors a WebGL-less browser): the Studio catches
  // this and falls back to the CPU path. The error message must mention WebGL so it's debuggable.
  const stub = { width: 64, height: 64, getContext: () => null };
  assert.throws(() => renderFractalGL(stub, { type: "mandelbrot" }), /WebGL/);
});

// ── Deep-zoom precision ───────────────────────────────────────────────────────────────────────
// The float32 wall: near |c| ~ 0.744 the smallest representable step is 2^-24 ~ 6e-8, so a view
// 6.25e-6 wide across 1600px (3.9e-9 per pixel) cannot address its own pixels. These tests lock the
// arithmetic that decides when to switch and the split that feeds the shader.

test("splitDouble reconstructs a double to far better than float32 alone", () => {
  const v = -0.744539761;                      // the Seahorse Deep centre
  const [hi, lo] = splitDouble(v);
  assert.equal(hi, Math.fround(v), "hi limb is the nearest float32");
  // float32 alone loses ~1e-8 here; hi+lo must land inside the df64 bound of |v| * 2^-48.
  const singleErr = Math.abs(hi - v), pairErr = Math.abs((hi + lo) - v);
  assert.ok(singleErr > 1e-10, "float32 alone really does lose this value");
  assert.ok(pairErr <= Math.abs(v) * 4e-15, `hi + lo within the df64 bound (got ${pairErr})`);
  assert.ok(pairErr * 1e5 < singleErr, "the pair is orders of magnitude closer than the single");
});

test("splitDouble is exact for values float32 already represents", () => {
  for (const v of [0, 0.5, -2, 0.15625]) {
    const [hi, lo] = splitDouble(v);
    assert.equal(hi, v);
    assert.equal(lo, 0);
  }
});

test("precision mode follows the pixel step, not the preset name", () => {
  // Full Overview: 3.5 wide over 1600px is 2.2e-3 per pixel — float32 has room to spare.
  assert.equal(fractalPrecisionMode(-0.75, 0, 3.5, 1600), "single");
  // Seahorse Deep: 6.25e-6 over 1600px is 3.9e-9 per pixel, below the 6e-8 float32 step.
  assert.equal(fractalPrecisionMode(-0.744539761, 0.121724001, 6.25e-6, 1600), "double");
  // Past df64's own ~2^-48 resolution nothing further is being resolved, and callers must say so.
  assert.equal(fractalPrecisionMode(-0.744539761, 0.121724001, 1e-17, 1600), "exhausted");
});

test("df64's range is not declared spent while the probe still resolves it", () => {
  // Hardware measurement (RTX 4090, ANGLE/D3D11): a 1e-12-wide view centred at -0.744539761 still
  // separates all 512 columns of a 512px frame, and only collapses (52/512) at 1e-13. Reporting
  // "exhausted" over a frame that is still resolving would be a false claim, so the boundary must
  // sit below what the hardware demonstrably delivers.
  // 1e-12 is deliberately not asserted: the probe puts the true coordinate wall at ~1.9e-15 per
  // pixel and that view sits 1% above it, inside measurement noise. The classifier calls it
  // exhausted there, which is the right side to err on — the ESCAPE LOOP drives z up to order 1
  // regardless of how small c is, so the image degrades a little before the coordinates do.
  const cx = -0.744539761, cy = 0.121724001;
  assert.equal(fractalPrecisionMode(cx, cy, 1e-11, 512), "double");
  assert.equal(fractalPrecisionMode(cx, cy, 1e-13, 512), "exhausted");
});

test("a wider backing store pushes the float32 wall closer, and the mode tracks it", () => {
  // Same view, more pixels across it → smaller step per pixel → float32 gives out sooner.
  const view = [-0.7436438870371587, 0.1318259042053119, 3e-4];
  assert.equal(fractalPrecisionMode(...view, 256), "single");
  assert.equal(fractalPrecisionMode(...view, 3200), "double");
});

test("precision mode never reports single for a degenerate view", () => {
  assert.equal(fractalPrecisionMode(0, 0, 0, 1600), "exhausted");
  assert.equal(fractalPrecisionMode(0, 0, NaN, 1600), "exhausted");
});

test("the double program carries df64 coordinates and the single program does not", () => {
  const single = _buildFragment("mandelbrot", "single");
  const dbl = _buildFragment("mandelbrot", "double");
  // Single keeps the original float32 centre uniform and has no emulated arithmetic at all.
  assert.match(single, /uniform vec2\s+u_center;/);
  assert.ok(!single.includes("dsMul"), "single-precision program must stay a plain float32 loop");
  // Double replaces the centre with hi/lo limbs and runs every coordinate through the df64 ops.
  assert.match(dbl, /uniform vec2\s+u_centerX;/);
  assert.match(dbl, /uniform vec2\s+u_centerY;/);
  assert.ok(!/uniform vec2\s+u_center;/.test(dbl), "double program must not read the float32 centre");
  for (const op of ["dsAdd", "dsMul"]) assert.ok(dbl.includes(op), `double program uses ${op}`);
});

test("both precisions share one image recipe, per fractal type", () => {
  for (const type of ["mandelbrot", "julia", "burningship"]) {
    const single = _buildFragment(type, "single");
    const dbl = _buildFragment(type, "double");
    for (const src of [single, dbl]) {
      assert.ok(src.includes("BAILOUT2  = 65536.0"), `${type}: same bailout`);
      assert.ok(src.includes("mu / 8.0"), `${type}: same palette cycle density`);
      assert.ok(src.includes("exp(-trap * 4.0) * 0.30"), `${type}: same orbit-trap glow`);
      assert.ok(src.includes("return vec3(0.0)"), `${type}: interior stays black`);
    }
    // Burning Ship folds |z| in both variants; the df64 fold negates both limbs.
    if (type === "burningship") {
      assert.ok(single.includes("z = abs(z)"), "single burning ship folds |z|");
      assert.ok(dbl.includes("dsAbs(zx)"), "double burning ship folds |z| in df64");
    }
  }
});

test("every foldable compensation step goes through the optimizer barrier", () => {
  // Measured failure, not a hypothetical: ANGLE/D3D11 folds `t1 = a + b; e = t1 - a` back to
  // `e = b`, which silently compiles df64 down to the float32 program it replaces. Each identity
  // below only survives because one occurrence is routed through dsBar(), a multiply by a uniform
  // 1.0 that the compiler cannot see through. Lose a barrier and the deep zoom quietly regresses.
  const dbl = _buildFragment("mandelbrot", "double");
  assert.ok(dbl.includes("uniform float u_one"), "the barrier uniform is declared");
  assert.ok(dbl.includes("float dsBar(float x) { return x * u_one; }"), "the barrier is a x*1.0");
  // two-sum: the error term and the low limb.
  assert.ok(dbl.includes("float e  = dsBar(t1) - a.x;"), "two-sum error term is barriered");
  assert.ok(dbl.includes("return vec2(hi, t2 - (dsBar(hi) - t1));"), "two-sum low limb is barriered");
  // Dekker split: the step that would otherwise collapse straight back to the input.
  assert.ok(dbl.includes("cona - (dsBar(cona) - a.x)"), "split for a is barriered");
  assert.ok(dbl.includes("conb - (dsBar(conb) - b.x)"), "split for b is barriered");
  assert.ok(dbl.includes("DS_SPLIT = 8193.0"), "split constant is 2^13 + 1");
  // A bare, unbarriered occurrence of the foldable pattern is the regression to catch.
  assert.ok(!dbl.includes("(cona - a.x)"), "no unbarriered split survives");
  assert.ok(!/float e\s+= t1 - /.test(dbl), "no unbarriered two-sum survives");
});
