// typepile.js: words as rigid bodies. Pills carry words, discs carry punctuation, boxes carry figures. They drop
// into a pile, pack into the numeral of their own count, or sort themselves by a data field.
//
// Synthesis: the pill-and-dot vocabulary of favourite 7VH9, the count drawn as a numeral from Hf9W's digit columns,
// and the closed economy of our swimmers (feed-test-22/build/swimmers.js), where mass is conserved: here the same
// n bodies pass through every mode, nothing spawns or vanishes, so the numeral a pile draws is the count it holds.
// The inks are the exhibit's (ink #eee9df, hot #e0177e) and studio material accents, never 7VH9's five.
//
// Physics: each body is a capsule (two Verlet particles joined by a rigid distance, radius r); a disc is a capsule of
// length 0 and a box a capsule with square caps when drawn. Contacts are capsule against capsule (closest points of
// two segments), resolved by position projection with tangential friction, in a uniform grid. The step is fixed
// (QUALITY-SPEC M4): drive it from cadence.js, so 60 and 120 Hz displays reach the same state.
// Real text: every body keeps its word. The page renders words as DOM text nodes placed over the bodies.
import { defineNode } from './lib/node.js';
import { image, fill, line, rect, toRGBA8 } from './lib/raster.js';
import { hash01 } from './lib/util.js';
import { numeralTracks, numeralWidth, numeralHeight, fillTracks } from './lib/typepile-numerals.js';

