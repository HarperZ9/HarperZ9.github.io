// lib/skeleton.mjs: the centre line of a letter, as ordered strokes. Pure functions, no DOM.
//   thin(mask, w, h)                 Zhang and Suen thinning (CACM 27(3), 1984) to a one-pixel skeleton
//   trace(skel, w, h, o)             the skeleton as polylines between ends and joins, short spurs pruned
//   strokes(mask, d, w, h, o)        the whole pipeline: thin, trace, prune, merge, extend ends to the outline, smooth
//   resample(pts, step)              even spacing along a polyline
//   arcField(strokes, w, h)          for every pixel: distance to the nearest centre line and how far along the word it sits
import { edt, bilinear, gradient, components } from './fields.mjs';

export function thin(mask, w, h, iso = 0.5) {
  const im = new Uint8Array(w * h);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] >= iso) { im[y * w + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  x0 = Math.max(1, x0); y0 = Math.max(1, y0); x1 = Math.min(w - 2, x1); y1 = Math.min(h - 2, y1);
  const del = [];
  for (let changed = true, pass = 0; changed && pass < 400; pass++) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x; if (!im[i]) continue;
        const p2 = im[i - w], p3 = im[i - w + 1], p4 = im[i + 1], p5 = im[i + w + 1], p6 = im[i + w], p7 = im[i + w - 1], p8 = im[i - 1], p9 = im[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (step === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
        del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) im[i] = 0; }
    }
  }
  // remove staircase corners: a pixel whose two 4-neighbours at a right angle are set, with the diagonal between them empty
  // of other support, is redundant for 8-connectivity and would read as a false join
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w + x; if (!im[i]) continue;
    const n = im[i - w], e = im[i + 1], s = im[i + w], ww = im[i - 1];
    const nb = n + e + s + ww + im[i - w + 1] + im[i + w + 1] + im[i + w - 1] + im[i - w - 1];
    if (nb !== 2) continue;
    if ((n && e && !im[i - w + 1]) || (e && s && !im[i + w + 1]) || (s && ww && !im[i + w - 1]) || (ww && n && !im[i - w - 1])) im[i] = 0;
  }
  // Zhang and Suen erase a 2 x 2 block completely, so a small dot (the tittle of an i) can vanish. Put back one
  // pixel at the deepest point of any piece of the mask that lost its whole skeleton.
  const { label, parts } = components(mask, w, h, iso), has = new Uint8Array(parts.length + 1);
  for (let i = 0; i < w * h; i++) if (im[i]) has[label[i]] = 1;
  for (const p of parts) if (!has[p.id]) { const x = Math.round(p.cx), y = Math.round(p.cy); im[y * w + x] = 1; }
  return im;
}

const N8 = (w) => [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];

// Trace paths between nodes (ends and joins). Returns { paths: [{ pts:[i...], a, b }], nodeOf } where a and b are node ids.
export function trace(skel, w, h) {
  const n = w * h, deg = new Uint8Array(n), off = N8(w);
  for (let i = w; i < n - w; i++) if (skel[i]) { let d = 0; for (const o of off) d += skel[i + o]; deg[i] = d; }
  const node = new Int32Array(n).fill(-1); let nodes = 0;
  // cluster join and end pixels into nodes
  for (let i = w; i < n - w; i++) {
    if (!skel[i] || deg[i] === 2 || node[i] >= 0) continue;
    const st = [i]; node[i] = nodes;
    while (st.length) { const j = st.pop(); for (const o of off) { const k = j + o; if (skel[k] && deg[k] !== 2 && node[k] < 0) { node[k] = nodes; st.push(k); } } }
    nodes++;
  }
  const used = new Uint8Array(n), paths = [];
  // a pixel of degree 2 has exactly two neighbours: where we came from and where we go
  const walk = (start, first) => {
    const pts = [start, first]; let prev = start, cur = first; used[first] = 1;
    while (node[cur] < 0) {
      let next = -1;
      for (const o of off) { const k = cur + o; if (k !== prev && skel[k] && (node[k] >= 0 || !used[k])) { next = k; break; } }
      if (next < 0) break;
      prev = cur; cur = next; pts.push(cur); if (node[cur] < 0) used[cur] = 1;
    }
    return pts;
  };
  for (let i = w; i < n - w; i++) {
    if (node[i] < 0) continue;
    for (const o of off) {
      const k = i + o;
      if (!skel[k] || used[k]) continue;
      if (node[k] >= 0) continue;
      const pts = walk(i, k), last = pts[pts.length - 1];
      if (pts.length < 4 && node[last] === node[i]) continue;
      paths.push({ pts, a: node[i], b: node[last] >= 0 ? node[last] : -1 });
    }
  }
  // closed loops with no node at all (the bowl of an o)
  for (let i = w; i < n - w; i++) {
    if (!skel[i] || used[i] || node[i] >= 0) continue;
    const pts = [i]; used[i] = 1; let cur = i, prev = -1;
    for (;;) { let next = -1; for (const o of off) { const k = cur + o; if (skel[k] && !used[k]) { next = k; break; } } if (next < 0) break; used[next] = 1; pts.push(next); prev = cur; cur = next; }
    pts.push(i); paths.push({ pts, a: -1, b: -1, closed: true });
  }
  // nodes that are single isolated pixels or tiny blobs with no paths (a full stop thinned to a point)
  const touched = new Uint8Array(nodes); for (const p of paths) { if (p.a >= 0) touched[p.a] = 1; if (p.b >= 0) touched[p.b] = 1; }
  for (let i = w; i < n - w; i++) if (node[i] >= 0 && !touched[node[i]]) { touched[node[i]] = 1; paths.push({ pts: [i], a: node[i], b: node[i], dot: true }); }
  return { paths, nodes };
}

