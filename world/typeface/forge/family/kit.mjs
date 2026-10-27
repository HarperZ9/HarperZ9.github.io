// forge/family/kit.mjs
// Construction helpers shared by the glyph modules. Every helper takes ink positions (where the edge of
// the ink should land) and works out the centre line from the pen widths in the context k:
// V is the vertical stroke, H the horizontal one. That is what lets a glyph sit exactly on the baseline,
// the x-height and the cap height at every weight, with overshoot only where a round meets a line.
//
// The construction is engineering lettering (the stroke-built alphabets of DIN 1451 and ISO 3098 that
// labelled drawings, index cards and archive boxes), with superellipse rounds and open apertures.

import { Path, arc, se, seAngle, PI, poly } from "./path.mjs";
import { S } from "./pen.mjs";

export { Path, arc, se, seAngle, PI, S, poly };

// Measures every module reads. cn is the n counter; the other widths follow from it.
export function dims(k) {
  const cn = 0.555 * k.xh * k.cw * k.wd;
  const cc = 0.55 * k.cap * k.cw * k.wd;      // the H counter
  return { cn, cc, Wn: 2 * k.V + cn, Wo: 2 * k.V + cn * 1.12, WH: 2 * k.V + cc, WO: 2 * k.V + cc * 1.2 };
}

export const stem = (x, y0, y1, o = {}) => S(new Path(x, y0).L(x, y1), o);

// Horizontal bar whose ink runs exactly from x0 to x1, centred on y.
export const bar = (x0, x1, y, o = {}) => S(new Path(x0, y).L(x1, y), o);

// A diagonal cut flat at both ends (baseline, x-height, cap height): engineering-lettering vertices.
export const diag = (x0, y0, x1, y1, o = {}) => S(new Path(x0, y0).L(x1, y1), { cap: { a: "h", b: "h" }, ...o });

// Centre-line ellipse for an ink box. Returns the superellipse parameters.
export function box(k, x0, x1, y0, y1, n = k.n) {
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 - k.V / 2, ry: (y1 - y0) / 2 - k.H / 2, n };
}

// A closed bowl filling the ink box.
export function ringBox(k, x0, x1, y0, y1, n = k.n, o = {}) {
  const b = box(k, x0, x1, y0, y1, n);
  const p = arc(b.cx, b.cy, b.rx, b.ry, n, 0, 2 * PI).close();
  p.kind = p.kind.map(() => "curve");
  return S(p, o);
}

// An open arc over the ink box from angle t0 to t1 (counter-clockwise when t1 > t0).
export function arcBox(k, x0, x1, y0, y1, t0, t1, n = k.n, o = {}) {
  const b = box(k, x0, x1, y0, y1, n);
  return S(arc(b.cx, b.cy, b.rx, b.ry, n, t0, t1), o);
}

// Angle on the box's centre line where x (axis 0) or y (axis 1) reaches the target.
export function boxAngle(k, b, t0, t1, axis, target) {
  return seAngle(b.cx, b.cy, b.rx, b.ry, b.n, t0, t1, axis, target);
}

// A filled superellipse (dots, the tittle, periods). Drawn as an outline, not a stroke.
export function blob(cx, cy, rx, ry, n = 2.6) {
  const pts = [];
  for (let i = 0; i < 24; i++) pts.push(se(cx, cy, rx, ry, n, -2 * PI * i / 24));
  return { pts, on: pts.map(() => false) };
}

// The i and j tittle, and every other dot in the face, share one size so the face reads as one hand.
export function dot(k, cx, cy, scale = 1) {
  const r = Math.max(k.V * 0.66, 36) * scale;
  return blob(cx, cy, r, r, 2.8);
}

// How heavy the weight is for its x-height: 0 up to a stem of 0.18 x-height, 1 from 0.40. Heavy
// weights widen the crowded letters and thin their diagonals, so counters stay open at 900.
export const heavy = (k) => (globalThis.process?.env?.NO_HEAVY ? 0 : Math.min(1, Math.max(0, (k.V / k.xh - 0.18) / 0.22)));

export const dotY = (k) => k.xh + (k.asc - k.xh) * 0.66;

// Junction thinning for an arch or bowl that leaves a stem: thin at the join, full by 22% of the run.
export const JOIN = (f = 0.42, len = 0.22) => [f, len];

// Map every centre-line and fill point of a definition through f (rotate, mirror, shift, scale).
// Winding is restored later by the pen, so a mirror needs no special care.
export function xform(def, f) {
  const strokes = (def.strokes || []).map((st) => ({ ...st, path: { ...st.path, meta: undefined, pts: st.path.pts.map(f) } }));
  const fills = (def.fills || []).map((fl) => ({ pts: fl.pts.map(f), on: fl.on }));
  return { ...def, strokes, fills };
}

export const shift = (def, dx, dy) => xform(def, ([x, y]) => [x + dx, y + dy]);

// Ink extent of a definition's centre lines (good enough to place a sub-drawing).
export function extent(def) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const st of def.strokes || []) for (const [x, y] of st.path.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const fl of def.fills || []) for (const [x, y] of fl.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
}

// A small-caps-size context for superiors, ordinals and the letters inside (c) and (r).
export function smallK(k, f = 0.6) {
  return { ...k, V: k.V * (0.42 + 0.48 * f), H: k.H * (0.42 + 0.48 * f), xh: k.xh * f, cap: k.cap * f, asc: k.asc * f,
    desc: k.desc * f, fig: k.fig * f, ov: k.ov * f, ovC: k.ovC * f, sb: k.sb * f, sbCap: k.sbCap * f, cw: k.cw * 1.04 };
}

// Math axis: where minus, plus, equals and arrows centre. Level with the hyphen and the middle of
// lining figures, so 3 - 2 = 1 sits on one line.
export const axis = (k) => Math.round(k.fig * 0.46);