export const INKS = Object.freeze({ ground: '#0f0f0e', ink: '#eee9df', bone: '#d9e3c4', slate: '#a9b7d6', ochre: '#b8893a', hot: '#e0177e' });
const PUNCT = /^[.,;:!?'"()]+$/;

// Bodies from a list of words. measure(word) returns the text width in px at the body font size (browser: canvas
// measureText; node: an average advance). Punctuation becomes discs, digits become boxes, words become pills.
export function bodiesFrom(words, { size = 18, measure = (w) => w.length * size * 0.56, hot = -1 } = {}) {
  const r = size * 0.72;
  return words.map((w, i) => {
    const kind = PUNCT.test(w) ? 'disc' : /^\d+$/.test(w) ? 'box' : 'pill';
    const len = kind === 'disc' ? 0 : Math.max(0, measure(w) + size * 0.5 - 2 * r * 0.5);
    return { i, word: w, kind, r: kind === 'disc' ? r * 0.55 : r, len, value: w.replace(/[^\p{L}\p{N}]/gu, '').length, hot: i === hot };
  });
}

export class Pile {
  constructor(bodies, { w = 1440, h = 900, seed = 1, gravity = 2200, iterations = 4, friction = 0.45 } = {}) {
    Object.assign(this, { w, h, seed, gravity, iterations, friction, mode: 'drop', stepN: 0 });
    this.b = bodies.map((d, k) => {
      const x = d.r + 8 + hash01(seed, k) * (w - 2 * d.r - 16 - d.len), y = -d.r - 40 - hash01(seed ^ 77, k) * h * 0.4;
      return { ...d, ax: x, ay: y, bx: x + d.len, by: y, pax: x, pay: y, pbx: x + d.len, pby: y, released: false, target: null };
    });
  }
  release(k) { const b = this.b[k]; if (b) b.released = true; }
  releaseAll() { for (const b of this.b) b.released = true; }
  // Modes: 'drop' (gravity), 'count' (targets along the numeral of n), 'sort' (targets in field order).
  setMode(mode, opts = {}) {
    this.mode = mode;
    if (mode === 'drop') { for (const b of this.b) b.target = null; return this; }
    const T = mode === 'count' ? countTargets(this.b, this.w, this.h, opts) : sortTargets(this.b, this.w, this.h, opts);
    this.layout = T.meta || null; this.b.forEach((b, k) => { b.target = T[k]; b.released = true; });
    return this;
  }
  step(dt) {
    const g = this.mode === 'drop' ? this.gravity * dt * dt : 0, damp = this.mode === 'drop' ? 0.995 : 0.86;
    for (const b of this.b) {
      if (!b.released) continue;
      let vx = (b.ax - b.pax) * damp, vy = (b.ay - b.pay) * damp; b.pax = b.ax; b.pay = b.ay; b.ax += vx; b.ay += vy + g;
      vx = (b.bx - b.pbx) * damp; vy = (b.by - b.pby) * damp; b.pbx = b.bx; b.pby = b.by; b.bx += vx; b.by += vy + g;
      const T = b.target; if (T) { b.ax += (T.ax - b.ax) * 0.12; b.ay += (T.ay - b.ay) * 0.12; b.bx += (T.bx - b.bx) * 0.12; b.by += (T.by - b.by) * 0.12; }
    }
    for (let it = 0; it < this.iterations; it++) { this.rigid(); this.contacts(); this.walls(); }
    this.stepN++;
  }
  rigid() {
    for (const b of this.b) {
      if (b.len === 0) { const mx = (b.ax + b.bx) / 2, my = (b.ay + b.by) / 2; b.ax = b.bx = mx; b.ay = b.by = my; continue; }
      const dx = b.bx - b.ax, dy = b.by - b.ay, d = Math.hypot(dx, dy) || 1e-9, k = (d - b.len) / d / 2;
      b.ax += dx * k; b.ay += dy * k; b.bx -= dx * k; b.by -= dy * k;
    }
  }
  walls() {
    const W = this.w, H = this.h;
    for (const b of this.b) {
      if (!b.released) continue; const r = b.r;
      if (b.ax < r) b.ax = r; else if (b.ax > W - r) b.ax = W - r;
      if (b.bx < r) b.bx = r; else if (b.bx > W - r) b.bx = W - r;
      if (b.ay > H - r) { b.ay = H - r; b.pax += (b.ax - b.pax) * 0.6; }
      if (b.by > H - r) { b.by = H - r; b.pbx += (b.bx - b.pbx) * 0.6; }
    }
  }
  contacts() {
    if (!this.cell) this.cell = Math.max(32, ...this.b.map((b) => b.len + 2 * b.r));
    const cell = this.cell, grid = new Map(), key = (x, y) => (x + 512) * 4096 + (y + 512);
    for (const b of this.b) { if (!b.released) continue; b.cx = Math.floor((b.ax + b.bx) / 2 / cell); b.cy = Math.floor((b.ay + b.by) / 2 / cell); const k = key(b.cx, b.cy); const l = grid.get(k); if (l) l.push(b); else grid.set(k, [b]); }
    for (const b of this.b) {
      if (!b.released) continue;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const l = grid.get(key(b.cx + i, b.cy + j)); if (l) for (const o of l) if (o.i > b.i) this.collide(b, o); }
    }
  }
  collide(p, q) {
    const R = p.r + q.r;
    // broad phase: bounding boxes
    if (Math.min(p.ax, p.bx) - R > Math.max(q.ax, q.bx) || Math.min(q.ax, q.bx) - R > Math.max(p.ax, p.bx) || Math.min(p.ay, p.by) - R > Math.max(q.ay, q.by) || Math.min(q.ay, q.by) - R > Math.max(p.ay, p.by)) return;
    const c = closest(p.ax, p.ay, p.bx, p.by, q.ax, q.ay, q.bx, q.by, SCR);
    let nx = c[4] - c[2], ny = c[5] - c[3]; const d = Math.hypot(nx, ny); if (d >= R) return;
    if (d < 1e-9) { nx = 0; ny = 1; } else { nx /= d; ny /= d; }
    const pen = (R - d) / 2, s = c[0], t = c[1];
    push(p, s, -nx * pen, -ny * pen, nx, ny, this.friction); push(q, t, nx * pen, ny * pen, nx, ny, this.friction);
  }
  // Bodies resting in the frame: released, both ends inside, and slower than 0.5 px a step.
  count() { return this.b.filter((b) => b.released && b.ay > -1 && b.by > -1 && Math.hypot(b.ax - b.pax, b.ay - b.pay) < 0.5).length; }
  energy() { let e = 0; for (const b of this.b) if (b.released) e += (b.ax - b.pax) ** 2 + (b.ay - b.pay) ** 2; return e; }
  // Centre and angle of each body for the DOM text layer.
  poses() { return this.b.map((b) => ({ word: b.word, x: (b.ax + b.bx) / 2, y: (b.ay + b.by) / 2, angle: Math.atan2(b.by - b.ay, b.bx - b.ax), visible: b.released && Math.max(b.ay, b.by) > -b.r })); }
}

