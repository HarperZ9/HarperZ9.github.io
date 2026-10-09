// Motion paths: SVG path data and drawn forms as flattened contours, and the
// operations an animation needs on them: bounds, arc length, trim (draw-on),
// transforms and resampling. A contour is { pts: Float32Array [x0, y0, x1, y1,
// ...], closed: bool }; a shape is an array of contours. Pure: runs in Node.
//
//   const s = parsePath("M0 0 C 40 0 60 80 100 80", { tolerance: 0.2 });
//   const half = trim(s, 0, 0.5);          // the first half of its length
//   const c = circle(960, 540, 120);        // one closed contour

const TAU = Math.PI * 2;

export function contour(pts, closed = false) {
  return { pts: pts instanceof Float32Array ? pts : Float32Array.from(pts), closed };
}

// Flatten a cubic Bezier into points (excluding the start) with a flatness
// tolerance in the path's own units.
function cubicTo(out, x0, y0, x1, y1, x2, y2, x3, y3, tol) {
  const dd = Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2) + Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3);
  const n = Math.max(1, Math.min(256, Math.ceil(Math.sqrt((3 * dd) / (4 * Math.max(tol, 1e-4))))));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push(a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3);
  }
}
function quadTo(out, x0, y0, x1, y1, x2, y2, tol) {
  cubicTo(out, x0, y0, x0 + (2 / 3) * (x1 - x0), y0 + (2 / 3) * (y1 - y0), x2 + (2 / 3) * (x1 - x2), y2 + (2 / 3) * (y1 - y2), x2, y2, tol);
}
// SVG elliptical arc (endpoint form) to points, by the W3C conversion.
function arcTo(out, x0, y0, rx, ry, phi, large, sweep, x, y, tol) {
  if (rx === 0 || ry === 0) { out.push(x, y); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);
  const c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x0 - x) / 2, dy = (y0 - y) / 2;
  const x1 = c * dx + s * dy, y1 = -s * dx + c * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  let k = Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  if (large === sweep) k = -k;
  const cx1 = (k * rx * y1) / ry, cy1 = (-k * ry * x1) / rx;
  const cx = c * cx1 - s * cy1 + (x0 + x) / 2, cy = s * cx1 + c * cy1 + (y0 + y) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= TAU; else if (sweep && dt < 0) dt += TAU;
  const n = Math.max(2, Math.ceil(Math.abs(dt) / (2 * Math.acos(Math.max(-1, 1 - tol / Math.max(rx, ry))) || 0.1)));
  for (let i = 1; i <= n; i++) {
    const t = t0 + (dt * i) / n, px = rx * Math.cos(t), py = ry * Math.sin(t);
    out.push(c * px - s * py + cx, s * px + c * py + cy);
  }
}

// Parse SVG path data (M L H V C S Q T A Z, absolute and relative) into a shape.
export function parsePath(d, { tolerance = 0.25 } = {}) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const shape = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, qx = 0, qy = 0, cur = null, prev = "";
  const num = () => parseFloat(toks[i++]);
  const flush = (closed) => { if (cur && cur.length >= 4) shape.push(contour(cur, closed)); cur = null; };
  while (i < toks.length) {
    if (/^[A-Za-z]$/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) throw new Error("path data must start with a command");
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z") { if (cur) { x = sx; y = sy; flush(true); } prev = "Z"; continue; }
    if (!cur && C !== "M") cur = [x, y];
    switch (C) {
      case "M": flush(false); x = ox + num(); y = oy + num(); sx = x; sy = y; cur = [x, y]; cmd = rel ? "l" : "L"; break;
      case "L": x = ox + num(); y = oy + num(); cur.push(x, y); break;
      case "H": x = ox + num(); cur.push(x, y); break;
      case "V": y = oy + num(); cur.push(x, y); break;
      case "C": case "S": {
        let x1, y1;
        if (C === "C") { x1 = ox + num(); y1 = oy + num(); }
        else if (prev === "C" || prev === "S") { x1 = 2 * x - cx; y1 = 2 * y - cy; } else { x1 = x; y1 = y; }
        const x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num();
        cubicTo(cur, x, y, x1, y1, x2, y2, x3, y3, tolerance);
        cx = x2; cy = y2; x = x3; y = y3; break;
      }
      case "Q": case "T": {
        let x1, y1;
        if (C === "Q") { x1 = ox + num(); y1 = oy + num(); }
        else if (prev === "Q" || prev === "T") { x1 = 2 * x - qx; y1 = 2 * y - qy; } else { x1 = x; y1 = y; }
        const x2 = ox + num(), y2 = oy + num();
        quadTo(cur, x, y, x1, y1, x2, y2, tolerance);
        qx = x1; qy = y1; x = x2; y = y2; break;
      }
      case "A": {
        const rx = num(), ry = num(), rot = (num() * Math.PI) / 180, la = num() !== 0, sw = num() !== 0;
        const ex = ox + num(), ey = oy + num();
        arcTo(cur, x, y, rx, ry, rot, la, sw, ex, ey, tolerance);
        x = ex; y = ey; break;
      }
      default: throw new Error("unsupported path command " + cmd);
    }
    prev = C;
  }
  flush(false);
  return shape;
}

