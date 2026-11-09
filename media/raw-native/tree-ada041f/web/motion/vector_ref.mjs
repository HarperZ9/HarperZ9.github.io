// The CPU reference for vector items (M1 exit criterion 4): box-filtered coverage
// from 16 x 16 point samples per pixel of the exact region, written apart from
// the GPU path. Fills use the winding number at each sample; strokes are tested
// against their segments, joins and caps, built here from the SVG definitions
// (the miter tip as the intersection of the outer offset lines); clips use the
// clip path's winding. Paint is evaluated at the pixel centre. Pixels no
// boundary crosses take one sample. Pure: runs in Node.
//
//   const { rgba, cls } = reference(item, { width: 256, height: 256, images });
//   // rgba: Float32Array premultiplied; cls: 0 outside, 1 edge, 2 interior (see the corpus bounds)
import { dash } from "./path.mjs";

const SS = 16;

function hexColour(c) {
  if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] ?? 1];
  const h = c.replace("#", ""), n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), h.length >= 8 ? n(6) : 1];
}

// Winding number of closed contours at (x, y), by signed crossings of a ray to +x.
function winding(shape, x, y) {
  let w = 0, cr = 0;
  for (const c of shape) {
    const p = c.pts, n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = p[2 * i], ay = p[2 * i + 1], j = (i + 1) % n, bx = p[2 * j], by = p[2 * j + 1];
      if ((ay <= y) !== (by <= y)) {
        const xi = ax + ((y - ay) * (bx - ax)) / (by - ay);
        if (xi > x) { w += by > ay ? 1 : -1; cr++; }
      }
    }
  }
  return { w, cr };
}
const insideFill = (shape, rule, x, y) => { const r = winding(shape, x, y); return rule === "evenodd" ? (r.cr & 1) === 1 : r.w !== 0; };

// Stroke region primitives: convex polygons and discs, from the SVG definitions.
function strokePrims(shape, hw, join, cap, limit) {
  const polys = [], discs = [];
  const quad = (pts) => polys.push(pts);
  for (const c of shape) {
    const v = [];
    for (let i = 0; i < c.pts.length; i += 2) {
      const x = c.pts[i], y = c.pts[i + 1], l = v[v.length - 1];
      if (!l || l[0] !== x || l[1] !== y) v.push([x, y]);
    }
    if (c.closed && v.length > 1 && v[0][0] === v[v.length - 1][0] && v[0][1] === v[v.length - 1][1]) v.pop();
    if (v.length === 1) {
      if (c.closed) continue;
      const [x, y] = v[0];
      if (cap === "round") discs.push([x, y, hw]);
      if (cap === "square") quad([[x - hw, y - hw], [x + hw, y - hw], [x + hw, y + hw], [x - hw, y + hw]]);
      continue;
    }
    const closed = c.closed && v.length > 2, m = v.length, segs = closed ? m : m - 1;
    const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    const off = (p, d, s) => [p[0] - s * d[1] * hw, p[1] + s * d[0] * hw];
    const D = [];
    for (let i = 0; i < segs; i++) {
      const a = v[i], b = v[(i + 1) % m], d = unit(a, b);
      D.push(d);
      quad([off(a, d, 1), off(b, d, 1), off(b, d, -1), off(a, d, -1)]);
    }
    const joinAt = (p, d0, d1) => {
      const cr = d0[0] * d1[1] - d0[1] * d1[0];
      if (Math.abs(cr) < 1e-9 && d0[0] * d1[0] + d0[1] * d1[1] > 0) return;
      if (join === "round") { discs.push([p[0], p[1], hw]); return; }
      const s = cr > 0 ? -1 : 1, A = off(p, d0, s), Bp = off(p, d1, s);
      if (join === "miter" && Math.abs(cr) > 1e-12) {
        // Intersection of the outer offset lines A + t d0 and Bp + u d1.
        const t = ((Bp[0] - A[0]) * d1[1] - (Bp[1] - A[1]) * d1[0]) / cr;
        const tip = [A[0] + t * d0[0], A[1] + t * d0[1]];
        if (Math.hypot(tip[0] - p[0], tip[1] - p[1]) / hw <= limit) { quad([p, A, tip, Bp]); return; }
      }
      quad([p, A, Bp]);
    };
    for (let i = closed ? 0 : 1; i < (closed ? m : m - 1); i++) joinAt(v[i], D[(i - 1 + segs) % segs], D[i % segs]);
    if (!closed) {
      for (const [p, d, s] of [[v[0], D[0], -1], [v[m - 1], D[segs - 1], 1]]) {
        if (cap === "round") discs.push([p[0], p[1], hw]);
        else if (cap === "square") { const e = [p[0] + s * d[0] * hw, p[1] + s * d[1] * hw]; quad([off(p, d, 1), off(e, d, 1), off(e, d, -1), off(p, d, -1)]); }
      }
    }
  }
  return { polys, discs };
}

function inConvex(pts, x, y) {
  let pos = 0, neg = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c > 0) pos++; else if (c < 0) neg++;
  }
  return (pos === 0 || neg === 0) && pos + neg > 0;
}
const inStroke = (P, x, y) => P.discs.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r) || P.polys.some((q) => inConvex(q, x, y));

// Does segment ab cross the box [x0, x0 + 1] x [y0, y0 + 1] (grown by e)?
function segHitsBox(ax, ay, bx, by, x0, y0, e) {
  const xa = x0 - e, xb = x0 + 1 + e, ya = y0 - e, yb = y0 + 1 + e;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - xa], [dx, xb - ax], [-dy, ay - ya], [dy, yb - ay]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

