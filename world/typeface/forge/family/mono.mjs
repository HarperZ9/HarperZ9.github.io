// forge/family/mono.mjs
// The utility face's own drawings. In one cell, narrow letters need serifs to fill their space and to
// stay apart: I has two bars, l has a top serif and its tail, 1 has a flag and a foot, i and j carry a
// top serif. Combined with the slashed zero, Il1|i and O0 never collide in a hash or a receipt.

import { Path, arc, PI, S, stem, bar, dot, dotY } from "./kit.mjs";
import { tail, hook } from "./lower.mjs";

const C = 600;
const serif = (k) => C * 0.22;

function i(k) {
  const x = C / 2 + k.V * 0.2;
  return { strokes: [stem(x, 0, k.xh), bar(x - serif(k) - k.V / 2, x, k.xh - k.H / 2), bar(C * 0.20, C * 0.80, k.H / 2)], fills: [dot(k, x - k.V * 0.1, dotY(k))], anchors: { top: x } };
}
function dotlessi(k) { const g = i(k); return { ...g, fills: [] }; }
function j(k) {
  const x = C * 0.60;
  return { strokes: [hook(k, x, k.xh, -k.xh * 0.04, C * 0.24, -0.82 * PI), bar(x - serif(k) - k.V / 2, x, k.xh - k.H / 2)], fills: [dot(k, x, dotY(k))], anchors: { top: x } };
}
function dotlessj(k) { const g = j(k); return { ...g, fills: [] }; }
function l(k) {
  const x = C * 0.44;
  return { strokes: [tail(k, x, k.asc, k.xh * 0.32, C * 0.24), bar(x - serif(k) - k.V / 2, x, k.asc - k.H / 2)], anchors: { top: x } };
}
function I(k) { return { strokes: [stem(C / 2, 0, k.cap), bar(C * 0.22, C * 0.78, k.cap - k.H / 2), bar(C * 0.22, C * 0.78, k.H / 2)], upper: true }; }
function one(k) {
  const x = C * 0.52;
  return { strokes: [stem(x, 0, k.fig), S(new Path(x - C * 0.24, k.fig * 0.78).L(x, k.fig)), bar(C * 0.22, C * 0.80, k.H / 2)], unicode: 0x31 };
}
function r(k) {
  const x = C * 0.34, rx = C * 0.26, yc = k.xh * 0.46, ry = k.xh + k.ov * 0.5 - k.H / 2 - yc;
  return { strokes: [stem(x, 0, k.xh), S(arc(x + rx, yc, rx, ry, k.n, PI, 0.30 * PI), { taper: { a: [0.42, 0.22] } }), bar(C * 0.16, C * 0.66, k.H / 2), bar(C * 0.16, x, k.xh - k.H / 2)] };
}

export const MONO = { i, dotlessi, j, dotlessj, l, I, one, r };
