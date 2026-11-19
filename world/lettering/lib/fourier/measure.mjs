// lib/fourier/measure.mjs: the checks' own measures. Pure functions, node and page alike.
//   hausdorff(a, b)        symmetric Hausdorff distance between two closed polylines, point to segment both ways
//   crossings(p)           how many pairs of non-adjacent segments of a closed polyline cross (self-intersections)
//   shuffledPhase(c, seed) the same amplitudes with random phases: the control that must not look like the letter

function directed(a, b) {
  const na = a.length / 2, nb = b.length / 2; let worst = 0;
  for (let i = 0; i < na; i++) {
    const px = a[2 * i], py = a[2 * i + 1]; let best = Infinity;
    for (let j = 0; j < nb; j++) {
      const k = (j + 1) % nb, x0 = b[2 * j], y0 = b[2 * j + 1], dx = b[2 * k] - x0, dy = b[2 * k + 1] - y0, L = dx * dx + dy * dy;
      let t = L > 0 ? ((px - x0) * dx + (py - y0) * dy) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + dx * t - px, ey = y0 + dy * t - py, d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
    if (best > worst) worst = best;
  }
  return Math.sqrt(worst);
}
export const hausdorff = (a, b) => Math.max(directed(a, b), directed(b, a));

export function crossings(p) {
  const n = p.length / 2; let count = 0;
  const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n, ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * i2], by = p[2 * i2 + 1];
    for (let j = i + 2; j < n; j++) {
      const j2 = (j + 1) % n; if (j2 === i) continue;
      const cx = p[2 * j], cy = p[2 * j + 1], dx = p[2 * j2], dy = p[2 * j2 + 1];
      const d1 = cross(ax, ay, bx, by, cx, cy), d2 = cross(ax, ay, bx, by, dx, dy), d3 = cross(cx, cy, dx, dy, ax, ay), d4 = cross(cx, cy, dx, dy, bx, by);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) count++;
    }
  }
  return count;
}

export function shuffledPhase(c, seed = 7) {
  let s = seed >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const re = Float64Array.from(c.re), im = Float64Array.from(c.im);
  for (let j = 1; j < re.length; j++) { const a = Math.hypot(re[j], im[j]), ph = r() * 2 * Math.PI; re[j] = a * Math.cos(ph); im[j] = a * Math.sin(ph); }
  return { ...c, re, im };
}
