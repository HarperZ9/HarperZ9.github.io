// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// strokes.mjs: the letters as centre lines, for pieces where the technique builds the letter (a tube swept along
// the line, engraving cuts that follow it, rays that carry it). Reads the forge's own skeletons from setName and
// resamples them evenly; the frame field (feed-30 geom.mjs) gives, for every pixel near a line, which stroke it
// belongs to, how far along (s, px) and how far across (t, -1..1).
import { frameField, ribbonInto } from '../../feed-30/build/lib/geom.mjs';
export { frameField, ribbonInto };

/** Resample a polyline every `step` px (keeps both ends). */
export function resample(P, step) {
  const out = [P[0]]; let carry = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let d = step - carry;
    while (d <= L) { out.push([a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L]); d += step; }
    carry = L - (d - step);
  }
  const e = P[P.length - 1], l = out[out.length - 1]; if (Math.hypot(e[0] - l[0], e[1] - l[1]) > step * 0.25) out.push(e);
  return out;
}

/** Centre lines of a setName result, resampled, each tagged with its letter index (spans order) and character. */
export function strokesOf(N, step = 2) {
  const out = []; let gi = -1;
  for (const s of N.skel) {
    if (s.pts.length < 2) continue;
    // skel is pushed glyph by glyph in spans order; a new glyph starts when the character/line run changes position
    const cx = s.pts[0][0], k = N.spans.findIndex(sp => sp.line === s.line && cx >= sp.x0 - 2 && cx <= sp.x1 + 2 && sp.ch === s.ch);
    gi = k >= 0 ? k : gi;
    out.push({ pts: resample(s.pts, step), glyph: gi, ch: s.ch, line: s.line });
  }
  return out;
}

/**
 * Round rods of radius r swept along strokes: coverage and the height of the top surface (thick x sqrt(1-(d/r)^2)),
 * unioned by max, which is the true top of overlapping cylinders. Also the distance to the nearest centre line.
 */
export function rods(w, h, strokes, r, thick = 2 * r) {
  const mask = new Float32Array(w * h), height = new Float32Array(w * h), dist = new Float32Array(w * h).fill(Infinity);
  for (const st of strokes) {
    const P = st.pts;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r - 2)), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + r + 2));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 2)), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + r + 2));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1], u = Math.max(0, Math.min(1, (px * dx + py * dy) / L2)), d = Math.hypot(px - u * dx, py - u * dy), j = y * w + x;
        if (d < dist[j]) dist[j] = d;
        if (d > r + 1) continue;
        const c = Math.max(0, Math.min(1, r - d + 0.5)); if (c > mask[j]) mask[j] = c;
        const q = Math.min(1, d / r), z = thick * Math.sqrt(1 - q * q); if (z > height[j]) height[j] = z;
      }
    }
  }
  return { mask, height, dist };
}

/**
 * Snap joins: a stroke end that stops within `reach` px of another stroke of the same letter moves onto that
 * stroke's centre line, so the two rods meet axis to axis. Without it a stem that overshoots a bar (the top left of
 * the forge's D) leaves its round cap standing out as a knob. Short strokes (dots) never move. Returns new strokes.
 */
export function snapJoins(strokes, reach) {
  const out = strokes.map(s => ({ ...s, pts: s.pts.map(p => [p[0], p[1]]) }));
  const len = (P) => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
  out.forEach((s, k) => {
    if (len(s.pts) < 2.5 * reach) return;   // a dot (the i's) stays where it is: snapping it would fuse it to the stem
    for (const end of [0, s.pts.length - 1]) {
      const E = s.pts[end]; let best = null, bd = reach;
      out.forEach((o, j) => {
        if (j === k || o.glyph !== s.glyph || len(o.pts) < 2.5 * reach) return;   // nor does anything snap onto a dot
        for (let i = 0; i + 1 < o.pts.length; i++) { const q = nearestOnSeg(E, o.pts[i], o.pts[i + 1]), d = Math.hypot(q[0] - E[0], q[1] - E[1]); if (d < bd) { bd = d; best = q; } }
      });
      if (best) s.pts[end] = best;
    }
  });
  return out;
}
function nearestOnSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return [a[0] + u * dx, a[1] + u * dy]; }

