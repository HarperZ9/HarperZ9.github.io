// fractal-formula.js: a small complex-number language for fractal iteration formulas.
//
// One source of truth for every formula the Studio draws besides its three hand-written kernels:
// the built-ins (Multibrot, Tricorn, Celtic, Buffalo, Phoenix, Newton, Nova, ...) are strings in
// this language, and so is anything a visitor types into the formula editor. A formula is PARSED
// into a syntax tree and compiled from the tree, to GLSL for the GPU and to a closure tree for the
// CPU. Nothing a visitor types is ever handed to eval, to new Function, or pasted into a shader as
// text: only the tree's own node kinds, numbers and the names on the allow-list below reach the
// output, so the worst a formula can do is draw something dull.
//
// The compiled code carries forward-mode derivatives with every value: two tangent columns, dz/dcx
// and dz/dcy (or dz/dz0x, dz/dz0y in Julia mode). Each operation applies its own real-linear
// derivative to each column, so holomorphic functions, conj(), abs() and re()/im() all get the
// right Jacobian, and the shading reads the gradient of log|z| from it. For a holomorphic formula
// that is exactly the direction the Mandelbrot kernel's relief uses; for a folding one it has no
// seams (see reliefDir in fractal-glsl-lib.js).
//
// Grammar:   expr  := term (('+' | '-') term)*
//            term  := unary (('*' | '/') unary)*      (juxtaposition is not multiplication)
//            unary := '-' unary | power
//            power := atom ('^' unary)?                (right-associative)
//            atom  := number | 'i' | name | name '(' expr (',' expr)* ')' | '(' expr ')'
// Names: z (the orbit), c (the parameter: the pixel, or the Julia constant), zp (the previous z),
// p and q (two user constants), pi, e. Numbers may carry an exponent and a trailing i (2.5i).

export const VARS = ["z", "c", "zp", "p", "q"];
export const CONSTS = { pi: [Math.PI, 0], e: [Math.E, 0], i: [0, 1] };
// name -> arity. The documentation strings go into the editor's help line.
export const FUNCS = {
  sqr: 1, cube: 1, recip: 1, sqrt: 1, exp: 1, log: 1,
  sin: 1, cos: 1, tan: 1, sinh: 1, cosh: 1, tanh: 1,
  conj: 1, abs: 1, absre: 1, absim: 1, re: 1, im: 1, flip: 1, mod: 1, arg: 1,
  pow: 2,
};
export const MAX_NODES = 160;
const MAX_INT_POWER = 16;

export class FormulaError extends Error {
  constructor(message, pos) { super(message); this.pos = pos; }
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────────────────────
function tokenize(src) {
  const out = [];
  let i = 0;
  const s = String(src);
  if (s.length > 2000) throw new FormulaError("the formula is longer than 2000 characters", 0);
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const num = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?(i(?![a-zA-Z0-9_]))?/.exec(s.slice(i));
    if (num) {
      const v = parseFloat(num[1] + (num[2] || ""));
      if (!Number.isFinite(v)) throw new FormulaError("a number is out of range", i);
      out.push({ k: "num", v, imag: !!num[3], pos: i });
      i += num[0].length;
      continue;
    }
    const id = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i));
    if (id) { out.push({ k: "id", v: id[0], pos: i }); i += id[0].length; continue; }
    if ("+-*/^(),".includes(ch)) { out.push({ k: ch, pos: i }); i++; continue; }
    throw new FormulaError(`unexpected character "${ch}"`, i);
  }
  out.push({ k: "end", pos: s.length });
  return out;
}

