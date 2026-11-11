// well-sim.mjs: what happens in the well, without the picture. Pure: no page, runs in node and the browser.
//
//   const sim = createSim({ reduced });
//   sim.set(parts); sim.seed(); sim.step(STEP); sim.pour(slot, x, y); sim.stir(x, y, vx, vy); sim.tilt(dx, dy);
//
// The water is the studio's own solver (world/studio/lib/fluid.mjs, stable fluids on a fixed clock) on a 96 by 72
// grid. It carries up to four pigment fields, one per element, and a displacement field that bends each element's
// pattern where the water has carried it.
//
// CONSERVATION. The solver's advection and the spreading below do not keep the total amount of a pigment exactly.
// So each step ends by scaling every pigment field back to the amount that was put in (the start, plus every
// pour). After that the total is within TOLERANCE of what was put in, as a share of it. drift() reports how far
// the worst step was out before it was scaled back.
//
// BLEED. A pigment spreads on its own at a rate set by its measured edge softness and flow speed, and faster
// where another pigment is already there (wet into wet).
//
// REACTION. Where two elements with a measured link have mixed, a Gray-Scott reaction runs (one substance feeds,
// another grows on it and decays) on a grid three times finer than the water. The pair's measured wave length
// sets the size of its features, by rank on the table's range; the link sets how far the feed is open and how
// many turns it takes. It runs on every second step, to keep it slow and inside the frame's time. No link, no reaction.
//
// MEDIUM. The ground has a state, and the state sets how pigment behaves on it: medium({ carry, spread, lift, wick })
// (grounds.mjs holds the numbers). carry is the share of the water's motion kept each step, spread scales how fast
// pigment spreads by itself, lift makes it rise as smoke does, wick is [along, across]: a fibre sheet spreads a wash
// faster along its fibres (the x direction) than across them.
//
// CHANGE OF STATE. change(next, op, seconds) moves the medium to another one behind a front that crosses the well:
// heat rises from the bottom, cooling and drying come in from the edges, grinding passes from left to right,
// water soaks down from the top, pressing works from the middle out. phase[] is how far each cell has gone over
// (0 old, 1 new); the picture reads the same field, so the front seen is the front the solver uses. Pigment is
// kept through it by the same correction as every other step.
import { Fluid, STEP } from '../../studio/lib/fluid.mjs';
export { STEP };

export const NX = 96, NY = 72, SLOTS = 4, RS = 3, RX = NX * RS, RY = NY * RS, TOLERANCE = 1e-4, DIFFUSE = 0.03;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const BASE = Object.freeze({ carry: 0.985, spread: 1, lift: 0, wick: [1, 1] });
const edge = (x, y) => 2 * Math.min(x, 1 - x, y, 1 - y);
// where a front starts (0) and where it ends (1), by operation
export const FRONTS = Object.freeze({ heat: (x, y) => 1 - y, cool: edge, dry: edge, grind: (x) => x, dissolve: (x, y) => y, press: (x, y) => 1 - edge(x, y) });
// Where each slot starts: one element fills the well; more share it as soft-edged bodies that meet in the middle.
const HOMES = { 1: [[0.5, 0.5, 0.44]], 2: [[0.3, 0.5, 0.42], [0.7, 0.5, 0.42]], 3: [[0.28, 0.36, 0.36], [0.72, 0.36, 0.36], [0.5, 0.72, 0.36]],
  4: [[0.28, 0.3, 0.32], [0.72, 0.3, 0.32], [0.28, 0.72, 0.32], [0.72, 0.72, 0.32]] };
const mixed = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const total = (F) => { let s = 0; for (let i = 0; i < F.length; i++) s += F[i]; return s; };

