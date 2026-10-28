// forge/family/punct.mjs
// Punctuation. Dots share the tittle's size; commas and quotes are the same wedge in four positions.

import { Path, arc, PI, S, stem, bar, diag, box, ringBox, arcBox, dot, xform, shift, axis, JOIN } from "./kit.mjs";
import { sShape } from "./lower2.mjs";

const r = (k) => Math.max(k.V * 0.66, 36);
const P = (def, cp) => ({ ...def, unicode: cp });

// The comma wedge: the dot with a tail leaving down and to the left, thinning to its end.
function commaStrokes(k, cx, cy) {
  const rr = r(k), tail = S(new Path(cx + rr * 0.35, cy).L(cx - rr * 0.95, cy - rr * 3.7), { taper: { b: [0.6, 0.9] }, scale: 1.12 });
  return { strokes: [tail], fills: [dot(k, cx, cy)] };
}
const turned = (def, cx, cy) => xform(def, ([x, y]) => [2 * cx - x, 2 * cy - y]);

function period(k) { return { fills: [dot(k, r(k), r(k))], sb: [k.sb * 0.7, k.sb * 0.7] }; }
function comma(k) { return { ...commaStrokes(k, r(k), r(k)), sb: [k.sb * 0.7, k.sb * 0.7] }; }
function colon(k) { return { fills: [dot(k, r(k), r(k)), dot(k, r(k), k.xh - r(k))], sb: [k.sb * 0.8, k.sb * 0.8] }; }
function semicolon(k) { const c = commaStrokes(k, r(k), r(k)); return { ...c, fills: [...c.fills, dot(k, r(k), k.xh - r(k))], sb: [k.sb * 0.8, k.sb * 0.8] }; }
function ellipsis(k) { const g = r(k) * 3.4; return { fills: [0, 1, 2].map((i) => dot(k, r(k) + i * g, r(k))), sb: [k.sb * 0.7, k.sb * 0.7] }; }

function exclam(k) {
  return { strokes: [stem(r(k), k.cap * 0.27, k.cap, { taper: { a: [0.72, 0.5] } })], fills: [dot(k, r(k), r(k))], sb: ["H", "H"] };
}
function question(k, d) {
  const W = d.cn * 0.92 + k.V * 1.4, yb = k.cap * 0.30, b = box(k, 0, W, k.cap * 0.42, k.cap + k.ovC);
  const p = arc(b.cx, b.cy, b.rx, b.ry, b.n, 0.88 * PI, -0.5 * PI).L(b.cx, yb, { smooth: true });
  return { strokes: [S(p)], fills: [dot(k, b.cx, r(k))], sb: ["o", "o"] };
}
const rot180 = (def, W, H) => xform(def, ([x, y]) => [W - x, H - y]);
function exclamdown(k) { return rot180(exclam(k), 2 * r(k), k.cap + k.desc * 0.9); }
function questiondown(k, d) { return rot180(question(k, d), d.cn * 0.92 + k.V * 1.4, k.cap + k.desc * 0.9); }

function quoteVert(k, n) {
  const g = k.V * 1.5, st = [];
  for (let i = 0; i < n; i++) st.push(stem(k.V / 2 + i * g, k.cap * 0.70, k.cap, { taper: { a: [0.7, 1] } }));
  return { strokes: st, sb: ["H", "H"] };
}
function quoteRight(k, n, y) {
  const rr = r(k), out = { strokes: [], fills: [] };
  for (let i = 0; i < n; i++) { const c = commaStrokes(k, rr + i * rr * 2.7, y); out.strokes.push(...c.strokes); out.fills.push(...c.fills); }
  return { ...out, sb: [k.sb * 0.6, k.sb * 0.6] };
}
function quoteLeft(k, n) {
  const rr = r(k), y = k.cap - rr * 0.9 - rr * 2.4, q = quoteRight(k, n, y);
  const W = rr * 2 + (n - 1) * rr * 2.7;
  return { ...turned(q, W / 2, y + rr * 0.6), sb: q.sb };
}

