// fill.mjs: nonzero-winding coverage of a set of closed polylines, the way a font rasteriser fills glyphs whose
// stroke rings overlap. 4 sub-rows per pixel, exact horizontal coverage per span. Pure.

export function fillNonzero(polys, w, h, sub = 4) {
  const cov = new Float32Array(w * h), edges = [];
  for (const P of polys) for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
    if (y0 !== y1) edges.push(y0 < y1 ? [x0, y0, x1, y1, 1] : [x1, y1, x0, y0, -1]);
  }
  let ymin = h, ymax = 0;
  for (const e of edges) { ymin = Math.min(ymin, e[1]); ymax = Math.max(ymax, e[3]); }
  const ya = Math.max(0, Math.floor(ymin)), yb = Math.min(h - 1, Math.ceil(ymax)), wt = 1 / sub;
  for (let y = ya; y <= yb; y++) for (let s = 0; s < sub; s++) {
    const sy = y + (s + 0.5) / sub, xs = [];
    for (const [x0, y0, x1, y1, d] of edges) if (sy >= y0 && sy < y1) xs.push([x0 + (x1 - x0) * (sy - y0) / (y1 - y0), d]);
    if (!xs.length) continue;
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k][1];
      if (wind === 0) continue;
      span(cov, w, y, Math.max(0, xs[k][0]), Math.min(w, xs[k + 1][0]), wt);
    }
  }
  for (let i = 0; i < cov.length; i++) if (cov[i] > 1) cov[i] = 1;
  return cov;
}

function span(cov, w, y, a, b, wt) {
  if (b <= a) return;
  const ia = Math.floor(a), ib = Math.floor(b), row = y * w;
  if (ia === ib) { if (ia < w) cov[row + ia] += (b - a) * wt; return; }
  cov[row + ia] += (ia + 1 - a) * wt;
  for (let x = ia + 1; x < ib && x < w; x++) cov[row + x] += wt;
  if (ib < w) cov[row + ib] += (b - ib) * wt;
}

// TrueType quadratic contour {pts, on} to a polyline, n segments per curve, through transform f([x, y]).
export function contourToPolyline(c, f, n = 6) {
  const P = c.pts, on = c.on, N = P.length;
  if (!N) return [];
  let start = on.indexOf(true), pts, flags;
  if (start < 0) { const m = [(P[0][0] + P[N - 1][0]) / 2, (P[0][1] + P[N - 1][1]) / 2]; pts = [m, ...P]; flags = [true, ...on]; }
  else { pts = P.slice(start).concat(P.slice(0, start)); flags = on.slice(start).concat(on.slice(0, start)); }
  const M = pts.length, out = [f(pts[0])];
  let cur = pts[0];
  for (let i = 1; i <= M; i++) {
    const p = pts[i % M];
    if (flags[i % M]) { if (i < M) out.push(f(p)); cur = p; continue; }
    const q = pts[(i + 1) % M], fq = flags[(i + 1) % M], end = fq ? q : [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; out.push(f([u * u * cur[0] + 2 * u * t * p[0] + t * t * end[0], u * u * cur[1] + 2 * u * t * p[1] + t * t * end[1]])); }
    cur = end; if (fq) i++;
  }
  return out;
}
