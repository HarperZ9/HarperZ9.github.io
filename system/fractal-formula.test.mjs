// fractal-formula.test.mjs: the formula language, its derivatives, the catalogue and Lyapunov.
// Run: node --test system/fractal-formula.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFormula, compileJS, compileGLSL, derivative, FormulaError } from "./fractal-formula.js";
import { formulaSpec, iterateSpec, cpuFunction, degreeOf, FORMULA_TYPES } from "./fractal-formulas.js";
import { buildFormulaFragment, rootColour } from "./fractal-glsl-formula.js";
import { lyapunovExponent, lyapunovSequence } from "./fractal-glsl-lyapunov.js";

const at = (z, c = [0, 0], extra = {}) => ({ z: [z[0], z[1], 1, 0, 0, 1], c: [c[0], c[1], 0, 0, 0, 0], zp: [0, 0, 0, 0, 0, 0], p: [0, 0, 0, 0, 0, 0], q: [0, 0, 0, 0, 0, 0], ...extra });

test("parses and evaluates complex arithmetic", () => {
  const f = compileJS(parseFormula("z^2 + c"));
  const r = f(at([1, 2], [0.5, -1]));
  assert.deepEqual([r[0], r[1]], [1 - 4 + 0.5, 4 - 1]);
  const g = compileJS(parseFormula("conj(z)*2i - 3"));
  const s = g(at([1, 2]));
  assert.deepEqual([s[0], s[1]], [4 - 3, 2]);
});

test("rejects anything outside the language, with a position", () => {
  for (const [src, re] of [["alert(1)", /unknown function/], ["z.constructor", /unexpected character/], ["window", /unknown name/],
    ["z^2 +", /ends too soon/], ["sin(z, c)", /takes 1 argument/], ["z $ c", /unexpected character/], ["(z", /expected "\)"/]]) {
    assert.throws(() => parseFormula(src), (e) => e instanceof FormulaError && re.test(e.message) && Number.isInteger(e.pos), src);
  }
  assert.throws(() => parseFormula("z+".repeat(200) + "z"), /more than/);
});

test("forward derivatives match finite differences, folds and conjugates included", () => {
  for (const src of ["z^3 + c", "sin(z)*c + z", "conj(z)^2 + c", "abs(z)^2 + c", "absre(sqr(z)) + c", "exp(z)/(z + 2)", "z^2.5 + c", "mod(z)*z + arg(z)"]) {
    const f = compileJS(parseFormula(src));
    const z = [0.37, -0.81], c = [0.2, 0.1], h = 1e-6;
    const r = f(at(z, c));
    const fx = f(at([z[0] + h, z[1]], c)), fy = f(at([z[0], z[1] + h], c));
    // Column a is d/dzx, column b is d/dzy.
    const ax = (fx[0] - r[0]) / h, ay = (fx[1] - r[1]) / h, bx = (fy[0] - r[0]) / h, by = (fy[1] - r[1]) / h;
    for (const [got, want, k] of [[r[2], ax, "a.x"], [r[3], ay, "a.y"], [r[4], bx, "b.x"], [r[5], by, "b.y"]]) {
      assert.ok(Math.abs(got - want) < 1e-4 * Math.max(1, Math.abs(want)), `${src}: ${k} ${got} vs ${want}`);
    }
  }
});

test("Newton's derivative is symbolic and exact", () => {
  const d = compileJS(derivative(parseFormula("z^3 - 1")));
  const r = d(at([0.5, 0.25]));
  // 3 z^2 at 0.5 + 0.25i = 3 (0.1875 + 0.25i)
  assert.ok(Math.abs(r[0] - 0.5625) < 1e-12 && Math.abs(r[1] - 0.75) < 1e-12);
  assert.throws(() => derivative(parseFormula("conj(z)^3 - 1")), /complex derivative/);
});

