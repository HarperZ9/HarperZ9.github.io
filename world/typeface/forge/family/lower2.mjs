// forge/family/lower2.mjs
// Lowercase n to z.

import { Path, arc, PI, S, stem, bar, diag, box, ringBox, JOIN, heavy } from "./kit.mjs";
import { arch, tail } from "./lower.mjs";

function n(k, d) {
  const xr = d.Wn - k.V / 2;
  return { strokes: [stem(k.V / 2, 0, k.xh), arch(k, k.V / 2, xr, k.xh * 0.5, k.xh + k.ov * 0.5)], sb: ["H", "H"] };
}

function o(k, d) { return { strokes: [ringBox(k, 0, d.Wo, -k.ov, k.xh + k.ov)], sb: ["O", "O"] }; }

function r(k, d) {
  const rx = Math.max(d.cn * 0.39, k.V * 1.15), cx = k.V / 2 + rx, yc = k.xh * 0.48, ry = k.xh + k.ov * 0.5 - k.H / 2 - yc;
  const arm = S(arc(cx, yc, rx, ry, k.n, PI, 0.36 * PI), { taper: { a: JOIN() } });
  return { strokes: [stem(k.V / 2, 0, k.xh), arm], sb: ["H", "R"], anchors: { top: k.V / 2 + rx * 0.5 } };
}

// s as two stacked bowls sharing one centre line through the waist; the top bowl is narrower.
export function sShape(k, W, y0, y1, ap = k.ap) {
  const nn = Math.min(k.n, 2.35), ymid = y0 + (y1 - y0) * 0.515;
  const u = box(k, W * 0.05, W * 0.95, ymid - k.H / 2, y1, nn), lo = box(k, 0, W, y0, ymid + k.H / 2, nn);
  const ts = (0.17 + 0.10 * ap) * PI, tl = (0.17 + 0.10 * ap) * PI;
  const p = arc(u.cx, u.cy, u.rx, u.ry, nn, ts, 1.5 * PI).A(lo.cx, lo.cy, lo.rx, lo.ry, nn, PI / 2, -PI + tl);
  return S(p);
}
function s(k, d) { return { strokes: [sShape(k, d.Wo * 0.86, -k.ov, k.xh + k.ov)], sb: ["o", "o"] }; }

function t(k, d) {
  const xt = k.V / 2 + d.cn * 0.26, yTop = k.xh + (k.asc - k.xh) * 0.48;
  return { strokes: [tail(k, xt, yTop, k.xh * 0.30, d.cn * 0.36), bar(0, xt + k.V / 2 + d.cn * 0.34, k.xh - k.H / 2)], sb: ["T", "o"], anchors: { top: xt } };
}

function u(k, d) {
  const xl = k.V / 2, xr = d.Wn - k.V / 2, yc = k.xh * 0.5, ry = yc - (-k.ov * 0.5 + k.H / 2);
  const bowl = S(new Path(xl, k.xh).L(xl, yc).A((xl + xr) / 2, yc, (xr - xl) / 2, ry, k.n, PI, 2 * PI), { taper: { b: JOIN() } });
  return { strokes: [bowl, stem(xr, 0, k.xh)], sb: ["H", "H"] };
}

// v, w, x, y: diagonals cut flat on the baseline and the x-height, meeting in a flat vertex.
const inset = (k) => k.V * 0.58;
function v(k, d) {
  const hv = heavy(k), W = d.cn * 1.02 + k.V * (1.75 + 0.45 * hv), e = inset(k), sc = 0.96 - 0.12 * hv;
  return { strokes: [diag(e, k.xh, W / 2, 0, { scale: sc }), diag(W - e, k.xh, W / 2, 0, { scale: sc })], sb: ["V", "V"] };
}

function w(k, d) {
  const hv = heavy(k), W = d.cn * 1.52 + k.V * (2.55 + 0.8 * hv), e = inset(k), x2 = W / 2, x1 = (e + x2) / 2 + k.V * 0.04, x3 = (x2 + W - e) / 2 - k.V * 0.04;
  const sc = (k.mono ? 0.82 : 0.92) - 0.14 * hv;
  const ym = k.xh * 0.80;
  return { strokes: [diag(e, k.xh, x1, 0, { scale: sc }), diag(x2, ym, x1, 0, { scale: sc }), diag(x2, ym, x3, 0, { scale: sc }), diag(W - e, k.xh, x3, 0, { scale: sc })], sb: ["V", "V"] };
}

function x(k, d) {
  const W = d.cn * 0.96 + k.V * 1.62, e = inset(k);
  return { strokes: [diag(e, k.xh, W - e, 0, { scale: 0.96 }), diag(e, 0, W - e, k.xh, { scale: 0.96 })], sb: ["V", "V"] };
}

function y(k, d) {
  const W = d.cn * 1.02 + k.V * 1.75, e = inset(k), xm = W / 2 - k.V * 0.10, xr = W - e;
  // The tail runs straight to near the descender, then turns left in a short hook: at 12 px a straight
  // tail read as a comma to the OCR proxy; the hook makes the y.
  const yb = k.desc * 0.62, xd = xm - (xr - xm) / k.xh * -yb, rx = d.cn * 0.30, ry = yb - (k.desc + k.H / 2);
  const t = S(new Path(xr, k.xh).L(xd, yb).A(xd - rx, yb, rx, ry, 2.4, 0, -0.62 * PI, { corner: true }), { cap: { a: "h" }, scale: 0.96 });
  return { strokes: [diag(e, k.xh, xm, 0, { scale: 0.96 }), t], sb: ["V", "V"], anchors: { bottom: xm } };
}

function z(k, d) {
  const W = d.cn * 0.90 + k.V * 1.1, yt = k.xh - k.H / 2, yb = k.H / 2;
  const p = new Path(k.V * 0.1, yt).L(W - k.V * 0.45, yt).L(k.V * 0.45, yb).L(W, yb);
  return { strokes: [S(p)], sb: ["o", "o"] };
}

export const LOWER_N_Z = { n, o, r, s, t, u, v, w, x, y, z };