const SCR = new Float64Array(6);
// Move one capsule's endpoints so the contact point moves by (dx, dy); weights follow the contact parameter.
// Friction pulls each endpoint's previous position along the tangent, removing a share mu of its sliding.
function push(b, s, dx, dy, nx, ny, mu) {
  const wa = b.len === 0 ? 0.5 : 1 - s, wb = b.len === 0 ? 0.5 : s, k = 0.5 / (wa * wa + wb * wb);
  b.ax += dx * wa * k; b.ay += dy * wa * k; b.bx += dx * wb * k; b.by += dy * wb * k;
  let vx = b.ax - b.pax, vy = b.ay - b.pay, vn = vx * nx + vy * ny; b.pax += (vx - vn * nx) * mu * wa; b.pay += (vy - vn * ny) * mu * wa;
  vx = b.bx - b.pbx; vy = b.by - b.pby; vn = vx * nx + vy * ny; b.pbx += (vx - vn * nx) * mu * wb; b.pby += (vy - vn * ny) * mu * wb;
}
// Closest points of segments P0P1 and Q0Q1 (Ericson, Real-Time Collision Detection 5.1.9).
export function closest(p0x, p0y, p1x, p1y, q0x, q0y, q1x, q1y, out = new Float64Array(6)) {
  const d1x = p1x - p0x, d1y = p1y - p0y, d2x = q1x - q0x, d2y = q1y - q0y, rx = p0x - q0x, ry = p0y - q0y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry; let s = 0, t = 0;
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; } else if (a <= 1e-9) { t = cl(f / e); } else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-9) { s = cl(-c / a); } else {
      const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
      s = den > 1e-9 ? cl((b * f - c * e) / den) : 0; t = (b * s + f) / e;
      if (t < 0) { t = 0; s = cl(-c / a); } else if (t > 1) { t = 1; s = cl((b - c) / a); }
    }
  }
  out[0] = s; out[1] = t; out[2] = p0x + d1x * s; out[3] = p0y + d1y * s; out[4] = q0x + d2x * t; out[5] = q0y + d2y * t; return out;
}

// Endpoint targets that draw the digits of n (the body count) with the bodies themselves. The numeral is sized so
// the bodies fill every segment. Tall frames stack the digits. Layouts tried in order: words along the strokes in
// 1 to 8 lanes (first fit with a stroke weight of 0.1 H wins), then words across the strokes like rungs in 1 to 3
// lanes, where each body uses only its thickness along the stroke and its length becomes the weight.
export function countTargets(bodies, w, h, { margin = 0.08, digits = String(bodies.length), stack = h > w * 1.25 } = {}) {
  const pitch = 2 * Math.max(...bodies.map((b) => b.r)) + 2, E = bodies.reduce((s, b) => s + b.len + 2 * b.r, 0) * 1.3;
  const unit = numeralTracks(digits, { H: 1, stack }), segUnits = unit.reduce((s, [a, b, c, d]) => s + Math.hypot(c - a, d - b), 0);
  const maxH = Math.min((h * (1 - 2 * margin)) / numeralHeight(digits, stack), (w * (1 - 2 * margin)) / numeralWidth(digits, 0.95, stack));
  const at = (H) => ({ x: (w - numeralWidth(digits, 0.95, stack) * H) / 2, y: (h - numeralHeight(digits, stack) * H) / 2 });
  const tryFit = (H0, opts) => { for (let H = H0; H <= maxH; H *= 1.05) { const { x, y } = at(H), T = fillTracks(numeralTracks(digits, { x, y, H, stack }), bodies, opts); if (T) { T.meta = { x, y, H, digits, stack, ...opts }; return T; } } return null; };
  let fallback = null;
  for (let lanes = 1; lanes <= 8; lanes++) {
    const inset = (lanes * pitch) / 2, T = tryFit(Math.max((E / lanes + 2 * inset * unit.length) / segUnits, lanes * pitch * 2.5), { lanes, pitch, inset });
    if (T) { if (lanes * pitch >= 0.1 * T.meta.H) return T; fallback = fallback || T; }
  }
  if (fallback) return fallback;
  const rungs = bodies.reduce((s, b) => s + 2 * b.r, 0) * 1.25, ext = bodies.map((b) => b.len + 2 * b.r).sort((a, b) => a - b), wt = ext[Math.floor(ext.length * 0.75)];
  for (let lanes = 1; lanes <= 3; lanes++) {
    const T = tryFit(Math.max(rungs / lanes / segUnits, wt * lanes * 2), { lanes, pitch: wt, inset: (wt * lanes) / 2, across: true });
    if (T) return T;
  }
  throw new Error(`typepile: ${bodies.length} bodies do not fit a numeral in ${w} x ${h}`);
}

