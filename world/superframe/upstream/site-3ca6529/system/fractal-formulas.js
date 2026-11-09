// fractal-formulas.js: the Studio's formula catalogue, and the CPU iteration for any formula.
//
// Each entry is a formula in the language of fractal-formula.js plus how to iterate it: escape
// (the orbit leaves a disk) or converge (Newton's method finds a root), the starting z, and the
// constants it reads. formulaSpec(view) turns a view into a compiled specification that both the
// GPU program builder (fractal-glsl-formula.js) and the CPU loop below consume, so the two paths
// iterate the same tree.
//
// The built-ins: Multibrot z^d + c and the Tricorn conj(z)^2 + c (the "Mandelbar"); Celtic, z^2 with
// its real part folded; Phoenix, z^2 + c + p z_{n-1}, in the Julia form with c = 0.5667 and
// p = -0.5 (after Shigehiro Ushiki); Magnet type I, ((z^2 + c - 1) / (2z + c - 2))^2; Newton's
// method on z^3 - 1; Nova, relaxed Newton with c added, started at the critical point z = 1.
// Attributions beyond these formulas are left to the research notes.

import { parseFormula, derivative, compileJS, FormulaError, usesOf } from "./fractal-formula.js";

export const FORMULA_TYPES = ["multibrot", "tricorn", "celtic", "magnet", "phoenix", "newton", "nova", "formula"];

export const CATALOG = {
  multibrot: { label: "Multibrot", mode: "escape", step: (v) => `z^${fmtPow(v.power)} + c` },
  tricorn:   { label: "Tricorn", mode: "escape", step: () => "conj(z)^2 + c" },
  celtic:    { label: "Celtic", mode: "escape", step: () => "absre(sqr(z)) + c" },
  magnet:    { label: "Magnet", mode: "escape", step: () => "sqr((sqr(z) + c - 1) / (2*z + c - 2))", bailout2: 1e4 },
  phoenix:   { label: "Phoenix", mode: "escape", step: () => "sqr(z) + c + p*zp", julia: true, jx: 0.5667, jy: 0, p: [-0.5, 0] },
  newton:    { label: "Newton", mode: "newton", f: (v) => v.f || "z^3 - 1", julia: true, p: [1, 0] },
  nova:      { label: "Nova", mode: "newton", f: (v) => v.f || "z^3 - 1", nova: true, z0: [1, 0], p: [1, 0] },
  formula:   { label: "Formula", mode: "escape", step: (v) => v.formula || "z^2 + c" },
};

function fmtPow(p) {
  const n = Number.isFinite(+p) ? +p : 3;
  return n < 0 ? `(${n})` : String(n);
}

// Polynomial degree of z in a tree, for the smooth-colouring normalisation. Functions that grow
// faster than any power (exp, sinh, ...) count as 2, which keeps the bands smooth enough.
export function degreeOf(n) {
  switch (n.t) {
    case "num": return 0;
    case "var": return n.name === "z" ? 1 : 0;
    case "neg": return degreeOf(n.a);
    case "bin": {
      const a = degreeOf(n.a), b = degreeOf(n.b);
      if (n.op === "+" || n.op === "-") return Math.max(a, b);
      if (n.op === "*") return a + b;
      if (n.op === "/") return Math.max(a - b, Math.max(a, 1) > 1 ? 1 : a);
      if (n.b.t === "num") return a * Math.abs(n.b.re);
      return Math.max(a, 2);
    }
    case "call": {
      const a = degreeOf(n.args[0]);
      if (n.f === "sqr") return 2 * a;
      if (n.f === "cube") return 3 * a;
      if (n.f === "pow") return n.args[1].t === "num" ? a * Math.abs(n.args[1].re) : Math.max(a, 2);
      if (["conj", "abs", "absre", "absim", "flip", "re", "im", "mod"].includes(n.f)) return a;
      if (n.f === "recip" || n.f === "log" || n.f === "arg") return 0;
      if (n.f === "sqrt") return a / 2;
      return a > 0 ? 2 : 0;
    }
  }
  return 1;
}

/**
 * Compile a view into a specification. Throws FormulaError when the visitor's formula does not
 * parse or Newton's derivative does not exist. Returns
 *   { type, key, mode: "escape" | "converge", tree, julia, z0, p, q, jc, bailout2, degree }
 * where key identifies the compiled program (same key, same shader).
 */
