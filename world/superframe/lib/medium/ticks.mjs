// lib/medium/ticks.mjs: an item as ticks, each carrying a weight vector over elements (BLEED sections 11 to 15).
// An item placed on the medium is sampled as ticks (points a fraction of a cell apart). Every tick rides the water's
// velocity, keeps its own clock, thickness and distance travelled, and carries weights over the item's elements, for
// example ink 1.0 and charcoal 0.0. A transformation is the weights moving from one element to the next, tick by
// tick, while the item moves; nothing sets one mix ratio for the whole item, so the change runs as a front.
//
// The rule that moves a tick is a cellular automaton whose law belongs to the element being grown into: each tick
// takes a weighted sum of its neighbours' weights in that element (a smooth kernel of the element's radius), adds the
// local drive (thinness, distance travelled, speed, contact with the bed, heat from the medium), and grows toward the
// element where the sum passes the element's threshold. mode 'life' flips a tick outright at the threshold (binary,
// after Conway's Life and Wolfram's Rule 110); mode 'lenia' moves it by a smooth growth function (continuous, after
// Bert Chan's Lenia, 2019). Growing Neural Cellular Automata (Mordvintsev et al., Distill 2020) showed that the same
// local update with learned weights grows and repairs whole patterns; here the weights are the elements' measured
// or chosen laws. Each element also brings its own timing layer (timing.mjs) and its own look.
//
// Element: { name, law: { radius, threshold, softness, rate, mode, drive: { thin, travel, speed, contact, heat },
//            seed }, look(tick, progress) -> { absorb?: [3], paint?: [r, g, b, a], emit?: [3] }, timing?: [layers] }
import { bilerp, clamp } from './grid.mjs';
import { progress as timed } from './timing.mjs';

// sample a shape (inside(x, y) in grid cells -> 0..1 thickness) as ticks on a jittered lattice
export function placeItem(m, { inside, box, spacing = 0.4, elements, start = 0, name = 'item', still = false }) {
  const [x0, y0, x1, y1] = box, ticks = [];
  for (let y = y0; y < y1; y += spacing) for (let x = x0; x < x1; x += spacing) {
    const jx = x + (m.rng() - 0.5) * spacing * 0.8, jy = y + (m.rng() - 0.5) * spacing * 0.8, h = inside(jx, jy);
    if (h > 0.02) ticks.push({ x: jx, y: jy, h, w: elements.map((_, i) => (i === start ? 1 : 0)), born: m.time, travel: 0, clock: elements.map(() => 0), id: ticks.length });
  }
  const item = { name, ticks, elements, spacing, still, history: [] };
  (m.items ??= []).push(item);
  return item;
}

// neighbour lookup: a hash grid of tick indices
function grid(ticks, cell) {
  const G = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
  ticks.forEach((t, k) => { const g = key(Math.floor(t.x / cell), Math.floor(t.y / cell)); if (!G.has(g)) G.set(g, []); G.get(g).push(k); });
  return (x, y, f) => { const i = Math.floor(x / cell), j = Math.floor(y / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = G.get(key(i + a, j + b)); if (L) for (const k of L) f(k); } };
}

// one step for every item: move, then let each element's law grow its weight across the ticks
export function stepItems(m, dt) {
  for (const it of m.items ?? []) {
    const s = dt * 30;
    if (!it.still) for (const t of it.ticks) {
      const u1 = bilerp(m.u, m.nx, m.ny, t.x, t.y), v1 = bilerp(m.v, m.nx, m.ny, t.x, t.y), mx = t.x + 0.5 * s * u1, my = t.y + 0.5 * s * v1;
      const ux = bilerp(m.u, m.nx, m.ny, mx, my), vy = bilerp(m.v, m.nx, m.ny, mx, my), sink = it.sink ?? 0;
      t.x = clamp(t.x + s * ux, 0, m.nx - 1); t.y = clamp(t.y + s * vy + sink * dt, m.surfaceY(clamp(Math.round(t.x), 0, m.nx - 1)) + 0.3, m.ny - 1);
      t.speed = Math.hypot(ux, vy); t.travel += t.speed * s;
    }
    for (let e = 0; e < it.elements.length; e++) { const E = it.elements[e]; if (E.law && e > 0) grow(m, it, e, E.law, dt); }
    for (const t of it.ticks) for (let e = 0; e < it.elements.length; e++) if (t.w[e] > 0.01) t.clock[e] += dt;
  }
}

