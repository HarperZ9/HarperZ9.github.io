// lib/medium/medium.mjs: a living medium of water and air whose properties change when anything is added to it.
//
//   const m = new Medium({ nx: 192, ny: 108, seed: 'tank', waterLevel: 0.42 });
//   m.add('text', { x: 0.3, y: 0.5 }, 1, { text: 'flow', color: '#1d2a3a', at: 0.5 });
//   m.add('heat', { x: 0.7, y: 0.97, r: 0.08 }, 1, { at: 0, for: 20 });
//   m.run(12);                       // fixed steps of 1/30 s
//   render(m, 3840, 2160)            // lib/medium/render.mjs
//
// The tank is a side view: water below a moving surface, air above. Both are fluids on one grid; the surface is a
// height field with waves, and the pressure solve treats it as a wall, so each fluid keeps to its side while wind,
// heat, bubbles and mist cross the interface by their own rules. Properties are fields (viscosity, density through
// temperature, salt, sugar and pigment, turbulence, refractive index, opacity), and every technique is an additive that
// changes them locally (additives.mjs). Nothing is wired between additives: when two meet, the flow mixes them.
// Deterministic: fixed step, fixed iterations, randomness only from the seed.
import { advect, diffuse, project, confine, clamp, bilerp, KAPPA } from './grid.mjs';
import { KINDS, layer } from './additives.mjs';
import { rngFrom } from '../seed.mjs';
import { moveTesserae } from './tesserae.mjs';
import { moveWisps } from './wisps.mjs';
import { moveMotes } from './motes.mjs';
import { stepItems } from './ticks.mjs';
import { stepReaction } from './reaction.mjs';

export const DT = 1 / 30;
const F32 = n => new Float32Array(n);

export const LAWS = Object.freeze(['advection', 'diffusion', 'buoyancy', 'surface', 'refraction', 'settling']);

