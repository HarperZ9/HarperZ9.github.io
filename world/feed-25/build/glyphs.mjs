// glyphs.mjs: hand-feel glyph bodies after the vocabulary of images 28 to 30 (Miró's): looping tubes and
// blobs in one dark body, a soft edge, an orange rim at a fixed offset, flat primary discs set inside the
// body, four-point sparkle stars and split discs around it. Shapes grow from a seed; nothing is traced.
//
// A body is a signed distance field: the minimum over tubes (distance to a polyline minus a radius that
// swells along it) and blobs (circles). We visit only each element's bounding box, so a 4K sheet costs
// the area the glyph covers, not the sheet.
import { curl, rng } from '../../feed-23/build/brush/core.js';
import { colour } from './px.mjs';
import { fillShape } from './hud.mjs';

// Describe a glyph in a unit box [0, 1]^2: tubes (curl-noise walks) and blobs.
export function design(seed, { tubes = 4, blobs = 2, steps = 34, step = 0.034, radius = [0.018, 0.034], pull = 0.025 } = {}) {
  const R = rng(seed), T = [], B = [];
  for (let t = 0; t < tubes; t++) {
    let x = 0.3 + R() * 0.4, y = 0.25 + R() * 0.5; const pts = [[x, y]], r0 = radius[0] + R() * (radius[1] - radius[0]);
    for (let s = 0; s < steps; s++) {
      const [cx, cy] = curl(x * 2.4, y * 2.4, seed + t * 17), g = Math.hypot(cx, cy) || 1;
      x += (cx / g) * step + (0.5 - x) * pull; y += (cy / g) * step + (0.5 - y) * pull; pts.push([x, y]);
    }
    T.push({ pts, r0, swell: 0.6 + R() * 0.8 });
  }
  for (let b = 0; b < blobs; b++) B.push({ x: 0.3 + R() * 0.4, y: 0.4 + R() * 0.35, r: 0.05 + R() * 0.05 });
  return { seed, T, B };
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
  return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t];
}

// Signed distance (px) of glyph g placed at (x, y) with side `size`, on a w x h grid; Infinity outside reach.
export function distance(g, x, y, size, w, h, reach) {
  const D = new Float32Array(w * h).fill(Infinity), visit = (x0, y0, x1, y1, fn) => {
    const xa = Math.max(0, Math.floor(x0 - reach)), xb = Math.min(w - 1, Math.ceil(x1 + reach)), ya = Math.max(0, Math.floor(y0 - reach)), yb = Math.min(h - 1, Math.ceil(y1 + reach));
    for (let j = ya; j <= yb; j++) for (let i = xa; i <= xb; i++) { const d = fn(i + 0.5, j + 0.5); if (d < D[j * w + i]) D[j * w + i] = d; }
  };
  for (const t of g.T) for (let s = 1; s < t.pts.length; s++) {
    const a = t.pts[s - 1], b = t.pts[s], ax = x + a[0] * size, ay = y + a[1] * size, bx = x + b[0] * size, by = y + b[1] * size;
    const u0 = (s - 1) / (t.pts.length - 1), u1 = s / (t.pts.length - 1), rr = (u) => t.r0 * size * (1 + t.swell * Math.sin(Math.PI * u) - 0.5 * u);
    const rm = Math.max(rr(u0), rr(u1));
    visit(Math.min(ax, bx) - rm, Math.min(ay, by) - rm, Math.max(ax, bx) + rm, Math.max(ay, by) + rm, (px, py) => { const [d, k] = segDist(px, py, ax, ay, bx, by); return d - rr(u0 + (u1 - u0) * k); });
  }
  for (const b of g.B) { const cx = x + b.x * size, cy = y + b.y * size, r = b.r * size; visit(cx - r, cy - r, cx + r, cy + r, (px, py) => Math.hypot(px - cx, py - cy) - r); }
  return D;
}

