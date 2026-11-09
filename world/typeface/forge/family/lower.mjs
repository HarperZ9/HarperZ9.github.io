// forge/family/lower.mjs
// Lowercase a to m. Each entry is (k, d) => definition, where k is the weight context and d = dims(k).
// Ink sits on 0 and k.xh exactly for flat parts; rounds overshoot by k.ov.

import { Path, arc, PI, S, stem, bar, diag, box, ringBox, arcBox, boxAngle, dot, dotY, JOIN, heavy } from "./kit.mjs";

// The n arch: leaves the stem at xl (thin), turns over the x-height and comes down the right stem.
export function arch(k, xl, xr, yc, top, foot = 0) {
  const cx = (xl + xr) / 2, rx = (xr - xl) / 2, ry = top - k.H / 2 - yc;
  return S(arc(cx, yc, rx, ry, k.n, PI, 0).L(xr, foot, { smooth: true }), { taper: { a: JOIN() } });
}

// A bowl joined to a stem on its left (b, p) or right (d, q, g): an arc whose two ends sit in the stem.
export function sideBowl(k, x0, x1, y0, y1, stemSide) {
  const b = box(k, x0, x1, y0, y1);
  if (stemSide === "left") {
    const t = boxAngle(k, b, PI / 2, PI, 0, b.cx - b.rx + (k.joinDepth ?? 0.24) * k.V);
    return S(arc(b.cx, b.cy, b.rx, b.ry, b.n, t, -t, 44), { taper: { a: JOIN(0.46, 0.16), b: JOIN(0.46, 0.16) } });
  }
  const t = boxAngle(k, b, 0, PI / 2, 0, b.cx + b.rx - (k.joinDepth ?? 0.24) * k.V);
  return S(arc(b.cx, b.cy, b.rx, b.ry, b.n, t, 2 * PI - t, 44), { taper: { a: JOIN(0.46, 0.16), b: JOIN(0.46, 0.16) } });
}

// The l and t tail: down the stem, then a quarter turn to the right ending in a cut terminal.
export function tail(k, x, yTop, yTurn, rx, end = 1.72 * PI) {
  const ry = yTurn - (-k.ov * 0.5 + k.H / 2);
  return S(new Path(x, yTop).L(x, yTurn).A(x + rx, yTurn, rx, ry, k.n, PI, end));
}

// The descender hook of g, j and the eng: down a stem, then round to the left.
export function hook(k, x, yTop, yTurn, rx, end = -0.80 * PI) {
  const ry = yTurn - (k.desc - k.ov * 0.5 + k.H / 2);
  return S(new Path(x, yTop).L(x, yTurn).A(x - rx, yTurn, rx, ry, k.n, 0, end));
}

function aDouble(k, d) {
  const Wa = d.Wn * 0.95, xr = Wa - k.V / 2, yh = k.xh * 0.52;
  const rxh = (xr - k.V * 0.55) / 2, ryh = k.xh + k.ov * 0.6 - k.H / 2 - yh;
  const hookS = S(new Path(xr, 0).L(xr, yh).A(xr - rxh, yh, rxh, ryh, k.n, 0, 0.80 * PI));
  const b = box(k, 0, xr + k.V / 2, -k.ov, k.xh * 0.60);
  const tEnd = boxAngle(k, b, 1.5 * PI, 2 * PI, 0, xr - (k.joinDepth ?? 0.24) * k.V);
  const bowl = S(new Path(xr, b.cy + b.ry).L(b.cx, b.cy + b.ry).A(b.cx, b.cy, b.rx, b.ry, b.n, PI / 2, tEnd, { steps: 36 }), { taper: { b: JOIN(0.5, 0.14) } });
  return { strokes: [hookS, bowl], sb: ["o", "H"] };
}

// Single-storey a (stylistic set 1): a d bowl on an x-height stem.
function aSingle(k, d) {
  const W = d.Wo, xr = W - k.V / 2;
  return { strokes: [sideBowl(k, 0, W, -k.ov, k.xh + k.ov, "right"), stem(xr, 0, k.xh)], sb: ["O", "H"] };
}

function c(k, d) {
  const t = (0.20 + 0.12 * k.ap) * PI;
  return { strokes: [arcBox(k, 0, d.Wo * 0.94, -k.ov, k.xh + k.ov, t, 2 * PI - t)], sb: ["O", "C"] };
}

function e(k, d) {
  const W = d.Wo * 0.98, b = box(k, 0, W, -k.ov, k.xh + k.ov), ybar = k.xh * 0.52;
  // The bowl starts level with the bar's lower edge and the bar runs out to the bowl's outer edge, so
  // bar and bowl make one contour on the right side (no step where the bowl's cap meets the bar).
  const t0 = boxAngle(k, b, -PI / 4, PI / 2, 1, ybar - k.H / 2), te = 2 * PI - (0.15 + 0.10 * k.ap) * PI;
  const bowl = S(arc(b.cx, b.cy, b.rx, b.ry, b.n, t0, te, 50), { cap: { a: "h" } });   // flat, level with the bar's lower edge
  const tTop = boxAngle(k, { ...b, rx: b.rx + k.V / 2, ry: b.ry + k.H / 2 }, -PI / 4, PI / 2, 1, ybar + k.H / 2);
  const xOuter = b.cx + (b.rx + k.V / 2) * Math.cos(tTop) ** (2 / b.n);
  return { strokes: [bowl, bar(k.V * 0.5, xOuter, ybar)], sb: ["O", "o"] };
}

