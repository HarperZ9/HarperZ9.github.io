// forge/family/cuts.mjs
// Display cuts as transforms of the skeleton, before the pen runs. A cut is a technique applied to
// the letter's construction, so the same skeleton gives every cut at every weight, and the cuts stay
// point-compatible (they become variable fonts like the base styles).
//   stencil  bowls split at top and bottom; strokes stop short of the stroke they join (crate and
//            archive-box lettering, where the bridges hold the stencil together)
//   slab     a bar on every free end of a vertical or flat-cut stroke (the brutalist slab of
//            direction A: poured concrete lettering)
//   runic    capitals' bowls cut as facets and lobes (the upstream forge's carved caps)
// Every decision (which end is free, where a bowl splits) reads the topology, never the weight.

import { Path, S, poly } from "./kit.mjs";

const dist2seg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const distToPath = (p, path) => {
  let m = Infinity;
  const P = path.pts, n = P.length;
  for (let i = 0; i + 1 < n; i++) m = Math.min(m, dist2seg(p, P[i], P[i + 1]));
  if (path.closed && n > 2) m = Math.min(m, dist2seg(p, P[n - 1], P[0]));
  return m;
};

// An end is joined when it lies within half a stem of another stroke's centre line.
function endJoined(strokes, i, end, V) {
  const P = strokes[i].path.pts, p = end === "a" ? P[0] : P[P.length - 1];
  return strokes.some((st, j) => j !== i && distToPath(p, st.path) < 0.55 * V);
}

function withPts(st, pts, kind) { return { ...st, path: { ...st.path, meta: undefined, pts, kind: kind ?? st.path.kind, closed: false } }; }

// Pull one end of an open stroke back along itself by len (moves points; the count stays).
function retreat(st, end, len) {
  const P = st.path.pts.map((p) => p.slice()), n = P.length;
  const order = end === "a" ? [...Array(n).keys()] : [...Array(n).keys()].reverse();
  let left = len;
  for (let k = 0; k + 1 < n && left > 0; k++) {
    const i = order[k], j = order[k + 1], seg = Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]);
    if (seg <= left && k + 2 < n) { left -= seg; P[i] = P[j].slice(); continue; }
    const t = Math.min(0.9, left / (seg || 1));
    P[i] = [P[i][0] + (P[j][0] - P[i][0]) * t, P[i][1] + (P[j][1] - P[i][1]) * t];
    for (let q = 0; q < k; q++) P[order[q]] = P[i].slice();
    break;
  }
  return withPts(st, P);
}

function splitRing(st, ref = st) {
  const P = st.path.pts, n = P.length, kind = st.path.kind, R = ref.path.pts;
  let top = 0, bot = 0;
  R.forEach((p, i) => { if (p[1] > R[top][1] + 1e-6) top = i; if (p[1] < R[bot][1] - 1e-6) bot = i; });
  const g = Math.max(2, Math.round(n * 0.045));
  const run = (a, b) => { const out = [], kk = []; for (let i = a; ; i = (i + 1) % n) { out.push(P[i]); kk.push(kind[i]); if (i === b) break; } return [out, kk]; };
  const pieces = [run((top + g) % n, (bot - g + n) % n), run((bot + g) % n, (top - g + n) % n)];
  return pieces.map(([pts, kk]) => { kk[0] = "node"; kk[kk.length - 1] = "node"; return S(Object.assign(new Path(0, 0), { pts, kind: kk, meta: undefined, closed: false }), { cap: st.cap, scale: st.scale, V: st.V, contrast: st.contrast }); });
}

export function stencil(def, k, ref = def, k0 = k) {
  const st = def.strokes || [], rs = ref.strokes || st, out = [];
  st.forEach((s, i) => {
    if (s.path.closed && s.path.pts.length > 8) { out.push(...splitRing(s, rs[i])); return; }
    let t = s;
    const len = 0.5 * k.V + 0.34 * k.V;
    if (!s.path.closed && s.path.pts.length > 1) {
      const ja = endJoined(rs, i, "a", k0.V) && !isStem(s), jb = endJoined(rs, i, "b", k0.V) && !isStem(s);
      // A bar held at both ends (the A's crossbar, the H's) keeps one bridge, so it still reads as a bar.
      const bar = s.path.pts.length === 2 && Math.abs(s.path.pts[1][1] - s.path.pts[0][1]) < 1;
      if (ja) t = retreat(t, "a", bar ? 0.5 * k.V + 0.26 * k.V : len);
      if (jb && !(bar && ja)) t = retreat(t, "b", len);
    }
    out.push(t);
  });
  return { ...def, strokes: out };
}

