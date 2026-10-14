// Stroke styles: a stroke as the union of convex pieces, as SVG and Canvas 2D
// define it. Each segment is a rectangle, each join a triangle (bevel), a quad
// (miter) or a disc (round), and each open end a cap: nothing (butt), a square
// or a disc. strokeOutline() turns the pieces into closed contours, all wound
// the same way, so a nonzero fill of them is their union; the vector pass
// ignores an edge with coverage on both sides, so overlaps leave no seams.
// Pure: runs in Node.
//
//   const P = strokePieces(contours, { hw: 7, join: "miter", cap: "butt", miterLimit: 4 });
//   // P: Float32Array, PIECE floats per piece: [kind, n, r, 0, x0, y0, x1, y1, x2, y2, x3, y3]
//   // kind 0: convex polygon of n points (2 to 4); kind 1: disc at x0, y0 of radius r.
//   const outline = strokeOutline(contours, { hw: 7, join: "miter", cap: "butt" }, 0.05);

export const PIECE = 12;

class Out {
  constructor() { this.a = new Float32Array(PIECE * 64); this.n = 0; }
  push(kind, n, r, pts) {
    if (this.n + PIECE > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    const a = this.a, i = this.n;
    a[i] = kind; a[i + 1] = n; a[i + 2] = r; a[i + 3] = 0;
    for (let k = 0; k < 8; k++) a[i + 4 + k] = k < pts.length ? pts[k] : pts[pts.length - 2 + (k & 1)];
    this.n += PIECE;
  }
  poly(...pts) { this.push(0, pts.length / 2, 0, pts); }
  disc(x, y, r) { this.push(1, 1, r, [x, y]); }
}

// Unit direction and left normal of a -> b (y down: left of travel).
function dir(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
  return l > 0 ? [dx / l, dy / l] : null;
}

function cap(o, x, y, d, hw, cap, atStart) {
  if (cap === "round") { o.disc(x, y, hw); return; }
  if (cap !== "square") return;
  const s = atStart ? -1 : 1, ex = x + s * d[0] * hw, ey = y + s * d[1] * hw, nx = -d[1] * hw, ny = d[0] * hw;
  o.poly(x + nx, y + ny, ex + nx, ey + ny, ex - nx, ey - ny, x - nx, y - ny);
}

// The join at vertex (x, y) between incoming direction d0 and outgoing d1.
function join(o, x, y, d0, d1, hw, kind, miterLimit) {
  const cross = d0[0] * d1[1] - d0[1] * d1[0], dot = d0[0] * d1[0] + d0[1] * d1[1];
  if (Math.abs(cross) < 1e-9 && dot > 0) return;              // straight on
  if (kind === "round") { o.disc(x, y, hw); return; }
  // The outer side is opposite the turn.
  const s = cross > 0 ? -1 : 1;
  const ax = x + s * -d0[1] * hw, ay = y + s * d0[0] * hw;     // end of the incoming edge's outer side
  const bx = x + s * -d1[1] * hw, by = y + s * d1[0] * hw;     // start of the outgoing edge's outer side
  if (kind === "miter") {
    // Miter length over stroke width is 1 / sin(theta / 2), theta the angle between the segments.
    const cosTheta = -dot, sinHalf = Math.sqrt(Math.max(0, (1 - cosTheta) / 2));
    if (sinHalf > 0 && 1 / sinHalf <= miterLimit) {
      const mx = s * (-d0[1] - d1[1]), my = s * (d0[0] + d1[0]), ml = Math.hypot(mx, my);
      const len = hw / sinHalf;
      if (ml > 0) { o.poly(x, y, ax, ay, x + (mx / ml) * len, y + (my / ml) * len, bx, by); return; }
    }
  }
  o.poly(x, y, ax, ay, bx, by);                                 // bevel, and the miter fallback
}

export function strokePieces(shape, { hw, join: joinKind = "miter", cap: capKind = "butt", miterLimit = 4 } = {}) {
  const o = new Out();
  for (const c of shape) {
    const p = c.pts, n = p.length / 2;
    // Drop repeated points; a contour that is one point is a zero-length subpath.
    const xs = [], ys = [];
    for (let i = 0; i < n; i++) {
      const x = p[2 * i], y = p[2 * i + 1];
      if (!xs.length || x !== xs[xs.length - 1] || y !== ys[ys.length - 1]) { xs.push(x); ys.push(y); }
    }
    if (c.closed && xs.length > 1 && xs[0] === xs[xs.length - 1] && ys[0] === ys[ys.length - 1]) { xs.pop(); ys.pop(); }
    const m = xs.length;
    if (m === 1) {
      if (c.closed) continue;
      if (capKind === "round") o.disc(xs[0], ys[0], hw);
      else if (capKind === "square") o.poly(xs[0] - hw, ys[0] - hw, xs[0] + hw, ys[0] - hw, xs[0] + hw, ys[0] + hw, xs[0] - hw, ys[0] + hw);
      continue;
    }
    const closed = c.closed && m > 2;
    const segs = closed ? m : m - 1, dirs = [];
    for (let i = 0; i < segs; i++) {
      const a = i, b = (i + 1) % m, d = dir(xs[a], ys[a], xs[b], ys[b]);
      dirs.push(d);
      const nx = -d[1] * hw, ny = d[0] * hw;
      o.poly(xs[a] + nx, ys[a] + ny, xs[b] + nx, ys[b] + ny, xs[b] - nx, ys[b] - ny, xs[a] - nx, ys[a] - ny);
    }
    for (let i = closed ? 0 : 1; i < (closed ? m : m - 1); i++) {
      const din = dirs[(i - 1 + segs) % segs], dout = dirs[i % segs];
      join(o, xs[i], ys[i], din, dout, hw, joinKind, miterLimit);
    }
    if (!closed) {
      cap(o, xs[0], ys[0], dirs[0], hw, capKind, true);
      cap(o, xs[m - 1], ys[m - 1], dirs[segs - 1], hw, capKind, false);
    }
  }
  return o.a.subarray(0, o.n);
}

// The pieces as closed contours wound one way (positive shoelace area), discs as
// polygons within tol of the circle.
export function strokeOutline(shape, opts, tol = 0.05) {
  const P = strokePieces(shape, opts), out = [];
  for (let i = 0; i < P.length; i += PIECE) {
    let pts;
    if (P[i] === 1) {
      const r = P[i + 2], cx = P[i + 4], cy = P[i + 5];
      const n = Math.max(8, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - tol / Math.max(r, 1e-6)))));
      pts = new Float32Array(2 * n);
      for (let k = 0; k < n; k++) { const a = (2 * Math.PI * k) / n; pts[2 * k] = cx + r * Math.cos(a); pts[2 * k + 1] = cy + r * Math.sin(a); }
    } else {
      const n = P[i + 1];
      if (n < 3) continue;
      pts = Float32Array.from(P.subarray(i + 4, i + 4 + 2 * n));
    }
    let a = 0;
    const n = pts.length / 2;
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; a += pts[2 * k] * pts[2 * j + 1] - pts[2 * j] * pts[2 * k + 1]; }
    if (a === 0) continue;
    if (a < 0) { const q = new Float32Array(pts.length); for (let k = 0; k < n; k++) { q[2 * k] = pts[2 * (n - 1 - k)]; q[2 * k + 1] = pts[2 * (n - 1 - k) + 1]; } pts = q; }
    out.push({ pts, closed: true });
  }
  return out;
}
