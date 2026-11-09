// The display list compiler: scene items in scene units -> band instances,
// segments, paints and index lists in pixels, ready for
// VECTOR_WGSL. Pure; runs in Node.
//
// An item: { shape, fill, stroke, width, opacity, blur, z, rule, blend, screen,
//            join, cap, miterLimit, dash, dashOffset, clip, clipRule }
//   shape    contours (path.mjs) in scene units (1920 x 1080 by default)
//   fill     colour, paint (paint.mjs) or null; stroke: colour, paint or null
//   width    stroke width in scene units
//   opacity  0..1; blur: extra softness in scene units; z: depth (0 is the focal plane)
//   rule     "nonzero" (default) or "evenodd"; blend: "over" (default) or "add"
//   screen   true: placed in screen space, not moved by the camera (labels, captions)
//   join     "round" (default), "miter" or "bevel"; cap: "round" (default), "butt" or "square"
//   miterLimit  4 by default; dash: [on, off, ...] in scene units; dashOffset
//   clip     contours that clip the item (filled by clipRule, "nonzero" by default)
// A colour is "#rrggbb", "#rrggbbaa" or [r, g, b, a] in 0..1.
//
// A round-joined, round-capped, undashed stroke is covered by its distance to
// the segments, as before. Any other stroke is cut into convex pieces
// (stroke.mjs) whose outlines are filled as one nonzero region. That region, a
// fill whose contours cross (a self-intersecting path, or glyphs drawn as
// overlapping parts) and such a clip get exact edges (edges.mjs): segments split
// where they cross and classed, so overlaps leave no seams and corners are
// covered from both of their edges.
//
// The camera: { x, y, zoom, distance, focus, aperture }. A point p on depth z
// lands at centre + (p - [x, y]) * zoom * distance / (distance + z), so layers
// at different depths move at different rates (parallax) and a zoom flies
// through scale. Defocus is aperture * |z - focus| / (distance + z), in scene
// units, and widens the coverage ramp: depth of field without a blur pass.
import { dash as dashShape } from "./path.mjs";
import { strokeOutline } from "./stroke.mjs";
import { exactEdges, crosses } from "./edges.mjs";
export { crosses };
import { isPaint, packPaint, PAINT } from "./paint.mjs";

export const BAND = 16;          // band height in pixels
export const INST = 24;          // floats per instance
const CHUNK = 128;               // bands split into chunks this wide (strokes, and fills of closed contours)
export const DEFAULT_CAMERA = Object.freeze({ x: 960, y: 540, zoom: 1, distance: 1000, focus: 0, aperture: 0 });

const hexCache = new Map();
export function rgba(c, opacity = 1) {
  if (c == null) return null;
  let v = c;
  if (typeof c === "string") {
    v = hexCache.get(c);
    if (!v) {
      const h = c.replace("#", "");
      const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
      v = [n(0), n(2), n(4), h.length >= 8 ? n(6) : 1];
      hexCache.set(c, v);
    }
  }
  const a = (v[3] ?? 1) * opacity;
  return [v[0] * a, v[1] * a, v[2] * a, a];   // premultiplied
}

class Grow {
  constructor(Type, n) { this.T = Type; this.a = new Type(n); this.n = 0; }
  need(k) {
    if (this.n + k > this.a.length) { const b = new this.T(Math.max(this.a.length * 2, this.n + k)); b.set(this.a.subarray(0, this.n)); this.a = b; }
    if (this.T === Float32Array && (!this.u || this.u.buffer !== this.a.buffer)) this.u = new Uint32Array(this.a.buffer);
  }
  push(...v) { this.need(v.length); for (const x of v) this.a[this.n++] = x; }
  view() { return this.a.subarray(0, this.n); }
}

// Project a scene item's geometry; returns the pixel mapping or null if culled.
export function project(item, cam, W, H, design = [1920, 1080]) {
  const base = W / design[0];
  let k = 1, ox = 0, oy = 0, blur = (item.blur || 0) * base;
  if (item.screen) { k = base; }
  else {
    const z = item.z || 0, depth = cam.distance + z;
    if (depth <= 1e-3) return null;
    const persp = cam.distance / depth;
    k = cam.zoom * persp * base;
    ox = W / 2 - cam.x * k; oy = H / 2 - cam.y * k;
    blur += cam.aperture * Math.abs(z - cam.focus) / depth * cam.zoom * base;
  }
  return { k, ox, oy, blur, hw: item.stroke ? Math.max(0, (item.width ?? 2) * (item.hairline ? base : k)) / 2 : 0 };
}

