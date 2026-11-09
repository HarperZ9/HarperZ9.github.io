// forge/family/refcuts.mjs
// Display families proposed from the reference library (2026-10-26). Each takes a construction rule
// from a reference, never its look, and applies it to Accession's skeletons:
//   tiles     Olivetti / Bayer Divisumma: a letter is a course of square tiles laid along the stroke;
//             where the stroke turns, the tiles foreshorten, so the flow shows in the tile widths
//   uroko     Hsia Yu's Mincho: contrast by stroke direction taken to the extreme, and a triangular
//             scale (uroko) where a horizontal stroke ends on the right
//   burin     intaglio, "tone by line": a stroke is engraved as parallel hairlines that swell
//             toward the middle; weight is the number and swell of lines, not one wide pen
//   setback   the deco motif rule (stepped and mirrored about an axis): a stroke is three nested
//             strokes, the outer two stepped back at both ends like a setback tower
// These are static cuts: their point counts follow the path length, so they do not interpolate.

import { Path, S, se } from "./kit.mjs";

const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Resample a path at a fixed spacing; returns points with tangents.
function walk(pts, closed, step) {
  const P = closed ? [...pts, pts[0]] : pts, out = [];
  let next = 0;                     // distance along this segment where the next tile sits
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], L = len(a, b);
    if (L < 1e-6) continue;
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    for (; next <= L; next += step) out.push({ p: [a[0] + t[0] * next, a[1] + t[1] * next], t });
    next -= L;
  }
  return out;
}

// n points spread evenly along a path (both ends included for open paths); fixed n keeps masters compatible.
function walkN(pts, closed, n) {
  const P = closed ? [...pts, pts[0]] : pts, segs = [];
  let total = 0;
  for (let i = 0; i + 1 < P.length; i++) { const L = len(P[i], P[i + 1]); if (L > 1e-6) { segs.push([P[i], P[i + 1], L]); total += L; } }
  const out = [], step = n > 1 ? total / (closed ? n : n - 1) : 0;
  let si = 0, acc = 0;
  for (let j = 0; j < n; j++) {
    let d = j * step;
    while (si < segs.length - 1 && d > acc + segs[si][2]) { acc += segs[si][2]; si++; }
    const [a, b, L] = segs[si], f = Math.min(1, (d - acc) / L), t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    out.push({ p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], t, step });
  }
  return out;
}

const quad = (c, t, w, h) => {
  const n = [-t[1], t[0]], hw = w / 2, hh = h / 2;
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + t[0] * a * hw + n[0] * b * hh, c[1] + t[1] * a * hw + n[1] * b * hh]);
  return { pts, on: pts.map(() => true) };
};

// k.tileTurn (0 to 1) is the rule's weight: how strongly a bend narrows its tiles (the TURN axis).
// Junction rule: courses are laid in stroke order, and a later course drops any tile that would sit
// within one tile of a tile already laid, so a crossing (the H bar over its stems) keeps one tile and
// a grout gap. Which tiles drop depends only on the skeleton, so every TURN master has the same tiles.
export function tiles(def, k, ref = def, k0 = k) {
  const fills = [...(def.fills || [])], size = k.V * 0.96, w = k.tileTurn ?? 1;
  const laid = [], keepR = k0.V * 0.85;
  const refStrokes = ref.strokes || def.strokes || [];
  (def.strokes || []).forEach((st, si) => {
    const sr = walk(refStrokes[si].path.pts, refStrokes[si].path.closed, k0.V * 0.85), s = walkN(st.path.pts, st.path.closed, Math.max(1, sr.length));
    const mine = [];
    for (let i = 0; i < s.length; i++) {
      const c = sr[Math.min(i, sr.length - 1)]?.p ?? s[i].p;
      if (laid.some((q) => len(q, c) < keepR)) continue;
      mine.push(c);
      const a = s[Math.max(0, i - 1)].t, b = s[Math.min(s.length - 1, i + 1)].t;
      const turn = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));   // radians over two steps
      const fore = Math.max(0.55, Math.cos(Math.min(Math.PI / 2.2, turn * 0.8)));
      // Along the course a tile takes 82% of its step (the rest is grout); across, the stroke's own width.
      const along = (s[i].step || size) * 0.8;
      fills.push(quad(s[i].p, s[i].t, along * (1 - w * (1 - fore)), size * (st.scale ?? 1)));
    }
    laid.push(...mine);
  });
  return { ...def, strokes: [], fills };
}

export function uroko(def, k) {
  const fills = [...(def.fills || [])];
  for (const st of def.strokes || []) {
    const P = st.path.pts; if (st.path.closed || P.length < 2) continue;
    for (const [end, prev] of [[P[P.length - 1], P[P.length - 2]], [P[0], P[1]]]) {
      const dx = end[0] - prev[0], dy = end[1] - prev[1];
      if (dx <= 0 || Math.abs(dy) > 0.2 * Math.abs(dx)) continue;   // only the right end of a horizontal stroke
      const h = k.H, s = k.V * 1.05, y = end[1] + h / 2;
      const pts = [[end[0], y], [end[0] - s, y], [end[0], y + s * 0.75]];
      fills.push({ pts, on: [true, true, true] });
    }
  }
  return { ...def, fills };
}

function offsetPath(path, d) {
  const P = path.pts, n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[path.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[path.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const L = len(a, b) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    out.push([P[i][0] + nx * d, P[i][1] + ny * d]);
  }
  const p = Object.assign(new Path(0, 0), { pts: out, kind: path.kind.slice(), meta: undefined, closed: path.closed });
  return p;
}

// lines: how many parallel strokes; step: how far the outer ones are stepped back at each end.
// slots: how many distinct line positions the lines share. Burin always draws 8 lines; at 4 slots they
// lie in pairs, so the LINE axis (4 to 8) reads as the line count while every master keeps 8 strokes.
function multiline(def, k, { lines, swell, step, slots = lines }) {
  const out = [];
  for (const st of def.strokes || []) {
    for (let i = 0; i < lines; i++) {
      const j = Math.floor(i * slots / lines), u = slots === 1 ? 0 : j / (slots - 1) - 0.5, d = u * k.V * 0.92;
      let path = offsetPath(st.path, d);
      const cut = Math.round(Math.abs(u) * 2 * step);
      if (!path.closed && cut > 0 && path.pts.length > 2 * cut + 2) path = Object.assign(new Path(0, 0), { pts: path.pts.slice(cut, -cut), kind: path.kind.slice(cut, -cut), meta: undefined, closed: false });
      out.push({ ...st, path, V: k.V * (0.92 / slots) * 0.62, contrast: 1, taper: swell ? { a: [0.25, 0.5], b: [0.25, 0.5] } : undefined });
    }
  }
  return { ...def, strokes: out };
}

export const burin = (def, k) => multiline(def, k, { lines: 8, swell: true, step: 0, slots: k.burinLines ?? 8 });
export const setback = (def, k) => multiline(def, k, { lines: 3, swell: false, step: 3 });

export const REF_CUTS = { tiles, uroko, burin, setback };
void se; void S;
