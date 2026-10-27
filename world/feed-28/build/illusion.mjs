// illusion.mjs: a bistable rotation, after the principles Akiyoshi Kitaoka demonstrates (feed set 28): a wireframe
// seen in orthographic projection carries no depth cue, so a turn to the right and a turn to the left produce the same
// frames, and perception flips. His stimulus is a colour solid in HCV; ours is a different object built on the same
// principle: the sRGB cube's twelve edges carried into OKLab, so the solid is curved and each edge wears its own colour.
//
// Two of his other principles join it:
//   - Peripheral drift (Kitaoka and Ashida 2003, after Fraser and Wilcox 1979): a repeating luminance sequence black,
//     dark grey, white, light grey reads as slow motion from black toward dark grey, strongest in peripheral vision.
//     Concentric rings of it surround the solid, alternate rings in opposite directions. The rings never move.
//   - The reveal (our safeguard, rule of record 1 "one panel of light"): a depth cue (near lines brighter and wider)
//     fades in for part of the loop and settles the direction, then fades out. The exhibit shows its own trick.
// Lines are drawn with max blending, which is order independent, so drawing order cannot leak depth either.
import { raster, clamp } from '../../feed-29/build/lib/field.mjs';
import { linToOklab } from '../../feed-29/build/lib/color.mjs';

export const SPEC = {
  id: 'illusion.bistable',
  params: {
    size: { min: 128, max: 4096, default: 1080, unit: 'px (square)' }, period: { min: 2, max: 30, default: 8, unit: 's per full turn and per loop' },
    cue: { min: 0, max: 1, default: 'loop envelope', unit: 'depth cue strength; 0 = fully ambiguous' }, rings: { min: 0, max: 8, default: 4, unit: 'drift rings' },
    segments: { min: 16, max: 160, default: 96, unit: 'luminance steps per ring (multiple of 4)' },
  },
  determinism: 'no randomness; a frame is a pure function of t (tests/illusion.test.mjs)',
};

// The solid: 12 cube edges sampled n points each, as { p: [a, L, b] centred, c: linear colour }.
export function solid(n = 40) {
  const V = [0, 1], E = [];
  for (const a of V) for (const b of V) { E.push([[0, a, b], [1, a, b]]); E.push([[a, 0, b], [a, 1, b]]); E.push([[a, b, 0], [a, b, 1]]); }
  return E.map(([A, B]) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, c = A.map((v, k) => v + (B[k] - v) * t), o = linToOklab(c); return { p: [o[1] * 1.9, o[0] - 0.5, o[2] * 1.9], c }; }));
}

// Rotate about the vertical (L) axis by th, then project orthographically. Returns [x, y, z] with z toward the viewer.
export const turn = ([a, L, b], th) => [a * Math.cos(th) - b * Math.sin(th), L, a * Math.sin(th) + b * Math.cos(th)];

// The drift rings: luminance sequence 0, 0.28, 1, 0.72 (black, dark grey, white, light grey), tinted by `tint`.
export const DRIFT = [0, 0.28, 1, 0.72];
export function rings(R, { rings: nR = 4, segments = 96, r0 = 0.395, r1 = 0.495, tint = [0.92, 0.88, 0.8] } = {}) {
  const { w, h, px } = R, cx = w / 2, cy = h / 2, S = Math.min(w, h), ss = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let acc = 0, cov = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const dx = x + (i + 0.5) / ss - cx, dy = y + (j + 0.5) / ss - cy, rr = Math.hypot(dx, dy) / S; if (rr < r0 || rr >= r1) continue;
      const ring = Math.floor((rr - r0) / (r1 - r0) * nR), dir = ring % 2 ? -1 : 1, ang = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
      const seg = ((Math.floor(ang * segments + ring * 0.5) * dir) % 4 + 4) % 4, gap = ((rr - r0) / (r1 - r0) * nR) % 1;
      acc += gap < 0.08 ? 0.12 : DRIFT[seg]; cov++;
    }
    if (!cov) continue;
    const v = acc / (ss * ss), a = cov / (ss * ss), k = 3 * (y * w + x);
    for (let c = 0; c < 3; c++) px[k + c] = px[k + c] * (1 - a) + v * tint[c] * 0.82;
  }
  return R;
}

// One frame at time t (s). cue: null for the loop's own envelope, or a number in [0, 1].
export function frame(t, { size = 1080, period = 8, cue = null, ringsOn = 4, base = null, pts = solid() } = {}) {
  const R = base ? { w: base.w, h: base.h, px: Float32Array.from(base.px) } : rings(raster(size, size, [0.012, 0.011, 0.016]), { rings: ringsOn });
  const th = 2 * Math.PI * ((t / period) % 1), u = (t / period) % 1, k = cue ?? Math.pow(Math.sin(Math.PI * clamp((u - 0.55) / 0.35)), 2);
  const S = R.w * 0.46, cx = R.w / 2, cy = R.h / 2, { w, h, px } = R;
  for (const edge of pts) for (let i = 0; i + 1 < edge.length; i++) {
    const A = turn(edge[i].p, th), B = turn(edge[i + 1].p, th), zm = (A[2] + B[2]) / 2, c = edge[i].c;
    const width = (1.6 + 1.6 * k * clamp(zm * 3.2 + 0.5)) * w / 1080, bright = 1 - k * 0.7 * clamp(0.5 - zm * 3.2);
    seg(px, w, h, cx + A[0] * S, cy - A[1] * S, cx + B[0] * S, cy - B[1] * S, width, c.map(v => (0.06 + 0.94 * v) * bright));
  }
  return R;
}

// An anti-aliased segment, max-blended (order independent).
function seg(px, w, h, ax, ay, bx, by, width, col) {
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - width - 1)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + width + 1)), y0 = Math.max(0, Math.floor(Math.min(ay, by) - width - 1)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + width + 1));
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = clamp(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / L), d = Math.hypot(x + 0.5 - ax - t * dx, y + 0.5 - ay - t * dy), a = clamp(width / 2 + 0.5 - d); if (a <= 0) continue;
    const k = 3 * (y * w + x); for (let c = 0; c < 3; c++) px[k + c] = Math.max(px[k + c], col[c] * a);
  }
}