// Paint glyph g onto layer S. rim: offset and width in px; soft: edge width in px. Returns the inner
// points where primary discs went, so a HUD mark can point at one.
export function paint(S, g, x, y, size, { ink = '#271d21', rim = '#cc7b38', rimOffset = 0.009, rimWidth = 0.006, soft = 0.002, discs = 3, primaries = ['#f2260a', '#f0e427', '#3411ee', '#38f30e'], seed = 1 } = {}) {
  const off = rimOffset * size, rw = rimWidth * size, sf = Math.max(0.75, soft * size), reach = off + rw + 2 * sf;
  const D = distance(g, x, y, size, S.w, S.h, reach), I = colour(ink), RM = colour(rim), p = S.px;
  for (let i = 0; i < D.length; i++) {
    const d = D[i]; if (d === Infinity || d > reach) continue;
    const ringA = rim ? Math.max(0, Math.min(1, 0.5 - (Math.abs(d - off - rw / 2) - rw / 2) / sf)) : 0, bodyA = Math.max(0, Math.min(1, 0.5 - d / sf));
    for (let c = 0; c < 3; c++) { let v = p[3 * i + c]; v += (RM[c] - v) * ringA; v += (I[c] - v) * bodyA; p[3 * i + c] = v; }
  }
  const R = rng(seed), P = primaries.map(colour), placed = [];
  for (let t = 0; t < 400 && placed.length < discs; t++) {
    const px = Math.round(x + R() * size), py = Math.round(y + R() * size), r = size * (0.025 + R() * 0.035);
    if (px < 0 || py < 0 || px >= S.w || py >= S.h) continue;
    const inside = (qx, qy) => { const k = Math.min(S.h - 1, Math.max(0, qy | 0)) * S.w + Math.min(S.w - 1, Math.max(0, qx | 0)); return D[k] < -r * 0.35; };
    if (!inside(px, py) || !inside(px + r, py) || !inside(px - r, py) || !inside(px, py + r) || !inside(px, py - r)) continue;
    if (placed.some((q) => Math.hypot(q[0] - px, q[1] - py) < q[2] + r + size * 0.02)) continue;
    const c = P[placed.length % P.length];
    fillShape(S, px - r - 2, py - r - 2, px + r + 2, py + r + 2, (qx, qy) => Math.hypot(qx - px, qy - py) <= r + 0.12 * r && Math.hypot(qx - px, qy - py) > r, RM);
    fillShape(S, px - r, py - r, px + r, py + r, (qx, qy) => Math.hypot(qx - px, qy - py) <= r, c);
    placed.push([px, py, r]);
  }
  return placed;
}

// Four-point sparkle star: the astroid-like set |x|^p + |y|^p <= r^p, p < 1, with an optional rim.
export function star(S, cx, cy, r, { ink = '#271d21', p = 0.45, rim = null } = {}) {
  const inside = (k) => (x, y) => Math.abs(x - cx) ** p + Math.abs(y - cy) ** p <= (r * k) ** p;
  if (rim) fillShape(S, cx - r * 1.2, cy - r * 1.2, cx + r * 1.2, cy + r * 1.2, inside(1.18), rim);
  fillShape(S, cx - r, cy - r, cx + r, cy + r, inside(1), ink);
}

// A disc split into sectors of flat colour (the ball in images 29 and 30), with a thin rim.
export function splitDisc(S, cx, cy, r, { colours = ['#3411ee', '#f2260a', '#f0e427'], rot = 0.4, rim = '#cc7b38' } = {}) {
  if (rim) fillShape(S, cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4, (x, y) => Math.hypot(x - cx, y - cy) <= r * 1.06, rim);
  colours.forEach((c, k) => {
    const a0 = rot + (k * 2 * Math.PI) / colours.length, a1 = rot + ((k + 1) * 2 * Math.PI) / colours.length;
    fillShape(S, cx - r, cy - r, cx + r, cy + r, (x, y) => { if (Math.hypot(x - cx, y - cy) > r) return false; let a = Math.atan2(y - cy, x - cx); while (a < a0) a += 2 * Math.PI; return a < a1; }, c);
  });
}
