// lib/medium/motes.mjs: ink as many small parcels (motes), for ink that leaves a solid: dye streaming off a
// loosening tile the way it streams off a dissolving tablet. Each mote carries a little pigment (its absorbance per
// channel times its mass), rides the water's velocity (midpoint rule), falls at its own settling speed (ink is
// denser than water), swirls a little below the grid's scale, and spreads as it ages (its splat widens like
// diffusion, with sqrt(age)). A mote that reaches the bed is laid into the bed's top layer with its colour: the ink
// dries into sediment. The render sums the motes' absorbance into a field at output resolution and lets the light
// through it by Beer-Lambert, so overlapping trails darken and mix like inks.
import { bilerp, clamp } from './grid.mjs';

export function releaseMotes(m, at, n, a, mass, sink, aS = null) {
  for (let i = 0; i < n; i++) { const [x, y] = at(m.rng(), m.rng()); m.motes.push({ x, y, age: 0, a, aS, mass, sink }); }
}

export function moveMotes(m, dt, layer) {
  if (!m.motes.length) return;
  const s = dt * 30, keep = [], t = m.time;
  for (const p of m.motes) {
    const u1 = bilerp(m.u, m.nx, m.ny, p.x, p.y), v1 = bilerp(m.v, m.nx, m.ny, p.x, p.y), mx = p.x + 0.5 * s * u1, my = p.y + 0.5 * s * v1;
    const q = 0.25 * Math.min(1, p.age / 1.5), e = 0.01, psi = (x, y) => Math.sin(x * 0.7 + t * 0.6) * Math.cos(y * 0.8 - t * 0.4) + 0.5 * Math.sin(x * 1.7 - y * 1.1 + t * 1.1);
    const tu = q * (psi(p.x, p.y + e) - psi(p.x, p.y - e)) / (2 * e), tv = -q * (psi(p.x + e, p.y) - psi(p.x - e, p.y)) / (2 * e);
    p.x += s * (bilerp(m.u, m.nx, m.ny, mx, my) + 0.3 * tu) + (m.rng() - 0.5) * 0.06;
    p.y += s * (bilerp(m.v, m.nx, m.ny, mx, my) + 0.3 * tv) + p.sink * dt + (m.rng() - 0.5) * 0.06;
    p.age += dt;
    const i = clamp(Math.round(p.x), 0, m.nx - 1), floor = m.ny - m.bed[i] - 0.5;
    if (p.y >= floor) { layer(m, i, p.a.map(v => v * p.mass), p.aS ? p.aS.map(v => v * p.mass) : null); continue; }   // dried into the bed
    if (p.x > -2 && p.x < m.nx + 1 && p.y > m.surfaceY(i)) keep.push(p);
  }
  m.motes = keep;
}

// absorbance field from every mote, then the light through it (Beer-Lambert per channel)
export function drawMotes(m, R, vp) {
  if (!m.motes.length) return;
  const { w: W, h: H } = R, d = R.data, A = new Float32Array(W * H * 3), px = vp.cx;
  for (const p of m.motes) {
    if (m.pigS && p.aS) continue;                  // a spectral tank draws these inside the scene (finebuf.mjs)
    const [cx, cy] = vp.p(p.x, p.y), rad = px * (0.35 + 0.75 * Math.sqrt(p.age)), k = p.mass / (rad * rad / (px * px)) * 1.4, R2 = rad * 2.2;
    for (let y = Math.max(0, Math.floor(cy - R2)); y <= Math.min(H - 1, Math.ceil(cy + R2)); y++) for (let x = Math.max(0, Math.floor(cx - R2)); x <= Math.min(W - 1, Math.ceil(cx + R2)); x++) {
      const q = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) / (rad * rad); if (q > 4.8) continue;
      const w = k * Math.exp(-q), o = 3 * (y * W + x); A[o] += p.a[0] * w; A[o + 1] += p.a[1] * w; A[o + 2] += p.a[2] * w;
    }
  }
  for (let i = 0; i < W * H; i++) { const o = 3 * i; if (A[o] + A[o + 1] + A[o + 2] < 1e-5) continue; for (let k = 0; k < 3; k++) d[4 * i + k] *= Math.exp(-3 * A[o + k]); }
}
