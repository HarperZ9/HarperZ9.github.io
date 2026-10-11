// Film 5's world, "What a model's written reasoning can and cannot show" (BIBLE.md,
// film 5): deep navy ground, bone glyphs, drift vermilion on the thread (the hint's
// pull, which the reasoning never names), violet and cyan glass for the monitors (art
// layer only). Written reasoning is drawn as a ribbon of glyphs that flows along a curve;
// the words in the ribbon are schematic and carry the tag "a depiction, not a readout".
import { contour } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";

export const C = Object.freeze({
  void: [0.010, 0.014, 0.034], ink: "#e9e3d3", ink2: "#a9a8a4", dim: "#666a78", faint: "#2b3046",
  hot: "#e86a4f", violet: "#9f8df2", cyan: "#6fd2e4",
});

// A curve sampled by arc length: at(s) gives the point and unit normal s pixels along it.
export function curve(pts) {
  const n = pts.length / 2, cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
  const total = cum[n - 1];
  const at = (s) => {
    s = Math.max(0, Math.min(total - 1e-6, s));
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const w = (s - cum[lo]) / (cum[hi] - cum[lo] || 1), dx = pts[2 * hi] - pts[2 * lo], dy = pts[2 * hi + 1] - pts[2 * lo + 1], l = Math.hypot(dx, dy) || 1;
    return [pts[2 * lo] + dx * w, pts[2 * lo + 1] + dy * w, -dy / l, dx / l];
  };
  return { at, total, pts };
}
export function bezier(a, c1, c2, b, n = 96) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u;
    o.push(v * v * v * a[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * b[0], v * v * v * a[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * b[1]);
  }
  return new Float32Array(o);
}

// A run of glyphs laid on a straight baseline at y = 0, ready to bend: its shape and width.
export function run(str, atlas, size) { const t = text(str, { atlas, size, x: 0, y: 0 }); return { shape: t.shape, width: t.width }; }

// Bend a run onto a curve, starting `offset` pixels along it; glyph points past the curve's
// ends are dropped by contour (the visible window is [from, to] along the run).
export function bend(r, cv, offset, from = -Infinity, to = Infinity, wobble = null) {
  const out = [];
  for (const c of r.shape) {
    const p = c.pts;
    let x0 = Infinity;
    for (let k = 0; k < p.length; k += 2) x0 = Math.min(x0, p[k]);
    if (x0 < from || x0 > to) continue;
    const o = new Float32Array(p.length);
    for (let k = 0; k < p.length; k += 2) {
      const s = p[k] + offset, [x, y, nx, ny] = cv.at(s), d = p[k + 1] + (wobble ? wobble(s) : 0);
      o[k] = x + nx * d; o[k + 1] = y + ny * d;
    }
    out.push(contour(o, c.closed));
  }
  return out;
}
