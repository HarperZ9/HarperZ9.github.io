// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// frame.mjs: for every pixel near the centre lines, which stroke is nearest, how far along it (s, px from the
// stroke's start) and how far across (t, signed px). The feed-30 frameField does the same, but its `nearest` mode
// skips every pixel (its distance buffer starts at 0); this one starts at Infinity. Pure.
export function nearestFrame(w, h, strokes, reach) {
  const id = new Int32Array(w * h).fill(-1), S = new Float32Array(w * h), T = new Float32Array(w * h), D = new Float32Array(w * h).fill(Infinity);
  strokes.forEach((st, k) => {
    const P = st.pts; let acc = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9, L2 = L * L;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - reach)), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + reach));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - reach)), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + reach));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1], u = Math.max(0, Math.min(1, (px * dx + py * dy) / L2)), qx = px - u * dx, qy = py - u * dy, d = Math.hypot(qx, qy), j = y * w + x;
        if (d > reach || d >= D[j]) continue;
        D[j] = d; id[j] = k; S[j] = acc + u * L; T[j] = (dx * py - dy * px >= 0 ? 1 : -1) * d;
      }
      acc += L;
    }
  });
  return { id, s: S, t: T, d: D };
}

/** Length of a polyline and its mean absolute turning per px (0 for a straight stroke). */
export function shapeOf(P) {
  let L = 0, turn = 0;
  for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  for (let i = 1; i + 1 < P.length; i++) {
    const a1 = Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]), a2 = Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0]);
    turn += Math.abs(((a2 - a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  }
  return { length: L, curvature: L > 0 ? turn / L : 0 };
}

/** Centre of the circle through a stroke's start, middle and end (the centre a fan of a bowl radiates from). */
export function arcCentre(P) {
  const A = P[0], B = P[P.length >> 1], C = P[P.length - 1];
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = A[0] ** 2 + A[1] ** 2, b2 = B[0] ** 2 + B[1] ** 2, c2 = C[0] ** 2 + C[1] ** 2;
  return [(a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / d, (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / d];
}