// Drawn forms.
export function circle(cx, cy, r, n = 0) {
  n = n || Math.max(24, Math.min(256, Math.ceil(TAU * r / 3)));
  const p = new Float32Array(2 * n);
  for (let i = 0; i < n; i++) { const a = (TAU * i) / n; p[2 * i] = cx + r * Math.cos(a); p[2 * i + 1] = cy + r * Math.sin(a); }
  return [contour(p, true)];
}
export function rect(x, y, w, h, r = 0) {
  if (r <= 0) return [contour([x, y, x + w, y, x + w, y + h, x, y + h], true)];
  r = Math.min(r, w / 2, h / 2);
  const p = [], q = 6;
  const corner = (cx, cy, a0) => { for (let i = 0; i <= q; i++) { const a = a0 + (Math.PI / 2) * (i / q); p.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return [contour(p, true)];
}
export function line(x0, y0, x1, y1) { return [contour([x0, y0, x1, y1], false)]; }
export function polyline(points, closed = false) { return [contour(points, closed)]; }
// A function plot y = f(x) over [a, b] in n steps, mapped by map(x, y) -> [px, py].
export function plot(f, a, b, n, map) {
  const p = [];
  for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n, [px, py] = map(x, f(x)); p.push(px, py); }
  return [contour(p, false)];
}

export function bounds(shape) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of shape) for (let i = 0; i < c.pts.length; i += 2) {
    const x = c.pts[i], y = c.pts[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
// Signed area (shoelace); positive is clockwise in y-down screen space.
export function area(c) {
  const p = c.pts, n = p.length / 2;
  let s = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; s += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
  return s / 2;
}
export function centroid(c) {
  const p = c.pts, n = p.length / 2;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += p[2 * i]; y += p[2 * i + 1]; }
  return [x / n, y / n];
}
// Cumulative arc length at each point (and the closing edge for a closed contour).
export function lengths(c) {
  const p = c.pts, n = p.length / 2, m = c.closed ? n + 1 : n;
  const L = new Float64Array(m);
  for (let i = 1; i < m; i++) {
    const a = (i - 1) % n, b = i % n;
    L[i] = L[i - 1] + Math.hypot(p[2 * b] - p[2 * a], p[2 * b + 1] - p[2 * a + 1]);
  }
  return L;
}
export function length(shape) { let s = 0; for (const c of shape) { const L = lengths(c); s += L[L.length - 1]; } return s; }

function pointAt(c, L, s) {
  const p = c.pts, n = p.length / 2, m = L.length;
  if (s <= 0) return [p[0], p[1]];
  let lo = 0, hi = m - 1;
  if (s >= L[hi]) { const k = (hi % n); return [p[2 * k], p[2 * k + 1]]; }
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid; }
  const a = lo % n, b = hi % n, u = (s - L[lo]) / Math.max(1e-9, L[hi] - L[lo]);
  return [p[2 * a] + (p[2 * b] - p[2 * a]) * u, p[2 * a + 1] + (p[2 * b + 1] - p[2 * a + 1]) * u];
}

// n points evenly spaced along the contour's length.
export function resample(c, n) {
  const L = lengths(c), total = L[L.length - 1], out = new Float32Array(2 * n);
  const steps = c.closed ? n : n - 1;
  for (let i = 0; i < n; i++) { const [x, y] = pointAt(c, L, steps ? (total * i) / steps : 0); out[2 * i] = x; out[2 * i + 1] = y; }
  return contour(out, c.closed);
}

// The part of a shape between fractions a and b of its total length, as open
// contours: the draw-on of a stroke. Contours are taken in order.
export function trim(shape, a, b) {
  a = Math.max(0, Math.min(1, a)); b = Math.max(0, Math.min(1, b));
  if (b <= a) return [];
  if (a === 0 && b === 1) return shape;
  const Ls = shape.map(lengths), tot = Ls.reduce((s, L) => s + L[L.length - 1], 0);
  const s0 = a * tot, s1 = b * tot, out = [];
  let base = 0;
  shape.forEach((c, k) => {
    const L = Ls[k], len = L[L.length - 1], lo = Math.max(s0 - base, 0), hi = Math.min(s1 - base, len);
    base += len;
    if (hi <= lo) return;
    if (lo === 0 && hi === len) { out.push(c); return; }
    const p = c.pts, n = p.length / 2, pts = [...pointAt(c, L, lo)];
    for (let i = 1; i < L.length; i++) if (L[i] > lo && L[i] < hi) { const q = i % n; pts.push(p[2 * q], p[2 * q + 1]); }
    pts.push(...pointAt(c, L, hi));
    out.push(contour(pts, false));
  });
  return out;
}

// Affine transform [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
export function transform(shape, m) {
  return shape.map((c) => {
    const p = c.pts, o = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 2) { const x = p[i], y = p[i + 1]; o[i] = m[0] * x + m[2] * y + m[4]; o[i + 1] = m[1] * x + m[3] * y + m[5]; }
    return contour(o, c.closed);
  });
}
export const translate = (shape, dx, dy) => transform(shape, [1, 0, 0, 1, dx, dy]);
export function scaleAbout(shape, s, cx, cy) { return transform(shape, [s, 0, 0, s, cx - s * cx, cy - s * cy]); }
export function rotateAbout(shape, a, cx, cy) {
  const c = Math.cos(a), s = Math.sin(a);
  return transform(shape, [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]);
}
