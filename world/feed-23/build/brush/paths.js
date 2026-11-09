// brush/paths.js: where strokes go. Generators return points in canvas-width units (x in 0..1, y in 0..aspect),
// with a pressure p per point, so a scene is a list of strokes that renders the same at any size.
import { curl, rng, fbm } from './core.js';

// A smoke wisp: integrate a curl-noise flow from a start point, with a drift (wind) added.
// Pressure swells in the middle, so the wisp thickens and thins the way a turned wrist lays one down.
export function curlPath(seed, x, y, { steps = 40, step = 0.006, scale = 3.2, drift = [0.6, -0.15], curlGain = 1 } = {}) {
  const pts = []; let px = x, py = y;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    pts.push({ x: px, y: py, p: 0.35 + 0.65 * Math.sin(Math.PI * f) });
    const [cx, cy] = curl(px * scale, py * scale, seed);
    let vx = cx * curlGain + drift[0], vy = cy * curlGain + drift[1];
    const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m;
    px += vx * step; py += vy * step;
  }
  return pts;
}

// A draped net: a diamond lattice warped by a smooth field, so strands bow like cord under its own weight.
// Returns strands (each a point list, both diagonal families) and nodes (lattice crossings), in width units.
export function netLattice({ x0 = -0.05, y0 = -0.05, cols = 5, rows = 9, cell = 0.11, seed = 4, sag = 0.05, shear = 0.35 } = {}) {
  const warp = (u, v) => {
    const wx = (fbm(u * 1.3 + 3, v * 1.3, seed, 3) - 0.5) * 0.08 + shear * v * cell * 0.4;
    const wy = sag * Math.sin(Math.PI * Math.min(1, u / cols)) + (fbm(u * 1.3, v * 1.3 + 7, seed + 1, 3) - 0.5) * 0.06;
    return [x0 + u * cell + wx, y0 + v * cell * 0.62 + wy];
  };
  const nodes = [], strands = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) if ((i + j) % 2 === 0) { const [x, y] = warp(i, j); nodes.push({ x, y }); }
  const line = (i0, j0, di, dj) => {
    const pts = [];
    for (let t = 0; ; t += 0.25) {
      const u = i0 + di * t, v = j0 + dj * t;
      if (u < -0.01 || u > cols + 0.01 || v < -0.01 || v > rows + 0.01) break;
      const [x, y] = warp(u, v); pts.push({ x, y, p: 0.7 + 0.3 * Math.sin(t * 0.9) });
    }
    if (pts.length > 2) strands.push(pts);
  };
  for (let s = -cols; s <= rows; s += 2) { line(Math.max(0, -s), Math.max(0, s), 1, 1); line(Math.min(cols, cols + s), Math.max(0, s), -1, 1); }
  return { strands, nodes };
}

// Billows packed along an ellipse ring and outward from it, largest at the base. Each entry is one billow
// with a radius and the direction its lit side faces (toward the light at the ring's centre).
export function billowRing({ cx = 0.5, cy = 0.45, rx = 0.2, ry = 0.28, rings = 4, seed = 2, base = 0.06 } = {}) {
  const R = rng(seed), out = [];
  for (let k = 0; k < rings; k++) {
    const grow = 1 + k * 0.45, n = Math.round(22 + k * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.2, low = Math.max(0, Math.sin(a)); // larger billows toward the bottom
      const r = base * (0.55 + 0.6 * R()) * (1 + 0.8 * low) * (1 + 0.25 * k);
      const ex = cx + Math.cos(a) * rx * grow + (R() - 0.5) * r, ey = cy + Math.sin(a) * ry * grow + (R() - 0.5) * r;
      out.push({ x: ex, y: ey, r, light: Math.atan2(cy - ey, cx - ex), depth: k });
    }
  }
  return out.sort((a, b) => b.depth - a.depth); // paint outer rings first, inner (lit) rings on top
}

