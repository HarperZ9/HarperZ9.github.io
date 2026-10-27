// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// draw.mjs: analytic anti-aliased line work into a coverage buffer (Float32Array w*h, 0..1, max-combined).
// Each segment is a tapered capsule; coverage is the exact distance to its edge clamped over one pixel, so a
// stroke edge is 1 px wide (R3) and a hairline under 1 px is drawn at 1 px with alpha scaled by its width (R3b).

// Tapered capsule from (x0, y0, r0) to (x1, y1, r1), radii in px.
export function capsule(cov, w, h, x0, y0, r0, x1, y1, r1, a = 1) {
  const R = Math.max(r0, r1) + 1.5;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - R)), xb = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + R));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - R)), yb = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + R));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + 0.5 - x0, py = y + 0.5 - y0;
    let t = (px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = px - dx * t, ey = py - dy * t, d = Math.sqrt(ex * ex + ey * ey), r = r0 + (r1 - r0) * t;
    const rr = Math.max(r, 0.5), thin = r < 0.5 ? r / 0.5 : 1;
    let c = rr + 0.5 - d; if (c <= 0) continue; if (c > 1) c = 1;
    c *= a * thin; const i = y * w + x; if (c > cov[i]) cov[i] = c;
  }
}
// Polyline with per-point radius. pts: [[x, y, r], ...] or [[x, y]] with a fixed radius.
export function polyline(cov, w, h, pts, r = 1, a = 1) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    capsule(cov, w, h, p[0], p[1], p[2] ?? r, q[0], q[1], q[2] ?? r, a);
  }
}
export function disc(cov, w, h, cx, cy, r, a = 1) { capsule(cov, w, h, cx, cy, r, cx, cy, r, a); }

// Ring (annulus) of radius r and half width hw, exact coverage.
export function ring(cov, w, h, cx, cy, r, hw, a = 1) {
  const R = r + hw + 1.5;
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(h - 1, Math.ceil(cy + R)); y++)
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(w - 1, Math.ceil(cx + R)); x++) {
      const d = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r), hh = Math.max(hw, 0.5);
      let c = hh + 0.5 - d; if (c <= 0) continue; if (c > 1) c = 1; c *= a * (hw < 0.5 ? hw / 0.5 : 1);
      const i = y * w + x; if (c > cov[i]) cov[i] = c;
    }
}
