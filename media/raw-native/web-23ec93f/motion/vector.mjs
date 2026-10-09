// The display list compiler: scene items in scene units -> band instances,
// segments and index lists in pixels, ready for VECTOR_WGSL. Pure; runs in Node.
//
// An item: { shape, fill, stroke, width, opacity, blur, z, rule, blend, screen }
//   shape    contours (path.mjs) in scene units (1920 x 1080 by default)
//   fill     colour or null; stroke: colour or null; width: stroke width in scene units
//   opacity  0..1; blur: extra softness in scene units; z: depth (0 is the focal plane)
//   rule     "nonzero" (default) or "evenodd"; blend: "over" (default) or "add"
//   screen   true: placed in screen space, not moved by the camera (labels, captions)
// A colour is "#rrggbb", "#rrggbbaa" or [r, g, b, a] in 0..1.
//
// The camera: { x, y, zoom, distance, focus, aperture }. A point p on depth z
// lands at centre + (p - [x, y]) * zoom * distance / (distance + z), so layers
// at different depths move at different rates (parallax) and a zoom flies
// through scale. Defocus is aperture * |z - focus| / (distance + z), in scene
// units, and widens the coverage ramp: depth of field without a blur pass.

export const BAND = 16;          // band height in pixels
const CHUNK = 256;               // stroke-only bands split into chunks this wide
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

// Project a scene item's geometry; returns segments in pixels or null if culled.
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

