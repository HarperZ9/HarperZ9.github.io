// findings-math.mjs: the papers' maths, a small subset of LaTeX, written out as MathML Core, which the reading
// browsers draw natively and screen readers speak. The subset is what the findings papers use: \frac, \sqrt,
// sums, products and integrals, function names, Greek letters, a few relations, sub- and superscripts and braces.
// A letter run of two or more (max, DQE, fit) is one upright name; a single letter is an italic variable.
// Anything outside the subset throws, so a new construct is noticed at build time, never drawn wrong.

const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ",
  upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ",
  Lambda: "Λ", Xi: "Ξ", ell: "ℓ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};
const OPS = { approx: "≈", ge: "≥", geq: "≥", le: "≤", leq: "≤", pm: "±", to: "→", cdot: "·", times: "×", neq: "≠",
  sim: "∼", in: "∈", ldots: "…", cdots: "⋯", mid: "|", infty: "∞", partial: "∂", rightarrow: "→" };
const LARGE = { sum: "∑", prod: "∏", int: "∫" };
const FUNCS = new Set(["ln", "log", "exp", "max", "min", "sin", "cos", "tan", "var", "det", "arg"]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function tokens(src) {
  const out = [];
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "\\") {
      const m = src.slice(i + 1).match(/^[A-Za-z]+/);
      if (m) { out.push({ t: "cmd", v: m[0] }); i += 1 + m[0].length; } else { out.push({ t: "sym", v: src[i + 1] }); i += 2; }
    } else if (/[0-9.]/.test(c)) {
      const m = src.slice(i).match(/^[0-9]+(?:\.[0-9]+)?|^\.[0-9]+|^\./)[0];
      out.push(m === "." ? { t: "op", v: "." } : { t: "num", v: m }); i += m.length;
    } else if (/[A-Za-z]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-z]+/)[0]; out.push({ t: "word", v: m }); i += m.length;
    } else { out.push({ t: c === "{" || c === "}" || c === "^" || c === "_" ? c : "op", v: c }); i++; }
  }
  return out;
}

class Parser {
  constructor(src, display) { this.k = tokens(src); this.i = 0; this.display = display; this.src = src; }
  peek() { return this.k[this.i]; }
  fail(why) { throw new Error(`maths: ${why} in "${this.src}"`); }
  list(stop) {
    const out = [];
    while (this.i < this.k.length && !(stop && this.peek().t === "}")) out.push(this.scripted());
    if (stop) { if (!this.peek()) this.fail("unclosed brace"); this.i++; }
    return out;
  }
  group() {
    const t = this.k[this.i++];
    if (!t) this.fail("missing argument");
    if (t.t === "{") return `<mrow>${this.list(true).join("")}</mrow>`;
    this.i--; return this.atom();
  }
  scripted() {
    const base = this.atom(), large = /^<mo largeop/.test(base);
    let sub = null, sup = null;
    while (this.peek() && (this.peek().t === "_" || this.peek().t === "^")) {
      const which = this.k[this.i++].t;
      if (which === "_") sub = this.group(); else sup = this.group();
    }
    const u = large && this.display;
    if (sub && sup) return u ? `<munderover>${base}${sub}${sup}</munderover>` : `<msubsup>${base}${sub}${sup}</msubsup>`;
    if (sub) return u ? `<munder>${base}${sub}</munder>` : `<msub>${base}${sub}</msub>`;
    if (sup) return u ? `<mover>${base}${sup}</mover>` : `<msup>${base}${sup}</msup>`;
    return base;
  }
  atom() {
    const t = this.k[this.i++];
    if (!t) this.fail("ends early");
    if (t.t === "{") return `<mrow>${this.list(true).join("")}</mrow>`;
    if (t.t === "num") return `<mn>${t.v}</mn>`;
    if (t.t === "word") return t.v.length === 1 ? `<mi>${t.v}</mi>` : `<mi mathvariant="normal">${esc(t.v)}</mi>`;
    if (t.t === "sym") return t.v === "," || t.v === ";" || t.v === "!" || t.v === " " ? "" : `<mo>${esc(t.v)}</mo>`;
    if (t.t === "op") return `<mo>${t.v === "-" ? "−" : t.v === "'" ? "′" : esc(t.v)}</mo>`;
    if (t.t === "cmd") return this.command(t.v);
    return this.fail(`unexpected ${t.t}`);
  }
  command(name) {
    if (name === "frac") { const a = this.group(), b = this.group(); return `<mfrac>${a}${b}</mfrac>`; }
    if (name === "sqrt") return `<msqrt>${this.group()}</msqrt>`;
    if (name === "text" || name === "mathrm" || name === "operatorname") {
      const t = this.k[this.i++]; if (!t || t.t !== "{") this.fail(`\\${name} needs braces`);
      const words = []; while (this.peek() && this.peek().t !== "}") words.push(this.k[this.i++].v); this.i++;
      return `<mtext>${esc(words.join(" "))}</mtext>`;
    }
    if (name === "left" || name === "right") return "";
    if (GREEK[name]) return `<mi>${GREEK[name]}</mi>`;
    if (OPS[name]) return name === "infty" || name === "partial" ? `<mi>${OPS[name]}</mi>` : `<mo>${OPS[name]}</mo>`;
    if (LARGE[name]) return `<mo largeop="true" movablelimits="${this.display ? "false" : "true"}">${LARGE[name]}</mo>`;
    if (FUNCS.has(name)) return `<mi mathvariant="normal">${name}</mi><mo>&#x2061;</mo>`;
    return this.fail(`unknown command \\${name}`);
  }
}

// mathml("\\frac{a}{b}", false) -> an inline <math>; display true gives a block equation
export function mathml(src, display = false) {
  const p = new Parser(src, display);
  const body = p.list(false).join("");
  return `<math${display ? ' display="block"' : ""}><mrow>${body}</mrow></math>`;
}

// the source as plain words, for a page's description or a search index: no markup, no backslashes
export function mathText(src) {
  return src.replace(/\\(frac|sqrt|left|right|text|mathrm)/g, "").replace(/\\([A-Za-z]+)/g, (m, n) => GREEK[n] || OPS[n] || LARGE[n] || n)
    .replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}
