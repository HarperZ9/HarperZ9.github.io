// forge/family/figures.mjs
// Figures, drawn once as functions of their vertical box (y0 to y1), so the same drawing gives the
// lining set (0 to the figure height), the oldstyle set (x-height figures with ascenders and
// descenders) and the superior and inferior sets (small box, heavier relative stroke).

import { Path, arc, PI, S, stem, bar, diag, box, ringBox, boxAngle, heavy } from "./kit.mjs";

const fw = (k, d) => d.cc * 0.66 + k.V * (1.9 + 0.55 * heavy(k));   // the zero's ink width; the other figures follow it

export function zero(k, d, y0, y1, slash = false) {
  const W = fw(k, d) * 0.98, ov = k.ov, st = [ringBox(k, 0, W, y0 - ov, y1 + ov, k.n + 0.2)];
  if (slash) st.push(diag(W * 0.30, y0 + (y1 - y0) * 0.30, W * 0.70, y0 + (y1 - y0) * 0.70, { cap: {}, scale: 0.8 }));
  return { strokes: st, sb: ["O", "O"] };
}

export function one(k, d, y0, y1) {
  const W = fw(k, d), xs = W * 0.56, h = y1 - y0;
  const flag = S(new Path(xs - W * 0.56, y1 - h * 0.34).L(xs, y1), { cap: { a: "n", b: "n" } });
  // A foot under the 1 at text sizes: with the flag it keeps 1 apart from I and l.
  const st = [stem(xs, y0, y1), flag];
  return { strokes: st, sb: [st.length > 2 ? "T" : "T", st.length > 2 ? "T" : "H"], minW: W };
}

export function two(k, d, y0, y1) {
  const W = fw(k, d), h = y1 - y0, yt = y1 - h * 0.30;
  const b = box(k, W * 0.02, W, y1 - h * 0.60, y1 + k.ov);
  const t1 = -0.12 * PI, p = arc(b.cx, b.cy, b.rx, b.ry, b.n, 0.86 * PI, t1);
  const [ex, ey] = p.last;
  p.L(k.V * 0.5, y0 + k.H / 2 + k.V * 0.08).L(W, y0 + k.H / 2);
  void ex; void ey; void yt;
  return { strokes: [S(p)], sb: ["o", "o"] };
}

export function three(k, d, y0, y1) {
  const W = fw(k, d) * 0.98, h = y1 - y0, ym = y0 + h * 0.54;
  const nn = Math.min(k.n, 2.8);   // a squarer bowl breaks the waist join
  const u = box(k, W * 0.08, W * 0.94, ym - k.H / 2, y1 + k.ov, nn), lo = box(k, 0, W, y0 - k.ov, ym + k.H / 2, nn);
  const tw = (0.84 - 0.22 * heavy(k)) * PI;   // heavy weights wrap the terminals less, so the counters stay open
  const p = arc(u.cx, u.cy, u.rx, u.ry, u.n, tw, -PI / 2, 30);
  p.pts[p.pts.length - 1] = [lo.cx, ym];
  p.meta[p.meta.length - 1] = null;   // moved by hand: offset it as a plain point
  p.A(lo.cx, lo.cy, lo.rx, lo.ry, lo.n, PI / 2, -tw, { steps: 32 });
  return { strokes: [S(p)], sb: ["o", "O"] };
}

export function four(k, d, y0, y1) {
  const W = fw(k, d) * 1.04, h = y1 - y0, yb = y0 + h * 0.27, xs = W * 0.70;
  const p = new Path(xs - k.V * 0.1, y1 - k.H * 0.2).L(k.V * 0.45, yb).L(W, yb);
  return { strokes: [S(p, { cap: { a: "h" } }), stem(xs, y0, y1 - h * 0.18)], sb: ["V", "T"] };
}

export function five(k, d, y0, y1) {
  const W = fw(k, d) * 0.98, h = y1 - y0, xl = W * 0.12;
  const b = box(k, 0, W, y0 - k.ov, y0 + h * 0.62);
  const t0 = boxAngle(k, b, PI / 2, PI, 0, xl);
  const [sx, sy] = [xl, b.cy + b.ry * Math.abs(Math.sin(t0)) ** (2 / b.n)];
  const p = new Path(W * 0.92, y1 - k.H / 2).L(xl, y1 - k.H / 2).L(sx, sy).A(b.cx, b.cy, b.rx, b.ry, b.n, t0, -0.84 * PI, { corner: true, steps: 30 });
  return { strokes: [S(p)], sb: ["o", "O"] };
}

export function six(k, d, y0, y1) {
  const W = fw(k, d), h = y1 - y0, yb = y0 + h * 0.60;
  const b = box(k, 0, W, y0 - k.ov, yb);
  const big = box(k, 0, W * 1.02, y0 - k.ov, y1 + k.ov);
  const ry = (y1 + k.ov - k.H / 2) - b.cy;
  const sweep = S(arc(b.cx, b.cy, b.rx, ry, big.n, PI, 0.36 * PI));
  return { strokes: [ringBox(k, 0, W, y0 - k.ov, yb), sweep], sb: ["O", "o"] };
}

export function seven(k, d, y0, y1) {
  const W = fw(k, d), h = y1 - y0;
  const p = new Path(k.V * 0.1, y1 - k.H / 2).L(W - k.V * 0.45, y1 - k.H / 2).L(W * 0.30, y0);
  return { strokes: [S(p, { cap: { b: "h" } })], sb: ["T", "o"], _h: h };
}

export function eight(k, d, y0, y1) {
  const W = fw(k, d), h = y1 - y0, ym = y0 + h * 0.555, sc = 1 - 0.14 * heavy(k);
  return { strokes: [ringBox(k, W * 0.06, W * 0.94, ym - k.H * sc, y1 + k.ov, k.n, { scale: sc }), ringBox(k, 0, W, y0 - k.ov, ym, k.n, { scale: sc })], sb: ["O", "O"] };
}

export function nine(k, d, y0, y1) {
  const W = fw(k, d), h = y1 - y0, yb = y1 - h * 0.60;
  const b = box(k, 0, W, yb, y1 + k.ov);
  const ry = b.cy - (y0 - k.ov + k.H / 2);
  const sweep = S(arc(b.cx, b.cy, b.rx, ry, b.n, 0, -0.64 * PI));
  return { strokes: [ringBox(k, 0, W, yb, y1 + k.ov), sweep], sb: ["o", "O"] };
}

export const FIGS = [zero, one, two, three, four, five, six, seven, eight, nine];
export const FIG_NAMES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

// Oldstyle boxes: 0 1 2 on the x-height; 6 8 ascend; 3 4 5 7 9 descend.
export function osfBox(k, i) {
  const desc = k.desc * 0.78;
  if (i <= 2) return [0, k.xh];
  if (i === 6 || i === 8) return [0, k.fig * 0.98];
  return [desc, k.xh];
}

export const tabWidth = (k, d) => Math.round(fw(k, d) * 1.04 + 2 * k.sbCap * 0.62);
