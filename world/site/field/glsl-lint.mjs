// glsl-lint.mjs: a lint pass for the field's GLSL strings. Our own code, no parser dependency.
//
// Contract
//   lint(src, opts) -> [{ rule, line, text }], sorted by line. src is one GLSL ES 3.00 shader. opts.nonzero lists
//   names the caller vouches are never zero (resolution uniforms, loop counts); opts.nonnegFns lists functions
//   whose result is never negative.
//   Rules
//     unused-uniform     a uniform that no code reads
//     unused-function    a function other than main that nothing calls
//     no-precision       a fragment shader with no default float precision
//     low-precision      a lowp or mediump qualifier (a phone may store it in 10 or 16 bits)
//     literal-precision  a float literal with more than 9 significant digits (float32 keeps about 7)
//     sin-hash           fract(sin(x) * big): the result depends on the GPU's sin precision
//     div                a divide whose denominator has no visible guard against zero
//     sqrt, log, pow     an argument or base with no visible guard against a negative (or zero for log)
//     acos               acos or asin of an argument that is not clamped
//     normalize          normalize of a vector that may be zero
//   A guard is one the lint can see: a non-zero literal, a constant, max(x, positive literal), exp(), a sum with a
//   positive literal and no subtraction, or a local whose last assignment is one of those. The lint reads text, not
//   types or value ranges, so a finding means "no guard visible", and a clean result does not prove the absence of
//   NaN. Integer and float mixing is left to the GLSL ES compiler, which refuses it.
//   The baseline (glsl-lint.baseline.json) lists the findings accepted so far; the test fails on any new one.
const NUM = /^(?:\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)u?$/;
const TYPES = "float|int|uint|bool|void|vec[234]|ivec[234]|uvec[234]|bvec[234]|mat[234]";
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

function close(s, i) { // index of the bracket that closes the one at i
  const o = s[i], c = o === "(" ? ")" : "]"; let d = 0;
  for (let j = i; j < s.length; j++) { if (s[j] === o) d++; else if (s[j] === c && --d === 0) return j; }
  return s.length - 1;
}
function split(s, sep) { // split at top-level separators (a set of characters)
  const out = []; let d = 0, last = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(" || s[i] === "[") d++; else if (s[i] === ")" || s[i] === "]") d--;
    else if (d === 0 && sep.includes(s[i]) && !(/[eE]/.test(s[i - 1] || "") && /\d/.test(s[i - 2] || "") && "+-".includes(s[i]))) { out.push(s.slice(last, i)); last = i + 1; }
  }
  out.push(s.slice(last)); return out.map((x) => x.trim());
}
function primary(s, i) { // the operand that starts at i: a number, a name with calls and swizzles, or a group
  while (/\s/.test(s[i])) i++;
  const a = i; if (s[i] === "-" || s[i] === "+") i++;
  const n = /^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(s.slice(i, i + 40));
  if (n) return s.slice(a, i + n[0].length);
  if (s[i] === "(") i = close(s, i) + 1; else while (/\w/.test(s[i] || "")) i++;
  for (;;) { if (s[i] === "(" || s[i] === "[") i = close(s, i) + 1; else if (s[i] === "." && /[a-z]/i.test(s[i + 1])) { i++; while (/\w/.test(s[i] || "")) i++; } else break; }
  return s.slice(a, i);
}
const call = (e, names) => { const m = new RegExp(`^(${names})\\s*\\(`).exec(e); return m && close(e, m[0].length - 1) === e.length - 1 ? split(e.slice(m[0].length, -1), ",") : null; };
const unwrap = (e) => { e = e.trim(); while (e[0] === "(" && close(e, 0) === e.length - 1) e = e.slice(1, -1).trim(); return e; };