export class Medium {
  constructor({ nx = 192, ny = 108, seed = 'medium', waterLevel = 0.3, bedLevel = 0.95, bedRelief = 0, spectral = false } = {}) {
    const n = nx * ny;
    Object.assign(this, { nx, ny, n, seed, time: 0, steps: 0, rng: rngFrom(seed), waterLevel, emitters: [], log: [] });
    this.u = F32(n); this.v = F32(n); this.p = F32(n); this.div = F32(n); this.tmp = F32(n); this.tmp2 = F32(n); this.curl = F32(n);
    this.T = F32(n); this.S = F32(n); this.sugar = F32(n); this.mist = F32(n); this.smoke = F32(n); this.oil = F32(n);
    // how fast pigment spreads here: each pour can set it (props.spread), it rides the flow with the pigment and
    // relaxes to the water's own rate, so a bloom ink and a tight ink can share one tank
    this.kap = F32(n).fill(KAPPA);
    this.pig = [F32(n), F32(n), F32(n)];   // dissolved pigment, absorption per channel
    this.pigT = [F32(n), F32(n), F32(n)];  // pigment poured as words: same physics, drawn through its own fine detail map
    // spectral: the same pigments also kept as 16-band absorbance spectra (spectral.mjs), so inks that look alike
    // can still mix apart; the RGB fields above keep the physics (density) either way
    if (spectral) { this.pigS = Array.from({ length: 16 }, () => F32(n)); this.pigTS = Array.from({ length: 16 }, () => F32(n)); this.sedS = Array.from({ length: 16 }, () => F32(n)); }
    this.details = [];                     // per text pour: a deformation map at twice the grid that keeps letters crisp
    this.sed = [F32(n), F32(n), F32(n)];   // particulate pigment that settles
    this.stain = [F32(n), F32(n), F32(n)]; // what the back wall remembers
    this.nu = F32(n); this.turb = F32(n); this.ior = F32(n); this.solid = new Uint8Array(n); this.phase = new Uint8Array(n);
    this.law = LAWS.map(() => F32(n));
    this.h = F32(nx); this.hv = F32(nx); this.film = F32(nx); // surface height (cells, up positive), its speed, oil film
    // bed height in cells from the bottom; bedRelief > 0 lays low dunes (two seeded swells), as a settled floor has
    const ph = [this.rng() * 6.283, this.rng() * 6.283];
    this.bed = Float32Array.from({ length: nx }, (_, i) => (1 - bedLevel) * ny * (1 + bedRelief * (0.6 * Math.sin(i / nx * 6.283 * 1.3 + ph[0]) + 0.4 * Math.sin(i / nx * 6.283 * 3.1 + ph[1]))));
    this.layers = Array.from({ length: nx }, () => []); // per column, bottom up: { t (cells), rgb (pigment) }
    this.glass = []; this.bubbles = []; this.foam = []; this.tesserae = []; this.wisps = []; this.motes = []; this.tracers = {}; this.wind = 0; this.sound = null;   // tracers: named dissolved substances, carried and conserved
    this.refresh();
  }
  surfaceY(i) { return this.waterLevel * this.ny - this.h[i]; }
  refresh() {
    const { nx, ny } = this;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, water = j + 0.5 >= this.surfaceY(i), bed = j + 0.5 >= ny - this.bed[i];
      let solid = bed ? 1 : 0;
      for (const g of this.glass) if (((i + 0.5) / nx - g.x) ** 2 / g.rx ** 2 + ((j + 0.5) / ny - g.y) ** 2 / g.ry ** 2 <= 1) solid = 2;
      this.solid[k] = solid; this.phase[k] = water ? 1 : 0;
      this.nu[k] = (water ? 0.6 : 0.25) + 18 * this.sugar[k];
      this.ior[k] = solid === 2 ? 1.5 : water ? 1.333 + 0.0006 * this.S[k] + 0.0004 * this.sugar[k] - 0.003 * this.T[k] : 1 - 0.0006 * this.T[k];
    }
  }

  // The one way in. kind: an additive name from additives.mjs. where: { x, y, r, w, h } in tank units (0..1, y down),
  // or a named region ('surface', 'bottom', 'air'). amount: strength (0 removes nothing; there is no un-adding).
  // props: kind-specific (colour, text, temperature...) plus at (s) and for (s, how long it keeps pouring).
  add(kind, where = {}, amount = 1, props = {}) {
    const K = KINDS[kind]; if (!K) throw new Error(`medium: no additive "${kind}" (one of ${Object.keys(KINDS).join(', ')})`);
    const e = { kind, where: K.where ? K.where(where, this) : where, amount, props: { at: 0, for: 0, ...props }, done: false, id: this.emitters.length };
    if (K.init) K.init(this, e);
    this.emitters.push(e);
    this.log.push({ kind, at: e.props.at, amount, text: props.text ?? null });
    return e.id;
  }

  step() {
    const { nx, ny, n } = this, dt = DT, t = this.time;
    // a pour with no duration fires exactly once (a float window let it fire on two steps: a mosaic laid twice)
    for (const e of this.emitters) {
      const a = e.props.at;
      if (!(e.props.for > 0)) { if (!e.done && t + dt > a) { KINDS[e.kind].apply(this, e, 0, dt); e.done = true; } continue; }
      if (t + dt > a && t < a + e.props.for) KINDS[e.kind].apply(this, e, (t - a) / e.props.for, dt);
    }
    this.refresh();
    const water = this.phase, air = Uint8Array.from(water, (w, k) => (!w && !this.solid[k] ? 1 : 0)), wet = Uint8Array.from(water, (w, k) => (w && !this.solid[k] ? 1 : 0));
    // forces: buoyancy from temperature, salt, sugar and pigment in water; heat and mist in air
    // Each cell is pushed by its density against the mean of its own row and phase (the hydrostatic part removed,
    // Boussinesq), so a flat stratified band rests instead of churning, and a fresh drop that reaches a salt layer
    // floats on it. (Absolute density drove spurious currents: a halocline dragged ink down, found 2026-10-26.)
    const by = this.law[2], dens = this.tmp2, rowW = new Float64Array(ny), rowA = new Float64Array(ny), cW = new Float64Array(ny), cA = new Float64Array(ny);
    for (let k = 0; k < n; k++) {
      if (this.solid[k]) { dens[k] = 0; continue; }
      const j = (k / nx) | 0;
      dens[k] = water[k] ? 0.9 * this.S[k] + 0.6 * this.sugar[k] + 0.25 * (this.pig[0][k] + this.pig[1][k] + this.pig[2][k] + this.pigT[0][k] + this.pigT[1][k] + this.pigT[2][k]) + 0.5 * (this.sed[0][k] + this.sed[1][k] + this.sed[2][k]) - 0.5 * this.oil[k] - 0.9 * this.T[k] : 0.05 * this.mist[k] - 1.6 * this.T[k] + 0.2 * this.smoke[k];
      if (water[k]) { rowW[j] += dens[k]; cW[j]++; } else { rowA[j] += dens[k]; cA[j]++; }
    }
    for (let k = 0; k < n; k++) {
      if (this.solid[k]) { by[k] = 0; continue; }
      const j = (k / nx) | 0, mean = water[k] ? rowW[j] / Math.max(1, cW[j]) : rowA[j] / Math.max(1, cA[j]);
      const f = 2.5 * (dens[k] - mean); this.v[k] += dt * f; by[k] = Math.abs(f);
      const keep = water[k] ? 0.985 : 0.99; this.u[k] *= keep; this.v[k] *= keep;
    }
    // wind: momentum into the air, and shear on the top water rows
    for (let i = 0; i < nx; i++) {
      const js = Math.floor(this.surfaceY(i));
      for (let j = 0; j < js; j++) this.u[j * nx + i] += dt * this.wind * (1 - j / Math.max(1, js)) * 2;
      for (let j = Math.max(0, js); j < Math.min(ny, js + 3); j++) { const k = j * nx + i; if (water[k]) this.u[k] += dt * 0.5 * (this.wind - this.u[k]) * (1 - (j - js) / 3); }
    }
    if (this.sound) KINDS.sound.force(this, this.sound, dt);
    confine(this.u, this.v, this.turb, nx, ny, dt, this.curl);
    const u0 = Float32Array.from(this.u), v0 = Float32Array.from(this.v);
    advect(u0, u0, v0, nx, ny, dt * 30, this.u); advect(v0, u0, v0, nx, ny, dt * 30, this.v);
    for (const [f] of [[this.u], [this.v]]) { const c = Float32Array.from(this.nu, x => x * dt); diffuse(f, c, nx, ny, 6, this.tmp, null); }
    project(this.u, this.v, water, this.solid, nx, ny, 40, this.p, this.div);
    this.lawRead(u0, v0);
    this.carryDetail(); moveTesserae(this, dt); moveMotes(this, dt, layer); stepItems(this, dt); if (this.reaction) stepReaction(this, dt);
    // a dissolved detail has handed everything to the carried field: drop it (its weight is under 1%)
    this.details = this.details.filter(d => d.mode !== 'dissolve' || this.time - d.at < d.hold * 4.6);
    this.carry(wet, air, dt);
    KINDS.sediment.settle(this, dt);
    KINDS.oil.surface(this, dt);
    KINDS.heat.evaporate(this, dt);
    this.waves(dt);
    KINDS.bubbles.move(this, dt); moveWisps(this, dt);
    for (let c = 0; c < 3; c++) for (let k = 0; k < n; k++) this.stain[c][k] += dt * 0.004 * this.pig[c][k];
    this.time += dt; this.steps++;
  }

  // scalars ride the flow on their own side of the surface; heat lives in both
  carry(wet, air, dt) {
    const { nx, ny, u, v, tmp } = this, s = dt * 30;
    // semi-Lagrangian advection does not conserve what it carries (a blooming ink gained 20% in 3 s); for the
    // conserved scalars the total after the step is scaled back to the total before it
    const sum = q => { let t = 0; for (let k = 0; k < q.length; k++) t += q[k]; return t; };
    const go = (q, mask, kappa, keep = true) => { const before = keep ? sum(q) : 0; advect(Float32Array.from(q), u, v, nx, ny, s, tmp, mask); q.set(tmp); if (keep) { const after = sum(q); if (after > 1e-9) { const f = before / after; for (let k = 0; k < q.length; k++) q[k] *= f; } } if (kappa) diffuse(q, kappa * dt, nx, ny, 3, this.tmp2, mask); };
    advect(Float32Array.from(this.kap), u, v, nx, ny, s, tmp, wet); this.kap.set(tmp);
    for (let k = 0; k < this.n; k++) this.kap[k] += (KAPPA - this.kap[k]) * 0.004;
    const kap = Float32Array.from(this.kap, x => x * dt), spread = q => diffuse(q, kap, nx, ny, 3, this.tmp2, wet);
    spread(this.kap); // the rate spreads with the ink it belongs to, so a bloom keeps blooming at its own front
    for (const c of [0, 1, 2]) { go(this.pig[c], wet, 0); spread(this.pig[c]); go(this.pigT[c], wet, 0); spread(this.pigT[c]); go(this.sed[c], wet, 0.05); }
    if (this.pigS) for (let b = 0; b < 16; b++) { go(this.pigS[b], wet, 0); spread(this.pigS[b]); go(this.pigTS[b], wet, 0); spread(this.pigTS[b]); go(this.sedS[b], wet, 0.05); }
    go(this.S, wet, 0.08); for (const q of Object.values(this.tracers)) go(q.f, wet, q.kappa); go(this.sugar, wet, 0.05); go(this.oil, wet, 0.1); go(this.mist, air, 0.8, false); go(this.smoke, air, 0.04, false);
    const T0 = Float32Array.from(this.T); advect(T0, u, v, nx, ny, s, tmp); this.T.set(tmp); diffuse(this.T, 1.2 * dt, nx, ny, 3, this.tmp2, null);
    for (let k = 0; k < this.n; k++) { this.T[k] *= 0.996; this.mist[k] *= 0.995; this.smoke[k] *= 0.998; }
  }

  // The two scales: physics runs on the coarse grid; words keep their shape through a deformation map at twice the
  // grid, advected by the same velocity (a characteristic map), so letters bend, stretch and sink as the flow says
  // while staying sharp at 4K. The map ages out as diffusion takes over (render.mjs blends map and coarse field).
  carryDetail() {
    const { nx, ny, u, v } = this;
    for (const d of this.details) {
      if (this.time < d.at) continue;
      if (d.mode === 'rigid') {
        // a body: it moves with the mean flow under it and turns with the mean curl
        let su = 0, sv = 0, sc = 0, c = 0;
        for (let j = 0; j < d.gh; j++) for (let i = 0; i < d.gw; i++) { const x = d.ox + d.pose.x + i, y = d.oy + d.pose.y + j; if (x < 1 || y < 1 || x >= nx - 1 || y >= ny - 1) continue; const k = (y | 0) * nx + (x | 0); su += u[k]; sv += v[k]; sc += 0.5 * (v[k + 1] - v[k - 1] - (u[k + nx] - u[k - nx])); c++; }
        if (c) { d.pose.x += su / c; d.pose.y += sv / c; d.pose.a += 0.5 * sc / c; }
        continue;
      }
      const P = d.P, Q = new Float32Array(P.length), W = d.mw, H = d.mh;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const gx = (x + 0.5) / 2 - 0.5, gy = (y + 0.5) / 2 - 0.5, vx = bilerp(u, nx, ny, gx, gy), vy = bilerp(v, nx, ny, gx, gy);
        const bx = clamp((gx - vx + 0.5) * 2 - 0.5, 0, W - 1.001), by = clamp((gy - vy + 0.5) * 2 - 0.5, 0, H - 1.001), i0 = bx | 0, j0 = by | 0, a = bx - i0, b = by - j0, q = 2 * (y * W + x);
        for (let c = 0; c < 2; c++) { const k = 2 * (j0 * W + i0) + c; Q[q + c] = (P[k] * (1 - a) + P[k + 2] * a) * (1 - b) + (P[k + 2 * W] * (1 - a) + P[k + 2 * W + 2] * a) * b; }
      }
      d.P = Q;
    }
  }

  // which process dominates each cell this step: advection, diffusion, buoyancy (set in step), surface, refraction, settling
  lawRead(u0, v0) {
    const { nx, ny } = this, [adv, dif, , sur, ref, set] = this.law;
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i, q = this.pig[0][k] + this.pig[1][k] + this.pig[2][k];
      const gx = (this.pig[0][k + 1] + this.pig[1][k + 1] + this.pig[2][k + 1] - this.pig[0][k - 1] - this.pig[1][k - 1] - this.pig[2][k - 1]) / 2;
      const gy = (this.pig[0][k + nx] + this.pig[1][k + nx] + this.pig[2][k + nx] - this.pig[0][k - nx] - this.pig[1][k - nx] - this.pig[2][k - nx]) / 2;
      adv[k] = Math.abs(u0[k] * gx + v0[k] * gy) * 6 + Math.hypot(u0[k], v0[k]) * 0.6;
      dif[k] = Math.abs(4 * q - (this.pig[0][k + 1] + this.pig[0][k - 1] + this.pig[0][k + nx] + this.pig[0][k - nx]) * 3) * 0.3 + this.nu[k] * 0.05;
      sur[k] = Math.max(0, 3 - Math.abs(j + 0.5 - this.surfaceY(i))) * (0.3 + Math.abs(this.hv[i]) * 4 + 4 * this.film[i]);
      ref[k] = Math.hypot(this.ior[k + 1] - this.ior[k - 1], this.ior[k + nx] - this.ior[k - nx]) * 200;
      set[k] = (this.sed[0][k] + this.sed[1][k] + this.sed[2][k]) * 3;
    }
  }

  // the surface: a damped wave equation driven by wind gusts, sound and what rises into it
  waves(dt) {
    const { nx, h, hv, rng } = this, c2 = 0.18, lap = F32(nx);
    for (let i = 0; i < nx; i++) lap[i] = h[Math.max(0, i - 1)] + h[Math.min(nx - 1, i + 1)] - 2 * h[i];
    for (let i = 0; i < nx; i++) {
      // three travelling components at unrelated wavelengths under a slow envelope, so the swell is irregular (one
      // regular component made a row of identical crests, and the caustic shafts under them read as stage lights)
      const ph = this.wavePh ?? (this.wavePh = [rng() * 6.283, rng() * 6.283, rng() * 6.283, rng() * 6.283]), t = this.time;
      const swell = 0.016 * Math.sin(i * 0.23 + t * 1.7 + ph[0]) + 0.013 * Math.sin(i * 0.41 - t * 2.6 + ph[1]) + 0.011 * Math.sin(i * 0.12 + t * 0.9 + ph[2]);
      const gust = this.wind ? ((rng() - 0.5) * 0.06 + swell * (0.6 + 0.4 * Math.sin(i * 0.05 + t * 0.35 + ph[3]))) * Math.abs(this.wind) : 0, k = Math.floor(this.surfaceY(i)) * nx + i;
      hv[i] += c2 * lap[i] + gust - 0.02 * hv[i] - 0.002 * h[i] - dt * 0.02 * (this.v[clamp(k, 0, this.n - 1)] || 0);
    }
    for (let i = 0; i < nx; i++) h[i] = clamp(h[i] + hv[i], -3.5, 3.5);
    // surface tension smooths the shortest ripples (a little, every step), so crests round instead of saw-toothing
    const h0 = Float32Array.from(h); for (let i = 1; i < nx - 1; i++) h[i] = 0.8 * h0[i] + 0.1 * (h0[i - 1] + h0[i + 1]);
  }

  run(seconds, onStep = null) { const end = this.time + seconds - 1e-9; while (this.time < end) { this.step(); if (onStep) onStep(this); } return this; }
  texts() { return this.log.filter(l => l.text).map(l => l.text); }
}