/**
 * Distance to the centre lines, fused: exact (min) within one stroke, polynomial smooth-min of width k px between
 * strokes, so where a bowl meets a stem the rods flow together with a fillet, as hot-worked glass does, instead of
 * leaving a mitred crease. Smoothing within a stroke would swell every resampled vertex, so it is not done there.
 * Infinity beyond `reach` px of every line. caps 'square' cuts each stroke's two ends square (deco terminals).
 */
export function fusedDistance(w, h, strokes, reach, k, { caps = 'round', perStroke = null } = {}) {
  const D = new Float32Array(w * h).fill(Infinity);
  for (const st of strokes) {
    const P = st.pts; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 = Math.max(0, Math.floor(x0 - reach)); y0 = Math.max(0, Math.floor(y0 - reach)); x1 = Math.min(w - 1, Math.ceil(x1 + reach)); y1 = Math.min(h - 1, Math.ceil(y1 + reach));
    if (x1 < x0 || y1 < y0) continue;
    const bw = x1 - x0 + 1, own = new Float32Array(bw * (y1 - y0 + 1)).fill(Infinity);
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
      const sx0 = Math.max(x0, Math.floor(Math.min(a[0], b[0]) - reach)), sx1 = Math.min(x1, Math.ceil(Math.max(a[0], b[0]) + reach));
      const sy0 = Math.max(y0, Math.floor(Math.min(a[1], b[1]) - reach)), sy1 = Math.min(y1, Math.ceil(Math.max(a[1], b[1]) + reach));
      for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1], j = (y - y0) * bw + (x - x0);
        let d;
        const tt = (px * dx + py * dy) / L2, sq = caps === 'square' && ((i === 0 && tt < 0) || (i === P.length - 2 && tt > 1));
        if (sq) { const L = Math.sqrt(L2), over = tt < 0 ? -tt * L : (tt - 1) * L, perp = Math.abs(px * dy - py * dx) / L; d = Math.max(perp, over); }   // a square-cut end
        else { const u = Math.max(0, Math.min(1, tt)); d = Math.hypot(px - u * dx, py - u * dy); }
        if (d < own[j]) own[j] = d;
      }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const b = own[(y - y0) * bw + (x - x0)]; if (!(b <= reach)) continue;
      const j = y * w + x, a = D[j];
      if (perStroke) { perStroke(j, b); continue; }
      if (a === Infinity) { D[j] = b; continue; }
      const hh = Math.max(k - Math.abs(a - b), 0) / k; D[j] = Math.min(a, b) - hh * hh * k * 0.25;
    }
  }
  return D;
}

/** Central-difference gradient of a field (Infinity treated as the centre value), as unit vectors plus magnitude. */
export function gradientOf(F, w, h) {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, c = F[i]; if (!isFinite(c)) continue;
    const l = isFinite(F[i - 1]) ? F[i - 1] : c, r = isFinite(F[i + 1]) ? F[i + 1] : c, u = isFinite(F[i - w]) ? F[i - w] : c, d = isFinite(F[i + w]) ? F[i + w] : c;
    gx[i] = (r - l) / 2; gy[i] = (d - u) / 2;
  }
  return { gx, gy };
}

/**
 * Round rods fused like hot-worked glass: each stroke is a cylinder of radius r (height thick x sqrt(1 - (d/r)^2))
 * and overlapping cylinders combine by a polynomial smooth-max of width k px on HEIGHT, so a bowl meeting a stem
 * rises into a fillet instead of a mitred crease. Coverage is the plain union. Returns { mask, height }.
 */
export function fusedRods(w, h, strokes, r, thick, k) {
  const mask = new Float32Array(w * h), height = new Float32Array(w * h);
  fusedDistance(w, h, strokes, r + 1, 1, { perStroke: (j, d) => {
    const c = Math.max(0, Math.min(1, r - d + 0.5)); if (c > mask[j]) mask[j] = c;
    const q = Math.min(1, d / r), z = thick * Math.sqrt(1 - q * q), a = height[j];
    const hh = Math.max(k - Math.abs(a - z), 0) / k; height[j] = Math.max(a, z) + hh * hh * k * 0.25;
  } });
  return { mask, height };
}