// Contours to pixel segments in o.segs; returns their bounds, per-contour x extents and owners.
function emitSegments(o, shape, k, ox, oy, forceClosed = false) {
  const g = { s0: o.segs.n / 4, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, cxa: [], cxb: [], segOf: [], allClosed: true };
  for (const c of shape) {
    const p = c.pts, n = p.length / 2, closed = c.closed || forceClosed;
    if (n < 2) continue;
    if (!closed) g.allClosed = false;
    let ca = Infinity, cb = -Infinity;
    const first = o.segs.n / 4, m = closed ? n : n - 1;
    o.segs.need(4 * m);
    const A = o.segs.a;
    for (let i = 0; i < m; i++) {
      const a = i, b = (i + 1) % n;
      const ax = p[2 * a] * k + ox, ay = p[2 * a + 1] * k + oy, bx = p[2 * b] * k + ox, by = p[2 * b + 1] * k + oy;
      if (ax === bx && ay === by && !(n === 2 && !closed)) continue;
      const j = o.segs.n; A[j] = ax; A[j + 1] = ay; A[j + 2] = bx; A[j + 3] = by; o.segs.n += 4;
      g.x0 = Math.min(g.x0, ax, bx); g.x1 = Math.max(g.x1, ax, bx); g.y0 = Math.min(g.y0, ay, by); g.y1 = Math.max(g.y1, ay, by);
      ca = Math.min(ca, ax, bx); cb = Math.max(cb, ax, bx);
    }
    g.cxa.push(ca); g.cxb.push(cb);
    for (let q = first; q < o.segs.n / 4; q++) g.segOf.push(g.cxa.length - 1);
  }
  g.n = o.segs.n / 4 - g.s0;
  if (o.flag) {                                       // plain segments carry no edge flags
    if (g.s0 + g.n > o.flag.n) { o.flag.need(g.s0 + g.n - o.flag.n); o.flag.n = g.s0 + g.n; }
    o.flag.a.fill(0, g.s0, g.s0 + g.n);
  }
  return g;
}

// Exact edges (edges.mjs) of pixel contours as segments; flags go to o.flag per segment.
function emitExact(o, shape, rule) {
  const E = exactEdges(shape, rule), n = E.kind.length;
  const g = { s0: o.segs.n / 4, n, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, cxa: [], cxb: [], segOf: [], allClosed: true };
  o.segs.need(4 * n); o.segs.a.set(E.segs, o.segs.n); o.segs.n += 4 * n;
  if (g.s0 + n > o.flag.n) o.flag.need(g.s0 + n - o.flag.n);
  for (let i = 0; i < n; i++) {
    o.flag.a[g.s0 + i] = E.kind[i] === 0 ? 0x80000000 : E.kind[i] === 2 ? 0x40000000 : 0;
    const ci = E.contour[i], ax = E.segs[4 * i], ay = E.segs[4 * i + 1], bx = E.segs[4 * i + 2], by = E.segs[4 * i + 3];
    while (g.cxa.length <= ci) { g.cxa.push(Infinity); g.cxb.push(-Infinity); }
    g.cxa[ci] = Math.min(g.cxa[ci], ax, bx); g.cxb[ci] = Math.max(g.cxb[ci], ax, bx);
    g.x0 = Math.min(g.x0, ax, bx); g.x1 = Math.max(g.x1, ax, bx); g.y0 = Math.min(g.y0, ay, by); g.y1 = Math.max(g.y1, ay, by);
    g.segOf.push(ci);
  }
  o.flag.n = Math.max(o.flag.n, g.s0 + n);
  return g;
}

// Pixel-space copies of contours.
const toPixels = (shape, k, ox, oy) => shape.map((c) => {
  const q = new Float32Array(c.pts.length);
  for (let i = 0; i < q.length; i += 2) { q[i] = c.pts[i] * k + ox; q[i + 1] = c.pts[i + 1] * k + oy; }
  return { pts: q, closed: c.closed };
});

// A styled stroke's outline (stroke.mjs) as closed contours in pixels, emitted as segments.
function emitOutline(o, item, P) {
  const k = P.k;
  let shape = item.shape;
  if (item.dash && item.dash.length) shape = dashShape(shape, item.dash, item.dashOffset || 0);
  const outline = strokeOutline(toPixels(shape, k, P.ox, P.oy), { hw: P.hw, join: item.join || "round", cap: item.cap || "round", miterLimit: item.miterLimit ?? 4 });
  return emitExact(o, outline, "nonzero");
}

const styled = (it) => !!(it.stroke && ((it.join && it.join !== "round") || (it.cap && it.cap !== "round") || (it.dash && it.dash.length)));
const solid = (c) => !isPaint(c);

