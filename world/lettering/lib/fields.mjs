// lib/fields.mjs: scalar fields over a glyph mask. Pure functions, no DOM, so node --test can run them.
//   edt(feature, w, h)        squared distance to the nearest feature pixel, and that pixel's index
//   sdf(mask, w, h)           signed distance in pixels, positive inside the letter
//   contours(mask, w, h)      closed outline loops by marching squares, with holes marked
//   components(mask, w, h)    connected pieces (a letter, the dot of an i), with bounding boxes
// The exact Euclidean transform is Felzenszwalb and Huttenlocher, "Distance Transforms of Sampled Functions" (2012).

const INF = 1e20;

// One dimension: lower envelope of parabolas. f is the cost row, out gets distances, arg the index of the winner.
function edt1d(f, n, out, arg, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; out[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; arg[q] = v[k]; }
}

// feature: truthy where the distance is zero. Returns { d2: Float32Array, near: Int32Array } (near is a pixel index).
export function edt(feature, w, h) {
  const n = Math.max(w, h), f = new Float64Array(n), out = new Float64Array(n), arg = new Int32Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const d2 = new Float32Array(w * h), rowArg = new Int32Array(w * h), near = new Int32Array(w * h);
  // columns first: each pixel learns its nearest feature row within its own column
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = feature[y * w + x] ? 0 : INF;
    edt1d(f, h, out, arg, v, z);
    for (let y = 0; y < h; y++) { d2[y * w + x] = out[y]; rowArg[y * w + x] = arg[y]; }
  }
  // then rows over those column results; the winner column plus its stored row is the nearest feature
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = d2[y * w + x];
    edt1d(f, w, out, arg, v, z);
    for (let x = 0; x < w; x++) { const c = arg[x]; d2[y * w + x] = out[x]; near[y * w + x] = rowArg[y * w + c] * w + c; }
  }
  return { d2, near };
}

// Signed distance, positive inside. The half-pixel offset puts the zero on the edge between pixels.
export function sdf(mask, w, h, iso = 0.5) {
  const n = w * h, inside = new Uint8Array(n), outside = new Uint8Array(n);
  for (let i = 0; i < n; i++) { inside[i] = mask[i] >= iso ? 1 : 0; outside[i] = 1 - inside[i]; }
  const a = edt(outside, w, h).d2, b = edt(inside, w, h).d2, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = inside[i] ? Math.sqrt(a[i]) - 0.5 : 0.5 - Math.sqrt(b[i]);
  return out;
}

// Largest inscribed radius: half the heaviest stroke. Used to scale every technique to the letter's weight.
export function maxInside(d) { let m = 0; for (let i = 0; i < d.length; i++) if (d[i] > m) m = d[i]; return m; }

// Typical stroke half-width: the median of the sdf over the skeleton, which ignores the fat joins.
export function medianAt(d, idx) { const v = idx.map(i => d[i]).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : 0; }

// Marching squares at iso, with linear interpolation. Returns loops [{ pts: [x,y,...], area, hole }].
// Area is signed in screen coordinates (y down): outer loops come out positive, holes (the counter of an o) negative.
export function contours(mask, w, h, iso = 0.5) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);
  const segs = new Map(); // edge key of a segment's start -> [endKey, x0, y0]
  const pt = (x0, y0, x1, y1) => { const a = at(x0, y0), b = at(x1, y1), t = (iso - a) / (b - a || 1e-9); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; };
  // edge ids: horizontal edge (x,y)-(x+1,y) is 2*(y*(w+1)+x), vertical (x,y)-(x,y+1) is that plus 1
  const H = (x, y) => 2 * ((y + 1) * (w + 2) + x + 1), V = (x, y) => H(x, y) + 1;
  const pos = new Map();
  const add = (e0, p0, e1, p1) => { segs.set(e0, e1); pos.set(e0, p0); pos.set(e1, pos.get(e1) || p1); };
  for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
    const tl = at(x, y) >= iso, tr = at(x + 1, y) >= iso, br = at(x + 1, y + 1) >= iso, bl = at(x, y + 1) >= iso;
    const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const T = [H(x, y), () => pt(x, y, x + 1, y)], R = [V(x + 1, y), () => pt(x + 1, y, x + 1, y + 1)];
    const B = [H(x, y + 1), () => pt(x, y + 1, x + 1, y + 1)], L = [V(x, y), () => pt(x, y, x, y + 1)];
    // segments keep the inside on their left in screen space (y down); outer loops then wind counter-clockwise on screen
    const S = (a, b) => add(a[0], a[1](), b[0], b[1]());
    switch (c) {
      case 1: S(B, L); break; case 2: S(R, B); break; case 3: S(R, L); break; case 4: S(T, R); break;
      case 5: S(T, L); S(B, R); break; case 6: S(T, B); break; case 7: S(T, L); break; case 8: S(L, T); break;
      case 9: S(B, T); break; case 10: S(L, B); S(R, T); break; case 11: S(R, T); break; case 12: S(L, R); break;
      case 13: S(B, R); break; case 14: S(L, B); break;
    }
  }
  const loops = [], seen = new Set();
  for (const start of segs.keys()) {
    if (seen.has(start)) continue;
    const pts = []; let e = start, guard = 0;
    while (e !== undefined && !seen.has(e) && guard++ < 1e7) { seen.add(e); const p = pos.get(e); pts.push(p[0], p[1]); e = segs.get(e); }
    if (pts.length < 6) continue;
    let area = 0; for (let i = 0; i < pts.length; i += 2) { const j = (i + 2) % pts.length; area += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; }
    area = -area / 2; loops.push({ pts, area, hole: area < 0 });
  }
  return loops;
}

// 8-connected components of mask >= iso. Returns { label: Int32Array (0 = none), parts: [{ id, x0, y0, x1, y1, n, cx, cy }] }.
export function components(mask, w, h, iso = 0.5) {
  const label = new Int32Array(w * h), parts = [], stack = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] || mask[s] < iso) continue;
    const id = parts.length + 1, p = { id, x0: w, y0: h, x1: 0, y1: 0, n: 0, cx: 0, cy: 0 };
    label[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      p.n++; p.cx += x; p.cy += y; if (x < p.x0) p.x0 = x; if (x > p.x1) p.x1 = x; if (y < p.y0) p.y0 = y; if (y > p.y1) p.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (!label[j] && mask[j] >= iso) { label[j] = id; stack.push(j); }
      }
    }
    p.cx /= p.n; p.cy /= p.n; parts.push(p);
  }
  return { label, parts };
}

// Bilinear sample of a field, clamped at the border.
export function bilinear(f, w, h, x, y) {
  x = x < 0 ? 0 : x > w - 1.001 ? w - 1.001 : x; y = y < 0 ? 0 : y > h - 1.001 ? h - 1.001 : y;
  const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * w + xi;
  return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + w] * (1 - fx) + f[i + w + 1] * fx) * fy;
}

// Gradient of a field by central differences at (x, y).
export function gradient(f, w, h, x, y) {
  return [(bilinear(f, w, h, x + 1, y) - bilinear(f, w, h, x - 1, y)) / 2, (bilinear(f, w, h, x, y + 1) - bilinear(f, w, h, x, y - 1)) / 2];
}