// ── Parser ────────────────────────────────────────────────────────────────────────────────────
/** Parse a formula into a tree. Throws FormulaError with a position on any mistake. */
export function parseFormula(src) {
  const toks = tokenize(src);
  let at = 0, nodes = 0;
  const peek = () => toks[at];
  const take = (k) => {
    const t = toks[at];
    if (t.k !== k) throw new FormulaError(k === "end" ? `unexpected "${t.k === "id" || t.k === "num" ? t.v : t.k}"` : `expected "${k}"`, t.pos);
    at++;
    return t;
  };
  const node = (n) => { if (++nodes > MAX_NODES) throw new FormulaError(`the formula has more than ${MAX_NODES} parts`, peek().pos); return n; };
  function expr() {
    let a = term();
    while (peek().k === "+" || peek().k === "-") { const op = toks[at++].k; a = node({ t: "bin", op, a, b: term() }); }
    return a;
  }
  function term() {
    let a = unary();
    while (peek().k === "*" || peek().k === "/") { const op = toks[at++].k; a = node({ t: "bin", op, a, b: unary() }); }
    return a;
  }
  function unary() {
    if (peek().k === "-") { at++; return node({ t: "neg", a: unary() }); }
    if (peek().k === "+") { at++; return unary(); }
    return power();
  }
  function power() {
    const a = atom();
    if (peek().k === "^") { at++; return node({ t: "bin", op: "^", a, b: unary() }); }
    return a;
  }
  function atom() {
    const t = peek();
    if (t.k === "num") { at++; return node({ t: "num", re: t.imag ? 0 : t.v, im: t.imag ? t.v : 0 }); }
    if (t.k === "(") { at++; const e = expr(); take(")"); return e; }
    if (t.k === "id") {
      at++;
      const name = t.v;
      if (peek().k === "(") {
        if (!(name in FUNCS)) throw new FormulaError(`unknown function "${name}"`, t.pos);
        at++;
        const args = [expr()];
        while (peek().k === ",") { at++; args.push(expr()); }
        take(")");
        if (args.length !== FUNCS[name]) throw new FormulaError(`${name}() takes ${FUNCS[name]} argument${FUNCS[name] > 1 ? "s" : ""}`, t.pos);
        return node({ t: "call", f: name, args });
      }
      if (VARS.includes(name)) return node({ t: "var", name });
      if (name in CONSTS) return node({ t: "num", re: CONSTS[name][0], im: CONSTS[name][1] });
      throw new FormulaError(`unknown name "${name}"`, t.pos);
    }
    throw new FormulaError(t.k === "end" ? "the formula ends too soon" : `unexpected "${t.k}"`, t.pos);
  }
  const tree = expr();
  take("end");
  return tree;
}

/** Which variables a tree reads. */
export function usesOf(tree) {
  const s = new Set();
  (function walk(n) {
    if (n.t === "var") s.add(n.name);
    if (n.a) walk(n.a);
    if (n.b) walk(n.b);
    if (n.args) n.args.forEach(walk);
  })(tree);
  return s;
}

// A small integer exponent becomes repeated multiplication (exact, and its derivative is exact).
function intPower(n) {
  if (n.t === "num" && n.im === 0 && Number.isInteger(n.re) && Math.abs(n.re) <= MAX_INT_POWER) return n.re;
  if (n.t === "neg" && n.a.t === "num" && n.a.im === 0 && Number.isInteger(n.a.re) && n.a.re <= MAX_INT_POWER) return -n.a.re;
  return null;
}

// ── GLSL ──────────────────────────────────────────────────────────────────────────────────────
// Complex helpers the generated code calls. Shared by every formula program.
export const COMPLEX_GLSL = `
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
vec2 cdivz(vec2 a, vec2 b) { float q = max(dot(b, b), 1e-30); return vec2(a.x*b.x + a.y*b.y, a.y*b.x - a.x*b.y) / q; }
vec2 cexp(vec2 a) { return exp(min(a.x, 80.0)) * vec2(cos(a.y), sin(a.y)); }
vec2 clog(vec2 a) { return vec2(0.5 * log(max(dot(a, a), 1e-30)), atan(a.y, a.x)); }
vec2 csqrt(vec2 a) { float r = length(a); return vec2(sqrt(max(0.0, 0.5*(r + a.x))), sign(a.y + 1e-30) * sqrt(max(0.0, 0.5*(r - a.x)))); }
float fsinh(float x) { x = clamp(x, -80.0, 80.0); return 0.5 * (exp(x) - exp(-x)); }
float fcosh(float x) { x = clamp(x, -80.0, 80.0); return 0.5 * (exp(x) + exp(-x)); }
vec2 csin(vec2 a) { return vec2(sin(a.x) * fcosh(a.y), cos(a.x) * fsinh(a.y)); }
vec2 ccos(vec2 a) { return vec2(cos(a.x) * fcosh(a.y), -sin(a.x) * fsinh(a.y)); }
vec2 csinh(vec2 a) { return vec2(fsinh(a.x) * cos(a.y), fcosh(a.x) * sin(a.y)); }
vec2 ccosh(vec2 a) { return vec2(fcosh(a.x) * cos(a.y), fsinh(a.x) * sin(a.y)); }
vec2 sgn2(vec2 a) { return vec2(a.x < 0.0 ? -1.0 : 1.0, a.y < 0.0 ? -1.0 : 1.0); }
`;

