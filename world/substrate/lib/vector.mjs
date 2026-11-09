// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// substrate/vector: SVG geometry every lane can share. Path data with fixed precision, line
// simplification, smooth curves through points, arc length for draw-on reveals, hatch fills,
// halftone dot fields, and a sparkline that carries its own text description.
//
// Written fresh for the substrate pilot. The ideas come from the site plotter (pen idioms, plotter
// SVG), plot-marks (hatch, stipple) and raw-native web/motion/path.mjs (arc length, trim). Pure:
// strings and arrays only, so it runs the same in a browser, in Node and in an offline render.
// A point is [x, y]; a polyline is an array of points, with an optional `closed` property.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// A number at fixed precision with trailing zeros cut and no "-0".
export function fmt(n, precision = 2) {
  if (!isNum(n)) throw new TypeError("vector: not a finite number: " + n);
  const s = n.toFixed(precision).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

export function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// SVG path data for one or more polylines. A polyline with `closed: true` ends in Z.
export function pathD(polylines, { precision = 2 } = {}) {
  const list = polylines.length && isNum(polylines[0][0]) ? [polylines] : polylines;
  return list.filter((l) => l.length).map((l) => {
    const head = `M${fmt(l[0][0], precision)} ${fmt(l[0][1], precision)}`;
    const rest = l.slice(1).map((p) => `L${fmt(p[0], precision)} ${fmt(p[1], precision)}`).join("");
    return head + rest + (l.closed ? "Z" : "");
  }).join("");
}

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

// Ramer-Douglas-Peucker simplification: keep only points that move the line by more than `tol`.
export function simplify(pts, tol = 0.5) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let best = -1, far = tol;
    for (let k = i + 1; k < j; k++) {
      const d = segDist(pts[k], pts[i], pts[j]);
      if (d > far) { far = d; best = k; }
    }
    if (best > 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

// Path data for a smooth curve through every point: Catmull-Rom segments as cubic Beziers.
// tension 0 gives straight lines, 0.5 the usual curve.
export function smoothD(pts, { tension = 0.5, precision = 2 } = {}) {
  if (pts.length < 3) return pathD(pts, { precision });
  const f = (n) => fmt(n, precision);
  const k = tension / 3;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

// Arc length of a polyline (closing segment included when `closed`).
export function pathLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (pts.closed && pts.length > 1) s += Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]);
  return s;
}

