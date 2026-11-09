// forge/family/pen.mjs
// The family's pen. Upstream forge.mjs offsets a centre line by a normal whose width follows the stroke
// direction (vertical = full stem, horizontal = stem x contrast). This pen keeps that rule and adds what
// text sizes need:
//   - mitred corners, so a turn in a stroke (the foot of a 2, the joints of a Z) has no notch;
//   - tapers, so an arch or bowl thins where it leaves a stem (the junction stays open at 12 px);
//   - cut caps: an end can be cut normal to the stroke, flat (horizontal) or plumb (vertical);
//   - TrueType flags: curve samples become off-curve points, so outlines are smooth splines;
//   - fixed winding: outer rings clockwise, counters counter-clockwise, so overlaps fill as a union.
// The point count of a ring depends only on the path, never on the weight. Two weights of the same
// glyph are therefore point-compatible, which is what a variable weight axis needs.

export function penWidth(dx, dy, V, contrast) {
  const L = Math.hypot(dx, dy) || 1;
  return V * (contrast + (1 - contrast) * (Math.abs(dy) / L));
}

const unit = (dx, dy) => { const L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };

function arcFractions(pts, closed) {
  const n = pts.length, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0) || 1;
  return cum.map((c) => c / total);
}

const smooth = (t) => t * t * (3 - 2 * t);
function taperAt(u, taper) {
  let f = 1;
  if (taper?.a && u < taper.a[1]) f = Math.min(f, taper.a[0] + (1 - taper.a[0]) * smooth(u / taper.a[1]));
  if (taper?.b && 1 - u < taper.b[1]) f = Math.min(f, taper.b[0] + (1 - taper.b[0]) * smooth((1 - u) / taper.b[1]));
  return f;
}

// Intersection of the line through p along d with the line through q along e; null when parallel.
function meet(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

function neighbours(pts, i, closed) {
  const n = pts.length;
  if (closed) return [pts[(i - 1 + n) % n], pts[(i + 1) % n]];
  return [pts[Math.max(0, i - 1)], pts[Math.min(n - 1, i + 1)]];
}

// On a superellipse sample the two edges are superellipses too: radii grown and shrunk by half the
// pen (V across the sides, H across top and bottom). Unlike a normal offset this never loops where a
// heavy pen meets a tight corner of a squared bowl, and it keeps the point count.
function seOffset(mt, V, H, f) {
  const at = (rx, ry) => { const c = Math.cos(mt.t), s = Math.sin(mt.t), e = 2 / mt.n; return [mt.cx + rx * Math.sign(c) * Math.abs(c) ** e, mt.cy + ry * Math.sign(s) * Math.abs(s) ** e]; };
  const out = at(mt.rx + V * f / 2, mt.ry + H * f / 2), inn = at(Math.max(1, mt.rx - V * f / 2), Math.max(1, mt.ry - H * f / 2));
  return mt.dir > 0 ? [inn, out] : [out, inn];
}

function offsetPoint(pts, kind, i, closed, half, wAt) {
  const p = pts[i], [a, b] = neighbours(pts, i, closed);
  const isEnd = !closed && (i === 0 || i === pts.length - 1);
  if (kind[i] === "corner" && !isEnd) {
    const d0 = unit(p[0] - a[0], p[1] - a[1]), d1 = unit(b[0] - p[0], b[1] - p[1]);
    const w0 = wAt(d0), w1 = wAt(d1), n0 = [-d0[1], d0[0]], n1 = [-d1[1], d1[0]];
    const out = [];
    for (const s of [1, -1]) {
      const m = meet([p[0] + s * n0[0] * w0, p[1] + s * n0[1] * w0], d0, [p[0] + s * n1[0] * w1, p[1] + s * n1[1] * w1], d1);
      const lim = 3.2 * Math.max(w0, w1);
      out.push(m && Math.hypot(m[0] - p[0], m[1] - p[1]) < lim ? m : [p[0] + s * (n0[0] + n1[0]) / 2 * w0, p[1] + s * (n0[1] + n1[1]) / 2 * w0]);
    }
    return out;
  }
  const d = unit(b[0] - a[0], b[1] - a[1]), w = wAt(d), nn = [-d[1], d[0]];
  return [[p[0] + nn[0] * w, p[1] + nn[1] * w], [p[0] - nn[0] * w, p[1] - nn[1] * w]];
}

// Move an end's two offset points along the stroke so the cut is flat ("h") or plumb ("v").
function cutCap(p, d, pair, mode) {
  const ax = mode === "h" ? 1 : mode === "v" ? 0 : -1;
  if (ax < 0 || Math.abs(d[ax]) < 0.25) return pair;
  return pair.map((q) => { const t = (p[ax] - q[ax]) / d[ax]; return [q[0] + d[0] * t, q[1] + d[1] * t]; });
}

const signedArea = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const [x0, y0] = r[i], [x1, y1] = r[(i + 1) % r.length]; s += x0 * y1 - x1 * y0; } return s / 2; };

function orient(ring, clockwise) {
  const cw = signedArea(ring.pts) < 0;
  if (cw !== clockwise) { ring.pts.reverse(); ring.on.reverse(); }
  return ring;
}

// Expand one stroke into closed rings: [{ pts: [[x, y]], on: [bool] }].
// floor: the thinnest a taper may go, as a share of the pen. Text styles use 0 (full ink traps for
// small sizes); display styles raise it so a junction never reads as a broken letter at 96 px and up.
export function expand(stroke, V, contrast, floor = 0) {
  const { path, taper, cap = {}, scale = 1 } = stroke;
  const pts = path.pts, kind = path.kind, closed = path.closed, n = pts.length;
  const u = arcFractions(pts, closed);
  const L = [], R = [];
  const meta = path.meta && path.meta.length === n ? path.meta : null;
  for (let i = 0; i < n; i++) {
    const f = scale * (closed ? 1 : Math.max(floor, taperAt(u[i], taper)));
    const mt = meta?.[i];
    const [l, r] = mt && kind[i] !== "corner" ? seOffset(mt, V, V * contrast, f) : offsetPoint(pts, kind, i, closed, 0, (d) => penWidth(d[0], d[1], V, contrast) * f / 2);
    L.push(l); R.push(r);
  }
  if (!closed) {
    const d0 = unit(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const d1 = unit(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]);
    [L[0], R[0]] = cutCap(pts[0], d0, [L[0], R[0]], cap.a);
    [L[n - 1], R[n - 1]] = cutCap(pts[n - 1], d1, [L[n - 1], R[n - 1]], cap.b);
  }
  const on = kind.map((k) => k !== "curve");
  if (closed) {
    const a = { pts: L, on: on.slice() }, b = { pts: R, on: on.slice() };
    const [outer, inner] = Math.abs(signedArea(L)) > Math.abs(signedArea(R)) ? [a, b] : [b, a];
    return [orient(outer, true), orient(inner, false)];
  }
  on[0] = on[n - 1] = true;
  const ringPts = L.concat(R.slice().reverse()), ringOn = on.concat(on.slice().reverse());
  return [orient({ pts: ringPts, on: ringOn }, true)];
}

// Stroke constructor used by every glyph module.
export const S = (path, opts = {}) => ({ path, ...opts });