// Add index i to every bin its box [xa, ya, xb, yb] (pixels, padded) overlaps.
function binBox(B, list, i, xa, ya, xb, yb, onlyExisting) {
  const ba = Math.max(B.b0, Math.floor(ya / BAND)), bb = Math.min(B.b1, Math.floor(yb / BAND));
  let ca = 0, cb = 0;
  if (B.chunked) { ca = Math.max(B.cx0, Math.floor(xa / CHUNK)) - B.cx0; cb = Math.min(B.cx1, Math.floor(xb / CHUNK)) - B.cx0; }
  for (let b = ba; b <= bb; b++) for (let c = ca; c <= cb; c++) {
    const key = (b - B.b0) * B.ncx + c;
    let bin = B.bins[key];
    if (!bin) { if (onlyExisting) continue; bin = B.bins[key] = { segs: [], pieces: [], clips: [] }; }
    bin[list].push(i);
  }
}

// Segments of g into bins: a stroke needs only nearby segments; a fill needs its whole
// contour wherever it overlaps (a closed contour wholly to one side of a pixel adds
// nothing to its winding number, so a chunk needs only the contours that overlap it).
function binSegments(B, o, g, pad, byContour, list, onlyExisting) {
  const S = o.segs.a;
  for (let s = g.s0; s < g.s0 + g.n; s++) {
    const ya = Math.min(S[4 * s + 1], S[4 * s + 3]) - pad, yb = Math.max(S[4 * s + 1], S[4 * s + 3]) + pad;
    const ci = g.segOf[s - g.s0];
    const xa = (byContour ? g.cxa[ci] : Math.min(S[4 * s], S[4 * s + 2])) - pad, xb = (byContour ? g.cxb[ci] : Math.max(S[4 * s], S[4 * s + 2])) + pad;
    binBox(B, list, s | (o.flag.a[s] || 0), xa, ya, xb, yb, onlyExisting);
  }
}

export function compile(items, cam = DEFAULT_CAMERA, W = 1920, H = 1080, design = [1920, 1080], out = null, images = null) {
  cam = { ...DEFAULT_CAMERA, ...cam };
  const o = out || { inst: new Grow(Float32Array, INST * 256), segs: new Grow(Float32Array, 4 * 4096), idx: new Grow(Uint32Array, 8192) };
  if (!o.paints) o.paints = new Grow(Float32Array, PAINT * 4);
  if (!o.flag) o.flag = new Grow(Uint32Array, 4096);
  o.inst.n = 0; o.segs.n = 0; o.idx.n = 0; o.paints.n = 0; o.flag.n = 0; o.flag.a.fill(0);
  o.paints.push(...new Float32Array(PAINT));                    // paint 0: flat colour
  const runs = [];
  const stats = { items: 0, culled: 0, segments: 0, instances: 0 };
  const run = (blend) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === "vector" && last.blend === blend) return last;
    const r = { kind: "vector", blend, first: o.inst.n / INST, count: 0 };
    runs.push(r);
    return r;
  };
  for (const item of items) {
    if (!item) continue;
    if (!item.shape) { runs.push({ kind: item.kind || "other", item }); continue; }
    if (compileItem(o, item, cam, W, H, design, images, run, stats) === false) stats.culled++;
  }
  return { out: o, runs, inst: o.inst.view(), segs: o.segs.view(), idx: o.idx.view(), paints: o.paints.view(), stats };
}