function f(k, d) {
  const xf = k.V / 2 + d.cn * 0.26, rx = d.cn * 0.40, top = k.asc + k.ov * 0.5 - k.H / 2, yf = top - rx * 1.1;
  const s = S(new Path(xf, 0).L(xf, yf).A(xf + rx, yf, rx, top - yf, k.n, PI, 0.30 * PI));
  return { strokes: [s, bar(0, xf + k.V / 2 + d.cn * 0.30, k.xh - k.H / 2)], sb: ["T", "T"], anchors: { top: xf } };
}

function g(k, d) {
  const W = d.Wo, xr = W - k.V / 2, rx = (xr - k.V * 0.6) / 2;
  return { strokes: [sideBowl(k, 0, W, -k.ov, k.xh + k.ov, "right"), hook(k, xr, k.xh, -k.xh * 0.04, rx)], sb: ["O", "H"] };
}

function h(k, d) {
  const xr = d.Wn - k.V / 2;
  return { strokes: [stem(k.V / 2, 0, k.asc), arch(k, k.V / 2, xr, k.xh * 0.5, k.xh + k.ov * 0.5)], sb: ["H", "H"], anchors: { top: k.V / 2 } };
}

const iStem = (k) => stem(k.V / 2, 0, k.xh);
function i(k) { return { strokes: [iStem(k)], fills: [dot(k, k.V / 2, dotY(k))], sb: ["H", "H"] }; }
function dotlessi(k) { return { strokes: [iStem(k)], sb: ["H", "H"] }; }

function jStroke(k, d) { return hook(k, k.V / 2, k.xh, -k.xh * 0.04, d.cn * 0.30, -0.78 * PI); }
function j(k, d) { return { strokes: [jStroke(k, d)], fills: [dot(k, k.V / 2, dotY(k))], sb: ["T", "H"], anchors: { top: k.V / 2 } }; }
function dotlessj(k, d) { return { strokes: [jStroke(k, d)], sb: ["T", "H"], anchors: { top: k.V / 2 } }; }

function kk(k, d) {
  const hv = heavy(k), W = k.V * (1 + 0.5 * hv) + d.cn * 0.98, xa = W - k.V * 0.62, y0 = k.xh * 0.30, sc = 1 - 0.16 * hv;
  const arm = diag(k.V * 0.55, y0, xa, k.xh, { cap: { a: "n", b: "h" }, scale: sc });
  const px = k.V * 0.55 + (xa - k.V * 0.55) * 0.40, py = y0 + (k.xh - y0) * 0.40;
  const leg = diag(px, py, W - k.V * 0.55, 0, { cap: { a: "n", b: "h" }, scale: sc });
  return { strokes: [stem(k.V / 2, 0, k.asc), arm, leg], sb: ["H", "V"], anchors: { top: k.V / 2 } };
}

// Tailed l: the tail is what keeps l apart from I and 1 at 12 px.
function l(k, d) { return { strokes: [tail(k, k.V / 2, k.asc, k.xh * 0.28, d.cn * 0.36, 1.66 * Math.PI)], sb: ["H", "o"], anchors: { top: k.V / 2 } }; }
function lPlain(k) { return { strokes: [stem(k.V / 2, 0, k.asc)], sb: ["H", "H"] }; }

function m(k, d) {
  const cm = d.cn * 0.80, x1 = k.V / 2, x2 = x1 + k.V + cm, x3 = x2 + k.V + cm, yc = k.xh * 0.5, top = k.xh + k.ov * 0.5;
  const sc = k.mono ? 0.86 : 0.97;
  return { strokes: [stem(x1, 0, k.xh, { scale: sc }), { ...arch(k, x1, x2, yc, top), scale: sc }, { ...arch(k, x2, x3, yc, top), scale: sc }], sb: ["H", "H"] };
}

function b_(k, d, low = 0, high = k.asc) {
  return { strokes: [stem(k.V / 2, low, high), sideBowl(k, 0, d.Wo, -k.ov, k.xh + k.ov, "left")], sb: ["H", "O"], anchors: { top: k.V / 2 } };
}
function d_(k, d, low = 0, high = k.asc) {
  const xr = d.Wo - k.V / 2;
  return { strokes: [sideBowl(k, 0, d.Wo, -k.ov, k.xh + k.ov, "right"), stem(xr, low, high)], sb: ["O", "H"], anchors: { top: xr } };
}

export const LOWER_A_M = {
  a: aDouble, "a.ss01": aSingle, b: (k, d) => b_(k, d), c, d: (k, d) => d_(k, d), e, f, g, h, i, dotlessi, j, dotlessj,
  k: kk, l, "l.ss02": lPlain, m,
  p: (k, d) => b_(k, d, k.desc, k.xh), q: (k, d) => d_(k, d, k.desc, k.xh),
};
