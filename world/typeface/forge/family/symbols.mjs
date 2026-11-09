// forge/family/symbols.mjs
// Math, currency, arrows and the marks of a working document (#, %, &, @, (c), degree, pilcrow).
// Math signs share one width and centre on the math axis, so they line up in a column of tabular data.

import { Path, arc, PI, S, stem, bar, diag, box, ringBox, arcBox, dot, xform, shift, axis, smallK, dims, heavy } from "./kit.mjs";
import { sShape } from "./lower2.mjs";
import { LOWER_A_M } from "./lower.mjs";
import { LOWER_N_Z } from "./lower2.mjs";
import { UPPER } from "./upper.mjs";

const Y = (def, cp) => ({ ...def, unicode: cp });
// Math signs are short, so at full stroke they read heavier than letters; they draw at 88%.
const Ym = (def, cp) => ({ ...def, strokes: def.strokes.map((st) => ({ ...st, scale: (st.scale ?? 1) * 0.88 })), unicode: cp });
const mw = (k, d) => d.cn * 0.92 + k.V * 1.3;                 // math sign width
const MS = (k) => [k.sb * 0.9, k.sb * 0.9];

function plus(k, d) { const W = mw(k, d), a = axis(k); return { strokes: [bar(0, W, a), stem(W / 2, a - W / 2, a + W / 2)], sb: MS(k) }; }
function minus(k, d) { return { strokes: [bar(0, mw(k, d), axis(k))], sb: MS(k) }; }
function equal(k, d, slash = false) {
  const W = mw(k, d), a = axis(k), g = W * 0.22, st = [bar(0, W, a + g), bar(0, W, a - g)];
  if (slash) st.push(diag(W * 0.22, a - W * 0.5, W * 0.78, a + W * 0.5, { cap: {} }));
  return { strokes: st, sb: MS(k) };
}
function multiply(k, d) { const W = mw(k, d) * 0.84, a = axis(k), h = W / 2; return { strokes: [diag(0, a - h, W, a + h, { cap: {} }), diag(0, a + h, W, a - h, { cap: {} })], sb: MS(k) }; }
function divide(k, d) { const W = mw(k, d), a = axis(k); return { strokes: [bar(0, W, a)], fills: [dot(k, W / 2, a + W * 0.36, 0.9), dot(k, W / 2, a - W * 0.36, 0.9)], sb: MS(k) }; }
function plusminus(k, d) { const W = mw(k, d), a = axis(k) + W * 0.12; return { strokes: [bar(0, W, a), stem(W / 2, a - W * 0.42, a + W * 0.42), bar(0, W, a - W * 0.62)], sb: MS(k) }; }
function angle(k, d, right, under) {
  const W = mw(k, d), a = axis(k) + (under ? W * 0.14 : 0), h = W * 0.46;
  const st = [S(new Path(W, a + h).L(0, a).L(W, a - h))];
  if (under) st.push(bar(0, W, a - h - W * 0.26));
  const def = { strokes: st, sb: MS(k) };
  return right ? xform(def, ([x, y]) => [W - x, y]) : def;
}
function tildeShape(k, W, y, amp) {
  const rx = W / 4, p = arc(rx, y, rx, amp, 2.0, PI, 0).A(3 * rx, y, rx, amp, 2.0, PI, 2 * PI);
  return S(p, { scale: 0.9 });
}
function asciitilde(k, d) { return { strokes: [tildeShape(k, mw(k, d), axis(k), mw(k, d) * 0.17)], sb: MS(k) }; }
function approx(k, d) { const W = mw(k, d), a = axis(k); return { strokes: [tildeShape(k, W, a + W * 0.22, W * 0.14), tildeShape(k, W, a - W * 0.22, W * 0.14)], sb: MS(k) }; }
function logicalnot(k, d) { const W = mw(k, d), a = axis(k) + W * 0.1; return { strokes: [S(new Path(0, a).L(W - k.V / 2, a).L(W - k.V / 2, a - W * 0.4))], sb: MS(k) }; }
function radical(k, d) {
  const W = mw(k, d) * 1.1, top = k.cap + 20;
  return { strokes: [S(new Path(0, k.cap * 0.42).L(W * 0.22, k.cap * 0.50).L(W * 0.48, 0).L(W * 0.78, top).L(W * 1.1, top))], sb: MS(k) };
}
function infinity(k, d) { const W = mw(k, d) * 1.5, a = axis(k), h = W * 0.36; return { strokes: [ringBox(k, 0, W * 0.54, a - h / 2, a + h / 2, 2.2), ringBox(k, W * 0.46, W, a - h / 2, a + h / 2, 2.2)], sb: MS(k) }; }
function emptyset(k, d) { const W = d.Wo; return { strokes: [ringBox(k, 0, W, -k.ov, k.fig * 0.86), diag(-W * 0.04, -k.fig * 0.06, W * 1.04, k.fig * 0.92, { cap: {} })], sb: ["O", "O"] }; }
function wedge(k, d, down) {
  const W = mw(k, d), h = k.xh * 0.95, p = new Path(0, 0).L(W / 2, h).L(W, 0);
  const def = { strokes: [S(p, { cap: { a: "h", b: "h" } })], sb: MS(k) };
  return down ? xform(def, ([x, y]) => [x, h - y]) : def;
}
function abracket(k, d, right) {
  const top = k.asc + 40, bot = k.desc + 20, W = d.cn * 0.42 + k.V * 0.6;
  const def = { strokes: [S(new Path(W, top).L(0, (top + bot) / 2).L(W, bot), { cap: { a: "h", b: "h" } })], sb: ["T", "T"] };
  return right ? xform(def, ([x, y]) => [W - x, y]) : def;
}
function delta(k, d) { const W = d.WH * 0.98; return { strokes: [S(new Path(W / 2, k.cap).L(0, k.H / 2).L(W, k.H / 2).close())], sb: ["V", "V"] }; }
function diamondW(k, d) { const W = mw(k, d), a = axis(k), h = W * 0.6; const p = new Path(W / 2, a + h).L(0, a).L(W / 2, a - h).L(W, a).close(); p.kind = p.kind.map(() => "corner"); return { strokes: [S(p)], sb: MS(k) }; }
function prime(k, n) { const st = []; for (let i = 0; i < n; i++) st.push(diag(k.V * 0.9 + i * k.V * 1.5, k.cap * 0.68, k.V * 1.7 + i * k.V * 1.5, k.cap + 10, { cap: {}, taper: { a: [0.7, 1] } })); return { strokes: st, sb: [k.sb * 0.6, k.sb * 0.6] }; }

