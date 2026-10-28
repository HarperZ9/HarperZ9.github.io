// forge/family/extras.mjs
// Letters that are not a base plus a mark: the ligatured, barred and slashed forms of Latin-1 and
// Latin Extended-A. Most reuse a base drawing and add one stroke.

import { Path, arc, PI, S, stem, bar, diag, box, ringBox, shift, extent, boxAngle, heavy, xform } from "./kit.mjs";
import { LOWER_A_M, hook } from "./lower.mjs";
import { LOWER_N_Z } from "./lower2.mjs";
import { UPPER } from "./upper.mjs";

const L = { ...LOWER_A_M, ...LOWER_N_Z };
const X = (def, cp, extra = {}) => ({ ...def, ...extra, unicode: cp });
const add = (def, ...strokes) => ({ ...def, strokes: [...def.strokes, ...strokes] });
const right = (def) => extent(def).x1;

// A crossing bar through a stem at x, from x - a to x + b.
const crossbar = (k, x, y, a, b) => bar(x - a, x + b, y, { scale: 0.9 });

function germandbls(k, d) {
  const xl = k.V / 2, W = d.Wn * 1.02, top = k.asc + k.ov * 0.5 - k.H / 2, ym = k.xh * 0.70;
  const rxU = (W * 0.86 - xl) / 2, cxU = xl + rxU, ryU = (top - ym) / 2, cyU = ym + ryU;
  const ryL = (ym - (-k.ov + k.H / 2)) / 2, cyL = ym - ryL, rxL = W - k.V / 2 - cxU + rxU * 0.0;
  const p = new Path(xl, 0).L(xl, cyU).A(cxU, cyU, rxU, ryU, k.n, PI, -0.5 * PI).A(cxU, cyL, Math.max(rxL, rxU), ryL, k.n, 0.5 * PI, -0.72 * PI);
  return { strokes: [S(p)], sb: ["H", "O"] };
}

function ae(k, d) {
  const a = L.a(k, d), e = L.e(k, d), ax = right(a) - k.V * 0.15;
  return { strokes: [...a.strokes, ...shift(e, ax, 0).strokes], sb: ["o", "o"] };
}
function oe(k, d) {
  const o = L.o(k, d), e = L.e(k, d), ox = right(o) - k.V * 0.15;
  return { strokes: [...o.strokes, ...shift(e, ox, 0).strokes], sb: ["O", "o"] };
}
function oslash(k, d) { const o = L.o(k, d), W = right(o); return add(o, diag(-W * 0.02, -k.xh * 0.06, W * 1.02, k.xh * 1.06, { cap: {}, scale: 0.86 })); }
function eth(k, d) {
  const W = d.Wo, o = ringBox(k, 0, W, -k.ov, k.xh * 1.04);
  const b = box(k, -W * 0.2, W, -k.ov, k.asc);
  const hv = heavy(k), sweep = S(arc(b.cx, b.cy, b.rx, b.ry, 2.2, 0.0, 0.62 * PI), { scale: 1 - 0.12 * hv });
  // The bar crosses the sweep where it rises past the x-height, centred on it and thinner at heavy
  // weights, so bar and sweep read as two strokes instead of one blot.
  const yc = k.xh + (k.asc - k.xh) * (0.52 - 0.10 * hv), tc = boxAngle(k, { ...b, n: 2.2 }, 0, 0.62 * PI, 1, yc);
  const sx = b.cx + b.rx * Math.sign(Math.cos(tc)) * Math.abs(Math.cos(tc)) ** (2 / 2.2), hw = W * (0.30 - 0.04 * hv);
  return { strokes: [o, sweep, diag(sx - hw, yc - W * 0.05, sx + hw, yc + W * 0.05, { cap: {}, scale: 0.84 - 0.24 * hv })], sb: ["O", "O"] };
}
function thorn(k, d) { const p = L.p(k, d); return { ...p, strokes: [stem(k.V / 2, k.desc, k.asc), ...p.strokes.slice(1)] }; }
function lslash(k, d) { const l = L["l.ss02"](k, d); return { ...add(l, diag(-k.V * 0.9, k.xh * 0.42, k.V * 1.9, k.xh * 0.84, { cap: {}, scale: 0.86 })), sb: ["T", "T"] }; }
function dcroat(k, d) { const g = L.d(k, d), x = d.Wo - k.V / 2; return add(g, crossbar(k, x, k.asc - k.V * 1.1, d.cn * 0.30, k.V * 1.2)); }
function hbar(k, d) { const g = L.h(k, d); return add(g, crossbar(k, k.V / 2, k.asc - k.V * 1.1, k.V * 1.1, d.cn * 0.36)); }
function eng(k, d) {
  const xr = d.Wn - k.V / 2, yc = k.xh * 0.5, top = k.xh + k.ov * 0.5, rx = (xr - k.V / 2) / 2, ry = top - k.H / 2 - yc;
  const archS = S(arc(k.V / 2 + rx, yc, rx, ry, k.n, PI, 0), { taper: { a: [0.42, 0.22] } });
  return { strokes: [stem(k.V / 2, 0, k.xh), archS, hook(k, xr, yc, -k.xh * 0.04, rx * 0.8, -0.8 * PI)], sb: ["H", "H"] };
}
function kgreen(k, d) {
  const W = k.V + d.cn * 0.92, y0 = k.xh * 0.42;
  const arm = diag(k.V * 0.55, y0, W - k.V * 0.62, k.xh, { cap: { a: "n", b: "h" } });
  const leg = diag(k.V * 0.55 + (W - k.V * 1.2) * 0.38, y0 + (k.xh - y0) * 0.38, W - k.V * 0.55, 0, { cap: { a: "n", b: "h" } });
  return { strokes: [stem(k.V / 2, 0, k.xh), arm, leg], sb: ["H", "V"] };
}
function longs(k, d) { const f = L.f(k, d); return { ...f, strokes: [f.strokes[0]], sb: ["T", "o"] }; }
function tbar(k, d) { const t = L.t(k, d), x = k.V / 2 + d.cn * 0.26; return add(t, crossbar(k, x, k.xh * 0.52, d.cn * 0.26 + k.V / 2, d.cn * 0.30 + k.V / 2)); }