// Boundary pieces as segments and circles, for finding the pixels a boundary crosses.
function boundaries(item, fillShape, P, clipShape) {
  const segs = [], circles = [];
  const addPoly = (pts, closed) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; segs.push([a[0], a[1], b[0], b[1]]); } };
  const contourPts = (c) => { const q = []; for (let i = 0; i < c.pts.length; i += 2) q.push([c.pts[i], c.pts[i + 1]]); return q; };
  if (fillShape) for (const c of fillShape) addPoly(contourPts(c), true);
  if (clipShape) for (const c of clipShape) addPoly(contourPts(c), true);
  if (P) { for (const q of P.polys) addPoly(q, true); for (const d of P.discs) circles.push(d); }
  return { segs, circles };
}

function crossesPixel(B, x, y) {
  for (const s of B.segs) if (segHitsBox(s[0], s[1], s[2], s[3], x, y, 1e-6)) return true;
  for (const [cx, cy, r] of B.circles) {
    const nx = Math.min(Math.max(cx, x), x + 1), ny = Math.min(Math.max(cy, y), y + 1);
    const near = Math.hypot(cx - nx, cy - ny), far = Math.max(Math.hypot(cx - x, cy - y), Math.hypot(cx - x - 1, cy - y), Math.hypot(cx - x, cy - y - 1), Math.hypot(cx - x - 1, cy - y - 1));
    if (near <= r + 1e-6 && far >= r - 1e-6) return true;
  }
  return false;
}

function paintColour(paint, x, y, images) {
  if (!paint) return null;
  if (typeof paint === "string" || Array.isArray(paint)) { const c = hexColour(paint); return [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]]; }
  if (paint.image) {
    const im = images[paint.image], [rx, ry, rw, rh] = paint.rect;
    // Texel centres at (i + 0.5) / w; clamp to the edge texels.
    const fx = Math.min(Math.max(((x - rx) / rw) * im.width - 0.5, 0), im.width - 1), fy = Math.min(Math.max(((y - ry) / rh) * im.height - 0.5, 0), im.height - 1);
    const ix = Math.min(Math.floor(fx), im.width - 2), iy = Math.min(Math.floor(fy), im.height - 2), ux = fx - ix, uy = fy - iy;
    const t = (i, j, k) => im.data[4 * (j * im.width + i) + k] / 255;
    const c = [0, 1, 2, 3].map((k) => (t(ix, iy, k) * (1 - ux) + t(ix + 1, iy, k) * ux) * (1 - uy) + (t(ix, iy + 1, k) * (1 - ux) + t(ix + 1, iy + 1, k) * ux) * uy);
    return [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]];
  }
  let t;
  if (paint.linear) { const [x0, y0, x1, y1] = paint.linear, ex = x1 - x0, ey = y1 - y0; t = ((x - x0) * ex + (y - y0) * ey) / (ex * ex + ey * ey); }
  else { const [cx, cy, r] = paint.radial; t = Math.hypot(x - cx, y - cy) / r; }
  const st = paint.stops.map(([o, c]) => [o, hexColour(c)]);
  let c;
  if (t <= st[0][0]) c = st[0][1];
  else if (t >= st[st.length - 1][0]) c = st[st.length - 1][1];
  else {
    let k = 0;
    while (t > st[k + 1][0]) k++;
    const u = (t - st[k][0]) / (st[k + 1][0] - st[k][0]);
    c = st[k][1].map((v, j) => v + (st[k + 1][1][j] - v) * u);
  }
  return [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]];
}

export function reference(item, { width: W = 256, height: H = 256, images = {} } = {}) {
  const hasFill = item.fill != null, hasStroke = item.stroke != null;
  const fillShape = hasFill ? item.shape : null;
  const strokeShape = hasStroke && item.dash && item.dash.length ? dash(item.shape, item.dash, item.dashOffset || 0) : item.shape;
  const P = hasStroke ? strokePrims(strokeShape, (item.width ?? 2) / 2, item.join || "round", item.cap || "round", item.miterLimit ?? 4) : null;
  const B = boundaries(item, fillShape, P, item.clip);
  const rgba = new Float32Array(W * H * 4), state = new Int8Array(W * H);   // state: 0 none, 1 crossed, 2 all inside
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    const F = paintColour(item.fill, cx, cy, item.images || images), S = paintColour(item.stroke, cx, cy, item.images || images);
    const sample = (sx, sy) => {
      if (item.clip && !insideFill(item.clip, item.clipRule || "nonzero", sx, sy)) return null;
      const f = hasFill && insideFill(fillShape, item.rule || "nonzero", sx, sy), s = hasStroke && inStroke(P, sx, sy);
      if (!f && !s) return null;
      let c = f ? F : [0, 0, 0, 0];
      if (s) c = S.map((v, j) => v + c[j] * (1 - S[3]));
      return c;
    };
    const crossed = crossesPixel(B, x, y), acc = [0, 0, 0, 0];
    let hits = 0;
    const n = crossed ? SS : 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = sample(x + (i + 0.5) / n, y + (j + 0.5) / n);
      if (c) { hits++; for (let k = 0; k < 4; k++) acc[k] += c[k]; }
    }
    const o = 4 * (y * W + x);
    for (let k = 0; k < 4; k++) rgba[o + k] = acc[k] / (n * n);
    state[y * W + x] = crossed ? 1 : hits ? 2 : 0;
  }
  // Classes: interior when this pixel and its eight neighbours are uncrossed and inside,
  // outside when they are uncrossed and outside, edge otherwise.
  const cls = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = state[y * W + x];
    let uniform = s !== 1;
    for (let j = -1; j <= 1 && uniform; j++) for (let i = -1; i <= 1 && uniform; i++) {
      const xx = x + i, yy = y + j;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (state[yy * W + xx] !== s) uniform = false;
    }
    cls[y * W + x] = !uniform ? 1 : s === 2 ? 2 : 0;
  }
  return { rgba, cls };
}
