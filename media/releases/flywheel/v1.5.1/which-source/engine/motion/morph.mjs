// Continuous morphs between shapes by point correspondence, not crossfade.
//
//   const m = morph(shapeA, shapeB);   // precomputes the correspondence once
//   m(0) is shapeA resampled, m(1) is shapeB resampled, m(0.5) lies between.
//
// How contours are paired. Outer contours (positive area in y-down space, as
// TrueType draws them) pair with outer contours, and holes with holes, so a
// nonzero fill keeps its holes through the whole morph. Within a class,
// contours pair in reading order (by centroid, left to right, then top to
// bottom). When one side has more contours, the extra ones grow from (or
// shrink into) a point at the centroid of the partner they share, as manim's
// Transform does with null submobjects. Each pair is resampled to the same
// count by arc length; for a closed pair the start point and direction that
// minimize the summed squared distance are chosen, so a circle turning into a
// square does not twist.
import { contour, resample, area, centroid, lengths } from "./path.mjs";

const isHole = (c) => c.closed && area(c) < 0;

function order(cs) {
  return cs.map((c) => ({ c, k: centroid(c) })).sort((a, b) => (Math.abs(a.k[0] - b.k[0]) > 1e-3 ? a.k[0] - b.k[0] : a.k[1] - b.k[1])).map((x) => x.c);
}

function point(c, n) {
  const [x, y] = centroid(c), p = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) { p[2 * i] = x; p[2 * i + 1] = y; }
  return contour(p, c.closed);
}

// Rotate (and maybe reverse) b's points to best match a's; both have n points.
function align(a, b) {
  const n = a.pts.length / 2, A = a.pts, B = b.pts;
  if (!a.closed || !b.closed) {
    // Open: choose the direction only.
    let f = 0, r = 0;
    for (let i = 0; i < n; i++) {
      const j = n - 1 - i;
      f += (A[2 * i] - B[2 * i]) ** 2 + (A[2 * i + 1] - B[2 * i + 1]) ** 2;
      r += (A[2 * i] - B[2 * j]) ** 2 + (A[2 * i + 1] - B[2 * j + 1]) ** 2;
    }
    if (r >= f) return b;
    const o = new Float32Array(2 * n);
    for (let i = 0; i < n; i++) { o[2 * i] = B[2 * (n - 1 - i)]; o[2 * i + 1] = B[2 * (n - 1 - i) + 1]; }
    return contour(o, false);
  }
  // Closed: the winding direction is kept (it carries the fill), only the start moves.
  const step = Math.max(1, Math.floor(n / 64));
  let best = 0, bestE = Infinity;
  for (let s = 0; s < n; s += step) {
    let e = 0;
    for (let i = 0; i < n; i += step) { const j = (i + s) % n; e += (A[2 * i] - B[2 * j]) ** 2 + (A[2 * i + 1] - B[2 * j + 1]) ** 2; }
    if (e < bestE) { bestE = e; best = s; }
  }
  for (let s = best - step + 1; s < best + step; s++) {
    const ss = (s + n) % n;
    let e = 0;
    for (let i = 0; i < n; i++) { const j = (i + ss) % n; e += (A[2 * i] - B[2 * j]) ** 2 + (A[2 * i + 1] - B[2 * j + 1]) ** 2; }
    if (e < bestE) { bestE = e; best = ss; }
  }
  const o = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) { const j = (i + best) % n; o[2 * i] = B[2 * j]; o[2 * i + 1] = B[2 * j + 1]; }
  return contour(o, true);
}

// Pair two lists of contours: each pair is { A, B } with matching point counts.
function pairClass(as, bs, density) {
  as = order(as); bs = order(bs);
  const swap = bs.length > as.length, L = swap ? bs : as, S = swap ? as : bs;
  const pairs = [], taken = new Set();
  for (let i = 0; i < L.length; i++) {
    const l = L[i], k = S.length ? Math.floor((i * S.length) / L.length) : -1, s = k >= 0 ? S[k] : null;
    const m = Math.max(16, Math.min(1024, Math.ceil(Math.max(lengths(l).at(-1), s ? lengths(s).at(-1) : 0) / density)));
    const P = resample(l, m);
    // The first contour to reach a partner morphs into it; any more grow from a point.
    let Q;
    if (s && !taken.has(k)) { taken.add(k); Q = resample(s, m); } else Q = point(s || l, m);
    let A = swap ? Q : P, B = swap ? P : Q;
    if (A.closed !== B.closed) { A = contour(A.pts, false); B = contour(B.pts, false); }
    pairs.push({ A, B: align(A, B) });
  }
  return pairs;
}

export function morph(a, b, { density = 2 } = {}) {
  const split = (s) => [s.filter((c) => !isHole(c)), s.filter(isHole)];
  const [ao, ah] = split(a), [bo, bh] = split(b);
  const pairs = [...pairClass(ao, bo, density), ...pairClass(ah, bh, density)];
  const fn = (t) => {
    t = Math.max(0, Math.min(1, t));
    return pairs.map(({ A, B }) => {
      const p = A.pts, q = B.pts, o = new Float32Array(p.length);
      for (let i = 0; i < p.length; i++) o[i] = p[i] + (q[i] - p[i]) * t;
      return contour(o, A.closed);
    });
  };
  fn.pairs = pairs.length;
  return fn;
}

// A shape interpolated straight between two shapes that already correspond
// contour for contour and point for point (for data-driven plots).
export function lerpShape(a, b, t) {
  return a.map((c, k) => {
    const p = c.pts, q = b[k].pts, o = new Float32Array(p.length);
    for (let i = 0; i < p.length; i++) o[i] = p[i] + (q[i] - p[i]) * t;
    return contour(o, c.closed);
  });
}
