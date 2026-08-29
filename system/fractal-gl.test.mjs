// fractal-gl.test.mjs — pure-ish unit tests for the GPU 2D fractal module.
// The actual GPU render needs a WebGL context (browser-only), so this file only exercises the parts
// that run without one: the capability probe degrades safely in node, the iteration ceiling is sane,
// and renderFractalGL fails CLEANLY (throws) when no GL context is obtainable — which is exactly the
// signal the Studio uses to fall back to the CPU renderFractal. Run: node --test system/fractal-gl.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderFractalGL, isFractalGLAvailable, _MAX_ITERS } from "./fractal-gl.js";

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
