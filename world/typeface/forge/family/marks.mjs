// forge/family/marks.mjs
// Combining marks, drawn centred on x = 0 with zero advance. The lowercase set sits above the x-height;
// the .case set is flatter and sits above the cap height (also used over ascenders). Below-marks hang
// under the baseline. compose.mjs places them on letters by anchor.

import { Path, arc, PI, S, stem, bar, diag, dot, ringBox, smallK } from "./kit.mjs";
import { commaStrokes, dotR } from "./punct.mjs";

const M = (def, cp) => ({ ...def, unicode: cp, raw: true, advance: 0, mark: true });
const mh = (k, c) => (c ? 0.20 : 0.27) * k.xh;               // mark height
const my = (k, c) => (c ? k.cap + 0.07 * k.xh : k.xh + 0.11 * k.xh);   // mark baseline
const mk = (k) => ({ ...k, V: k.V * 0.86, H: k.H * 0.86 });

function acute(k, c, flip = false) {
  const h = mh(k, c), y = my(k, c), w = h * (c ? 1.1 : 0.82), s = flip ? -1 : 1;
  return { strokes: [S(new Path(-s * w / 2, y).L(s * w / 2, y + h), { V: k.V * 0.92, taper: { a: [0.7, 1] } })] };
}
function hat(k, c, inv) {
  const h = mh(k, c) * 0.92, y = my(k, c), w = h * (c ? 1.25 : 1.0);
  const [a, b] = inv ? [y + h, y] : [y, y + h];
  return { strokes: [S(new Path(-w, a).L(0, b).L(w, a), { V: k.V * 0.86, cap: { a: "h", b: "h" } })] };
}
function breve(k, c) { const h = mh(k, c), y = my(k, c), w = h * 1.05; return { strokes: [S(arc(0, y + h, w, h - k.H * 0.4, 2.2, PI, 2 * PI), { V: k.V * 0.86 })] }; }
function tilde(k, c) {
  const h = mh(k, c) * 0.7, y = my(k, c) + h * 0.5, w = h * 1.6, rx = w / 2, amp = h * 0.45;
  return { strokes: [S(arc(-rx, y, rx, amp, 2.2, PI, 0).A(rx, y, rx, amp, 2.2, PI, 2 * PI), { V: k.V * 0.8 })] };
}
function macron(k, c) { const h = mh(k, c), y = my(k, c) + h * 0.45, w = h * 1.15; return { strokes: [bar(-w, w, y, { V: k.V * 0.86 })] }; }
function dieresis(k, c) { const g = dotR(k) * 1.55, y = my(k, c) + dotR(k) * 1.05; return { fills: [dot(k, -g, y), dot(k, g, y)] }; }
function dotaccent(k, c) { return { fills: [dot(k, 0, my(k, c) + dotR(k) * 1.05)] }; }
function ring(k, c) { const s = smallK(mk(k), 0.5), h = mh(k, c) * (c ? 1.25 : 1.15), y = my(k, c) - (c ? 6 : 0); return { strokes: [{ ...ringBox(s, -h * 0.55, h * 0.55, y, y + h, 2.3), V: s.V, contrast: s.C }] }; }
function dblacute(k, c) {
  const a = acute(k, c), g = mh(k, c) * 0.62;
  const sh = (st, dx) => ({ ...st, path: { ...st.path, pts: st.path.pts.map(([x, y]) => [x + dx, y]) } });
  return { strokes: [sh(a.strokes[0], -g), sh(a.strokes[0], g)] };
}
function cedilla(k) {
  const h = 0.20 * k.xh;
  const q = new Path(k.V * 0.1, k.H * 0.4).L(k.V * 0.1, -h * 0.40).A(k.V * 0.1, -h * 0.40 - h * 0.42, h * 0.55, h * 0.42, 2.3, PI / 2, -0.85 * PI);
  return { strokes: [S(q, { V: k.V * 0.8 })] };
}
function ogonek(k) {
  const h = 0.24 * k.xh, p = new Path(0, k.H * 0.5).A(h * 0.6, k.H * 0.5, h * 0.6, h * 1.1, 2.2, PI, 1.62 * PI);
  return { strokes: [S(p, { V: k.V * 0.82, taper: { b: [0.55, 0.5] } })] };
}
function commabelow(k) { const r = dotR(k), c = commaStrokes(k, 0, -r * 1.9); return { ...c }; }
function dotbelow(k) { return { fills: [dot(k, 0, -dotR(k) * 2.1)] }; }
function commaturned(k) {
  const r = dotR(k), y = my(k, false) + r * 3.0, c = commaStrokes(k, 0, y - r * 1.2);
  const rot = (pts) => pts.map(([x, yy]) => [-x, 2 * (y - r * 1.2) - yy + r * 1.6]);
  return { strokes: c.strokes.map((st) => ({ ...st, path: { ...st.path, pts: rot(st.path.pts) } })), fills: c.fills.map((f) => ({ ...f, pts: rot(f.pts) })) };
}
// The vertical caron of d, l, t and L: a comma set beside the stem.
function caronalt(k) { const r = dotR(k), c = commaStrokes(k, 0, k.asc - r * 1.0); return { ...c }; }

const pair = (name, cp, fn) => ({ [name]: (k) => M(fn(k, false), cp), [`${name}.case`]: (k) => ({ ...M(fn(k, true), null) }) });

export const MARKS = {
  ...pair("uni0300", 0x300, (k, c) => acute(k, c, true)), ...pair("uni0301", 0x301, (k, c) => acute(k, c)),
  ...pair("uni0302", 0x302, (k, c) => hat(k, c, false)), ...pair("uni030C", 0x30c, (k, c) => hat(k, c, true)),
  ...pair("uni0306", 0x306, breve), ...pair("uni0303", 0x303, tilde), ...pair("uni0304", 0x304, macron),
  ...pair("uni0308", 0x308, dieresis), ...pair("uni0307", 0x307, dotaccent), ...pair("uni030A", 0x30a, ring), ...pair("uni030B", 0x30b, dblacute),
  uni0327: (k) => M(cedilla(k), 0x327), uni0328: (k) => M(ogonek(k), 0x328), uni0326: (k) => M(commabelow(k), 0x326),
  uni0323: (k) => M(dotbelow(k), 0x323), uni0312: (k) => M(commaturned(k), 0x312), caronalt: (k) => M(caronalt(k), null),
};

// Spacing forms: the mark with an advance, for the legacy code points.
export const SPACING = {
  grave: ["uni0300", 0x60], acute: ["uni0301", 0xb4], circumflex: ["uni0302", 0x2c6], caron: ["uni030C", 0x2c7], breve: ["uni0306", 0x2d8],
  tilde: ["uni0303", 0x2dc], macron: ["uni0304", 0xaf], dieresis: ["uni0308", 0xa8], dotaccent: ["uni0307", 0x2d9], ring: ["uni030A", 0x2da],
  hungarumlaut: ["uni030B", 0x2dd], cedilla: ["uni0327", 0xb8], ogonek: ["uni0328", 0x2db], asciicircum: ["uni0302.case", 0x5e],
};