// Parallel hatch lines at `angle` degrees, `spacing` apart, clipped to a polygon (even-odd).
// Returns segments [[x0, y0], [x1, y1]]. Alternate lines run backwards to save pen travel.
export function hatch(polygon, { angle = 45, spacing = 4 } = {}) {
  if (!(spacing > 0)) throw new RangeError("vector: hatch spacing must be above 0");
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const rot = polygon.map(([x, y]) => [x * c + y * s, -x * s + y * c]);
  const ys = rot.map((p) => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const out = [];
  let row = 0;
  for (let v = lo + spacing / 2; v < hi; v += spacing, row++) {
    const xs = [];
    for (let i = 0; i < rot.length; i++) {
      const p = rot[i], q = rot[(i + 1) % rot.length];
      if ((p[1] <= v) !== (q[1] <= v)) xs.push(p[0] + ((v - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const ends = [[xs[i], v], [xs[i + 1], v]].map(([u, w]) => [u * c - w * s, u * s + w * c]);
      out.push(row % 2 ? ends.reverse() : ends);
    }
  }
  return out;
}

// A halftone dot field from a grey image (0 black .. 255 white, one value per pixel).
// Each cell becomes one dot whose AREA is proportional to the cell's darkness, so tone survives
// any print scale. Returns [{ x, y, r }] in pixel units; empty cells are skipped.
export function halftone(gray, w, h, { cell = 8, minR = 0.15 } = {}) {
  if (gray.length < w * h) throw new RangeError("vector: grey buffer is smaller than w * h");
  const dots = [];
  const rMax = (cell / 2) * Math.SQRT2;   // a full-dark cell covers its square
  for (let cy = 0; cy < h; cy += cell) for (let cx = 0; cx < w; cx += cell) {
    let sum = 0, n = 0;
    for (let y = cy; y < Math.min(cy + cell, h); y++) for (let x = cx; x < Math.min(cx + cell, w); x++) { sum += gray[y * w + x]; n++; }
    const dark = 1 - sum / n / 255;
    const r = rMax * Math.sqrt(dark);
    if (r >= minR) dots.push({ x: cx + cell / 2, y: cy + cell / 2, r });
  }
  return dots;
}

// Dots as SVG circles in one group.
export function dotsSvg(dots, { fill = "currentColor", precision = 2 } = {}) {
  const f = (n) => fmt(n, precision);
  return `<g fill="${escapeXml(fill)}">` + dots.map((d) => `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}"/>`).join("") + "</g>";
}

// Plain-language summary of a series: start, end, extremes and the largest single step.
export function describeSeries(values, { label = "Series", unit = "", labels = null, precision = 2 } = {}) {
  const v = values.filter(isNum);
  if (!v.length) return `${label}: no data.`;
  const at = (i) => (labels ? labels[i] : `point ${i + 1}`);
  const u = (n) => fmt(n, precision) + (unit ? " " + unit : "");
  let lo = 0, hi = 0, step = 0, stepAt = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] < v[lo]) lo = i;
    if (v[i] > v[hi]) hi = i;
    if (i && Math.abs(v[i] - v[i - 1]) > Math.abs(step)) { step = v[i] - v[i - 1]; stepAt = i; }
  }
  const dir = v.at(-1) > v[0] ? "rises" : v.at(-1) < v[0] ? "falls" : "ends level";
  const parts = [
    `${label}, ${v.length} points, ${dir} from ${u(v[0])} to ${u(v.at(-1))}.`,
    `Lowest ${u(v[lo])} at ${at(lo)}; highest ${u(v[hi])} at ${at(hi)}.`,
  ];
  if (v.length > 1) parts.push(`Largest step: ${step >= 0 ? "up" : "down"} ${u(Math.abs(step))} into ${at(stepAt)}.`);
  return parts.join(" ");
}

// A whole SVG document with a title and description that screen readers announce.
export function svgDoc({ width, height, body, title, desc = "", id = "fig" }) {
  const t = `${id}-title`, d = `${id}-desc`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" width="${fmt(width)}" height="${fmt(height)}" role="img" aria-labelledby="${t} ${d}">`
    + `<title id="${t}">${escapeXml(title)}</title><desc id="${d}">${escapeXml(desc)}</desc>${body}</svg>`;
}

// Points for a series fitted into a box with padding. Equal values draw a centred flat line.
export function seriesPoints(values, { width = 320, height = 64, pad = 4 } = {}) {
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo;
  const dx = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  return values.map((v, i) => [pad + i * dx, span ? pad + (1 - (v - lo) / span) * (height - 2 * pad) : height / 2]);
}

// A sparkline SVG: smooth or straight line, end dot, and a description computed from the data.
// The path carries pathLength="1" so a CSS draw-on works without measuring in script.
export function sparkline(values, { width = 320, height = 64, pad = 4, smooth = true, title = "Sparkline", label, unit = "", labels = null, id = "spark" } = {}) {
  if (!values.length) throw new RangeError("vector: sparkline needs at least one value");
  const pts = seriesPoints(values, { width, height, pad });
  const d = smooth ? smoothD(pts) : pathD(pts);
  const end = pts.at(-1);
  const body = `<path class="substrate-line" d="${d}" pathLength="1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<circle cx="${fmt(end[0])}" cy="${fmt(end[1])}" r="2.5" fill="currentColor"/>`;
  return svgDoc({ width, height, body, title, desc: describeSeries(values, { label: label || title, unit, labels }), id });
}