const f = (x) => {
  if (!Number.isFinite(x)) return "0.0";
  const s = String(x);
  return /[.eE]/.test(s) ? (s.includes("e") && !s.includes(".") ? s.replace("e", ".0e") : s) : s + ".0";
};

/**
 * Compile a tree to GLSL statements. Returns { code, out } where code assigns temporaries and out
 * is [value, tangentA, tangentB] expression names. env maps variable names to triples of GLSL
 * expressions.
 */
export function compileGLSL(tree, env) {
  const lines = [];
  let k = 0;
  const tmp = (v, a, b) => {
    const id = `f${k++}`;
    lines.push(`vec2 ${id} = ${v}; vec2 ${id}a = ${a}; vec2 ${id}b = ${b};`);
    return [id, id + "a", id + "b"];
  };
  const ZERO = "vec2(0.0)";
  // Apply a complex multiplier m to both tangent columns.
  const lin = (m, x) => [`cmul(${m}, ${x[1]})`, `cmul(${m}, ${x[2]})`];
  function mul(x, y) {
    return tmp(`cmul(${x[0]}, ${y[0]})`, `cmul(${x[0]}, ${y[1]}) + cmul(${y[0]}, ${x[1]})`, `cmul(${x[0]}, ${y[2]}) + cmul(${y[0]}, ${x[2]})`);
  }
  function powInt(x, n) {
    if (n === 0) return tmp("vec2(1.0, 0.0)", ZERO, ZERO);
    if (n < 0) return recip(powInt(x, -n));
    let r = null, b = x, e = n;
    while (e > 0) {
      if (e & 1) r = r ? mul(r, b) : b;
      e >>= 1;
      if (e) b = mul(b, b);
    }
    return r;
  }
  function recip(x) {
    const v = `cdivz(vec2(1.0, 0.0), ${x[0]})`;
    const r = tmp(v, ZERO, ZERO);
    // d(1/u) = -1/u^2 du
    const m = `-cmul(${r[0]}, ${r[0]})`;
    lines.push(`${r[1]} = cmul(${m}, ${x[1]}); ${r[2]} = cmul(${m}, ${x[2]});`);
    return r;
  }
  function holo(v, deriv, x) {
    // value v(x), derivative factor deriv(x) (may reference the new value as R)
    const r = tmp(v, ZERO, ZERO);
    const m = deriv.replace(/\bR\b/g, r[0]);
    const [a, b] = lin(`(${m})`, x);
    lines.push(`${r[1]} = ${a}; ${r[2]} = ${b};`);
    return r;
  }
  function gen(n) {
    switch (n.t) {
      case "num": return [`vec2(${f(n.re)}, ${f(n.im)})`, ZERO, ZERO];
      case "var": return env[n.name];
      case "neg": { const x = gen(n.a); return tmp(`-${x[0]}`, `-${x[1]}`, `-${x[2]}`); }
      case "bin": {
        if (n.op === "^") {
          const ip = intPower(n.b);
          const x = gen(n.a);
          if (ip !== null) return powInt(x, ip);
          return gen({ t: "call", f: "exp", args: [{ t: "bin", op: "*", a: n.b, b: { t: "call", f: "log", args: [n.a] } }] });
        }
        const x = gen(n.a), y = gen(n.b);
        if (n.op === "+") return tmp(`${x[0]} + ${y[0]}`, `${x[1]} + ${y[1]}`, `${x[2]} + ${y[2]}`);
        if (n.op === "-") return tmp(`${x[0]} - ${y[0]}`, `${x[1]} - ${y[1]}`, `${x[2]} - ${y[2]}`);
        if (n.op === "*") return mul(x, y);
        // quotient: (x' y - x y') / y^2
        const q = tmp(`cdivz(${x[0]}, ${y[0]})`, ZERO, ZERO);
        lines.push(`${q[1]} = cdivz(${x[1]} - cmul(${q[0]}, ${y[1]}), ${y[0]}); ${q[2]} = cdivz(${x[2]} - cmul(${q[0]}, ${y[2]}), ${y[0]});`);
        return q;
      }
      case "call": {
        const fn = n.f;
        if (fn === "pow") return gen({ t: "bin", op: "^", a: n.args[0], b: n.args[1] });
        const x = gen(n.args[0]);
        switch (fn) {
          case "sqr": return powInt(x, 2);
          case "cube": return powInt(x, 3);
          case "recip": return recip(x);
          case "sqrt": return holo(`csqrt(${x[0]})`, `cdivz(vec2(0.5, 0.0), R)`, x);
          case "exp": return holo(`cexp(${x[0]})`, "R", x);
          case "log": return holo(`clog(${x[0]})`, `cdivz(vec2(1.0, 0.0), ${x[0]})`, x);
          case "sin": return holo(`csin(${x[0]})`, `ccos(${x[0]})`, x);
          case "cos": return holo(`ccos(${x[0]})`, `-csin(${x[0]})`, x);
          case "sinh": return holo(`csinh(${x[0]})`, `ccosh(${x[0]})`, x);
          case "cosh": return holo(`ccosh(${x[0]})`, `csinh(${x[0]})`, x);
          case "tan": return holo(`cdivz(csin(${x[0]}), ccos(${x[0]}))`, `vec2(1.0, 0.0) + cmul(R, R)`, x);
          case "tanh": return holo(`cdivz(csinh(${x[0]}), ccosh(${x[0]}))`, `vec2(1.0, 0.0) - cmul(R, R)`, x);
          case "conj": return tmp(`vec2(${x[0]}.x, -${x[0]}.y)`, `vec2(${x[1]}.x, -${x[1]}.y)`, `vec2(${x[2]}.x, -${x[2]}.y)`);
          case "abs": return tmp(`abs(${x[0]})`, `sgn2(${x[0]}) * ${x[1]}`, `sgn2(${x[0]}) * ${x[2]}`);
          case "absre": return tmp(`vec2(abs(${x[0]}.x), ${x[0]}.y)`, `vec2(sgn2(${x[0]}).x, 1.0) * ${x[1]}`, `vec2(sgn2(${x[0]}).x, 1.0) * ${x[2]}`);
          case "absim": return tmp(`vec2(${x[0]}.x, abs(${x[0]}.y))`, `vec2(1.0, sgn2(${x[0]}).y) * ${x[1]}`, `vec2(1.0, sgn2(${x[0]}).y) * ${x[2]}`);
          case "re": return tmp(`vec2(${x[0]}.x, 0.0)`, `vec2(${x[1]}.x, 0.0)`, `vec2(${x[2]}.x, 0.0)`);
          case "im": return tmp(`vec2(${x[0]}.y, 0.0)`, `vec2(${x[1]}.y, 0.0)`, `vec2(${x[2]}.y, 0.0)`);
          case "flip": return tmp(`${x[0]}.yx`, `${x[1]}.yx`, `${x[2]}.yx`);
          case "mod": {
            const l = `max(length(${x[0]}), 1e-30)`;
            return tmp(`vec2(length(${x[0]}), 0.0)`, `vec2(dot(${x[0]}, ${x[1]}) / ${l}, 0.0)`, `vec2(dot(${x[0]}, ${x[2]}) / ${l}, 0.0)`);
          }
          case "arg": {
            const q = `max(dot(${x[0]}, ${x[0]}), 1e-30)`;
            return tmp(`vec2(atan(${x[0]}.y, ${x[0]}.x), 0.0)`,
              `vec2((${x[0]}.x * ${x[1]}.y - ${x[0]}.y * ${x[1]}.x) / ${q}, 0.0)`,
              `vec2((${x[0]}.x * ${x[2]}.y - ${x[0]}.y * ${x[2]}.x) / ${q}, 0.0)`);
          }
        }
      }
    }
    throw new FormulaError("internal: unknown node " + n.t, 0);
  }
  const out = gen(tree);
  return { code: lines.join("\n    "), out };
}

