// Tube geometry and the phosphor mask (CPU reference of the same functions in crt.wgsl).
//
// The viewer sits on the axis at distance D in front of the faceplate. The face is a
// paraboloid z = x^2 / 2Rx + y^2 / 2Ry receding from the viewer (Rx = Ry for a spherical
// tube, Ry very large for a cylindrical Trinitron, both very large for a flat one). A ray
// through an output pixel meets the face at (sx, sy); the raster is laid on the face in
// those coordinates. Perspective onto the receding edges is what bends a curved tube's
// picture. The mask is integrated over each output pixel's footprint on the face: a tent
// filter across the phosphor stripes and a box along the slots, so the mask is
// anti-aliased exactly instead of being point-sampled into moire.

// Output pixel centre (px + 0.5, py + 0.5) -> face position in mm, or null if the ray misses.
export function faceAt(plan, px, py) {
  const g = plan.p.view, X = (px - plan.out.w / 2) * (plan.viewW / plan.out.w) + g.centre[0];
  const Y = (py - plan.out.h / 2) * (plan.viewH / plan.out.h) + g.centre[1];
  const { rx, ry } = plan.p.curvature, D = plan.distance;
  const A = (X * X) / (2 * rx) + (Y * Y) / (2 * ry);
  // The near root of A t^2 - D t + D = 0 in the form without cancellation (f32-safe).
  const t = (2 * D) / (D + Math.sqrt(Math.max(0, D * D - 4 * A * D)));
  return [t * X, t * Y];
}
// Position, and the half-extents in mm of the pixel's footprint on the face.
export function footprint(plan, px, py) {
  const c = faceAt(plan, px + 0.5, py + 0.5), xp = faceAt(plan, px + 1, py + 0.5), xm = faceAt(plan, px, py + 0.5);
  const yp = faceAt(plan, px + 0.5, py + 1), ym = faceAt(plan, px + 0.5, py);
  const hx = 0.5 * (Math.abs(xp[0] - xm[0]) + Math.abs(yp[0] - ym[0])), hy = 0.5 * (Math.abs(xp[1] - xm[1]) + Math.abs(yp[1] - ym[1]));
  return [c[0], c[1], Math.max(hx, 1e-4), Math.max(hy, 1e-4)];
}