function hyphen(k, d) { return { strokes: [bar(0, d.cn * 0.62 + k.V * 0.6, axis(k))], sb: [k.sb * 0.8, k.sb * 0.8] }; }
function endash(k) { return { strokes: [bar(0, 500 - k.sb * 1.2, axis(k))], sb: [k.sb * 0.6, k.sb * 0.6] }; }
function emdash(k) { return { strokes: [bar(0, 1000 - k.sb * 0.8, axis(k))], sb: [k.sb * 0.4, k.sb * 0.4] }; }
function underscore(k, d) { return { strokes: [bar(0, d.Wn * 1.0, k.desc * 0.55)], sb: [0, 0] }; }

function paren(k, d, right) {
  const top = k.asc + 40, bot = k.desc + 20, W = d.cn * 0.5 + k.V;
  const b = box(k, 0, W * 2.4, bot, top, 2.2), t = 0.66 * PI;
  const s = S(arc(b.cx, b.cy, b.rx, b.ry, 2.2, t, 2 * PI - t));
  const def = { strokes: [s], sb: ["O", "o"] };
  return right ? { ...xform(def, ([x, y]) => [-x, y]), sb: ["o", "O"] } : def;
}
function bracket(k, d, right) {
  const top = k.asc + 40, bot = k.desc + 20, w = d.cn * 0.42 + k.V * 0.5;
  const p = new Path(w, top - k.H / 2).L(k.V / 2, top - k.H / 2).L(k.V / 2, bot + k.H / 2).L(w, bot + k.H / 2);
  const def = { strokes: [S(p)], sb: ["H", "T"] };
  return right ? { ...xform(def, ([x, y]) => [-x, y]), sb: ["T", "H"] } : def;
}
function brace(k, d, right) {
  const top = k.asc + 40, bot = k.desc + 20, mid = (top + bot) / 2, w = d.cn * 0.44 + k.V, xs = w * 0.52, rr = w * 0.48;
  const p = new Path(w, top - k.H / 2).L(xs + rr * 0.35, top - k.H / 2);
  p.L(xs, top - rr, { smooth: true }).L(xs, mid + rr * 0.6, { smooth: true }).L(k.V * 0.4, mid).L(xs, mid - rr * 0.6).L(xs, bot + rr, { smooth: true })
    .L(xs + rr * 0.35, bot + k.H / 2, { smooth: true }).L(w, bot + k.H / 2, { smooth: true });
  const def = { strokes: [S(p)], sb: ["o", "T"] };
  return right ? { ...xform(def, ([x, y]) => [-x, y]), sb: ["T", "o"] } : def;
}

function slash(k, d, back) {
  const W = d.cn * 0.82 + k.V, top = k.asc, bot = k.desc * 0.55;
  return { strokes: [back ? diag(0, top, W, bot) : diag(0, bot, W, top)], sb: ["V", "V"] };
}
function bar_(k) { return { strokes: [stem(k.V / 2, k.desc + 20, k.asc + 40)], sb: ["H", "H"] }; }
function brokenbar(k) { return { strokes: [stem(k.V / 2, k.desc + 20, axis(k) - 60), stem(k.V / 2, axis(k) + 60, k.asc + 40)], sb: ["H", "H"] }; }

function guil(k, d, n, right) {
  const w = d.cn * 0.36 + k.V * 0.5, h = k.xh * 0.42, y = axis(k) - k.xh * 0.04, st = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * (w * 0.92);
    st.push(S(new Path(x0 + w, y + h / 2).L(x0, y).L(x0 + w, y - h / 2), { scale: 0.86 }));
  }
  const def = { strokes: st, sb: [k.sb * 0.6, k.sb * 0.6] };
  return right ? xform(def, ([x, yy]) => [-x, yy]) : def;
}

