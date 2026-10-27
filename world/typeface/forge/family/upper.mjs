// forge/family/upper.mjs
// Capitals A to Z. Flat parts sit on 0 and k.cap; rounds overshoot by k.ovC.

import { Path, arc, PI, S, stem, bar, diag, box, ringBox, arcBox, boxAngle, JOIN } from "./kit.mjs";
import { sShape } from "./lower2.mjs";

const U = (def) => ({ ...def, upper: true });
const e = (k) => k.V * 0.58;          // diagonal inset at a flat cut

function A(k, d) {
  const W = d.cc * 1.10 + k.V * 1.9, x = W / 2, yb = k.cap * 0.30;
  const sl = (W / 2 - e(k)) / k.cap;
  return U({ strokes: [diag(e(k), 0, x, k.cap), diag(W - e(k), 0, x, k.cap), bar(e(k) + sl * yb + k.V * 0.2, W - e(k) - sl * yb - k.V * 0.2, yb)], sb: ["V", "V"] });
}

// Bowl for B, P, R and D: straight runs from the stem, a superellipse end on the right.
function lobe(k, x0, xr, y0, y1, n = k.n) {
  const yt = y1 - k.H / 2, yb = y0 + k.H / 2, ry = (yt - yb) / 2, rx = Math.min(ry * 1.05, (xr - x0) * 0.62), cx = xr - k.V / 2 - rx;
  return S(new Path(x0, yt).L(cx, yt, { smooth: true }).A(cx, (yt + yb) / 2, rx, ry, n, PI / 2, -PI / 2).L(x0, yb, { smooth: true }));
}

function B(k, d) {
  const W = d.WH * 0.86, ym = k.cap * 0.53;
  return U({ strokes: [stem(k.V / 2, 0, k.cap), lobe(k, k.V / 2, W * 0.93, ym - k.H / 2, k.cap), lobe(k, k.V / 2, W, 0, ym + k.H / 2)], sb: ["H", "O"] });
}

function C(k, d) {
  const t = (0.19 + 0.10 * k.ap) * PI;
  return U({ strokes: [arcBox(k, 0, d.WO * 0.93, -k.ovC, k.cap + k.ovC, t, 2 * PI - t)], sb: ["O", "o"] });
}

function D(k, d) {
  const W = d.WO * 0.94, yt = k.cap - k.H / 2, yb = k.H / 2, ry = (yt - yb) / 2, rx = W * 0.44, cx = W - k.V / 2 - rx;
  const p = new Path(k.V / 2, yt).L(cx, yt, { smooth: true }).A(cx, k.cap / 2, rx, ry, k.n + 0.3, PI / 2, -PI / 2).L(k.V / 2, yb, { smooth: true });
  return U({ strokes: [stem(k.V / 2, 0, k.cap), S(p)], sb: ["H", "O"] });
}

function E(k, d, mid = true, low = true) {
  const W = d.WH * 0.80, xs = k.V / 2, st = [stem(xs, 0, k.cap), bar(xs, W, k.cap - k.H / 2)];
  if (mid) st.push(bar(xs, W * 0.90, k.cap * 0.51));
  if (low) st.push(bar(xs, W * 1.02, k.H / 2));
  return U({ strokes: st, sb: ["H", "T"] });
}

function G(k, d) {
  const W = d.WO * 0.98, b = box(k, 0, W, -k.ovC, k.cap + k.ovC), t = (0.19 + 0.10 * k.ap) * PI, yb = k.cap * 0.46;
  const xr = b.cx + b.rx, tEnd = boxAngle(k, b, 1.6 * PI, 2 * PI, 1, Math.min(yb - k.V, b.cy - k.V * 0.3));
  const p = arc(b.cx, b.cy, b.rx, b.ry, b.n, t, tEnd, 46).L(xr, yb - k.H / 2 + k.V * 0.0, { smooth: true }).L(W * 0.54, yb - k.H / 2 + 0);
  return U({ strokes: [S(p)], sb: ["O", "H"] });
}

function H(k, d) {
  const xr = d.WH - k.V / 2;
  return U({ strokes: [stem(k.V / 2, 0, k.cap), stem(xr, 0, k.cap), bar(k.V / 2, xr, k.cap * 0.51)], sb: ["H", "H"] });
}

function I(k) { return U({ strokes: [stem(k.V / 2, 0, k.cap)], sb: ["H", "H"] }); }

function J(k, d) {
  const xr = d.cc * 0.62 + k.V, rx = (xr - k.V * 0.55) / 2, yt = k.cap * 0.30, ry = yt - (-k.ovC * 0.5 + k.H / 2);
  const p = new Path(xr, k.cap).L(xr, yt).A(xr - rx, yt, rx, ry, k.n, 0, -0.84 * PI);
  return U({ strokes: [S(p)], sb: ["o", "H"] });
}

function K(k, d) {
  const W = d.WH * 0.94, xa = W - e(k) - k.V * 0.1, y0 = k.cap * 0.30;
  const arm = diag(k.V * 0.6, y0, xa, k.cap, { cap: { a: "n", b: "h" } });
  const px = k.V * 0.6 + (xa - k.V * 0.6) * 0.38, py = y0 + (k.cap - y0) * 0.38;
  return U({ strokes: [stem(k.V / 2, 0, k.cap), arm, diag(px, py, W - e(k), 0, { cap: { a: "n", b: "h" } })], sb: ["H", "V"] });
}

