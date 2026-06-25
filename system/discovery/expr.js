// expr.js: a SAFE, zero-dependency math-expression evaluator over a fixed variable set.
//
// NO eval and NO Function: tokenize -> shunting-yard -> RPN evaluation over an
// allowlisted token set. Any identifier that is neither an allowed variable nor a known
// function throws, so a model's submitted expression cannot reach JS internals. This is
// the seam through which a model proposes a candidate law as text and we evaluate it on
// perceived data. Supports numbers, the allowed variables, + - * / ^, unary +/-,
// parentheses, and the functions sin cos tan sqrt abs exp log.

// Null-prototype so `t in FUNCS` cannot match inherited names ("constructor",
// "__proto__", "toString", ...): the allowlist is exactly these own keys, nothing else.
const FUNCS = Object.assign(Object.create(null), {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, exp: Math.exp,
  sqrt: (x) => Math.sqrt(Math.abs(x)),       // total: never NaN on a negative argument
  log: (x) => Math.log(Math.abs(x) + 1e-12), // total
});
const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
const RIGHT_ASSOC = { "^": true };

function tokenize(src) {
  const tokens = [];
  const re = /\s*([0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/^,])/g;
  let m, last = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index !== last) throw new Error("bad token near: " + src.slice(last, m.index + 1));
    tokens.push(m[1]);
    last = re.lastIndex;
  }
  if (last !== src.length) throw new Error("unparsed input: " + JSON.stringify(src.slice(last)));
  return tokens;
}

const isNum = (t) => /^[0-9.]/.test(t);
const isName = (t) => /^[A-Za-z_]/.test(t);

// Compile `src` to Reverse Polish Notation over an allowlist. Throws on any unknown token.
export function toRPN(src, allowedVars) {
  const allowed = allowedVars instanceof Set ? allowedVars : new Set(allowedVars);
  const tokens = tokenize(src);
  const out = [], ops = [];
  let prev = "start"; // start | value | op | open
  for (const t of tokens) {
    if (isNum(t)) { out.push({ k: "num", v: parseFloat(t) }); prev = "value"; }
    else if (isName(t)) {
      if (t in FUNCS) { ops.push({ k: "fn", v: t }); prev = "op"; }
      else if (allowed.has(t)) { out.push({ k: "var", v: t }); prev = "value"; }
      else throw new Error("unknown identifier: " + t);
    }
    else if (t === ",") {
      while (ops.length && ops[ops.length - 1].v !== "(") out.push(ops.pop());
      prev = "op";
    }
    else if (t === "(") { ops.push({ k: "paren", v: "(" }); prev = "open"; }
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1].v !== "(") out.push(ops.pop());
      if (!ops.length) throw new Error("mismatched )");
      ops.pop();
      if (ops.length && ops[ops.length - 1].k === "fn") out.push(ops.pop());
      prev = "value";
    }
    else if (t === "+" || t === "-" || t === "*" || t === "/" || t === "^") {
      const unary = (t === "+" || t === "-") && (prev === "start" || prev === "op" || prev === "open");
      if (unary) {
        out.push({ k: "num", v: 0 });            // unary +/- as (0 +/- value)
        ops.push({ k: "op", v: t });
      } else {
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (top.k === "op" && (PREC[top.v] > PREC[t] || (PREC[top.v] === PREC[t] && !RIGHT_ASSOC[t]))) {
            out.push(ops.pop());
          } else break;
        }
        ops.push({ k: "op", v: t });
      }
      prev = "op";
    }
    else throw new Error("bad token: " + t);
  }
  while (ops.length) {
    const op = ops.pop();
    if (op.v === "(") throw new Error("mismatched (");
    out.push(op);
  }
  return out;
}

// Compile `src` to a pure numeric function of a state object {var: number, ...}.
export function makeFn(src, allowedVars) {
  const rpn = toRPN(src, allowedVars);
  return function (state) {
    const st = [];
    for (const tok of rpn) {
      if (tok.k === "num") st.push(tok.v);
      else if (tok.k === "var") { const v = state[tok.v]; st.push(typeof v === "number" ? v : NaN); }
      else if (tok.k === "fn") st.push(FUNCS[tok.v](st.pop()));
      else { // op
        const b = st.pop(), a = st.pop();
        st.push(tok.v === "+" ? a + b : tok.v === "-" ? a - b : tok.v === "*" ? a * b
          : tok.v === "/" ? a / (Math.abs(b) < 1e-12 ? (b < 0 ? -1e-12 : 1e-12) : b) : Math.pow(a, b));
      }
    }
    return st.length === 1 ? st[0] : NaN;
  };
}

// Relative variation of a quantity over a trajectory: (max - min) / (|mean| + eps).
// 0 means perfectly conserved; large means it changes. Infinity on any non-finite value.
export function variation(fn, states) {
  let min = Infinity, max = -Infinity, sum = 0, k = 0;
  for (const s of states) {
    const v = fn(s);
    if (!Number.isFinite(v)) return Infinity;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v; k++;
  }
  if (k === 0) return Infinity;
  return (max - min) / (Math.abs(sum / k) + 1e-9);
}