// A straight or gently bowed line with a pressure ramp, for water streaks and spike glints.
export function line(x0, y0, x1, y1, { n = 12, bow = 0, p = [0.4, 1, 0.4] } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, b = bow * Math.sin(Math.PI * t), pr = t < 0.5 ? p[0] + (p[1] - p[0]) * t * 2 : p[1] + (p[2] - p[1]) * (t - 0.5) * 2;
    pts.push({ x: x0 + (x1 - x0) * t - (y1 - y0) * b, y: y0 + (y1 - y0) * t + (x1 - x0) * b, p: pr });
  }
  return pts;
}

// A curved, tapering thorn: a quadratic arc, thick at the root.
export function thorn(x, y, len, angle, bend, seed = 1) {
  const R = rng(seed), pts = [], n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = angle + bend * t * t + (R() - 0.5) * 0.05;
    const prev = pts[i - 1] ?? { x, y };
    pts.push({ x: i ? prev.x + Math.cos(a) * len / n : x, y: i ? prev.y + Math.sin(a) * len / n : y, p: 1 - 0.85 * t });
  }
  return pts;
}

// A curl of smoke: a spiral that opens from its eye, the scroll shape painters use for a smoke edge.
// dir = 1 turns clockwise on screen. Pressure peaks in the outer turn, where the light catches the lip.
export function spiral(x, y, r, { turns = 1.2, dir = 1, start = 0, n = 40 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = start + dir * t * turns * Math.PI * 2, rr = r * (0.15 + 0.85 * (1 - t));
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.8, p: 0.25 + 0.75 * Math.sin(Math.PI * (1 - t) * 0.9) });
  }
  return pts;
}

// A standing figure of height h (width units), feet at (x, y), as brush strokes: { body: [stroke...], rim: [stroke...],
// hand: [x, y] }. Built from our own proportions (head 1/7.5 of height, a long coat), facing away, one arm raised
// to hold a cord. Strokes are point lists with pressure, painted with a dark tapered brush; rim strokes trace the
// side facing the light at `lightSide` (-1 left, 1 right).
export function figure(x, y, h, { lightSide = -1, lean = 0.04 } = {}) {
  const P = (u, v, p = 1) => ({ x: x + u * h + lean * h * (1 - v), y: y - v * h, p });
  const head = [P(0, 0.93, 1), P(0.002, 0.88, 1)];
  const coat = [P(0, 0.84, 0.9), P(0.01, 0.62, 1), P(0.03, 0.4, 1), P(0.05, 0.18, 0.9)];
  const coatL = [P(-0.04, 0.8, 0.6), P(-0.06, 0.5, 0.9), P(-0.08, 0.2, 0.8)];
  const coatR = [P(0.05, 0.8, 0.6), P(0.08, 0.5, 0.9), P(0.11, 0.22, 0.8)];
  const legs = [[P(-0.02, 0.22, 0.6), P(-0.025, 0, 0.5)], [P(0.05, 0.22, 0.6), P(0.06, 0, 0.5)]];
  const armUp = [P(0.05, 0.78, 0.6), P(0.12, 0.92, 0.5), P(0.16, 1.08, 0.4)];
  const armDown = [P(-0.05, 0.78, 0.6), P(-0.08, 0.6, 0.5), P(-0.07, 0.45, 0.4)];
  // the rim hugs the outer edge of the coat on the light side: the coat's side stroke pushed out by its half width
  const side = lightSide < 0 ? coatL : coatR, out = 0.055 * Math.sign(lightSide);
  const rim = [side.map((q) => ({ ...q, x: q.x + out * h, p: q.p * 0.8 }))];
  return { head, body: [coat, coatL, coatR, ...legs, armUp, armDown], rim, hand: [x + 0.16 * h + lean * h * -0.08, y - 1.08 * h] };
}

// A catenary from a to b sagging by `sag` (width units), as a point list.
export function catenary(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t), p: 0.6 + 0.4 * Math.sin(Math.PI * t) }); }
  return pts;
}