function dollar(k, d) {
  const W = d.Wo * 0.92, s = sShape(k, W, k.fig * 0.0 - k.ov, k.fig + k.ov);
  return { strokes: [s, stem(W / 2, -k.fig * 0.12, k.fig * 1.12, { scale: 0.8 })], sb: ["o", "o"] };
}
function cent(k, d) {
  const W = d.Wo * 0.92, t = 0.27 * PI;
  return { strokes: [arcBox(k, 0, W, k.fig * 0.06, k.fig * 0.84, t, 2 * PI - t), stem(W * 0.52, -k.fig * 0.04, k.fig * 0.94, { scale: 0.8 })], sb: ["O", "o"] };
}
function sterling(k, d) {
  const W = d.Wo * 0.98, xs = W * 0.30, rx = W * 0.30, yt = k.fig * 0.70, ry = k.fig + k.ov - k.H / 2 - yt;
  const p = new Path(xs, k.H).L(xs, yt).A(xs + rx, yt, rx, ry, k.n, PI, 0.18 * PI);
  return { strokes: [S(p), bar(0, W, k.H / 2), bar(k.V * 0.2, W * 0.66, k.fig * 0.44)], sb: ["H", "o"] };
}
function yen(k, d) {
  const W = d.cc + k.V * 1.8, ym = k.fig * 0.46, e = k.V * 0.58;
  return { strokes: [diag(e, k.fig, W / 2, ym, { cap: { a: "h" } }), diag(W - e, k.fig, W / 2, ym, { cap: { a: "h" } }), stem(W / 2, 0, ym), bar(W * 0.18, W * 0.82, ym - k.H * 0.4), bar(W * 0.18, W * 0.82, ym * 0.52)], sb: ["V", "V"] };
}
// The euro's bars keep a gap of at least 0.9 bar between them and stop a third of the way into the
// counter, so at heavy weights they never fuse with each other or fill the bowl.
function euro(k, d) {
  const W = d.WO * 0.92, t = 0.23 * PI, x0 = W * 0.14, b0 = arcBox(k, x0, W, -k.ov, k.fig + k.ov, t, 2 * PI - t);
  const hv = heavy(k), sc = 1 - 0.22 * hv, h = k.H * sc, mid = k.fig * 0.49, gap = Math.max(k.fig * 0.18 - h, 0.9 * h);
  const inner = x0 + k.V, counter = Math.max(0, W - k.V - inner), xe = inner + counter * 0.42 * (1 - Math.min(1, hv * 2));
  return { strokes: [b0, bar(0, xe, mid + (gap + h) / 2, { scale: sc }), bar(0, xe - W * 0.04, mid - (gap + h) / 2, { scale: sc })], sb: ["T", "o"] };
}
function currency(k, d) {
  const W = mw(k, d), a = axis(k), r0 = W * 0.34, c = W / 2, st = [ringBox(k, c - r0, c + r0, a - r0, a + r0)];
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) st.push(diag(c + sx * r0 * 0.7, a + sy * r0 * 0.7, c + sx * W * 0.5, a + sy * W * 0.5, { cap: {} }));
  return { strokes: st, sb: MS(k) };
}