export function compile(items, cam = DEFAULT_CAMERA, W = 1920, H = 1080, design = [1920, 1080], out = null) {
  cam = { ...DEFAULT_CAMERA, ...cam };
  const o = out || { inst: new Grow(Float32Array, 20 * 256), segs: new Grow(Float32Array, 4 * 4096), idx: new Grow(Uint32Array, 8192) };
  o.inst.n = 0; o.segs.n = 0; o.idx.n = 0;
  const runs = [];
  let stats = { items: 0, culled: 0, segments: 0, instances: 0 };
  const run = (blend) => {
    const last = runs[runs.length - 1];
    if (last && last.kind === "vector" && last.blend === blend) return last;
    const r = { kind: "vector", blend, first: o.inst.n / 20, count: 0 };
    runs.push(r);
    return r;
  };
  for (const item of items) {
    if (!item) continue;
    if (!item.shape) { runs.push({ kind: item.kind || "other", item }); continue; }
    const op = item.opacity ?? 1;
    const fill = rgba(item.fill, op), stroke = rgba(item.stroke, op);
    if ((!fill || fill[3] <= 0) && (!stroke || stroke[3] <= 0)) continue;
    const P = project(item, cam, W, H, design);
    if (!P) { stats.culled++; continue; }
    const { k, ox, oy, blur, hw } = P;
    const pad = hw + 1 + 2 * blur + 1;
    // Segments in pixels.
    const s0 = o.segs.n / 4;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of item.shape) {
      const p = c.pts, n = p.length / 2;
      if (n < 2) continue;
      const m = c.closed ? n : n - 1;
      o.segs.need(4 * m);
      const A = o.segs.a;
      for (let i = 0; i < m; i++) {
        const a = i, b = (i + 1) % n;
        const ax = p[2 * a] * k + ox, ay = p[2 * a + 1] * k + oy, bx = p[2 * b] * k + ox, by = p[2 * b + 1] * k + oy;
        if (ax === bx && ay === by && !(n === 2 && !c.closed)) continue;
        const j = o.segs.n; A[j] = ax; A[j + 1] = ay; A[j + 2] = bx; A[j + 3] = by; o.segs.n += 4;
        if (ax < x0) x0 = ax; if (bx < x0) x0 = bx; if (ax > x1) x1 = ax; if (bx > x1) x1 = bx;
        if (ay < y0) y0 = ay; if (by < y0) y0 = by; if (ay > y1) y1 = ay; if (by > y1) y1 = by;
      }
    }
    const nseg = o.segs.n / 4 - s0;
    if (!nseg || x1 + pad < 0 || y1 + pad < 0 || x0 - pad > W || y0 - pad > H || (x1 - x0 + 2 * pad) < 0.2) { o.segs.n = s0 * 4; stats.culled++; continue; }
    stats.items++; stats.segments += nseg;
    // Bin segments into bands (and, for stroke-only items, x chunks).
    const strokeOnly = !fill || fill[3] <= 0;
    const b0 = Math.max(0, Math.floor((y0 - pad) / BAND)), b1 = Math.min(Math.ceil(H / BAND) - 1, Math.floor((y1 + pad) / BAND));
    if (b1 < b0) continue;
    const nb = b1 - b0 + 1;
    const cx0 = Math.max(0, Math.floor((x0 - pad) / CHUNK)), cx1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor((x1 + pad) / CHUNK));
    const ncx = strokeOnly ? Math.max(1, cx1 - cx0 + 1) : 1;
    const bins = new Array(nb * ncx);
    const S = o.segs.a;
    for (let s = s0; s < s0 + nseg; s++) {
      const ya = Math.min(S[4 * s + 1], S[4 * s + 3]) - pad, yb = Math.max(S[4 * s + 1], S[4 * s + 3]) + pad;
      const ba = Math.max(b0, Math.floor(ya / BAND)), bb = Math.min(b1, Math.floor(yb / BAND));
      let ca = 0, cb = 0;
      if (strokeOnly) {
        const xa = Math.min(S[4 * s], S[4 * s + 2]) - pad, xb = Math.max(S[4 * s], S[4 * s + 2]) + pad;
        ca = Math.max(cx0, Math.floor(xa / CHUNK)) - cx0; cb = Math.min(cx1, Math.floor(xb / CHUNK)) - cx0;
      }
      for (let b = ba; b <= bb; b++) for (let c = ca; c <= cb; c++) {
        const key = (b - b0) * ncx + c;
        (bins[key] || (bins[key] = [])).push(s);
      }
    }
    const r = run(item.blend === "add" ? "add" : "over");
    const rule = item.rule === "evenodd" ? 1 : 0;
    for (let key = 0; key < bins.length; key++) {
      const list = bins[key];
      if (!list) continue;
      const b = b0 + Math.floor(key / ncx), c = key % ncx;
      let bx0 = x0 - pad, bx1 = x1 + pad;
      if (strokeOnly) { bx0 = Math.max(bx0, (cx0 + c) * CHUNK); bx1 = Math.min(bx1, (cx0 + c + 1) * CHUNK); }
      const by0 = Math.max(y0 - pad, b * BAND), by1 = Math.min(y1 + pad, (b + 1) * BAND);
      bx0 = Math.max(0, bx0); bx1 = Math.min(W, bx1);
      if (bx1 <= bx0 || by1 <= by0) continue;
      const start = o.idx.n;
      o.idx.need(list.length);
      o.idx.a.set(list, start); o.idx.n += list.length;
      o.inst.need(20);
      const f = o.inst.a, i = o.inst.n;
      f[i] = bx0; f[i + 1] = by0; f[i + 2] = bx1; f[i + 3] = by1;
      const F = fill || [0, 0, 0, 0], T = stroke || [0, 0, 0, 0];
      f[i + 4] = F[0]; f[i + 5] = F[1]; f[i + 6] = F[2]; f[i + 7] = F[3];
      f[i + 8] = T[0]; f[i + 9] = T[1]; f[i + 10] = T[2]; f[i + 11] = T[3];
      f[i + 12] = hw; f[i + 13] = blur; f[i + 14] = rule; f[i + 15] = 0;
      o.inst.n += 20;
      const U = o.inst.u;
      U[i + 16] = start; U[i + 17] = list.length; U[i + 18] = 0; U[i + 19] = 0;
      r.count++; stats.instances++;
    }
  }
  return { out: o, runs, inst: o.inst.view(), segs: o.segs.view(), idx: o.idx.view(), stats };
}