const isStem = (s) => s.path.pts.length === 2 && Math.abs(s.path.pts[0][0] - s.path.pts[1][0]) < 0.5;
const flatEnd = (s, end) => (s.cap?.[end] === "h") || isStem(s);

export function slab(def, k, ref = def, k0 = k) {
  const st = def.strokes || [], rs = ref.strokes || st, add = [], arm = 0.62 * k.V + 0.10 * k.xh, h = k.H * 0.9;
  st.forEach((s, i) => {
    if (s.path.closed || s.path.pts.length < 2) return;
    for (const end of ["a", "b"]) {
      if (!flatEnd(s, end) || endJoined(rs, i, end, k0.V)) continue;
      const P = s.path.pts, p = end === "a" ? P[0] : P[P.length - 1], q = end === "a" ? P[1] : P[P.length - 2];
      const dir = Math.sign(p[1] - q[1]) || 1, y = p[1] - dir * h / 2;
      add.push(S(new Path(p[0] - arm, y).L(p[0] + arm, y), { V: h / k.C }));
    }
  });
  return { ...def, strokes: [...st, ...add] };
}

// Runic capitals: the bowls become straight facets (after the upstream forge's runic style).
export function runicCaps(k, d) {
  const C = k.cap, W = d.WH, x0 = k.V / 2, yt = C - k.H / 2, yb = k.H / 2, m = C / 2;
  const P = (pts, closed = false) => S(poly(pts, closed));
  const stem = () => P([[x0, 0], [x0, C]]);
  const lobe = (y0, y1, tip) => P([[x0, y1], [tip, (y0 + y1) / 2], [x0, y0]]);
  return {
    B: { strokes: [stem(), lobe(m, yt, W * 0.70), lobe(yb, m, W * 0.78)], sb: ["H", "V"], upper: true },
    D: { strokes: [stem(), P([[x0, yt], [W * 0.92, m], [x0, yb]])], sb: ["H", "V"], upper: true },
    P: { strokes: [stem(), lobe(C * 0.46, yt, W * 0.72)], sb: ["H", "V"], upper: true },
    R: { strokes: [stem(), lobe(C * 0.46, yt, W * 0.72), P([[W * 0.36, C * 0.46], [W * 0.86, 0]])], sb: ["H", "V"], upper: true },
    C: { strokes: [P([[W * 0.86, yt], [W * 0.10, C * 0.74], [W * 0.10, C * 0.26], [W * 0.86, yb]])], sb: ["V", "o"], upper: true },
    G: { strokes: [P([[W * 0.86, yt], [W * 0.10, C * 0.74], [W * 0.10, C * 0.26], [W * 0.86, yb], [W * 0.86, C * 0.44], [W * 0.50, C * 0.44]])], sb: ["V", "H"], upper: true },
    O: { strokes: [P([[W * 0.5, C - k.H * 0.2], [W * 0.98, m], [W * 0.5, k.H * 0.2], [W * 0.02, m]], true)], sb: ["V", "V"], upper: true },
    Q: { strokes: [P([[W * 0.5, C - k.H * 0.2], [W * 0.98, m], [W * 0.5, k.H * 0.2], [W * 0.02, m]], true), P([[W * 0.56, C * 0.30], [W * 0.98, -C * 0.12]])], sb: ["V", "V"], upper: true },
    S: { strokes: [P([[W * 0.82, C * 0.98], [W * 0.12, C * 0.68], [W * 0.82, C * 0.32], [W * 0.12, C * 0.02]])], sb: ["V", "V"], upper: true },
    U: { strokes: [P([[x0, C], [x0, C * 0.24], [W * 0.46, k.H * 0.2], [W * 0.92, C * 0.24], [W * 0.92, C]])], sb: ["H", "H"], upper: true },
  };
}

import { REF_CUTS } from "./refcuts.mjs";

export const CUTS = { stencil, slab, ...REF_CUTS };