function percent(k, d, mille = false) {
  const s = smallK(k, 0.5), w = d.cn * 0.42 + k.V, st = [ringBox(s, 0, w, k.fig * 0.56, k.fig), ringBox(s, w * 1.3, w * 2.3, 0, k.fig * 0.44), diag(w * 0.2, -10, w * 2.1, k.fig + 10, { scale: 0.85 })];
  if (mille) st.push(ringBox(s, w * 2.45, w * 3.45, 0, k.fig * 0.44));
  return { strokes: st, sb: ["O", "O"] };
}
function numbersign(k, d) {
  const W = d.cn * 0.9 + k.V * 1.3, h = k.fig, sl = W * 0.08;
  return { strokes: [diag(W * 0.30 + sl, h, W * 0.30 - sl, 0, { cap: {}, scale: 0.9 }), diag(W * 0.70 + sl, h, W * 0.70 - sl, 0, { cap: {}, scale: 0.9 }), bar(0, W, h * 0.66), bar(0, W, h * 0.32)], sb: MS(k) };
}
function asterisk(k, d) {
  const c = d.cn * 0.36 + k.V * 0.6, cy = k.cap - c, st = [];
  for (let i = 0; i < 3; i++) { const t = PI / 2 + i * PI / 3; st.push(S(new Path(c - Math.cos(t) * c, cy - Math.sin(t) * c).L(c + Math.cos(t) * c, cy + Math.sin(t) * c), { scale: 0.86 })); }
  return { strokes: st, sb: ["T", "T"] };
}
function ampersand(k, d) {
  const W = d.WH * 0.92, top = k.cap + k.ovC;
  const loop = ringBox(k, W * 0.10, W * 0.62, k.cap * 0.56, top, 2.3);
  const leg = diag(W * 0.26, k.cap * 0.62, W - k.V * 0.5, 0, { cap: { a: "n", b: "h" } });
  const b = box(k, 0, W * 0.80, -k.ovC, k.cap * 0.62, 2.4);
  const bowl = S(arc(b.cx, b.cy, b.rx, b.ry, b.n, 0.62 * PI, 1.94 * PI).L(W * 0.94, k.cap * 0.46, { smooth: true }));
  return { strokes: [loop, leg, bowl], sb: ["O", "V"] };
}
function at(k, d) {
  const W = d.WO * 1.12, top = k.cap + 40, bot = k.desc * 0.6, c = W / 2, a = (top + bot) / 2, ri = (top - bot) * 0.20;
  const inner = ringBox(k, c - ri * 1.1, c + ri * 0.9, a - ri, a + ri), xs = c + ri * 0.9 + k.V * 0.1;
  const b = box(k, 0, W, bot, top), t0 = -0.16 * PI;
  const outer = S(new Path(xs, a + ri).L(xs, a - ri * 0.8, { smooth: true }).L(b.cx + b.rx * 0.82, a - ri * 1.05).A(b.cx, b.cy, b.rx, b.ry, b.n, t0, 1.72 * PI, { corner: true }));
  return { strokes: [inner, outer], sb: ["O", "O"] };
}
function degree(k) { const w = k.cap * 0.30; return { strokes: [ringBox(smallK(k, 0.7), 0, w, k.cap - w, k.cap + 6)], sb: ["O", "O"] }; }
function pilcrow(k, d) {
  const W = d.cn * 0.95 + k.V * 1.4, xs1 = W * 0.60, xs2 = W - k.V / 2;
  const bowl = { pts: [], on: [] };
  for (let i = 0; i < 20; i++) { const t = PI / 2 + PI * i / 19; bowl.pts.push([xs1 + Math.cos(t) * xs1 * 0.98, k.cap * 0.72 + Math.sin(t) * k.cap * 0.28]); bowl.on.push(i === 0 || i === 19); }
  return { strokes: [stem(xs1, k.desc * 0.6, k.cap), stem(xs2, k.desc * 0.6, k.cap), bar(xs1, W, k.cap - k.H / 2)], fills: [bowl], sb: ["O", "H"] };
}
function enclosed(k, d, inner) {
  const W = d.WO * 1.16, st = [ringBox(k, 0, W, -k.ovC, k.cap + k.ovC, 2.2)];
  const s = smallK(k, 0.5), ds = dims(s), g = inner(s, ds), ex = (() => { let a = Infinity, b = -Infinity; for (const x of g.strokes) for (const [px] of x.path.pts) { a = Math.min(a, px); b = Math.max(b, px); } return [a, b]; })();
  const moved = shift(g, W / 2 - (ex[0] + ex[1]) / 2, k.cap * 0.25);
  return { strokes: [...st, ...moved.strokes.map((x) => ({ ...x, V: s.V, contrast: s.C }))], sb: ["O", "O"] };
}
function trademark(k, d) {
  const s = smallK(k, 0.42), ds = dims(s), T = UPPER.T(s, ds), M = UPPER.M(s, ds), tw = ds.WH * 0.88 + s.V;
  const up = k.cap - s.cap;
  const st = [...shift(T, 0, up).strokes, ...shift(M, tw + s.sbCap, up).strokes].map((x) => ({ ...x, V: s.V, contrast: s.C }));
  return { strokes: st, sb: ["T", "H"] };
}
function ordinal(k, d, ch) {
  const s = smallK(k, 0.62), ds = dims(s), g = (ch === "a" ? LOWER_A_M.a : LOWER_N_Z.o)(s, ds), up = k.cap - s.xh - s.ov;
  const m = shift(g, 0, up), w = ch === "a" ? ds.Wn * 0.95 : ds.Wo;
  return { strokes: [...m.strokes.map((x) => ({ ...x, V: s.V, contrast: s.C })), bar(0, w, up - k.xh * 0.18, { V: s.V })], sb: ["O", "O"] };
}
function micro(k, d) {
  const xl = k.V / 2, xr = d.Wn - k.V / 2, yc = k.xh * 0.5, ry = yc - (-k.ov * 0.5 + k.H / 2);
  const bowl = S(new Path(xl, k.xh).L(xl, yc).A((xl + xr) / 2, yc, (xr - xl) / 2, ry, k.n, PI, 2 * PI));
  return { strokes: [bowl, stem(xr, 0, k.xh), stem(xl, k.desc, yc)], sb: ["H", "H"] };
}
function halfring(k, left) {
  const r0 = k.V * 1.6, cy = k.cap - r0, p = arc(r0, cy, r0 * 0.7, r0, 2.2, left ? 0.5 * PI : 0.5 * PI, left ? 1.5 * PI : -0.5 * PI);
  return { strokes: [S(p, { scale: 0.9 })], sb: [k.sb * 0.5, k.sb * 0.5] };
}
function arrow(k, d, dir) {
  const W = d.cn * 1.6 + k.V * 1.8, a = axis(k), h = W * 0.30;
  const def = { strokes: [bar(0, W - k.V * 0.6, a), S(new Path(W - h, a + h).L(W, a).L(W - h, a - h))], sb: MS(k) };
  if (dir === "both") def.strokes.push(S(new Path(h, a + h).L(0, a).L(h, a - h)));
  const rot = { right: 0, left: PI, up: PI / 2, down: -PI / 2, both: 0, ne: PI / 4, se: -PI / 4, sw: -3 * PI / 4, nw: 3 * PI / 4, updown: PI / 2 }[dir];
  if (dir === "updown") def.strokes.push(S(new Path(h, a + h).L(0, a).L(h, a - h)));
  const c = [W / 2, a], cs = Math.cos(rot), sn = Math.sin(rot);
  return xform(def, ([x, y]) => [c[0] + (x - c[0]) * cs - (y - c[1]) * sn, c[1] + (x - c[0]) * sn + (y - c[1]) * cs]);
}
function boxH(k) { return { strokes: [bar(0, 600, axis(k), { V: k.V * 0.8 })], advance: 600, sb: [0, 0], free: true }; }
function boxV(k) { return { strokes: [stem(300, k.desc - 60, k.asc + 60, { V: k.V * 0.8 })], advance: 600, center: true, sb: [0, 0] }; }