// Endpoint targets in field order: bodies sorted by value (then reading order) flow left to right in rows,
// bottom aligned, with a line break between values, so the pile reads as a sorted text.
export function sortTargets(bodies, w, h, { field = 'value', margin = 0.06 } = {}) {
  const order = bodies.map((b, k) => k).sort((p, q) => bodies[p][field] - bodies[q][field] || p - q);
  const pitch = 2 * Math.max(...bodies.map((b) => b.r)) + 4, x0 = w * margin, x1 = w * (1 - margin), T = new Array(bodies.length), rows = [[]];
  let x = x0, last = null;
  for (const k of order) {
    const b = bodies[k], ext = b.len + 2 * b.r;
    if ((last !== null && b[field] !== last) || x + ext > x1) { rows.push([]); x = x0; }
    rows.at(-1).push([k, x + b.r]); x += ext + 6; last = b[field];
  }
  rows.forEach((row, j) => { const y = h - h * margin - (rows.length - 1 - j) * pitch - pitch / 2; for (const [k, ax] of row) T[k] = { ax, ay: y, bx: ax + bodies[k].len, by: y }; });
  return T;
}

// CPU reference render: ground, then each released body as an anti-aliased capsule (discs round, boxes square).
export function renderCPU(pile, { scale = 1, ground = INKS.ground, inks = [INKS.ink, INKS.bone, INKS.slate, INKS.ochre] } = {}) {
  const im = fill(image(Math.round(pile.w * scale), Math.round(pile.h * scale)), ground);
  for (const b of pile.b) {
    if (!b.released) continue;
    const c = b.hot ? INKS.hot : inks[Math.floor(hash01(pile.seed, b.i) * inks.length)], S = scale;
    if (b.kind === 'box') { const r = b.r * S, x0 = Math.min(b.ax, b.bx) * S - r, x1 = Math.max(b.ax, b.bx) * S + r, y0 = Math.min(b.ay, b.by) * S - r, y1 = Math.max(b.ay, b.by) * S + r; if (Math.abs(b.ay - b.by) < 1) rect(im, x0, y0, x1, y1, c); else line(im, b.ax * S, b.ay * S, b.bx * S, b.by * S, b.r * S, c); }
    else line(im, b.ax * S, b.ay * S, b.bx * S, b.by * S, b.r * S, c);
  }
  return im;
}

export const SPEC = Object.freeze({
  inputs: { words: 'string[] (punctuation tokens become discs, digit tokens boxes)', measure: '(word) => px width at the body size', seed: 'uint32' },
  params: {
    size: { range: [12, 48], unit: 'CSS px, body font size (pill height is 1.44 x size)', default: 18 },
    gravity: { range: [0, 6000], unit: 'px per s squared', default: 2200 },
    iterations: { range: [1, 12], unit: 'constraint passes per step', default: 4 },
    friction: { range: [0, 1], unit: 'share of tangential motion removed per contact', default: 0.45 },
    step: { range: [1 / 240, 1 / 60], unit: 's, fixed step', default: 1 / 120 },
  },
  determinism: 'pure arithmetic in a fixed body order; same words, size, seed and step count give the same pile',
  budget: '80 bodies at 1440 x 900: under 1 ms per step in node (measured in tests/typepile.test.js)',
});

export const node = defineNode({
  id: 'typepile', ports: { in: { words: 'text' }, out: { image: 'image', text: 'text' } }, params: SPEC.params, seed: 1,
  render: ({ seed, params, inputs = {}, w = 640, h = 400, t = 4, mode = 'drop' }) => {
    const pile = new Pile(bodiesFrom(inputs.words || ['type', 'as', 'matter', '.'], { size: params.size }), { w, h, seed, gravity: params.gravity, iterations: params.iterations, friction: params.friction });
    if (mode === 'drop') pile.releaseAll(); else pile.setMode(mode);
    for (let i = 0; i < Math.round(t / params.step); i++) pile.step(params.step);
    return { image: renderCPU(pile), count: pile.count(), poses: pile.poses() };
  },
});

export { toRGBA8 };