// ── JS (CPU) ──────────────────────────────────────────────────────────────────────────────────
// Complex values with two tangent columns as flat arrays [vr, vi, ar, ai, br, bi]. The tree compiles
// to nested closures; evaluation allocates, which is fine for a fallback and for tests.
const cm = (ar, ai, br, bi) => [ar * br - ai * bi, ar * bi + ai * br];
const cd = (ar, ai, br, bi) => { const q = Math.max(br * br + bi * bi, 1e-300); return [(ar * br + ai * bi) / q, (ai * br - ar * bi) / q]; };
const chyp = (x) => { x = Math.max(-700, Math.min(700, x)); return [Math.sinh(x), Math.cosh(x)]; };
const VAL = {
  exp: (r, i) => { const m = Math.exp(Math.min(r, 700)); return [m * Math.cos(i), m * Math.sin(i)]; },
  log: (r, i) => [0.5 * Math.log(Math.max(r * r + i * i, 1e-300)), Math.atan2(i, r)],
  sqrt: (r, i) => { const m = Math.hypot(r, i); return [Math.sqrt(Math.max(0, 0.5 * (m + r))), (i + 1e-300 < 0 ? -1 : 1) * Math.sqrt(Math.max(0, 0.5 * (m - r)))]; },
  sin: (r, i) => { const [s, c] = chyp(i); return [Math.sin(r) * c, Math.cos(r) * s]; },
  cos: (r, i) => { const [s, c] = chyp(i); return [Math.cos(r) * c, -Math.sin(r) * s]; },
  sinh: (r, i) => { const [s, c] = chyp(r); return [s * Math.cos(i), c * Math.sin(i)]; },
  cosh: (r, i) => { const [s, c] = chyp(r); return [c * Math.cos(i), s * Math.sin(i)]; },
};
function lin2(m, x) { const a = cm(m[0], m[1], x[2], x[3]), b = cm(m[0], m[1], x[4], x[5]); return [a[0], a[1], b[0], b[1]]; }