function grow(m, it, e, L, dt) {
  const R = L.radius ?? 1.2, near = grid(it.ticks, R), next = new Float32Array(it.ticks.length), D = L.drive ?? {};
  for (const t of it.ticks) {
    // the neighbourhood: a smooth kernel (a ring is allowed: inner/outer), weighted sum of neighbours in element e
    let S = 0, K = 0;
    near(t.x, t.y, k => { const o = it.ticks[k], d = Math.hypot(o.x - t.x, o.y - t.y) / R; if (d > 1 || o === t) return; const kw = L.ring ? Math.exp(-(((d - 0.5) / 0.15) ** 2)) : 1 - d * d; S += kw * o.w[e]; K += kw; });
    S = K > 0 && L.neighbours !== false ? S / K : 0;                                 // neighbours: false runs without the automaton
    const i = clamp(Math.round(t.x), 0, m.nx - 1), floor = m.ny - m.bed[i] - 0.5, heat = bilerp(m.T, m.nx, m.ny, t.x, t.y);
    const drive = (D.thin ?? 0) * (1 - t.h) + (D.travel ?? 0) * Math.min(1, t.travel / (D.travelScale ?? 40)) + (D.speed ?? 0) * Math.min(1, (t.speed ?? 0) / 0.5) + (D.contact ?? 0) * (floor - t.y < 1.5 ? 1 : 0) + (D.heat ?? 0) * clamp(heat, 0, 1) + (D.age ?? 0) * Math.min(1, (m.time - t.born) / (D.ageScale ?? 6)) + (D.tracer && m.tracers[D.tracer.name] ? D.tracer.gain * Math.min(1, bilerp(m.tracers[D.tracer.name].f, m.nx, m.ny, t.x, t.y) / (D.tracer.scale ?? 1)) : 0);
    const x = S + drive - (L.threshold ?? 0.5), rate = (L.rate ?? 1) * dt;
    let w = t.w[e];
    if (L.mode === 'global') w = clamp(w + rate, 0, 1);                              // the control: one slider for every tick (a crossfade)
    else if ((L.mode ?? 'lenia') === 'life') { if (x > 0) w = 1; }                  // a binary flip, held once made
    else w = clamp(w + rate * Math.tanh(x / (L.softness ?? 0.08)), 0, 1);         // a smooth growth toward or away
    next[t.id] = w;
  }
  // the weight a tick gains in e is taken from the elements before it, in order (the vector stays a partition of 1)
  for (const t of it.ticks) {
    const gain = next[t.id] - t.w[e]; if (Math.abs(gain) < 1e-7) continue;
    t.w[e] = next[t.id];
    let take = gain;
    for (let f = e - 1; f >= 0 && take > 0; f--) { const q = Math.min(t.w[f], take); t.w[f] -= q; take -= q; }
    if (gain < 0) t.w[e - 1] -= gain;
  }
}

// the item's state as numbers (BLEED section 13's check): per element, the mean weight, the spread of weights across
// the ticks (a crossfade has none), the share of ticks mid-change (the front), the front's centroid, and the change
export function measure(it, e = 1, prev = null) {
  const n = it.ticks.length; let s = 0, s2 = 0, front = 0, fx = 0, fy = 0, dsum = 0;
  for (const t of it.ticks) { const w = t.w[e]; s += w; s2 += w * w; if (w > 0.15 && w < 0.85) { front++; fx += t.x; fy += t.y; } if (prev) dsum += Math.abs(w - (prev[t.id] ?? w)); }
  const mean = s / n, spread = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  return { mean, spread, front: front / n, frontAt: front ? [fx / front, fy / front] : null, change: prev ? dsum / n : 0, snapshot: Float32Array.from(it.ticks, t => t.w[e]) };
}

// draw every item: each tick lays every element's look, scaled by its weight in that element, as a soft splat
export function drawItems(m, R, vp) {
  if (!(m.items ?? []).length) return;
  const { w: W, h: H } = R, d = R.data, A = new Float32Array(W * H * 3), P = new Float32Array(W * H * 4), E = new Float32Array(W * H * 3);
  let any = false;
  for (const it of m.items) {
    const r = it.spacing * 1.7 * vp.cx, norm = (it.spacing * vp.cx) ** 2 / (Math.PI * r * r), R2 = r * 2.1;
    for (const t of it.ticks) {
      const looks = it.elements.map((E0, e) => (t.w[e] > 0.002 ? [t.w[e], E0.look(t, E0.timing ? timed(E0.timing, t.clock[e]) : 1, m)] : null)).filter(Boolean);
      if (!looks.length) continue; any = true;
      const [cx, cy] = vp.p(t.x, t.y);
      for (let y = Math.max(0, Math.floor(cy - R2)); y <= Math.min(H - 1, Math.ceil(cy + R2)); y++) for (let x = Math.max(0, Math.floor(cx - R2)); x <= Math.min(W - 1, Math.ceil(cx + R2)); x++) {
        const q = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (r * r); if (q > 4.4) continue;
        const k = norm * Math.exp(-q) * t.h, i = y * W + x;
        for (const [w, L] of looks) {
          if (L.absorb && !m.pigS) for (let c = 0; c < 3; c++) A[3 * i + c] += L.absorb[c] * w * k;   // a spectral tank has these in the scene
          if (L.paint) { const a = L.paint[3] * w * k; for (let c = 0; c < 3; c++) P[4 * i + c] += L.paint[c] * a; P[4 * i + 3] += a; }
          if (L.emit) for (let c = 0; c < 3; c++) E[3 * i + c] += L.emit[c] * w * k;
        }
      }
    }
  }
  if (!any) return;
  for (let i = 0; i < W * H; i++) {
    const a = 1 - Math.exp(-4 * P[4 * i + 3]), pa = P[4 * i + 3] > 1e-6 ? a / P[4 * i + 3] : 0;    // paint covers like a layer of pigment: dense where ticks overlap
    for (let c = 0; c < 3; c++) { let v = d[4 * i + c] * Math.exp(-3 * A[3 * i + c]); v = v * (1 - a) + P[4 * i + c] * pa; d[4 * i + c] = v + E[3 * i + c]; }
  }
}