// Coverage of the visible face (a rounded rectangle) over a footprint, feathered by it.
export function faceAlpha(plan, sx, sy, hx, hy) {
  const r = plan.p.tube.corner, qx = Math.abs(sx) - (plan.faceW / 2 - r), qy = Math.abs(sy) - (plan.faceH / 2 - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  const d = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
  return Math.min(1, Math.max(0, 0.5 - d / (2 * Math.max(hx, hy))));
}

// The CDF of a tent of half-width a centred on 0.
function tentCdf(u, a) {
  const v = u / a;
  if (v <= -1) return 0;
  if (v <= 0) return 0.5 * (1 + v) * (1 + v);
  if (v < 1) return 1 - 0.5 * (1 - v) * (1 - v);
  return 1;
}
// The fraction of the box [y0, y1] covered by a pulse train of period P, pulse width w
// starting at phase s. Local origin first, so f32 keeps its precision far from centre.
function pulseBox(y0, y1, P, w, s) {
  const n0 = Math.floor((y0 - s) / P), a = y0 - s - n0 * P, b = y1 - s - n0 * P;
  const F = (x) => Math.floor(x / P) * w + Math.min(Math.max(x - Math.floor(x / P) * P, 0), w);
  return (F(b) - F(a)) / (y1 - y0);
}

// Mean coverage of each phosphor colour over the whole screen.
export function maskMean(m) {
  if (m.type === "grille") return m.fill / 3;
  if (m.type === "slot") return (m.fill / 3) * (m.slotHeight / (m.slotHeight + m.slotGap));
  if (m.type === "delta") { const d = m.pitch / Math.sqrt(3), r = (m.fill * d) / 2; return (Math.PI * r * r) / ((Math.sqrt(3) / 2) * m.pitch * m.pitch); }
  return 1;
}

function stripeMask(m, sx, sy, hx, hy, c, plan) {
  const P = m.pitch, w = (m.fill * P) / 3, s = (c * P) / 3 + ((1 - m.fill) * P) / 6, a = 2 * hx;
  const m0 = Math.floor((sx - a - s - w) / P), m1 = Math.floor((sx + a - s) / P);
  if (m1 - m0 > 32) return maskMean(m) * 1;
  let cov = 0;
  for (let k = m0; k <= m1; k++) {
    const x0 = k * P + s - sx, xw = tentCdf(x0 + w, a) - tentCdf(x0, a);
    if (xw <= 0) continue;
    let yw = 1;
    if (m.type === "slot") { const Py = m.slotHeight + m.slotGap; yw = pulseBox(sy - hy, sy + hy, Py, m.slotHeight, (k & 1) * Py * 0.5); }
    cov += xw * yw;
  }
  if (m.type === "grille") {
    for (const d of m.dampers) {
      const dc = (d - 0.5) * plan.faceH, lo = Math.max(sy - hy, dc - m.damperWidth / 2), hi = Math.min(sy + hy, dc + m.damperWidth / 2);
      if (hi > lo) cov *= 1 - (hi - lo) / (2 * hy);
    }
  }
  return cov;
}

function deltaMask(m, sx, sy, hx, hy) {
  // The soft edge is capped at the dot radius, so a dot reaches at most 1.5 r < rowH from
  // its centre and the two-by-two candidate search below always finds it.
  const d = m.pitch / Math.sqrt(3), r = (m.fill * d) / 2, rowH = (d * Math.sqrt(3)) / 2, out = [0, 0, 0];
  const aa = Math.min(0.75 * (hx + hy), r);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = sx + ((i + 0.5) / 4 - 0.5) * 3 * hx, y = sy + ((j + 0.5) / 4 - 0.5) * 3 * hy;
    const lj = Math.floor(y / rowH);
    for (let dj = 0; dj <= 1; dj++) {
      const jj = lj + dj, li = Math.floor(x / d - jj / 2);
      for (let di = 0; di <= 1; di++) {
        const ii = li + di, cx = (ii + jj / 2) * d, cy = jj * rowH;
        // A soft dot edge one sample spacing wide: coverage is continuous, so f32 and f64 agree.
        const e = Math.min(1, Math.max(0, 0.5 + (r - Math.hypot(x - cx, y - cy)) / aa));
        if (e > 0) out[(((ii - jj) % 3) + 3) % 3] += e / 16;
      }
    }
  }
  // Footprints wider than the pitch cannot resolve the dots with 16 samples: blend to the mean.
  const t = Math.min(1, Math.max(0, (hx / m.pitch - 0.7) / 0.3)), b = t * t * (3 - 2 * t), mean = maskMean(m);
  return out.map((v) => v + (mean - v) * b);
}

// Normalised mask transmission per colour: 1 on average, about 1 / mean on a stripe.
export function maskCover(plan, sx, sy, hx, hy) {
  const m = plan.p.mask;
  if (m.type === "none" || plan.screen.mono) return [1, 1, 1];
  const mean = maskMean(m), mix = m.mix;
  const cov = m.type === "delta" ? deltaMask(m, sx, sy, hx, hy) : [0, 1, 2].map((c) => stripeMask(m, sx, sy, hx, hy, c, plan));
  return cov.map((v) => 1 - mix + (mix * v) / mean);
}

// A dim room reflected in the glass: a low ambient and one soft window light.
export function roomEnv(dx, dy, dz) {
  const wx = -0.38, wy = -0.33, wz = -0.864, c = dx * wx + dy * wy + dz * wz;
  const t = Math.min(1, Math.max(0, (c - 0.975) / 0.02));
  return 0.04 + t * t * (3 - 2 * t);
}