/** Compile a tree to a function (vars) -> [vr, vi, ar, ai, br, bi]. vars maps names to such arrays. */
export function compileJS(tree) {
  function mul(x, y) {
    const v = cm(x[0], x[1], y[0], y[1]);
    const a1 = cm(x[0], x[1], y[2], y[3]), a2 = cm(y[0], y[1], x[2], x[3]);
    const b1 = cm(x[0], x[1], y[4], y[5]), b2 = cm(y[0], y[1], x[4], x[5]);
    return [v[0], v[1], a1[0] + a2[0], a1[1] + a2[1], b1[0] + b2[0], b1[1] + b2[1]];
  }
  function recip(x) {
    const r = cd(1, 0, x[0], x[1]);
    const m = cm(r[0], r[1], r[0], r[1]);
    return [r[0], r[1], ...lin2([-m[0], -m[1]], x)];
  }
  function powInt(x, n) {
    if (n === 0) return [1, 0, 0, 0, 0, 0];
    if (n < 0) return recip(powInt(x, -n));
    let r = null, b = x, e = n;
    while (e > 0) { if (e & 1) r = r ? mul(r, b) : b; e >>= 1; if (e) b = mul(b, b); }
    return r;
  }
  function holo(fv, fd) {
    return (x) => { const v = fv(x[0], x[1]); const m = fd(x, v); return [v[0], v[1], ...lin2(m, x)]; };
  }
  const H = {
    sqrt: holo(VAL.sqrt, (x, v) => cd(0.5, 0, v[0], v[1])),
    exp: holo(VAL.exp, (x, v) => v),
    log: holo(VAL.log, (x) => cd(1, 0, x[0], x[1])),
    sin: holo(VAL.sin, (x) => VAL.cos(x[0], x[1])),
    cos: holo(VAL.cos, (x) => { const s = VAL.sin(x[0], x[1]); return [-s[0], -s[1]]; }),
    sinh: holo(VAL.sinh, (x) => VAL.cosh(x[0], x[1])),
    cosh: holo(VAL.cosh, (x) => VAL.sinh(x[0], x[1])),
    tan: holo((r, i) => { const s = VAL.sin(r, i), c = VAL.cos(r, i); return cd(s[0], s[1], c[0], c[1]); }, (x, v) => { const q = cm(v[0], v[1], v[0], v[1]); return [1 + q[0], q[1]]; }),
    tanh: holo((r, i) => { const s = VAL.sinh(r, i), c = VAL.cosh(r, i); return cd(s[0], s[1], c[0], c[1]); }, (x, v) => { const q = cm(v[0], v[1], v[0], v[1]); return [1 - q[0], -q[1]]; }),
  };
  const sg = (v) => (v < 0 ? -1 : 1);
  function gen(n) {
    switch (n.t) {
      case "num": { const k = [n.re, n.im, 0, 0, 0, 0]; return () => k; }
      case "var": { const name = n.name; return (env) => env[name]; }
      case "neg": { const a = gen(n.a); return (env) => a(env).map((v) => -v); }
      case "bin": {
        if (n.op === "^") {
          const ip = intPower(n.b);
          if (ip !== null) { const a = gen(n.a); return (env) => powInt(a(env), ip); }
          return gen({ t: "call", f: "exp", args: [{ t: "bin", op: "*", a: n.b, b: { t: "call", f: "log", args: [n.a] } }] });
        }
        const a = gen(n.a), b = gen(n.b);
        if (n.op === "+") return (env) => { const x = a(env), y = b(env); return x.map((v, j) => v + y[j]); };
        if (n.op === "-") return (env) => { const x = a(env), y = b(env); return x.map((v, j) => v - y[j]); };
        if (n.op === "*") return (env) => mul(a(env), b(env));
        return (env) => {
          const x = a(env), y = b(env);
          const q = cd(x[0], x[1], y[0], y[1]);
          const ta = cm(q[0], q[1], y[2], y[3]), tb = cm(q[0], q[1], y[4], y[5]);
          const da = cd(x[2] - ta[0], x[3] - ta[1], y[0], y[1]), db = cd(x[4] - tb[0], x[5] - tb[1], y[0], y[1]);
          return [q[0], q[1], da[0], da[1], db[0], db[1]];
        };
      }
      case "call": {
        if (n.f === "pow") return gen({ t: "bin", op: "^", a: n.args[0], b: n.args[1] });
        const a = gen(n.args[0]);
        switch (n.f) {
          case "sqr": return (env) => powInt(a(env), 2);
          case "cube": return (env) => powInt(a(env), 3);
          case "recip": return (env) => recip(a(env));
          case "conj": return (env) => { const x = a(env); return [x[0], -x[1], x[2], -x[3], x[4], -x[5]]; };
          case "abs": return (env) => { const x = a(env), sx = sg(x[0]), sy = sg(x[1]); return [Math.abs(x[0]), Math.abs(x[1]), sx * x[2], sy * x[3], sx * x[4], sy * x[5]]; };
          case "absre": return (env) => { const x = a(env), sx = sg(x[0]); return [Math.abs(x[0]), x[1], sx * x[2], x[3], sx * x[4], x[5]]; };
          case "absim": return (env) => { const x = a(env), sy = sg(x[1]); return [x[0], Math.abs(x[1]), x[2], sy * x[3], x[4], sy * x[5]]; };
          case "re": return (env) => { const x = a(env); return [x[0], 0, x[2], 0, x[4], 0]; };
          case "im": return (env) => { const x = a(env); return [x[1], 0, x[3], 0, x[5], 0]; };
          case "flip": return (env) => { const x = a(env); return [x[1], x[0], x[3], x[2], x[5], x[4]]; };
          case "mod": return (env) => { const x = a(env), l = Math.max(Math.hypot(x[0], x[1]), 1e-300); return [Math.hypot(x[0], x[1]), 0, (x[0] * x[2] + x[1] * x[3]) / l, 0, (x[0] * x[4] + x[1] * x[5]) / l, 0]; };
          case "arg": return (env) => { const x = a(env), q = Math.max(x[0] * x[0] + x[1] * x[1], 1e-300); return [Math.atan2(x[1], x[0]), 0, (x[0] * x[3] - x[1] * x[2]) / q, 0, (x[0] * x[5] - x[1] * x[4]) / q, 0]; };
          default: { const h = H[n.f]; return (env) => h(a(env)); }
        }
      }
    }
    throw new FormulaError("internal: unknown node " + n.t, 0);
  }
  return gen(tree);
}