function compileItem(o, item, cam, W, H, design, images, run, stats) {
  const op = item.opacity ?? 1;
  const fill = isPaint(item.fill) ? [op, op, op, op] : rgba(item.fill, op);
  const stroke = isPaint(item.stroke) ? [op, op, op, op] : rgba(item.stroke, op);
  const hasFill = !!fill && fill[3] > 0, hasStroke = !!stroke && stroke[3] > 0;
  if (!hasFill && !hasStroke) return true;
  const P = project(item, cam, W, H, design);
  if (!P) return false;
  const { k, ox, oy, blur, hw } = P;
  const pieceMode = hasStroke && styled(item);
  const needSegs = hasFill || (hasStroke && !pieceMode);
  const pad = hw + 1 + 2 * blur + 1, padP = 2 + 2 * blur;
  const s0 = o.segs.n, i0 = o.paints.n;
  let G = emitSegments(o, item.shape, k, ox, oy);
  if (!needSegs) { o.segs.n = s0; G.n = 0; G.s0 = s0 / 4; }
  const exactFill = hasFill && item.rule !== "evenodd" && (item.exact || crosses(o.segs.a, G.s0, G.n));
  if (exactFill) { o.segs.n = s0; G = emitExact(o, toPixels(item.shape, k, ox, oy), "nonzero"); }
  const PG = pieceMode ? emitOutline(o, item, P) : null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  if (G.n) { x0 = G.x0 - pad; y0 = G.y0 - pad; x1 = G.x1 + pad; y1 = G.y1 + pad; }
  if (PG && PG.n) { x0 = Math.min(x0, PG.x0 - padP); y0 = Math.min(y0, PG.y0 - padP); x1 = Math.max(x1, PG.x1 + padP); y1 = Math.max(y1, PG.y1 + padP); }
  const rollback = () => { o.segs.n = s0; o.paints.n = i0; return false; };
  if (!G.n && !(PG && PG.n)) return rollback();
  if (x1 < 0 || y1 < 0 || x0 > W || y0 > H || (x1 - x0) < 0.2) return rollback();
  // A clip: its contours (always closed) as segments, and its box.
  let C = null;
  if (item.clip) {
    C = emitSegments(o, item.clip, k, ox, oy, true);
    if (item.clipRule !== "evenodd" && (item.exact || crosses(o.segs.a, C.s0, C.n))) {
      o.segs.n = C.s0 * 4; C = emitExact(o, toPixels(item.clip, k, ox, oy), "nonzero"); C.exact = true;
    }
    const pc = 1 + 2 * blur + 1;
    if (!C.n) return rollback();
    x0 = Math.max(x0, C.x0 - pc); y0 = Math.max(y0, C.y0 - pc); x1 = Math.min(x1, C.x1 + pc); y1 = Math.min(y1, C.y1 + pc);
    if (x1 <= x0 || y1 <= y0) return rollback();
  }
  stats.items++; stats.segments += G.n + (PG ? PG.n : 0);
  const fillPaint = hasFill && isPaint(item.fill) ? packPaint(o.paints, item.fill, k, ox, oy, images) : 0;
  const strokePaint = hasStroke && isPaint(item.stroke) ? packPaint(o.paints, item.stroke, k, ox, oy, images) : 0;
  const strokeOnly = !hasFill;
  const b0 = Math.max(0, Math.floor(y0 / BAND)), b1 = Math.min(Math.ceil(H / BAND) - 1, Math.floor(y1 / BAND));
  if (b1 < b0) return true;
  const cx0 = Math.max(0, Math.floor(x0 / CHUNK)), cx1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor(x1 / CHUNK));
  const chunked = strokeOnly || G.allClosed;
  const B = { b0, b1, cx0, cx1, chunked, ncx: chunked ? Math.max(1, cx1 - cx0 + 1) : 1, bins: [] };
  if (G.n) binSegments(B, o, G, pad, !strokeOnly, "segs", false);
  if (PG) binSegments(B, o, PG, padP, true, "pieces", false);
  if (C) binSegments(B, o, C, 1 + 2 * blur + 1, true, "clips", true);
  const r = run(item.blend === "add" ? "add" : "over");
  const exactClip = !!(C && C.exact);
  const flags = (pieceMode ? 1 : 0) | (C && item.clipRule === "evenodd" ? 2 : 0) | (C ? 4 : 0) | (exactFill ? 8 : 0) | (exactClip ? 16 : 0);
  const F = hasFill ? fill : [0, 0, 0, 0], T = hasStroke ? stroke : [0, 0, 0, 0];
  for (let key = 0; key < B.bins.length; key++) {
    const bin = B.bins[key];
    if (!bin || (!bin.segs.length && !bin.pieces.length)) continue;
    const b = b0 + Math.floor(key / B.ncx), c = key % B.ncx;
    let bx0 = x0, bx1 = x1;
    if (chunked) { bx0 = Math.max(bx0, (cx0 + c) * CHUNK); bx1 = Math.min(bx1, (cx0 + c + 1) * CHUNK); }
    const by0 = Math.max(y0, b * BAND), by1 = Math.min(y1, (b + 1) * BAND);
    bx0 = Math.max(0, bx0); bx1 = Math.min(W, bx1);
    if (bx1 <= bx0 || by1 <= by0) continue;
    const starts = [];
    for (const list of [bin.segs, bin.pieces, bin.clips]) {
      starts.push(o.idx.n);
      o.idx.need(list.length); o.idx.a.set(list, o.idx.n); o.idx.n += list.length;
    }
    o.inst.need(INST);
    const f = o.inst.a, i = o.inst.n, U = o.inst.u;
    f.set([bx0, by0, bx1, by1, ...F, ...T, hw, blur, item.rule === "evenodd" ? 1 : 0, flags], i);
    U[i + 16] = starts[0]; U[i + 17] = bin.segs.length; U[i + 18] = starts[1]; U[i + 19] = bin.pieces.length;
    U[i + 20] = starts[2]; U[i + 21] = bin.clips.length; U[i + 22] = fillPaint; U[i + 23] = strokePaint;
    o.inst.n += INST;
    r.count++; stats.instances++;
  }
  return true;
}