// Schwa (Azerbaijani and others): the e turned through 180 degrees; the capital is the same drawing at
// cap height.
function schwa(k, d, cap = false) {
  const e = L.e(k, d), x = extent(e), cx = (x.x0 + x.x1) / 2, h = cap ? k.cap / k.xh : 1;
  return { ...xform(e, ([px, py]) => [2 * cx - px, (k.xh - py) * h]), sb: ["o", "O"], upper: cap };
}

function AE(k, d) {
  const xs = d.WH * 0.62, W = xs + d.WH * 0.62, e = k.V * 0.58;
  return { strokes: [diag(e, 0, xs + k.V * 0.1, k.cap, { cap: { a: "h", b: "h" } }), stem(xs + k.V * 0.5, 0, k.cap), bar(xs - k.V * 0.2, W, k.cap - k.H / 2),
    bar(xs + k.V * 0.5, W * 0.96, k.cap * 0.51), bar(xs + k.V * 0.5, W * 1.01, k.H / 2), bar(e + xs * 0.32, xs + k.V * 0.5, k.cap * 0.30)], sb: ["V", "T"], upper: true };
}
function OE(k, d) {
  const O = UPPER.O(k, d), E = UPPER.E(k, d), ox = right(O) - k.V * 0.6;
  return { strokes: [...O.strokes, ...shift(E, ox, 0).strokes], sb: ["O", "T"], upper: true };
}
function Oslash(k, d) { const O = UPPER.O(k, d), W = right(O); return add(O, diag(-W * 0.04, -k.cap * 0.06, W * 1.04, k.cap * 1.06, { cap: {}, scale: 0.86 })); }
function Eth(k, d) { const D = UPPER.D(k, d); return add(D, crossbar(k, k.V / 2, k.cap / 2, k.V * 1.2, d.cc * 0.32)); }
function Thorn(k, d) {
  const P = UPPER.P(k, d), lobe = P.strokes[1];
  const sh = { ...lobe, path: { ...lobe.path, meta: undefined, pts: lobe.path.pts.map(([x, y]) => [x, y - k.cap * 0.20]) } };
  return { ...P, strokes: [P.strokes[0], sh] };
}
function Hbar(k, d) { const H = UPPER.H(k, d), xr = d.WH - k.V / 2; return add(H, bar(-k.V * 0.3, xr + k.V * 0.8, k.cap * 0.76, { scale: 0.9 })); }
function Eng(k, d) {
  const xr = d.WH - k.V / 2, yc = k.cap * 0.55, top = k.cap + k.ovC * 0.5, rx = (xr - k.V / 2) / 2, ry = top - k.H / 2 - yc;
  const archS = S(arc(k.V / 2 + rx, yc, rx, ry, k.n, PI, 0), { taper: { a: [0.42, 0.22] } });
  return { strokes: [stem(k.V / 2, 0, k.cap), archS, hook(k, xr, yc, k.cap * 0.0, rx * 0.8, -0.8 * PI)], sb: ["H", "H"], upper: true };
}
function Tbar(k, d) { const T = UPPER.T(k, d), W = d.WH * 0.88; return add(T, bar(W * 0.22, W * 0.78, k.cap * 0.48, { scale: 0.9 })); }
function Lslash(k, d) { const Lg = UPPER.L(k, d); return add(Lg, diag(-k.V * 0.6, k.cap * 0.30, k.V * 2.0, k.cap * 0.62, { cap: {}, scale: 0.86 })); }

export const EXTRAS = {
  germandbls: (k, d) => X(germandbls(k, d), 0xdf), ae: (k, d) => X(ae(k, d), 0xe6), oe: (k, d) => X(oe(k, d), 0x153), oslash: (k, d) => X(oslash(k, d), 0xf8),
  eth: (k, d) => X(eth(k, d), 0xf0), thorn: (k, d) => X(thorn(k, d), 0xfe), lslash: (k, d) => X(lslash(k, d), 0x142), dcroat: (k, d) => X(dcroat(k, d), 0x111),
  hbar: (k, d) => X(hbar(k, d), 0x127), eng: (k, d) => X(eng(k, d), 0x14b), kgreenlandic: (k, d) => X(kgreen(k, d), 0x138), longs: (k, d) => X(longs(k, d), 0x17f),
  tbar: (k, d) => X(tbar(k, d), 0x167), uni0259: (k, d) => X(schwa(k, d), 0x259), uni018F: (k, d) => X(schwa(k, d, true), 0x18f),
  AE: (k, d) => X(AE(k, d), 0xc6), OE: (k, d) => X(OE(k, d), 0x152), Oslash: (k, d) => X(Oslash(k, d), 0xd8), Eth: (k, d) => X(Eth(k, d), 0xd0),
  Dcroat: (k, d) => X(Eth(k, d), 0x110), Thorn: (k, d) => X(Thorn(k, d), 0xde), Hbar: (k, d) => X(Hbar(k, d), 0x126), Eng: (k, d) => X(Eng(k, d), 0x14a),
  Tbar: (k, d) => X(Tbar(k, d), 0x166), Lslash: (k, d) => X(Lslash(k, d), 0x141),
};
