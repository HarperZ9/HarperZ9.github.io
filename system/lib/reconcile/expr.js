// The strand expression algebra -- the substrate every backend derives from.
// A frozen closed-form AST over vars u,v,t (fields) and x,y,i (point maps): one source, sampled
// for the features criteria judge, emitted as GLSL for the eye, parsed back for the grounding
// proof. Ported from studio-engine's strand. Pure; zero-dep; node + browser.
import { hashHex } from "./hash.js";

export const VARS = new Set(["u", "v", "t", "x", "y", "i"]);
const EPS = 1e-3; // division guard (matches the metaballs field's +eps)
const FUNCS = new Set(["sin", "cos", "exp", "abs", "sqrt"]);

const lift = (a) => (a && typeof a === "object" && a.op) ? a : c(a);

export const c = (x) => ({ op: "const", args: [Number(x)] });
export const v = (name) => { if (!VARS.has(name)) throw new Error(`unknown var ${name}`); return { op: "var", args: [name] }; };
export const sin = (a) => ({ op: "sin", args: [lift(a)] });
export const cos = (a) => ({ op: "cos", args: [lift(a)] });
export const exp = (a) => ({ op: "exp", args: [lift(a)] });
export const absx = (a) => ({ op: "abs", args: [lift(a)] });
export const neg = (a) => ({ op: "neg", args: [lift(a)] });
export const sqrt = (a) => ({ op: "sqrt", args: [lift(a)] });
export const add = (...a) => ({ op: "add", args: a.map(lift) });
export const mul = (...a) => ({ op: "mul", args: a.map(lift) });
export const sub = (a, b) => ({ op: "sub", args: [lift(a), lift(b)] });
export const div = (a, b) => ({ op: "div", args: [lift(a), lift(b)] });

export function evalExpr(e, env = {}) {
  switch (e.op) {
    case "const": return e.args[0];
    case "var": return Number(env[e.args[0]] ?? 0);
    case "sin": return Math.sin(evalExpr(e.args[0], env));
    case "cos": return Math.cos(evalExpr(e.args[0], env));
    case "exp": return Math.exp(evalExpr(e.args[0], env));
    case "abs": return Math.abs(evalExpr(e.args[0], env));
    case "neg": return -evalExpr(e.args[0], env);
    case "sqrt": { const a = evalExpr(e.args[0], env); return a > 0 ? Math.sqrt(a) : 0; }
    case "add": return e.args.reduce((s, a) => s + evalExpr(a, env), 0);
    case "mul": return e.args.reduce((p, a) => p * evalExpr(a, env), 1);
    case "sub": return evalExpr(e.args[0], env) - evalExpr(e.args[1], env);
    case "div": { const d = evalExpr(e.args[1], env); const dd = Math.abs(d) > EPS ? d : (d >= 0 ? EPS : -EPS); return evalExpr(e.args[0], env) / dd; }
    default: throw new Error(`bad op ${e.op}`);
  }
}

export const GLSL_HELPERS =
  "float safediv(float a, float b){ float d = abs(b) > 1e-3 ? b : (b >= 0.0 ? 1e-3 : -1e-3); return a / d; }";

function glslNum(x) { let s = String(x); if (!/[.eE]/.test(s)) s += ".0"; return s; }

export function emitGLSL(e) {
  switch (e.op) {
    case "const": { const x = e.args[0]; const r = glslNum(x); return x < 0 ? `(${r})` : r; }
    case "var": return e.args[0];
    case "neg": return `(-${emitGLSL(e.args[0])})`;
    case "add": return "(" + e.args.map(emitGLSL).join(" + ") + ")";
    case "mul": return "(" + e.args.map(emitGLSL).join(" * ") + ")";
    case "sub": return `(${emitGLSL(e.args[0])} - ${emitGLSL(e.args[1])})`;
    case "div": return `safediv(${emitGLSL(e.args[0])}, ${emitGLSL(e.args[1])})`;
    default: if (FUNCS.has(e.op)) return `${e.op}(${emitGLSL(e.args[0])})`; throw new Error(`cannot emit ${e.op}`);
  }
}

// recursive-descent parser over exactly the subset emitGLSL produces (for the round-trip proof)
export function parseGLSL(src) {
  const s = src.replace(/\s+/g, "");
  let i = 0;
  const peek = () => (i < s.length ? s[i] : "");
  const FN = { sin, cos, exp, abs: absx, sqrt };
  function sum() {
    let node = term();
    while (peek() === "+" || peek() === "-") { const op = s[i++]; const rhs = term(); node = op === "+" ? add(node, rhs) : sub(node, rhs); }
    return node;
  }
  function term() { let node = atom(); while (peek() === "*") { i++; node = mul(node, atom()); } return node; }
  function atom() {
    const ch = peek();
    if (ch === "(") { i++; let n; if (peek() === "-") { i++; n = neg(sum()); } else { n = sum(); } i++; return n; }
    if (/[a-z]/i.test(ch)) {
      let j = i; while (/[a-z0-9]/i.test(peek())) i++;
      const id = s.slice(j, i);
      if (peek() === "(") {
        i++; const a = sum();
        if (peek() === ",") { i++; const b = sum(); i++; if (id !== "safediv") throw new Error(`unknown 2-arg fn ${id}`); return div(a, b); }
        i++; const f = FN[id]; if (!f) throw new Error(`unknown fn ${id}`); return f(a);
      }
      return v(id);
    }
    return num();
  }
  function num() {
    let j = i;
    while (peek() && (/[0-9.]/.test(peek()) || /[eE]/.test(peek()) || ((peek() === "+" || peek() === "-") && /[eE]/.test(s[i - 1])))) i++;
    return c(parseFloat(s.slice(j, i)));
  }
  const e = sum();
  if (i !== s.length) throw new Error(`trailing input at ${i} in ${s}`);
  return e;
}

export function sampleField(e, n, t = 0) {
  n = Math.max(1, n);
  const out = [];
  for (let gy = 0; gy < n; gy++) {
    const vv = 2 * ((gy + 0.5) / n) - 1;
    for (let gx = 0; gx < n; gx++) { const uu = 2 * ((gx + 0.5) / n) - 1; out.push(evalExpr(e, { u: uu, v: vv, t })); }
  }
  return out;
}

function canon(e) {
  if (e.op === "const") return `(${e.args[0]})`;
  if (e.op === "var") return e.args[0];
  return e.op + "(" + e.args.map(canon).join(",") + ")";
}
export const sha = (e) => hashHex(canon(e));
