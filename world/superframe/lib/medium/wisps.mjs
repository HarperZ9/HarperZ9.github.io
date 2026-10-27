// lib/medium/wisps.mjs: smoke as threads. The air's smoke field lives on the coarse grid and blurs to a cloud; a
// wick's smoke is a thread that the air bends, splits and frays. So each smoke pour also releases fine tracers that
// ride the air's velocity (midpoint rule) with a small seeded jitter, and the render lays them as soft dots at output
// resolution: the thread is the trail of many tracers released from one point, and it widens and fades as it ages.
// After Otto Piene's smoke drawings, where the line is made by the air, not the hand.
import { bilerp, clamp } from './grid.mjs';

const LIFE = 9;

export function releaseWisps(m, e, dt) {
  const n = Math.max(1, Math.round((e.props.threads ?? 24) * dt * 30)), r = (e.where.r ?? 0.02) * 0.4;
  for (let i = 0; i < n; i++) m.wisps.push({ x: ((e.where.x ?? 0.5) + (m.rng() - 0.5) * r) * m.nx - 0.5, y: ((e.where.y ?? 0.2) + (m.rng() - 0.5) * r) * m.ny - 0.5, age: 0 });
}

export function moveWisps(m, dt) {
  if (!m.wisps.length) return;
  const s = dt * 30, keep = [];
  for (const w of m.wisps) {
    w.px = w.x; w.py = w.y;
    const u1 = bilerp(m.u, m.nx, m.ny, w.x, w.y), v1 = bilerp(m.v, m.nx, m.ny, w.x, w.y), mx = w.x + 0.5 * s * u1, my = w.y + 0.5 * s * v1;
        // turbulence finer than the grid (a subgrid model): a divergence-free swirl from a moving stream function, weak
    // where the smoke leaves the wick (it rises laminar) and stronger as it ages, so the column breaks into curls
    const t = m.time, q = 0.9 * Math.min(1, w.age / 2.5), e = 0.01, psi = (x, y) => Math.sin(x * 0.55 + t * 0.7) * Math.cos(y * 0.6 - t * 0.5) + 0.6 * Math.sin(x * 1.3 - y * 0.9 + t * 1.3) + 0.35 * Math.cos(x * 2.4 + y * 2.1 - t * 1.9);
    const tu = q * (psi(w.x, w.y + e) - psi(w.x, w.y - e)) / (2 * e), tv = -q * (psi(w.x + e, w.y) - psi(w.x - e, w.y)) / (2 * e);
    w.x += s * 0.35 * tu; w.y += s * 0.35 * tv;
    const jit = 0.12 * Math.sqrt(dt * 30) * (0.3 + w.age / LIFE);
    w.x += s * bilerp(m.u, m.nx, m.ny, mx, my) + (m.rng() - 0.5) * jit; w.y += s * bilerp(m.v, m.nx, m.ny, mx, my) + (m.rng() - 0.5) * jit; w.age += dt;
    const i = clamp(Math.round(w.x), 0, m.nx - 1);
    if (w.age < LIFE && w.x > 0 && w.x < m.nx - 1 && w.y > 0 && w.y < m.surfaceY(i) - 0.5) keep.push(w);
  }
  m.wisps = keep;
}

// a soft volume: every tracer adds a little smoke density in a gaussian that widens as it ages (young smoke is a
// tight column, old smoke a diffuse veil), summed into a density field at output resolution; the air is then seen
// through it, exp(-density), toward a warm grey lit from above. The density varies because the tracers bunch and
// part with the air's own folds, which is what makes it read as a wisp rather than a line.
export function drawWisps(m, R, soot, vp) {
  if (!m.wisps.length) return;
  const { w: W, h: H } = R, d = R.data, px = vp.cx * m.nx / 1280, D = new Float32Array(W * H);
  for (const w of m.wisps) {
    const [cx, cy] = vp.p(w.x, w.y), life = w.age / LIFE, rad = px * (1.6 + 16 * life ** 0.8), mass = 0.9 * (1 - life) ** 1.4 / (rad / px) ** 0.7;
    const R2 = rad * 2.2;
    for (let y = Math.max(0, Math.floor(cy - R2)); y <= Math.min(H - 1, Math.ceil(cy + R2)); y++) for (let x = Math.max(0, Math.floor(cx - R2)); x <= Math.min(W - 1, Math.ceil(cx + R2)); x++) {
      const q = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (rad * rad); if (q > 4.8) continue;
      D[y * W + x] += mass * Math.exp(-q);
    }
  }
  // fine structure inside the veil: young tracers also lay a thin trace along their last step, so the column keeps
  // the threads it is made of before they spread
  for (const w of m.wisps) {
    const life = w.age / LIFE; if (life > 0.45 || w.px == null) continue;
    const [ax, ay] = vp.p(w.px, w.py), [bx, by] = vp.p(w.x, w.y), steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let s = 0; s <= steps; s++) { const x = Math.round(ax + (bx - ax) * s / steps), y = Math.round(ay + (by - ay) * s / steps); if (x >= 0 && y >= 0 && x < W && y < H) D[y * W + x] += 0.22 * (1 - life / 0.45); }
  }
  for (let y = 0; y < H; y++) {
    const light = 1.25 - 0.45 * clamp(vp.g(0, y)[1] / (m.ny * m.waterLevel), 0, 1);                         // lit from above: the veil is paler high in the air
    for (let x = 0; x < W; x++) {
      const i = y * W + x; if (D[i] < 1e-4) continue;
      const a = 0.85 * (1 - Math.exp(-D[i] * 0.32)), o = 4 * i;
      for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - a) + soot[k] * light * a;
    }
  }
}