export function lint(src, opts = {}) {
  const s = strip(src), out = [], lines = src.split("\n");
  const lineOf = (i) => s.slice(0, i).split("\n").length;
  const add = (rule, i) => { const line = lineOf(i); out.push({ rule, line, text: lines[line - 1].trim() }); };
  const consts = new Set(opts.nonzero || []);
  for (const m of s.matchAll(/(?:const\s+(?:float|int)\s+(\w+)\s*=\s*([^;]+);|#define\s+(\w+)\s+(\S+))/g)) if (parseFloat(m[2] || m[4]) !== 0) consts.add(m[1] || m[3]);
  const lastAssign = (name, at) => { let e = null; for (const m of s.slice(0, at).matchAll(new RegExp(`(?<![\\w.])${name}\\s*=(?!=)\\s*([^;]+);`, "g"))) e = m[1]; return e; };
  // positive(e): e cannot be zero or negative, as far as the text shows
  const positive = (e, at, depth = 0) => {
    e = unwrap(e); if (e[0] === "+") e = e.slice(1).trim();
    if (NUM.test(e)) return parseFloat(e) > 0;
    let a;
    const tern = split(e, "?");
    if (tern.length === 2) return split(tern[1], ":").every((x) => positive(x, at, depth));
    if ((a = call(e, "max"))) return a.some((x) => positive(x, at, depth));
    if (call(e, "exp|exp2|cosh")) return true;
    if ((a = call(e, "float|sqrt|vec[234]"))) return a.every((x) => positive(x, at, depth));
    const sum = split(e, "+-");
    if (sum.length > 1) return split(e, "-").length === 1 && sum.some((x) => positive(x, at, depth)) && sum.every((x) => positive(x, at, depth) || nonneg(x, at, depth));
    const prod = split(e, "*/");
    if (prod.length > 1) return prod.every((x) => positive(x, at, depth));
    const base = /^(\w+)(?:\.[a-z]+)?$/.exec(e);
    if (!base) return false;
    if (consts.has(base[1])) return true;
    const prev = depth < 2 && e === base[1] ? lastAssign(e, at) : null;
    return prev ? positive(prev, at, depth + 1) : false;
  };
  // nonneg(e): e cannot be negative
  const nonneg = (e, at, depth = 0) => {
    e = unwrap(e);
    if (positive(e, at, depth) || (NUM.test(e) && parseFloat(e) >= 0)) return true;
    let a;
    if (call(e, "abs|clamp|smoothstep|fract|length|sqrt|exp|step" + (opts.nonnegFns ? "|" + opts.nonnegFns.join("|") : ""))) return true;
    if ((a = call(e, "max"))) return a.some((x) => nonneg(x, at, depth));
    if ((a = call(e, "dot"))) return a[0] === a[1];
    const prod = split(e, "*");
    if (prod.length === 2 && prod[0] === prod[1]) return true;
    if (prod.length > 1) return prod.every((x) => nonneg(x, at, depth));
    const prev = depth < 2 && /^\w+$/.test(e) ? lastAssign(e, at) : null;
    return prev ? nonneg(prev, at, depth + 1) : false;
  };

  for (const m of s.matchAll(/uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+(\w+)\s*;/g)) if ((s.match(new RegExp(`\\b${m[1]}\\b`, "g")) || []).length < 2) add("unused-uniform", m.index);
  for (const m of s.matchAll(new RegExp(`(?:^|[;}\\n])\\s*(?:${TYPES})\\s+(\\w+)\\s*\\([^)]*\\)\\s*\\{`, "g"))) {
    if (m[1] !== "main" && (s.match(new RegExp(`\\b${m[1]}\\s*\\(`, "g")) || []).length < 2) add("unused-function", m.index + m[0].indexOf(m[1]));
  }
  if (!/gl_Position/.test(s) && /\bfloat\b/.test(s) && !/precision\s+(highp|mediump|lowp)\s+float/.test(s)) out.push({ rule: "no-precision", line: 1, text: lines[0].trim() });
  for (const m of s.matchAll(/\b(lowp|mediump)\b/g)) add("low-precision", m.index);
  for (const m of s.matchAll(/(?<![\w.])(\d+\.\d*|\.\d+)(?:[eE][-+]?\d+)?/g)) if (m[1].replace(".", "").replace(/^0+/, "").replace(/0+$/, "").length > 9) add("literal-precision", m.index);
  for (const m of s.matchAll(/fract\s*\(\s*sin\s*\(/g)) add("sin-hash", m.index);
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "/") continue;
    const den = s[i + 1] === "=" ? s.slice(i + 2, s.indexOf(";", i)) : primary(s, i + 1);
    if (!positive(den.replace(/^\s*-/, ""), i)) add("div", i);
  }
  for (const m of s.matchAll(/(?<![\w.])(sqrt|inversesqrt|log2|log|pow|acos|asin|normalize)\s*\(/g)) {
    const o = m.index + m[0].length - 1, args = split(s.slice(o + 1, close(s, o)), ","), f = m[1], a = unwrap(args[0]);
    if (f === "sqrt" && !nonneg(a, o)) add("sqrt", m.index);
    else if ((f === "log" || f === "log2" || f === "inversesqrt") && !positive(a, o)) add("log", m.index);
    else if (f === "pow" && !nonneg(a, o)) add("pow", m.index);
    else if ((f === "acos" || f === "asin") && !call(a, "clamp") && !(NUM.test(a) && parseFloat(a) <= 1)) add("acos", m.index);
    else if (f === "normalize") {
      const v = call(a, "vec[234]"), lit = (x) => NUM.test(x.replace(/^-/, "")) && parseFloat(x.replace(/^-/, "")) !== 0;
      if (!(v && v.some(lit)) && !split(a, "+").slice(1).some(lit)) add("normalize", m.index);
    }
  }
  return out.sort((p, q) => p.line - q.line || (p.rule < q.rule ? -1 : 1));
}

// the shaders this repo ships, and the names the callers keep non-zero (field.js sets uRes from the canvas size)
export const NONZERO = ["uRes", "uTiles", "uFocal", "uIor", "uMarch"], NONNEG_FNS = ["hash", "n3", "jit", "lum"];
export async function shaders() {
  const m = { ...(await import("./scene.glsl.js")), ...(await import("./atmosphere.glsl.js")), ...(await import("./upscale.glsl.js")) };
  return Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === "string" && v.includes("#version")));
}
export const key = (f) => `${f.rule} | ${f.text}`;
export async function findings() {
  const out = {};
  for (const [name, src] of Object.entries(await shaders())) out[name] = lint(src, { nonzero: NONZERO, nonnegFns: NONNEG_FNS }).map(key);
  return out;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const f = await findings();
  if (process.argv.includes("--write")) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(new URL("./glsl-lint.baseline.json", import.meta.url), JSON.stringify(f, null, 1) + "\n");
  }
  for (const [n, l] of Object.entries(f)) { console.log(`${n}: ${l.length} findings`); for (const x of l) console.log("  " + x); }
}