function periodcentered(k) { return { fills: [dot(k, r(k), axis(k) + k.xh * 0.04)], sb: [k.sb * 0.8, k.sb * 0.8] }; }
function bullet(k) { const rr = r(k) * 1.5; return { fills: [dot(k, rr, axis(k) + k.xh * 0.04, 1.5)], sb: ["H", "H"] }; }

function dagger(k, d, dbl) {
  const W = d.cn * 0.82 + k.V, x = W / 2, st = [stem(x, k.desc * 0.7, k.cap), bar(0, W, k.cap * 0.70)];
  if (dbl) st.push(bar(0, W, k.cap * 0.10));
  return { strokes: st, sb: ["T", "T"] };
}

function section(k, d) {
  const W = d.Wo * 0.80, a = sShape(k, W, k.cap * 0.18, k.cap + k.ovC), b = sShape(k, W, k.desc * 0.55, k.cap * 0.62);
  return { strokes: [a, b], sb: ["o", "o"] };
}

export const PUNCT = {
  period: (k) => P(period(k), 0x2e), comma: (k) => P(comma(k), 0x2c), colon: (k) => P(colon(k), 0x3a), semicolon: (k) => P(semicolon(k), 0x3b),
  ellipsis: (k) => P(ellipsis(k), 0x2026), exclam: (k) => P(exclam(k), 0x21), question: (k, d) => P(question(k, d), 0x3f),
  exclamdown: (k) => P(exclamdown(k), 0xa1), questiondown: (k, d) => P(questiondown(k, d), 0xbf),
  quotesingle: (k) => P(quoteVert(k, 1), 0x27), quotedbl: (k) => P(quoteVert(k, 2), 0x22),
  quoteright: (k) => P(quoteRight(k, 1, k.cap - r(k)), 0x2019), quotedblright: (k) => P(quoteRight(k, 2, k.cap - r(k)), 0x201d),
  quoteleft: (k) => P(quoteLeft(k, 1), 0x2018), quotedblleft: (k) => P(quoteLeft(k, 2), 0x201c),
  quotesinglbase: (k) => P(quoteRight(k, 1, r(k)), 0x201a), quotedblbase: (k) => P(quoteRight(k, 2, r(k)), 0x201e),
  hyphen: (k, d) => P(hyphen(k, d), 0x2d), uni00AD: (k, d) => P(hyphen(k, d), 0xad), endash: (k) => P(endash(k), 0x2013), emdash: (k) => P(emdash(k), 0x2014),
  underscore: (k, d) => P(underscore(k, d), 0x5f),
  parenleft: (k, d) => P(paren(k, d, false), 0x28), parenright: (k, d) => P(paren(k, d, true), 0x29),
  bracketleft: (k, d) => P(bracket(k, d, false), 0x5b), bracketright: (k, d) => P(bracket(k, d, true), 0x5d),
  braceleft: (k, d) => P(brace(k, d, false), 0x7b), braceright: (k, d) => P(brace(k, d, true), 0x7d),
  slash: (k, d) => P(slash(k, d, false), 0x2f), backslash: (k, d) => P(slash(k, d, true), 0x5c), fraction: (k, d) => P(slash(k, d, false), 0x2044),
  bar: (k) => P(bar_(k), 0x7c), brokenbar: (k) => P(brokenbar(k), 0xa6),
  guillemetleft: (k, d) => P(guil(k, d, 2, false), 0xab), guillemetright: (k, d) => P(guil(k, d, 2, true), 0xbb),
  guilsinglleft: (k, d) => P(guil(k, d, 1, false), 0x2039), guilsinglright: (k, d) => P(guil(k, d, 1, true), 0x203a),
  periodcentered: (k) => P(periodcentered(k), 0xb7), bullet: (k) => P(bullet(k), 0x2022),
  dagger: (k, d) => P(dagger(k, d, false), 0x2020), daggerdbl: (k, d) => P(dagger(k, d, true), 0x2021),
  section: (k, d) => P(section(k, d), 0xa7),
};
export { commaStrokes, r as dotR };
