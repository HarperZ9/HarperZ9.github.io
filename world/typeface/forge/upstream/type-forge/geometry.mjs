// system/type-forge/geometry.mjs
// The centerline primitives every skeleton is drawn from (Flywheel harness/typeface_skeletons.py).

export const PI = Math.PI;
const N = 48;   // sampling density for curved strokes

const copysign = (m, s) => (s < 0 || Object.is(s, -0) ? -Math.abs(m) : Math.abs(m));

// A superellipse arc: n = 2 is an ellipse, higher squares the bowl.
export function superellipse(cx, cy, rx, ry, n, t0 = 0, t1 = 2 * PI, steps = N) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + (t1 - t0) * i / steps;
    const c = Math.cos(t), s = Math.sin(t);
    pts.push([cx + rx * copysign(Math.abs(c) ** (2.0 / n), c), cy + ry * copysign(Math.abs(s) ** (2.0 / n), s)]);
  }
  return pts;
}

export function line(x0, y0, x1, y1, steps = 12) {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push([x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]);
  return pts;
}

export const stroke = (pts, role, closed = false) => ({ pts, role, closed });
export const stem = (x, y0, y1) => stroke(line(x, y0, x, y1), "stem");
export const diag = (x0, y0, x1, y1) => stroke(line(x0, y0, x1, y1), "diag");
export const bar = (x0, x1, y) => stroke(line(x0, y, x1, y), "crossbar");

