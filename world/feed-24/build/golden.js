// golden.js: the golden-rectangle construction and its quarter-arc spiral, exact.
// A rectangle of width w and height w / phi is cut into a square and a smaller golden rectangle,
// again and again; the squares turn left, top, right, bottom (the order measured in feed set 24).
// Each square carries a quarter arc centred on its inner corner; consecutive arcs meet with equal
// tangents, so the spiral is C1. Pure.

export const PHI = (1 + Math.sqrt(5)) / 2;
const HALF = Math.PI / 2;

export function goldenRect(x, y, w, levels = 9) {
  const h = w / PHI;
  let L = x, T = y, R = x + w, B = y + h;
  const squares = [];
  for (let k = 0; k < levels; k++) {
    const side = k % 4; let sq;
    if (side === 0) { const s = B - T; sq = { x: L, y: T, s, arc: { cx: L + s, cy: B, r: s, a0: 2 * HALF, a1: 3 * HALF } }; L += s; }
    else if (side === 1) { const s = R - L; sq = { x: L, y: T, s, arc: { cx: L, cy: T + s, r: s, a0: 3 * HALF, a1: 4 * HALF } }; T += s; }
    else if (side === 2) { const s = B - T; sq = { x: R - s, y: T, s, arc: { cx: R - s, cy: T, r: s, a0: 0, a1: HALF } }; R -= s; }
    else { const s = R - L; sq = { x: L, y: B - s, s, arc: { cx: R, cy: B - s, r: s, a0: HALF, a1: 2 * HALF } }; B -= s; }
    sq.side = side; squares.push(sq);
  }
  return { x, y, w, h, squares, rest: { x: L, y: T, w: R - L, h: B - T } };
}

// Point on the spiral at u = quarter index + fraction (constant angular rate inside each quarter).
export function spiralAt(g, u) {
  const n = g.squares.length, k = Math.max(0, Math.min(n - 1, Math.floor(u))), f = Math.max(0, Math.min(1, u - k));
  const { cx, cy, r, a0, a1 } = g.squares[k].arc, a = a0 + (a1 - a0) * f;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a), r, k };
}

// Arc length from the outer end to u; the total for n quarters is (pi/2) * sum(s_k).
export function arcLength(g, u) {
  let s = 0; const k = Math.floor(u);
  for (let i = 0; i < Math.min(k, g.squares.length); i++) s += HALF * g.squares[i].s;
  if (k < g.squares.length) s += HALF * g.squares[k].s * (u - k);
  return s;
}

// Inverse: the u at a given arc length (for a constant-speed comet, the alternative timing law).
export function uAtLength(g, s) {
  for (let i = 0; i < g.squares.length; i++) { const q = HALF * g.squares[i].s; if (s <= q) return i + s / q; s -= q; }
  return g.squares.length;
}

// Timing laws for the comet head. 'angle': equal time per quarter (what the reference shows, moderate
// confidence: about 1.65 s per quarter for the outer three). 'speed': equal pixels per second.
export function cometU(g, t, { law = 'angle', quarter = 1.65, quarters = 6, hold = 0 } = {}) {
  const run = quarter * quarters, cyc = run + hold, tt = ((t % cyc) + cyc) % cyc;
  if (tt >= run) return quarters;
  if (law === 'angle') return tt / quarter;
  const total = arcLength(g, quarters);
  return uAtLength(g, total * tt / run);
}

// Points where square edges meet the outer rectangle: the construction's nodes.
export function nodes(g) {
  const out = [], push = (x, y) => { if (!out.some(p => Math.hypot(p.x - x, p.y - y) < 1e-6)) out.push({ x, y }); };
  push(g.x, g.y); push(g.x + g.w, g.y); push(g.x + g.w, g.y + g.h); push(g.x, g.y + g.h);
  for (const q of g.squares.slice(0, 4)) {
    for (const [x, y] of [[q.x, q.y], [q.x + q.s, q.y], [q.x + q.s, q.y + q.s], [q.x, q.y + q.s]]) {
      const onEdge = Math.abs(x - g.x) < 1e-6 || Math.abs(x - g.x - g.w) < 1e-6 || Math.abs(y - g.y) < 1e-6 || Math.abs(y - g.y - g.h) < 1e-6;
      if (onEdge) push(x, y);
    }
  }
  return out;
}