const plen = (P, w) => { let L = 0; for (let k = 1; k < P.length; k++) { const a = P[k - 1], b = P[k]; L += Math.hypot((a % w) - (b % w), ((a / w) | 0) - ((b / w) | 0)); } return L; };

// Prune spurs: a path that ends in a free end, starts at a join, and is shorter than `len` (or, when a distance
// field d is given, shorter than `ratio` times the inscribed radius at its join: a thinning spur at a square corner is about
// 0.4 to 0.6 of that radius, while a real short stroke, the arm of a t, is longer). Then merge through nodes left with
// exactly two paths, so a stroke runs unbroken through a false join.
export function prune(paths, w, len, d = null, ratio = 0.8) {
  for (let round = 0; round < 3; round++) {
    const count = new Map(); for (const p of paths) for (const v of [p.a, p.b]) if (v >= 0) count.set(v, (count.get(v) || 0) + 1);
    const before = paths.length;
    paths = paths.filter(p => { if (p.closed || p.dot) return true; const ca = count.get(p.a) || 0, cb = count.get(p.b) || 0; const spur = (ca === 1) !== (cb === 1) && (ca >= 3 || cb >= 3); if (!spur) return true;
      const j = ca >= 3 ? p.pts[0] : p.pts[p.pts.length - 1], lim = d ? Math.min(len, Math.max(2, d[j] * ratio)) : len;
      return plen(p.pts, w) >= lim; });
    if (paths.length === before) break;
  }
  for (let guard = 0; guard < 1000; guard++) {
    const at = new Map(); paths.forEach((p, k) => { for (const v of [p.a, p.b]) if (v >= 0 && !p.dot) { if (!at.has(v)) at.set(v, []); at.get(v).push(k); } });
    let merged = false;
    for (const [v, ks] of at) {
      if (ks.length !== 2 || ks[0] === ks[1]) continue;
      const [P, Q] = [paths[ks[0]], paths[ks[1]]];
      const p = P.b === v ? P.pts : P.pts.slice().reverse(), q = Q.a === v ? Q.pts : Q.pts.slice().reverse();
      const na = P.b === v ? P.a : P.b, nb = Q.a === v ? Q.b : Q.a;
      paths[ks[0]] = { pts: p.concat(q.slice(1)), a: na, b: nb, closed: na === nb && na >= 0 };
      paths.splice(ks[1], 1); merged = true; break;
    }
    if (!merged) break;
  }
  return paths;
}

export function resample(pts, step = 1.5) {
  if (pts.length < 4) return pts.slice();
  const out = [pts[0], pts[1]]; let carry = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2], ay = pts[i - 1], bx = pts[i], by = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= L) { const t = d / L; out.push(ax + (bx - ax) * t, ay + (by - ay) * t); d += step; }
    carry = L - (d - step);
  }
  const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
  if (Math.hypot(out[out.length - 2] - lx, out[out.length - 1] - ly) > step * 0.25) out.push(lx, ly);
  return out;
}

// Moving average that keeps both ends fixed (so strokes still meet at their joins).
export function smooth(pts, r = 3, closed = false) {
  const n = pts.length / 2, out = pts.slice();
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) continue;
    const k = closed ? r : Math.min(r, i, n - 1 - i); let sx = 0, sy = 0, c = 0;
    for (let j = -k; j <= k; j++) { const m = closed ? (i + j + n) % n : i + j; sx += pts[2 * m]; sy += pts[2 * m + 1]; c++; }
    out[2 * i] = sx / c; out[2 * i + 1] = sy / c;
  }
  return out;
}

export const length = pts => { let L = 0; for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); return L; };

