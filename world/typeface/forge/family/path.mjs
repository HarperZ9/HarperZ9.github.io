// forge/family/path.mjs
// Centre-line paths for the family. A path is a list of points, each tagged with its kind:
//   "node"   on-curve point where the line is tangent-continuous (offset by the averaged normal)
//   "corner" on-curve point where the direction breaks (offset by a mitre)
//   "curve"  interior sample of a curve; written as a TrueType off-curve point
// Units are font units (1000 per em), y up, baseline at 0. Unlike upstream skeletons.mjs, these paths
// are written in final units so a glyph can place its ink edges exactly (the pen width is known).

export const PI = Math.PI;
const STEPS_PER_TURN = 56;

const sgnpow = (v, e) => Math.sign(v) * Math.abs(v) ** e;

// A point on a superellipse: n = 2 is an ellipse, larger n squares the bowl.
export function se(cx, cy, rx, ry, n, t) {
  return [cx + rx * sgnpow(Math.cos(t), 2 / n), cy + ry * sgnpow(Math.sin(t), 2 / n)];
}

// Solve for the angle in [t0, t1] where the superellipse reaches x (or y) = target, by bisection.
export function seAngle(cx, cy, rx, ry, n, t0, t1, axis, target) {
  const f = (t) => se(cx, cy, rx, ry, n, t)[axis] - target;
  let a = t0, b = t1, fa = f(a);
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2, fm = f(m);
    if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

export class Path {
  constructor(x, y) { this.pts = [[x, y]]; this.kind = ["node"]; this.meta = [null]; this.closed = false; }
  get last() { return this.pts[this.pts.length - 1]; }

  // Straight segment. The join at the current point is a corner unless smooth is set.
  L(x, y, { smooth = false } = {}) {
    if (!smooth && this.pts.length > 1) this.kind[this.kind.length - 1] = "corner";
    this.pts.push([x, y]); this.kind.push("node"); this.meta.push(null);
    return this;
  }

  // Superellipse arc from angle t0 to t1. The arc's first sample must sit on the current point; it is
  // dropped so the path has no duplicate. corner marks the join at the start as a break in direction.
  // When an end angle is solved from the weight (a bowl meeting a stem), pass steps so every weight
  // gets the same point count; the variable font needs that.
  A(cx, cy, rx, ry, n, t0, t1, { corner = false, steps: fixed } = {}) {
    const steps = fixed ?? Math.max(4, Math.ceil(Math.abs(t1 - t0) / (2 * PI) * STEPS_PER_TURN));
    if (corner && this.pts.length > 1) this.kind[this.kind.length - 1] = "corner";
    const dir = Math.sign(t1 - t0) || 1, m = (t) => ({ cx, cy, rx, ry, n, t, dir });
    if (!corner && this.meta[this.meta.length - 1] === null && this.pts.length === 1) this.meta[0] = m(t0);
    for (let i = 1; i <= steps; i++) {
      const t = t0 + (t1 - t0) * i / steps;
      this.pts.push(se(cx, cy, rx, ry, n, t));
      this.kind.push(i === steps ? "node" : "curve");
      this.meta.push(m(t));
    }
    return this;
  }

  close() {
    const [a, b] = [this.pts[0], this.last];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01) { this.pts.pop(); this.kind.pop(); this.meta.pop(); }
    this.closed = true;
    return this;
  }
}

// Start a path at the superellipse point for angle t0, then sweep to t1.
export function arc(cx, cy, rx, ry, n, t0, t1, steps) {
  const [x, y] = se(cx, cy, rx, ry, n, t0);
  return new Path(x, y).A(cx, cy, rx, ry, n, t0, t1, { steps });
}

// A full closed superellipse ring, counter-clockwise from angle 0. Every sample is a curve point.
export function ring(cx, cy, rx, ry, n) {
  const p = arc(cx, cy, rx, ry, n, 0, 2 * PI).close();
  p.kind = p.kind.map(() => "curve");
  return p;
}

// A straight run through the given points with corners at every interior vertex.
export function poly(points, closed = false) {
  const p = new Path(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) p.L(points[i][0], points[i][1]);
  if (closed) { p.close(); p.kind = p.kind.map(() => "corner"); }
  return p;
}