export function createSim({ reduced = false, conserve = true } = {}) {
  const n = NX * NY, rn = RX * RY, fluid = new Fluid(NX, NY, { seed: 7, iters: 16, dissipation: 1 });
  const dye = Array.from({ length: SLOTS }, () => new Float32Array(n)), dx = new Float32Array(n), dy = new Float32Array(n), all = new Float32Array(n);
  const RU = new Float32Array(rn).fill(1), RV = new Float32Array(rn), RA = new Float32Array(rn), RB = new Float32Array(rn), zone = new Float32Array(rn), zc = new Float32Array(n);
  const put = new Float64Array(SLOTS), fade = new Float32Array(rn), phase = new Float32Array(n), ragged = new Float32Array(n);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) ragged[y * NX + x] = 0.5 + 0.25 * (Math.sin(x * 0.31 + 2.1 * Math.sin(y * 0.17)) + Math.sin(y * 0.43 + 1.6 * Math.sin(x * 0.13) + 1.9));
  // the reaction fades out before the well's edge, along an uneven line so that no straight front forms there
  for (let y = 0; y < RY; y++) for (let x = 0; x < RX; x++) { const wob = Math.sin(x * 0.071 + 1.3 * Math.sin(y * 0.043)) + Math.sin(y * 0.083 + 1.7 * Math.sin(x * 0.037));
    fade[y * RX + x] = clamp((Math.min(x, RX - 1 - x, y, RY - 1 - y) - 14 - 7 * wob) / 22, 0, 1); }
  let parts = [], tick = 0, clock = 0, tiltX = 0, tiltY = 0, calm = 0, dry = reduced ? 1 : 0, worst = 0, grain = 1, flow = { speed: 0.3, curl: 0.3, coherence: 0.4 }, cur = BASE, to = null, change = null;
  const active = () => dye.slice(0, Math.max(1, parts.length));

  function splat(F, x, y, r, amount) {
    const cx = x * NX, cy = y * NY, rr = r * NX;
    for (let j = Math.max(0, Math.floor(cy - rr * 2)); j < Math.min(NY, Math.ceil(cy + rr * 2)); j++)
      for (let i = Math.max(0, Math.floor(cx - rr * 2)); i < Math.min(NX, Math.ceil(cx + rr * 2)); i++)
        F[j * NX + i] = Math.min(1.4, F[j * NX + i] + amount * Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (rr * rr)));
  }
  function seed() {
    RU.fill(1); RV.fill(0);
    for (const F of dye) F.fill(0); dx.fill(0); dy.fill(0); fluid.u.fill(0); fluid.v.fill(0); clock = 0; tiltX = tiltY = 0; calm = 0; worst = 0; dry = reduced ? 1 : 0;
    const homes = HOMES[clamp(parts.length, 1, SLOTS)] || [], sum = parts.reduce((s, p) => s + p.weight, 0) || 1;
    parts.forEach((p, i) => { const [x, y, r] = homes[i]; splat(dye[i], x, y, r * (0.6 + 0.8 * p.weight * parts.length / sum), 0.95); });
    dye.forEach((F, i) => { put[i] = total(F); });
  }
  // The elements' own measured motion moves the water a little: mean speed sets the drift, coherence how much of it
  // runs one way, curl how much turns. Slow by rule; the visitor's hand is always the stronger force.
  function ambient(dt) {
    clock += dt;
    const s = 34 * flow.speed, c = clamp((flow.coherence - 0.25) * 3.4, 0, 1), a = clock * 0.11;
    if (s > 0.01) {
      fluid.impulse(NX * (0.5 + 0.3 * Math.cos(a)), NY * (0.5 + 0.3 * Math.sin(a * 1.3)), s * c * dt * 9, s * c * 0.2 * Math.sin(a) * dt * 9, 16);
      const k = 110 * flow.curl * (1 - c * 0.5) * dt * 9, x = 0.5 + 0.22 * Math.sin(a * 0.7), y = 0.5 + 0.22 * Math.cos(a * 0.9);
      fluid.impulse(NX * x, NY * (y - 0.12), k, 0, 9); fluid.impulse(NX * x, NY * (y + 0.12), -k, 0, 9);
    }
    if (tiltX || tiltY) for (let i = 0; i < n; i++) { fluid.u[i] += tiltX * dt * 30; fluid.v[i] += tiltY * dt * 30; }
  }
  // the reaction's field is finer than the water, so it is carried by the water's velocity read between its cells
  function carry(src, dst, dt) {
    const { u, v } = fluid;
    for (let y = 0; y < RY; y++) { const gy = Math.min(NY - 1.001, y / RS), y0 = gy | 0, ay = gy - y0;
      for (let x = 0; x < RX; x++) { const gx = Math.min(NX - 1.001, x / RS), x0 = gx | 0, ax = gx - x0, k = y0 * NX + x0;
        const uu = (u[k] * (1 - ax) + u[k + 1] * ax) * (1 - ay) + (u[k + NX] * (1 - ax) + u[k + NX + 1] * ax) * ay, vv = (v[k] * (1 - ax) + v[k + 1] * ax) * (1 - ay) + (v[k + NX] * (1 - ax) + v[k + NX + 1] * ax) * ay;
        const px = clamp(x - dt * uu * RS, 0, RX - 1.001), py = clamp(y - dt * vv * RS, 0, RY - 1.001), a0 = px | 0, b0 = py | 0, fx = px - a0, fy = py - b0, q = b0 * RX + a0;
        dst[y * RX + x] = (src[q] * (1 - fx) + src[q + 1] * fx) * (1 - fy) + (src[q + RX] * (1 - fx) + src[q + RX + 1] * fx) * fy; } }
  }
  // the front: each cell's share of the new state, from the operation's direction and an uneven line
  function front() {
    const at = FRONTS[change.op] || FRONTS.heat, band = 0.12, W = change.op === 'grind' ? 0.34 : 0.2, t = change.f * (1 + band + W) - W;
    for (let y = 0; y < NY; y++) for (let x = 0, i = y * NX; x < NX; x++, i++) phase[i] = clamp((t - at((x + 0.5) / NX, (y + 0.5) / NY) + W * ragged[i]) / band, 0, 1);
  }
  // real is the time that has truly passed, so a front takes its stated seconds whatever the frame rate
  function step(dt = STEP, drift = true, turns = reduced ? 8 : 1, real = dt) {
    if (change) { change.f = Math.min(1, change.f + real / change.seconds); front(); if (change.f >= 1) { cur = to; to = change = null; phase.fill(0); } }
    const nx = to || cur, dC = nx.carry - cur.carry, dS = nx.spread - cur.spread, dL = nx.lift - cur.lift, dA = nx.wick[0] - cur.wick[0], dB = nx.wick[1] - cur.wick[1];
    if (drift) ambient(dt);
    fluid.step(dt);
    const A = active(), moving = fluid.energy() > 1e-5;
    for (const F of [...A, dx, dy]) { fluid._advect(F, fluid.t0, dt); F.set(fluid.t0); }
    for (let i = 0; i < n; i++) { let s = 0; for (const F of A) s += F[i]; all[i] = s; }
    A.forEach((F, s) => { const T = fluid.t0, rate = DIFFUSE * (0.5 + (parts[s]?.drive.bleed ?? 0.5) + 0.8 * (parts[s]?.drive.speed ?? 0.3)); T.set(F);
      for (let y = 1; y < NY - 1; y++) for (let x = 1, i = y * NX + 1; x < NX - 1; x++, i++) {
        const ph = phase[i], k = Math.min(0.2, rate * (1 + 2.2 * Math.min(1, all[i] - T[i]))) * (cur.spread + dS * ph);     // faster where it meets a wet neighbour
        const kx = Math.min(0.24, k * (cur.wick[0] + dA * ph)), ky = Math.min(0.24, k * (cur.wick[1] + dB * ph));           // and along the fibres of a sheet
        F[i] = T[i] + kx * (T[i - 1] + T[i + 1] - 2 * T[i]) + ky * (T[i - NX] + T[i + NX] - 2 * T[i]); }
      const now = total(F); if (put[s] > 1e-9) { worst = Math.max(worst, Math.abs(now - put[s]) / put[s]); if (conserve && now > 1e-9) { const f = put[s] / now; for (let i = 0; i < n; i++) F[i] *= f; } } });
    if (turns > 0 && (reduced || (tick++ & 1))) { if (moving) { carry(RV, RA, dt * (reduced ? 1 : 2)); RV.set(RA); carry(RU, RA, dt * (reduced ? 1 : 2)); RU.set(RA); } react(turns); }   // both substances are carried together
    for (let i = 0; i < n; i++) {
      const ph = phase[i], c = cur.carry + dC * ph, l = cur.lift + dL * ph;
      fluid.u[i] *= c; fluid.v[i] = fluid.v[i] * c - l * Math.min(1, all[i]) * dt;   // the water comes to rest; in a gas pigment rises
      dx[i] = (dx[i] + fluid.u[i] * dt / NX) * 0.997; dy[i] = (dy[i] + fluid.v[i] * dt / NY) * 0.997;   // and the pattern eases back
    }
    // a wash dries once it is left alone: wet at once when the hand acts, dry over a few seconds of calm
    calm += dt; if (!reduced) dry += ((calm > 2.5 ? 1 : 0) - dry) * (calm > 2.5 ? 0.006 : 0.05);
  }
  function react(turns) {
    let any = 0, sc = 0, sk = 0, sw = 0;
    for (let i = 0; i < n; i++) { let z = 0;
      for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) { const l = parts[a].links?.[b] ?? 0; if (l > 0) z = Math.max(z, l * 2.4 * Math.sqrt(Math.min(1, dye[a][i]) * Math.min(1, dye[b][i]))); }
      zc[i] = Math.min(1, z); if (zc[i] > any) any = zc[i]; }
    for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) { const l = parts[a].links?.[b] ?? 0; sc += l * ((parts[a].drive.scale ?? 0.5) + (parts[b].drive.scale ?? 0.5)) / 2; sk += l * ((parts[a].drive.bleed ?? 0.5) + (parts[b].drive.bleed ?? 0.5)) / 2; sw += l; }
    grain = sw ? clamp(0.6 + 0.65 * sc / sw, 0.6, 1.25) : 1;
    const kill = 0.0625 - 0.005 * clamp(sw ? sk / sw : 0.5, 0, 1);   // hard-edged pairs grow separate spots; soft-edged pairs grow joined, winding forms
    if (any < 0.05) { for (let i = 0; i < rn; i++) if (RV[i] > 0.001) { RV[i] *= 0.9; RU[i] += (1 - RU[i]) * 0.1; } return; }
    let x0 = RX, x1 = 0, y0 = RY, y1 = 0;
    for (let y = 0; y < RY; y++) { const gy = Math.min(NY - 1.001, y / RS), j = gy | 0, ay = gy - j;
      for (let x = 0; x < RX; x++) { const gx = Math.min(NX - 1.001, x / RS), i0 = gx | 0, ax = gx - i0, k = j * NX + i0, i = y * RX + x;
        const z = zone[i] = fade[i] * ((zc[k] * (1 - ax) + zc[k + 1] * ax) * (1 - ay) + (zc[k + NX] * (1 - ax) + zc[k + NX + 1] * ax) * ay);
        if (z > 0.06 || RV[i] > 0.002) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } }
    x0 = Math.max(4, x0); y0 = Math.max(4, y0); x1 = Math.min(RX - 5, x1); y1 = Math.min(RY - 5, y1);
    // the reaction needs a start: a few small patches, chosen by the cell's own number so the same blend starts the same way
    for (let y = y0; y <= y1; y++) for (let x = x0, i = y * RX + x0; x <= x1; x++, i++) if (zone[i] > 0.3 && RV[i] < 0.02 && mixed(x, y) % 1499 < 2)
      for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) if (a * a + b * b <= 9) { RV[i + b * RX + a] = 0.5; RU[i + b * RX + a] = 0.35; }
    const Du = 0.533 * grain, Dv = 0.2665 * grain;   // on the nine-point Laplacian below, which has no grain of its own along the grid
    for (let t = 0; t < Math.max(1, Math.round(turns * any)); t++) {
      for (let y = y0; y <= y1; y++) for (let x = x0, i = y * RX + x0; x <= x1; x++, i++) {
        const z = zone[i], u = RU[i], v = RV[i];
        if (z < 0.06) { RA[i] = u + (1 - u) * 0.05; RB[i] = v * 0.95; continue; }
        const lu = 0.2 * (RU[i - 1] + RU[i + 1] + RU[i - RX] + RU[i + RX]) + 0.05 * (RU[i - RX - 1] + RU[i - RX + 1] + RU[i + RX - 1] + RU[i + RX + 1]) - u;
        const lv = 0.2 * (RV[i - 1] + RV[i + 1] + RV[i - RX] + RV[i + RX]) + 0.05 * (RV[i - RX - 1] + RV[i - RX + 1] + RV[i + RX - 1] + RV[i + RX + 1]) - v;
        const f = 0.024 + 0.014 * z, kz = kill + (z < 0.45 ? 0.011 * (0.45 - z) / 0.39 : 0), uvv = u * v * v;   // toward the zone's edge the product decays faster, so the pattern thins out and no front runs along the edge
        const nu = u + Du * lu - uvv + f * (1 - u), nv = v + Dv * lv + uvv - (f + kz) * v;
        RA[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu; RB[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
      }
      for (let y = y0; y <= y1; y++) { const a = y * RX + x0, b = y * RX + x1 + 1; RU.set(RA.subarray(a, b), a); RV.set(RB.subarray(a, b), a); }
    }
  }

  const api = {
    reduced, dye, dx, dy, RV, fluid, phase,
    get changing() { return change ? { op: change.op, f: change.f } : null; }, get medium() { return cur; },
    // the ground's state, at once
    setMedium(m) { cur = { ...BASE, ...m }; to = change = null; phase.fill(0); return api; },
    // the ground changes state behind a front; under reduced motion it has changed at once
    change(m, op, seconds = 9) { to = { ...BASE, ...m }; change = { op, f: 0, seconds }; calm = 0; if (reduced) { cur = to; to = change = null; phase.fill(0); } return api; },
    get dry() { return dry; }, get flow() { return flow; }, get parts() { return parts; }, get grain() { return grain; },
    set(next) { parts = next.slice(0, SLOTS); let sp = 0, cu = 0, co = 0, w = 0;
      for (const p of parts) { sp += p.weight * p.drive.speed; cu += p.weight * p.drive.curl; co += p.weight * p.drive.coherence; w += p.weight; }
      flow = w ? { speed: sp / w, curl: cu / w, coherence: co / w } : flow; return api; },
    seed, step, react,
    // a brush lays pigment in one cell (amount above 0), or lifts that share of it (below 0); what is owed follows. Returns the change.
    lay(slot, i, amount) { if (slot >= parts.length || !(i >= 0 && i < n)) return 0; const F = dye[slot], was = F[i]; F[i] = amount >= 0 ? Math.min(1.4, was + amount) : was * Math.max(0, 1 + amount); put[slot] += F[i] - was; calm = 0; return F[i] - was; },
    // an empty well: no pigment, and nothing owed
    clear() { for (const F of dye) F.fill(0); put.fill(0); return api; },
    // Reduced motion never sees the drift, so a fresh well is carried a fixed way along its own measured flow first,
    // and the reaction is then given its turns in one go: the still is the same every time.
    settle() { if (!reduced) return; for (let i = 0; i < 150; i++) step(STEP, true, 0); react(1000); },
    pour(slot, x, y, amount = 0.5) { if (slot < parts.length) { const F = dye[slot], was = total(F); splat(F, x, y, 0.09, amount); put[slot] += total(F) - was; } calm = 0; },
    stir(x, y, vx, vy) { fluid.impulse(x * NX, y * NY, vx * NX, vy * NY, 7); calm = 0; },
    tilt(tx, ty) { tiltX = clamp(tx, -1, 1); tiltY = clamp(ty, -1, 1); calm = 0; },
    energy: () => fluid.energy(),
    product: () => total(RV) / rn,
    amounts: () => dye.map((F) => total(F) / n),
    // conservation: what was put in, what is there now, and the worst step before it was scaled back
    put: () => Array.from(put, (p) => p / n),
    error: () => Math.max(0, ...dye.map((F, i) => (put[i] > 1e-9 ? Math.abs(total(F) - put[i]) / put[i] : 0))),
    drift: () => worst,
  };
  return api;
}