export function formulaSpec(view) {
  const type = FORMULA_TYPES.includes(view.type) ? view.type : "formula";
  const cat = CATALOG[type];
  const julia = view.julia != null ? !!view.julia : !!cat.julia;
  const p = view.p || cat.p || [0, 0];
  const q = view.q || [0, 0];
  const jc = [view.jx != null ? +view.jx : (cat.jx ?? -0.8), view.jy != null ? +view.jy : (cat.jy ?? 0.156)];
  let tree, mode, src;
  const userMode = type === "formula" ? (view.formulaMode || "escape") : cat.mode;
  if (userMode === "newton") {
    const fsrc = type === "formula" ? (view.formula || "z^3 - 1") : cat.f(view);
    const fTree = parseFormula(fsrc);
    const dTree = derivative(fTree);
    // z - p * f / f'  (+ c for Nova)
    tree = { t: "bin", op: "-", a: { t: "var", name: "z" }, b: { t: "bin", op: "*", a: { t: "var", name: "p" }, b: { t: "bin", op: "/", a: fTree, b: dTree } } };
    if (cat.nova || view.nova) tree = { t: "bin", op: "+", a: tree, b: { t: "var", name: "c" } };
    mode = "converge";
    src = "newton:" + fsrc + (cat.nova || view.nova ? ":nova" : "");
  } else {
    src = cat.step(view);
    tree = parseFormula(src);
    mode = userMode === "converge" ? "converge" : "escape";
  }
  const z0 = view.z0 === "c" ? "c" : (Array.isArray(view.z0) ? view.z0 : (cat.z0 || [0, 0]));
  const degree = Math.max(1.01, Math.min(16, view.degree || degreeOf(tree) || 2));
  const bailout2 = view.bailout2 || cat.bailout2 || 65536;
  return { type, key: `${mode}|${julia ? "j" : "m"}|${z0 === "c" ? "z0c" : z0.join(",")}|${src}`, mode, tree, julia, z0, p, q, jc, bailout2, degree, uses: usesOf(tree) };
}

export { FormulaError };

/**
 * Iterate one point on the CPU. x, y is the pixel's plane coordinate. Returns
 * { n, zx, zy, gx, gy, trap, done, step2, prev2 } where done says whether it escaped (escape mode) or
 * converged (converge mode), gx/gy is the gradient of log|z| for the shading, and step2 the last
 * |z - zp|^2 (for converge colouring).
 */
export function iterateSpec(spec, fn, x, y, maxIter) {
  const julia = spec.julia;
  let z = julia || spec.z0 === "c" ? [x, y, 1, 0, 0, 1] : [spec.z0[0], spec.z0[1], 0, 0, 0, 0];
  const c = julia ? [spec.jc[0], spec.jc[1], 0, 0, 0, 0] : [x, y, 1, 0, 0, 1];
  let zp = [0, 0, 0, 0, 0, 0];
  const env = { z, c, zp, p: [spec.p[0], spec.p[1], 0, 0, 0, 0], q: [spec.q[0], spec.q[1], 0, 0, 0, 0] };
  let n = 0, trap = Infinity, done = false, step2 = 1, prev2 = 1;
  for (; n < maxIter; ) {
    if (spec.mode === "escape" && z[0] * z[0] + z[1] * z[1] > spec.bailout2) { done = true; break; }
    env.z = z; env.zp = zp;
    const nz = fn(env);
    zp = z; z = nz;
    n++;
    if (!(Math.abs(z[0]) < 1e30 && Math.abs(z[1]) < 1e30)) { done = spec.mode === "escape"; break; }
    if (spec.mode === "converge") {
      const dx = z[0] - zp[0], dy = z[1] - zp[1];
      prev2 = step2;
      step2 = dx * dx + dy * dy;
      if (step2 < 1e-9) { done = true; break; }
    } else {
      const t = Math.min(Math.abs(z[0]), Math.abs(z[1]));
      if (t < trap) trap = t;
    }
    // Keep the tangents in range; their direction is all the shading reads.
    const m = Math.max(z[2] * z[2] + z[3] * z[3], z[4] * z[4] + z[5] * z[5]);
    if (m > 1e18) {
      z = [z[0], z[1], z[2] * 1e-9, z[3] * 1e-9, z[4] * 1e-9, z[5] * 1e-9];
      zp = [zp[0], zp[1], zp[2] * 1e-9, zp[3] * 1e-9, zp[4] * 1e-9, zp[5] * 1e-9];
      if (!julia) c[2] *= 1e-9, c[5] *= 1e-9;
    }
  }
  return { n, zx: z[0], zy: z[1], gx: z[0] * z[2] + z[1] * z[3], gy: z[0] * z[4] + z[1] * z[5], trap, done, step2, prev2 };
}

/** A compiled CPU function for a spec, cached by key. */
const CPU_CACHE = new Map();
export function cpuFunction(spec) {
  let fn = CPU_CACHE.get(spec.key);
  if (!fn) {
    fn = compileJS(spec.tree);
    if (CPU_CACHE.size > 32) CPU_CACHE.clear();
    CPU_CACHE.set(spec.key, fn);
  }
  return fn;
}