/**
 * Symbolic derivative d/dz of a tree, for Newton and Nova: they need f'(z) of the f the visitor
 * typed. Supports the holomorphic subset (+ - * / ^ with a constant exponent, and the analytic
 * functions); a formula that uses conj, abs, re, im, flip, mod or arg in f has no complex
 * derivative and is refused with that reason.
 */
export function derivative(n) {
  const num = (re, im = 0) => ({ t: "num", re, im });
  const isZero = (x) => x.t === "num" && x.re === 0 && x.im === 0;
  const add = (a, b) => (isZero(a) ? b : isZero(b) ? a : { t: "bin", op: "+", a, b });
  const mulT = (a, b) => (isZero(a) || isZero(b) ? num(0) : { t: "bin", op: "*", a, b });
  const call = (fn, a) => ({ t: "call", f: fn, args: [a] });
  function d(x) {
    switch (x.t) {
      case "num": return num(0);
      case "var": return x.name === "z" ? num(1) : num(0);
      case "neg": { const da = d(x.a); return isZero(da) ? da : { t: "neg", a: da }; }
      case "bin": {
        const { a, b } = x;
        if (x.op === "+") return add(d(a), d(b));
        if (x.op === "-") { const db = d(b); return isZero(db) ? d(a) : { t: "bin", op: "-", a: d(a), b: db }; }
        if (x.op === "*") return add(mulT(d(a), b), mulT(a, d(b)));
        if (x.op === "/") return { t: "bin", op: "/", a: { t: "bin", op: "-", a: mulT(d(a), b), b: mulT(a, d(b)) }, b: { t: "bin", op: "^", a: b, b: num(2) } };
        // a ^ b with b constant in z
        if (!isZero(d(b))) throw new FormulaError("Newton needs exponents that do not depend on z", 0);
        return mulT(mulT(b, { t: "bin", op: "^", a, b: { t: "bin", op: "-", a: b, b: num(1) } }), d(a));
      }
      case "call": {
        const a = x.args[0], da = d(a);
        const chain = (g) => mulT(g, da);
        switch (x.f) {
          case "sqr": return chain(mulT(num(2), a));
          case "cube": return chain(mulT(num(3), call("sqr", a)));
          case "recip": return chain({ t: "neg", a: call("recip", call("sqr", a)) });
          case "sqrt": return chain({ t: "bin", op: "/", a: num(0.5), b: call("sqrt", a) });
          case "exp": return chain(call("exp", a));
          case "log": return chain(call("recip", a));
          case "sin": return chain(call("cos", a));
          case "cos": return chain({ t: "neg", a: call("sin", a) });
          case "sinh": return chain(call("cosh", a));
          case "cosh": return chain(call("sinh", a));
          case "tan": return chain(call("recip", call("sqr", call("cos", a))));
          case "tanh": return chain(call("recip", call("sqr", call("cosh", a))));
          case "pow": return d({ t: "bin", op: "^", a: x.args[0], b: x.args[1] });
          default: throw new FormulaError(`Newton needs a formula with a complex derivative, and ${x.f}() has none`, 0);
        }
      }
    }
    return num(0);
  }
  return d(n);
}