function L(k, d) { return U({ strokes: [stem(k.V / 2, 0, k.cap), bar(k.V / 2, d.WH * 0.76, k.H / 2)], sb: ["H", "T"] }); }

function M(k, d) {
  const W = d.cc * 1.30 + k.V * 3.0, xl = k.V / 2, xr = W - k.V / 2, sc = k.mono ? 0.84 : 0.94;
  const xi = xl + k.V * 0.36, xj = xr - k.V * 0.36, vx = W / 2, vy = k.mono ? k.cap * 0.22 : 0;
  return U({ strokes: [stem(xl, 0, k.cap, { scale: sc }), stem(xr, 0, k.cap, { scale: sc }), diag(xi, k.cap, vx, vy, { scale: sc * 0.92 }), diag(xj, k.cap, vx, vy, { scale: sc * 0.92 })], sb: ["H", "H"] });
}

function N(k, d) {
  const W = d.WH * 1.02, xl = k.V / 2, xr = W - k.V / 2;
  return U({ strokes: [stem(xl, 0, k.cap), stem(xr, 0, k.cap), diag(xl + k.V * 0.34, k.cap, xr - k.V * 0.34, 0, { scale: 0.94 })], sb: ["H", "H"] });
}

function O(k, d) { return U({ strokes: [ringBox(k, 0, d.WO, -k.ovC, k.cap + k.ovC)], sb: ["O", "O"] }); }

function P(k, d) { return U({ strokes: [stem(k.V / 2, 0, k.cap), lobe(k, k.V / 2, d.WH * 0.86, k.cap * 0.44, k.cap)], sb: ["H", "O"] }); }

function Q(k, d) {
  const W = d.WO;
  return U({ strokes: [ringBox(k, 0, W, -k.ovC, k.cap + k.ovC), diag(W * 0.58, k.cap * 0.26, W * 0.98, -k.cap * 0.10, { cap: {} })], sb: ["O", "O"] });
}

function R(k, d) {
  const W = d.WH * 0.90, yj = k.cap * 0.45;
  return U({ strokes: [stem(k.V / 2, 0, k.cap), lobe(k, k.V / 2, W * 0.97, yj, k.cap), diag(W * 0.46, yj + k.H / 2, W - e(k) * 0.9, 0, { cap: { a: "n", b: "h" } })], sb: ["H", "V"] });
}

function S_(k, d) { return U({ strokes: [sShape(k, d.WH * 0.88, -k.ovC, k.cap + k.ovC)], sb: ["o", "o"] }); }

function T(k, d) {
  const W = d.WH * 0.88;
  return U({ strokes: [bar(0, W, k.cap - k.H / 2), stem(W / 2, 0, k.cap)], sb: ["T", "T"] });
}

function Uu(k, d) {
  const xl = k.V / 2, xr = d.WH - k.V / 2, yc = k.cap * 0.36, ry = yc - (-k.ovC * 0.5 + k.H / 2);
  const p = new Path(xl, k.cap).L(xl, yc).A((xl + xr) / 2, yc, (xr - xl) / 2, ry, k.n, PI, 2 * PI).L(xr, k.cap, { smooth: true });
  return U({ strokes: [S(p)], sb: ["H", "H"] });
}

function V_(k, d) {
  const W = d.cc * 1.08 + k.V * 1.9;
  return U({ strokes: [diag(e(k), k.cap, W / 2, 0), diag(W - e(k), k.cap, W / 2, 0)], sb: ["V", "V"] });
}

function W_(k, d) {
  const W = d.cc * 1.62 + k.V * 2.7, x2 = W / 2, x1 = (e(k) + x2) / 2, x3 = (x2 + W - e(k)) / 2, sc = k.mono ? 0.8 : 0.92;
  return U({ strokes: [diag(e(k), k.cap, x1, 0, { scale: sc }), diag(x2, k.cap, x1, 0, { scale: sc }), diag(x2, k.cap, x3, 0, { scale: sc }), diag(W - e(k), k.cap, x3, 0, { scale: sc })], sb: ["V", "V"] });
}

function X(k, d) {
  const W = d.cc * 1.0 + k.V * 1.8;
  return U({ strokes: [diag(e(k), k.cap, W - e(k), 0, { scale: 0.96 }), diag(e(k), 0, W - e(k), k.cap, { scale: 0.96 })], sb: ["V", "V"] });
}

function Y(k, d) {
  const W = d.cc * 1.0 + k.V * 1.8, ym = k.cap * 0.44;
  return U({ strokes: [diag(e(k), k.cap, W / 2, ym, { cap: { a: "h", b: "n" } }), diag(W - e(k), k.cap, W / 2, ym, { cap: { a: "h", b: "n" } }), stem(W / 2, 0, ym + k.V * 0.3)], sb: ["V", "V"] });
}

function Z(k, d) {
  const W = d.cc * 0.95 + k.V * 1.2, yt = k.cap - k.H / 2, yb = k.H / 2;
  return U({ strokes: [S(new Path(k.V * 0.15, yt).L(W - k.V * 0.5, yt).L(k.V * 0.5, yb).L(W, yb))], sb: ["o", "o"] });
}

export const UPPER = { A, B, C, D, E: (k, d) => E(k, d), F: (k, d) => E(k, d, true, false), G, H, I, J, K, L, M, N, O, P, Q, R, S: S_, T, U: Uu, V: V_, W: W_, X, Y, Z };
export { lobe };
