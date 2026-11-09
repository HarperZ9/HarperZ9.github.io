// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// surface.js: two more ways to make a glass body, added for feed set 31 (frosted pebbled glass; swept liquid-glass
// ribbons). Both return the same body shape as lib/body.js ({ w, h, mask, height }), so renderGlass takes them as is.
//   pane(w, h, { thickness })                     a full-frame sheet of even thickness
//   pebble(body, { cell, depth, seed })           cellular stipple on the front face: rounded pebbles of seeded size
//   ribbons(w, h, paths, { width, thickness })    a sweep SDF: each path is a smooth centreline; the cross-section is
//                                                 a flattened tube whose width tapers along the path; overlaps keep the
//                                                 thicker glass, so ribbons pass over and under each other
//   flowPaths(w, h, { count, steps, seed })       centrelines traced through a curl-noise field, for organic sweeps
import { clamp, random, mix, boxBlur, smoothstep } from './raster.js';

export function pane(w, h, { thickness = 20 } = {}) {
  return { w, h, mask: new Float32Array(w * h).fill(1), height: new Float32Array(w * h).fill(thickness) };
}

// Pebbled (hammered) glass: each pixel finds its nearest jittered cell centre (Worley F1, 3 x 3 search) and rises as a
// dome over the cell, with a seeded height per cell. The result is a field of rounded bumps meeting in soft creases.
export function pebble(body, { cell = 9, depth = 2.5, seed = 1, jitter = 0.85, soften = 1 } = {}) {
  const { w, h, mask } = body, H = Float32Array.from(body.height), nx = Math.ceil(w / cell) + 2, ny = Math.ceil(h / cell) + 2;
  const r = random(`pebble/${seed}`), pts = new Float32Array(nx * ny * 3);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pts[k] = (i - 1 + 0.5 + (r() - 0.5) * jitter) * cell; pts[k + 1] = (j - 1 + 0.5 + (r() - 0.5) * jitter) * cell; pts[k + 2] = 0.6 + 0.4 * r(); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (mask[i] <= 0) continue;
    const ci = Math.floor(x / cell) + 1, cj = Math.floor(y / cell) + 1; let best = 1e9, amp = 1;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const k = ((cj + dj) * nx + (ci + di)) * 3; if (k < 0 || k >= pts.length) continue;
      const d = Math.hypot(x + 0.5 - pts[k], y + 0.5 - pts[k + 1]); if (d < best) { best = d; amp = pts[k + 2]; }
    }
    const u = clamp(best / (cell * 0.75));
    H[i] += depth * amp * Math.sqrt(Math.max(0, 1 - u * u)) * mask[i];
  }
  // fire-polish: a light blur rounds the creases between pebbles, as rolled glass leaves them
  return { ...body, height: soften > 0 ? boxBlur(H, w, h, soften, { passes: 2 }) : H };
}

// Catmull-Rom through the control points, resampled to about one point per 2 px.
function spline(P) {
  const out = [];
  for (let k = 0; k < P.length - 1; k++) {
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(P[P.length - 1]); return out;
}

// Sweep SDF: for every sample along each path, stamp the tube cross-section into a height buffer (max), so the
// field is exact to the sample spacing. width(t) and the flattening give a ribbon rather than a rope.
// profile 'tube' is a round cross-section; 'sheet' is flat across the middle with rounded rims, as a poured ribbon
// of glass sets; striae add fine lengthwise ridges (count across the width, depth as a share of the thickness).
export function ribbons(w, h, paths, { width = 0.03, taper = 0.85, thickness = 0.035, flat = 0.55, seed = 1, profile = 'tube', striae = 0, striaeDepth = 0.08 } = {}) {
  const H = new Float32Array(w * h), M = new Float32Array(w * h), r = random(`ribbon/${seed}`);
  for (const P of paths) {
    const S = spline(P), wPx = width * h * (0.7 + 0.6 * r()), phase = r() * 6.28;
    for (let k = 0; k < S.length; k++) {
      const t = k / (S.length - 1), rad = wPx * (1 - taper * Math.abs(2 * t - 1) ** 2) * (0.85 + 0.15 * Math.sin(phase + t * 9));
      if (rad < 0.8) continue;
      const [cx, cy] = S[k], x0 = Math.max(0, Math.floor(cx - rad - 1)), x1 = Math.min(w - 1, Math.ceil(cx + rad + 1)), y0 = Math.max(0, Math.floor(cy - rad - 1)), y1 = Math.min(h - 1, Math.ceil(cy + rad + 1));
      const T = thickness * h * (rad / wPx) ** flat;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad; if (d >= 1.04) continue;
        const i = y * w + x, cov = clamp((1.04 - d) * rad), dd = Math.min(1, d);
        let z = profile === 'sheet' ? T * Math.sqrt(Math.max(0, 1 - smoothstep(0.55, 1, dd) ** 2)) : T * Math.sqrt(Math.max(0, 1 - dd * dd));
        if (striae > 0) z *= 1 - striaeDepth * (0.5 + 0.5 * Math.cos(dd * Math.PI * striae));
        if (z > H[i]) H[i] = z; if (cov > M[i]) M[i] = cov;
      }
    }
  }
  return { w, h, mask: M, height: H };
}

// Curl of a seeded smooth noise: divergence-free flow, so traced lines swirl and never bunch into a sink.
export function flowPaths(w, h, { count = 3, steps = 90, step = 0.012, scale = 1.6, seed = 7 } = {}) {
  const r = random(`flow/${seed}`), g = Array.from({ length: 64 * 64 }, () => r() * 6.283);
  const pot = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, at = (i, j) => Math.sin(g[((j & 63) * 64) + (i & 63)]);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return mix(mix(at(xi, yi), at(xi + 1, yi), sx), mix(at(xi, yi + 1), at(xi + 1, yi + 1), sx), sy);
  };
  const out = [];
  for (let c = 0; c < count; c++) {
    let x = 0.15 + 0.7 * r(), y = 0.2 + 0.6 * r(); const P = [];
    for (let s = 0; s < steps; s++) {
      const e = 1e-3, X = x * scale * 3 + c * 5.1, Y = y * scale * 3;
      const vx = (pot(X, Y + e) - pot(X, Y - e)) / (2 * e), vy = -(pot(X + e, Y) - pot(X - e, Y)) / (2 * e), l = Math.hypot(vx, vy) || 1;
      x += step * vx / l * (w / h > 1 ? h / w : 1); y += step * vy / l;
      if (s % 6 === 0) P.push([x * w, y * h]);
    }
    out.push(P);
  }
  return out;
}

// Centrelines of a vortex: arcs of logarithmic spirals around one eye, each with its own start, span and growth,
// so the ribbons read as one swirl of poured glass rather than separate strands. Shares of the frame height.
export function vortexPaths(w, h, { cx = 0.6, cy = 0.42, count = 5, seed = 9 } = {}) {
  const r = random(`vortex/${seed}`), out = [];
  for (let c = 0; c < count; c++) {
    const r0 = (0.1 + 0.14 * r()) * h, k = 0.18 + 0.12 * r(), th0 = r() * 6.283, span = 3.2 + 2.6 * r(), P = [], squash = 0.62 + 0.2 * r();
    for (let s = 0; s <= 40; s++) { const th = th0 + span * s / 40, rr = r0 * Math.exp(k * (th - th0)); P.push([cx * w + rr * Math.cos(th) * 1.25, cy * h + rr * Math.sin(th) * squash]); }
    out.push(P);
  }
  return out;
}