// Thinning eats each free end back by about the stroke's half-width. Walk the end out along its tangent until the
// signed distance says we have reached the outline, minus a margin, so a rope or a light reaches the true terminal.
function extendEnd(pts, d, w, h, atStart, margin) {
  const n = pts.length / 2; if (n < 3) return pts;
  const i0 = atStart ? 0 : n - 1, i1 = atStart ? Math.min(n - 1, 4) : Math.max(0, n - 5);
  let x = pts[2 * i0], y = pts[2 * i0 + 1], tx = x - pts[2 * i1], ty = y - pts[2 * i1 + 1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
  const add = [];
  for (let s = 0; s < 200; s++) { const nx = x + tx, ny = y + ty; if (bilinear(d, w, h, nx, ny) < margin) break; x = nx; y = ny; add.push(x, y); }
  if (!add.length) return pts;
  if (atStart) { const r = []; for (let k = add.length - 2; k >= 0; k -= 2) r.push(add[k], add[k + 1]); return r.concat(pts); }
  return pts.concat(add);
}

// The whole pipeline. mask and d (the sdf) share w, h. Returns strokes in reading order:
// [{ pts: [x,y,...], closed, len, start }] where start is the arc length of the word before this stroke.
export function strokes(mask, d, w, h, o = {}) {
  const half = o.half ?? 4, skel = thin(mask, w, h);
  let { paths } = trace(skel, w, h);
  paths = prune(paths, w, o.prune ?? half * 2.2, d);
  const count = new Map(); for (const p of paths) for (const v of [p.a, p.b]) if (v >= 0) count.set(v, (count.get(v) || 0) + 1);
  let out = paths.map(p => {
    let pts = []; for (const i of p.pts) pts.push(i % w, (i / w) | 0);
    if (p.dot) { const x = pts[0], y = pts[1]; return { pts: [x - 0.5, y, x + 0.5, y], closed: false, dot: true }; }
    pts = smooth(resample(pts, 1), o.smooth ?? Math.max(2, Math.round(half * 0.6)), !!p.closed);
    if (!p.closed) {
      const margin = half * (o.endMargin ?? 0.45);
      if ((count.get(p.a) || 0) <= 1) pts = extendEnd(pts, d, w, h, true, margin);
      if ((count.get(p.b) || 0) <= 1) pts = extendEnd(pts, d, w, h, false, margin);
    }
    return { pts: resample(pts, o.step ?? 1.5), closed: !!p.closed };
  }).filter(s => s.pts.length >= 4);
  // reading order: by the leftmost x of each stroke, and each open stroke starts at its top-left end (pen order)
  for (const s of out) {
    let mx = Infinity; for (let i = 0; i < s.pts.length; i += 2) mx = Math.min(mx, s.pts[i]); s.minX = mx;
    if (!s.closed) { const n = s.pts.length; const a = s.pts[0] + s.pts[1] * 0.6, b = s.pts[n - 2] + s.pts[n - 1] * 0.6; if (b < a) { const r = []; for (let k = n - 2; k >= 0; k -= 2) r.push(s.pts[k], s.pts[k + 1]); s.pts = r; } }
  }
  out.sort((a, b) => a.minX - b.minX);
  let acc = 0; for (const s of out) { s.len = length(s.pts); s.start = acc; acc += s.len; }
  return out;
}

// Per pixel: distance to the nearest centre line (px), the word-arc position of that nearest point (0..1), and which stroke.
export function arcField(list, w, h) {
  const n = w * h, feat = new Uint8Array(n), arc = new Float32Array(n), sid = new Int16Array(n).fill(-1);
  const total = list.reduce((a, s) => a + s.len, 0) || 1;
  list.forEach((s, k) => {
    const p = resample(s.pts, 0.7); let acc = 0;
    for (let i = 0; i < p.length; i += 2) {
      if (i) acc += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      const x = Math.round(p[i]), y = Math.round(p[i + 1]); if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const j = y * w + x; feat[j] = 1; arc[j] = (s.start + acc) / total; sid[j] = k;
    }
  });
  const { d2, near } = edt(feat, w, h), dist = new Float32Array(n), at = new Float32Array(n), which = new Int16Array(n);
  for (let i = 0; i < n; i++) { dist[i] = Math.sqrt(d2[i]); at[i] = arc[near[i]]; which[i] = sid[near[i]]; }
  return { dist, arc: at, stroke: which, total };
}

// Tangent and normal along a polyline at point index i.
export function frame(pts, i) {
  const n = pts.length / 2, a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
  let tx = pts[2 * b] - pts[2 * a], ty = pts[2 * b + 1] - pts[2 * a + 1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
  return [tx, ty, -ty, tx];
}
export { gradient };
