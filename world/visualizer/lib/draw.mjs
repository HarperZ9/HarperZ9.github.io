// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// draw.mjs: anti-aliased marks into a float coverage plane (Float32Array w*h, 0..1 and above for emission).
// Every mark is a distance field evaluated over its bounding box, so edges are exact to the pixel:
//   line(P, x0, y0, x1, y1, width, alpha)        capsule of the given width in px
//   polyline(P, pts, width, alpha, closed)
//   ring(P, cx, cy, r, width, alpha, a0, a1)     circle or arc (angles in radians, a0 < a1)
//   disc(P, cx, cy, r, alpha)
// QUALITY-SPEC R3b: a mark thinner than one device pixel is drawn one pixel wide with its alpha scaled by its
// width, never left to sub-pixel coverage. Marks add (light adds on a phosphor), then the caller tone-maps.

export function plane(w, h) { return { w, h, data: new Float32Array(w * h) }; }

function thin(width, alpha) { return width < 1 ? [1, alpha * width] : [width, alpha]; }
const cover = d => (d <= -0.5 ? 1 : d >= 0.5 ? 0 : 0.5 - d);   // box-filtered coverage from signed distance in px

export function line(P, x0, y0, x1, y1, width = 1, alpha = 1) {
  [width, alpha] = thin(width, alpha);
  const { w, h, data } = P, r = width / 2, pad = r + 1;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - pad)), xb = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + pad));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - pad)), yb = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + pad));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + 0.5 - x0, py = y + 0.5 - y0, t = Math.max(0, Math.min(1, (px * dx + py * dy) / L2));
    const d = Math.hypot(px - t * dx, py - t * dy) - r, c = cover(d);
    if (c > 0) { const i = y * w + x; data[i] = Math.max(data[i], c * alpha); }
  }
}

export function polyline(P, pts, width = 1, alpha = 1, closed = false) {
  for (let i = 0; i + 1 < pts.length; i++) line(P, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], width, alpha);
  if (closed && pts.length > 2) line(P, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], width, alpha);
}

export function ring(P, cx, cy, r, width = 1, alpha = 1, a0 = -Math.PI, a1 = Math.PI) {
  [width, alpha] = thin(width, alpha);
  const { w, h, data } = P, hw = width / 2, pad = r + hw + 1, full = a1 - a0 >= 2 * Math.PI - 1e-6;
  const xa = Math.max(0, Math.floor(cx - pad)), xb = Math.min(w - 1, Math.ceil(cx + pad)), ya = Math.max(0, Math.floor(cy - pad)), yb = Math.min(h - 1, Math.ceil(cy + pad));
  const ex = [Math.cos(a0) * r + cx, Math.sin(a0) * r + cy, Math.cos(a1) * r + cx, Math.sin(a1) * r + cy];
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + 0.5 - cx, py = y + 0.5 - cy;
    let d;
    if (full) d = Math.abs(Math.hypot(px, py) - r) - hw;
    else {
      let a = Math.atan2(py, px); while (a < a0) a += 2 * Math.PI; while (a > a0 + 2 * Math.PI) a -= 2 * Math.PI;
      d = a <= a1 ? Math.abs(Math.hypot(px, py) - r) - hw
        : Math.min(Math.hypot(x + 0.5 - ex[0], y + 0.5 - ex[1]), Math.hypot(x + 0.5 - ex[2], y + 0.5 - ex[3])) - hw;
    }
    const c = cover(d);
    if (c > 0) { const i = y * w + x; data[i] = Math.max(data[i], c * alpha); }
  }
}

export function disc(P, cx, cy, r, alpha = 1) {
  const { w, h, data } = P, pad = r + 1;
  for (let y = Math.max(0, Math.floor(cy - pad)); y <= Math.min(h - 1, Math.ceil(cy + pad)); y++)
    for (let x = Math.max(0, Math.floor(cx - pad)); x <= Math.min(w - 1, Math.ceil(cx + pad)); x++) {
      const c = cover(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r);
      if (c > 0) { const i = y * w + x; data[i] = Math.max(data[i], c * alpha); }
    }
}

// Separable box blur of a plane, `passes` times (three passes approach a Gaussian), for glow.
export function blurPlane(P, r, passes = 3) {
  const { w, h } = P; let a = Float32Array.from(P.data), b = new Float32Array(w * h);
  r = Math.max(1, Math.round(r));
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) { let s = 0; const o = y * w; for (let x = -r; x <= r; x++) s += a[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { b[o + x] = s / (2 * r + 1); s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; } }
  }
  return { w, h, data: a };
}