export const SYMBOLS = {
  plus: (k, d) => Ym(plus(k, d), 0x2b), minus: (k, d) => Ym(minus(k, d), 0x2212), equal: (k, d) => Ym(equal(k, d), 0x3d), notequal: (k, d) => Ym(equal(k, d, true), 0x2260),
  multiply: (k, d) => Ym(multiply(k, d), 0xd7), divide: (k, d) => Ym(divide(k, d), 0xf7), plusminus: (k, d) => Ym(plusminus(k, d), 0xb1),
  less: (k, d) => Ym(angle(k, d, false, false), 0x3c), greater: (k, d) => Ym(angle(k, d, true, false), 0x3e),
  lessequal: (k, d) => Ym(angle(k, d, false, true), 0x2264), greaterequal: (k, d) => Ym(angle(k, d, true, true), 0x2265),
  asciitilde: (k, d) => Ym(asciitilde(k, d), 0x7e), approxequal: (k, d) => Ym(approx(k, d), 0x2248), logicalnot: (k, d) => Ym(logicalnot(k, d), 0xac),
  radical: (k, d) => Y(radical(k, d), 0x221a), infinity: (k, d) => Y(infinity(k, d), 0x221e), emptyset: (k, d) => Y(emptyset(k, d), 0x2205),
  logicaland: (k, d) => Y(wedge(k, d, false), 0x2227), logicalor: (k, d) => Y(wedge(k, d, true), 0x2228),
  uni27E8: (k, d) => Y(abracket(k, d, false), 0x27e8), uni27E9: (k, d) => Y(abracket(k, d, true), 0x27e9),
  uni2206: (k, d) => Y(delta(k, d), 0x2206), uni25C7: (k, d) => Y(diamondW(k, d), 0x25c7), minute: (k) => Y(prime(k, 1), 0x2032), second: (k) => Y(prime(k, 2), 0x2033),
  dollar: (k, d) => Y(dollar(k, d), 0x24), cent: (k, d) => Y(cent(k, d), 0xa2), sterling: (k, d) => Y(sterling(k, d), 0xa3), yen: (k, d) => Y(yen(k, d), 0xa5),
  Euro: (k, d) => Y(euro(k, d), 0x20ac), currency: (k, d) => Y(currency(k, d), 0xa4),
  percent: (k, d) => Y(percent(k, d), 0x25), perthousand: (k, d) => Y(percent(k, d, true), 0x2030), numbersign: (k, d) => Y(numbersign(k, d), 0x23),
  asterisk: (k, d) => Y(asterisk(k, d), 0x2a), ampersand: (k, d) => Y(ampersand(k, d), 0x26), at: (k, d) => Y(at(k, d), 0x40),
  degree: (k) => Y(degree(k), 0xb0), paragraph: (k, d) => Y(pilcrow(k, d), 0xb6),
  copyright: (k, d) => Y(enclosed(k, d, UPPER.C), 0xa9), registered: (k, d) => Y(enclosed(k, d, UPPER.R), 0xae), trademark: (k, d) => Y(trademark(k, d), 0x2122),
  ordfeminine: (k, d) => Y(ordinal(k, d, "a"), 0xaa), ordmasculine: (k, d) => Y(ordinal(k, d, "o"), 0xba), mu: (k, d) => Y(micro(k, d), 0xb5),
  uni02BF: (k) => Y(halfring(k, true), 0x2bf), uni02BE: (k) => Y(halfring(k, false), 0x2be),
  arrowright: (k, d) => Y(arrow(k, d, "right"), 0x2192), arrowleft: (k, d) => Y(arrow(k, d, "left"), 0x2190), arrowup: (k, d) => Y(arrow(k, d, "up"), 0x2191),
  arrowdown: (k, d) => Y(arrow(k, d, "down"), 0x2193), arrowboth: (k, d) => Y(arrow(k, d, "both"), 0x2194), arrowupdn: (k, d) => Y(arrow(k, d, "updown"), 0x2195),
  uni2197: (k, d) => Y(arrow(k, d, "ne"), 0x2197), uni2198: (k, d) => Y(arrow(k, d, "se"), 0x2198), uni2199: (k, d) => Y(arrow(k, d, "sw"), 0x2199), uni2196: (k, d) => Y(arrow(k, d, "nw"), 0x2196),
  uni2500: (k) => Y(boxH(k), 0x2500), uni2502: (k) => Y(boxV(k), 0x2502),
};
