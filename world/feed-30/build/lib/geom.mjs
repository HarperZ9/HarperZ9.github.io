// lib/geom.mjs: rasterising centre lines into coverage and frame fields. Pure.
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

/**
 * Coverage of a variable-width ribbon: pts [[x, y]...], widths per point (px, full width). Each segment is a
 * capsule whose radius blends linearly between its two ends; one-pixel antialiased edge. Max-combined into cov.
 */
export function ribbonInto(cov, w, h, pts, widths) {
  for (let i = 0; i + 1 < pts.length || (pts.length === 1 && i === 0); i++) {
    const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], ra = widths[i] / 2, rb = widths[Math.min(i + 1, pts.length - 1)] / 2, R = Math.max(ra, rb);
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - R - 1)), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + R + 1));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - R - 1)), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + R + 1));
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - a[0], py = y + 0.5 - a[1], t = clamp((px * dx + py * dy) / L2), d = Math.hypot(px - t * dx, py - t * dy), r = ra + (rb - ra) * t;
      const c = clamp(r - d + 0.5), j = y * w + x; if (c > cov[j]) cov[j] = c;
    }
    if (pts.length === 1) break;
  }
  return cov;
}

/** Coverage of a polygon by 4x4 supersampling inside its bounding box (convex or not, even-odd). */
export function polygonInto(cov, w, h, poly, alpha = 1) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) {
    let n = 0; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(poly, x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n++;
    const c = (n / 16) * alpha, j = y * w + x; if (c > cov[j]) cov[j] = c;
  }
  return cov;
}
function inside(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }

/**
 * The frame field of a set of tubes around centre lines: for each pixel within radius r of a stroke, the stroke
 * index, the arc length s along it, and the signed cross coordinate t in [-1, 1] (t < 0 left of travel). A later
 * stroke wins where tubes cross (drawing order). Returns { id: Int32Array (-1 outside), s, t, r: per stroke }.
 */
export function frameField(w, h, strokes, radius, { nearest = false } = {}) {
  const id = new Int32Array(w * h).fill(-1), S = new Float32Array(w * h), T = new Float32Array(w * h), D = new Float32Array(w * h).fill(Infinity), stamp = new Int32Array(w * h).fill(-1);
  strokes.forEach((st, k) => {
    const r = typeof radius === 'function' ? radius(st, k) : radius, P = st.pts; let acc = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9, L2 = L * L;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r - 1)), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + r + 1));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 1)), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + r + 1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1], u = clamp((px * dx + py * dy) / L2), qx = px - u * dx, qy = py - u * dy, d = Math.hypot(qx, qy);
        if (d > r) continue;
        const j = y * w + x; if ((nearest || stamp[j] === k) && D[j] <= d) continue;
        stamp[j] = k; D[j] = d; id[j] = k; S[j] = acc + u * L; T[j] = (Math.sign(dx * py - dy * px) || 1) * d / r;
      }
      acc += L;
    }
  });
  return { id, s: S, t: T };
}

/**
 * Signed distance to an equilateral triangle centred on its centroid, half side r, apex up on screen (y down).
 * Pass -py for apex down. After Inigo Quilez's sdEquilateralTriangle (a published formula, rewritten here).
 */
export function triSdf(px, py, r) {
  const k = Math.sqrt(3);
  let x = Math.abs(px) - r, y = -py + r / k;
  if (x + k * y > 0) { const nx = (x - k * y) / 2, ny = (-k * x - y) / 2; x = nx; y = ny; }
  x -= clamp(x, -2 * r, 0);
  return -Math.hypot(x, y) * Math.sign(y);
}