test("Newton on z^3 - 1 converges to the cube roots of unity", () => {
  const spec = formulaSpec({ type: "newton", f: "z^3 - 1" });
  const fn = cpuFunction(spec);
  const roots = new Set();
  for (const [x, y] of [[1.2, 0.1], [-0.6, 0.9], [-0.6, -0.9]]) {
    const r = iterateSpec(spec, fn, x, y, 60);
    assert.ok(r.done, "converged");
    assert.ok(Math.abs(Math.hypot(r.zx, r.zy) - 1) < 1e-6, "on the unit circle");
    roots.add(Math.round(Math.atan2(r.zy, r.zx) / (2 * Math.PI / 3)));
  }
  assert.equal(roots.size, 3, "three different roots");
  assert.ok(rootColour(spec), "Newton is coloured by root");
  assert.ok(!rootColour(formulaSpec({ type: "nova" })), "Nova, with c in it, is coloured by speed");
});

test("every catalogue type compiles to GLSL that uses only its own names", () => {
  for (const type of FORMULA_TYPES) {
    const spec = formulaSpec({ type, power: 4, formula: "c*sin(z) + p*zp", formulaMode: "escape" });
    const src = buildFormulaFragment(spec);
    assert.match(src, /void main\(\)/);
    // Comments may say NaN; code may not hold undefined, NaN or Infinity.
    const code = src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    assert.doesNotMatch(code, /undefined|NaN|Infinity/, `${type} source is clean`);
  }
  const g = compileGLSL(parseFormula("z^2 + c"), { z: ["z", "za", "zb"], c: ["c", "ca", "cb"] });
  assert.equal(g.out.length, 3);
});

test("degree drives smooth colouring", () => {
  assert.equal(degreeOf(parseFormula("z^5 + c")), 5);
  assert.equal(degreeOf(parseFormula("conj(z)^2 + c")), 2);
  assert.equal(degreeOf(parseFormula("sqr(z)*z + c")), 3);
});

test("the Multibrot escapes where it should", () => {
  const spec = formulaSpec({ type: "multibrot", power: 3 });
  const fn = cpuFunction(spec);
  assert.ok(!iterateSpec(spec, fn, 0, 0, 200).done, "0 is in the cubic Multibrot set");
  assert.ok(iterateSpec(spec, fn, 1.5, 0, 200).done, "1.5 escapes");
});

test("Lyapunov exponent: the logistic map at r = 4 has exponent ln 2", () => {
  const l = lyapunovExponent(4, 4, "AB", 20000, 100, 0.3);
  assert.ok(Math.abs(l - Math.LN2) < 0.02, `got ${l}`);
  assert.ok(lyapunovExponent(2.5, 2.5, "AB") < 0, "r = 2.5 settles");
  assert.deepEqual(lyapunovSequence("aab-ab"), { text: "AABAB", mask: 4 + 16, length: 5 });
});

test("Buddhabrot accumulation: symmetric, lit inside the figure, dark far outside", async () => {
  const { accumulateCPU, exposureOf, buddhaLimits } = await import("./fractal-buddhabrot.js");
  const W = 64, H = 64;
  const view = { type: "buddhabrot", cx: -0.45, cy: 0, scale: 2.8, maxIter: 300, minIter: 10 };
  const acc = accumulateCPU(view, W, H, 60000, 3);
  let total = 0, asym = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = acc[(y * W + x) * 3], b = acc[((H - 1 - y) * W + x) * 3];
    total += a; asym += Math.abs(a - b);
  }
  assert.ok(total > 1000, "orbits landed in the view");
  assert.ok(asym / total < 1e-9, "the mirror image makes it exactly symmetric");
  const at = (x, y) => acc[(y * W + x) * 3];
  assert.ok(at(40, 32) > 10 * Math.max(1, at(0, 0)), "the figure is far denser than the corner");
  assert.ok(exposureOf(acc)[0] >= 1);
  assert.deepEqual(buddhaLimits({ type: "nebulabrot", maxIter: 5000, limits: [5000, 1000, 200] }).channel, [5000, 1000, 200]);
});
