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
// The tick model itself (the field of ticks, the automaton, the weight transfer and the measures) is the creation
// engine's core module, creation/lib/core/ticks.mjs, the one tick model for every caller (switched
// 2026-10-26). What stays here is what only the medium knows: where a tick is placed (an item's shape), how it moves
// (the water's velocity, an item's sink, the surface and the bed), and the medium fields an element's drive reads
// (heat from m.T, contact with the bed, a named tracer), folded into the one drive grid the core samples.
import { bilerp, clamp } from './grid.mjs';
import { progress as timed } from './timing.mjs';
import { rgbToSpectrum, spectrumRGB, toXYZ, toLinearRGB, ks as ksOf, fromKS } from './spectral.mjs';
import { stepTicks, measureTicks } from '../../../creation/lib/core/ticks.mjs';

// The core keeps ticks in typed arrays at cell-centre coordinates (x + 0.5); an item's ticks are views over them,
// so looks, tests and tools still read t.x, t.y, t.h, t.w[e] and t.clock[e], and writes go through to the core.
function tickView(T, i) {
  const E = T.E;
  return { id: i, get x() { return T.x[i] - 0.5; }, set x(v) { T.x[i] = v + 0.5; }, get y() { return T.y[i] - 0.5; }, set y(v) { T.y[i] = v + 0.5; },
    get h() { return T.th[i]; }, get travel() { return T.travel[i]; }, set travel(v) { T.travel[i] = v; }, get speed() { return T.speed[i]; }, set speed(v) { T.speed[i] = v; },
    w: T.W.subarray(i * E, i * E + E), clock: T.clock.subarray(i * E, i * E + E), born: T.born };
}

// sample a shape (inside(x, y) in grid cells -> 0..1 thickness) as ticks on a jittered lattice
export function placeItem(m, { inside, box, spacing = 0.4, elements, start = 0, name = 'item', still = false }) {
  const [x0, y0, x1, y1] = box, xs = [], ys = [], hs = [];
  for (let y = y0; y < y1; y += spacing) for (let x = x0; x < x1; x += spacing) {
    const jx = x + (m.rng() - 0.5) * spacing * 0.8, jy = y + (m.rng() - 0.5) * spacing * 0.8, h = inside(jx, jy);
    if (h > 0.02) { xs.push(jx + 0.5); ys.push(jy + 0.5); hs.push(h); }
  }
  const n = xs.length, E = elements.length, W = new Float32Array(n * E);
  for (let i = 0; i < n; i++) W[i * E + start] = 1;
  const T = { w: m.nx, h: m.ny, n, E, elements, x: Float32Array.from(xs), y: Float32Array.from(ys), th: Float32Array.from(hs), W, travel: new Float32Array(n), speed: new Float32Array(n), born: m.time, time: 0, clock: new Float32Array(n * E), spacing };
  const item = { name, T, ticks: Array.from({ length: n }, (_, i) => tickView(T, i)), elements, spacing, still, history: [] };
  (m.items ??= []).push(item);
  return item;
}

// the medium's fields an element's drive reads, as one grid in 0..1 for the core's drive slot: heat (m.T), contact
// with the bed (within 1.5 cells of the floor under the column) and a named tracer, each by its coefficient; the
// core multiplies the grid by the coefficients' sum, so the sum it adds equals the medium's own
function driveGrid(m, D) {
  const cH = D.heat ?? 0, cC = D.contact ?? 0, tr = D.tracer && m.tracers?.[D.tracer.name] ? D.tracer : null, cT = tr ? tr.gain : 0, S = cH + cC + cT;
  if (S <= 0) return { S: 0, g: null };
  const { nx, ny } = m, g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, floor = ny - m.bed[i] - 0.5;
    g[k] = (cH * clamp(m.T[k], 0, 1) + cC * (floor - j < 1.5 ? 1 : 0) + (tr ? cT * Math.min(1, m.tracers[tr.name].f[k] / (tr.scale ?? 1)) : 0)) / S;
  }
  return { S, g };
}

// one step for every item: move in the medium, then let the core grow each element's weight by its law
export function stepItems(m, dt) {
  for (const it of m.items ?? []) {
    const T = it.T, s = dt * 30, sink = it.sink ?? 0;
    if (!it.still) for (let i = 0; i < T.n; i++) {
      const x = T.x[i] - 0.5, y = T.y[i] - 0.5;
      const u1 = bilerp(m.u, m.nx, m.ny, x, y), v1 = bilerp(m.v, m.nx, m.ny, x, y), mx = x + 0.5 * s * u1, my = y + 0.5 * s * v1;
      const ux = bilerp(m.u, m.nx, m.ny, mx, my), vy = bilerp(m.v, m.nx, m.ny, mx, my);
      const nxp = clamp(x + s * ux, 0, m.nx - 1);
      T.x[i] = nxp + 0.5; T.y[i] = clamp(y + s * vy + sink * dt, m.surfaceY(clamp(Math.round(nxp), 0, m.nx - 1)) + 0.3, m.ny - 1) + 0.5;
      T.speed[i] = Math.hypot(ux, vy); T.travel[i] += T.speed[i] * s;
    }
    // each lawful element is grown by the core with its own drive grid; the clocks and the item's time advance once
    const scratch = new Float32Array(T.n * T.E);
    for (let e = 1; e < T.E; e++) {
      const L = it.elements[e].law; if (!L) continue;
      const D = L.drive ?? {}, { S, g } = driveGrid(m, D);
      const law = { ...L, drive: { ...D, contact: 0, tracer: undefined, heat: S } };
      const Te = Object.create(T); Te.elements = it.elements.map((E0, q) => (q === e ? { ...E0, law } : { name: E0.name })); Te.clock = scratch; Te.time = T.time;
      stepTicks(Te, dt, { still: true, drive: g });
    }
    for (let i = 0; i < T.n * T.E; i++) if (T.W[i] > 0.01) T.clock[i] += dt;
    T.time += dt;
  }
}

// the item's state as numbers (BLEED section 13's check), from the core: per element, the mean weight, the spread of
// weights across the ticks (a crossfade has none), the share mid-change (the front), its centroid, and the change
export function measure(it, e = 1, prev = null) {
  const r = measureTicks(it.T, e, prev);
  if (r.frontAt) r.frontAt = [r.frontAt[0] - 0.5, r.frontAt[1] - 0.5];
  return r;
}

// draw every item: each tick lays every element's look, scaled by its weight in that element, as a soft splat
export function drawItems(m, R, vp, illuminant = 'D65') {
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
          if (m.pigS) continue;                                                      // a spectral tank paints and glows below
          if (L.paint) { const a = L.paint[3] * w * k; for (let c = 0; c < 3; c++) P[4 * i + c] += L.paint[c] * a; P[4 * i + 3] += a; }
          if (L.emit) for (let c = 0; c < 3; c++) E[3 * i + c] += L.emit[c] * w * k;
        }
      }
    }
  }
  if (!any) return;
  if (m.pigS) drawItemsSpectral(m, R, vp, illuminant);
  if (m.pigS) return;
  for (let i = 0; i < W * H; i++) {
    const a = 1 - Math.exp(-4 * P[4 * i + 3]), pa = P[4 * i + 3] > 1e-6 ? a / P[4 * i + 3] : 0;    // paint covers like a layer of pigment: dense where ticks overlap
    for (let c = 0; c < 3; c++) { let v = d[4 * i + c] * Math.exp(-3 * A[3 * i + c]); v = v * (1 - a) + P[4 * i + c] * pa; d[4 * i + c] = v + E[3 * i + c]; }
  }
}

// A spectral tank's opaque paint and glow on ticks. Paint mixes as pigment: each tick adds its reflectance's
// Kubelka-Munk K/S, weighted by its coverage, and the pixel shows the mixture's reflectance under the light; glow adds
// an emission spectrum (a forge's blackbody). Done in stripes of rows to keep the 16-band buffers small at 4K.
function drawItemsSpectral(m, R, vp, illuminant) {
  const { w: W, h: H } = R, d = R.data, SH = 64, spec = new Map(), specOf = (key, rgb) => spec.get(key) ?? spec.set(key, rgbToSpectrum(rgb).map(v => Math.min(0.999, Math.max(0.001, v)))).get(key);
  const flat = new Array(16).fill(1), splats = [];
  for (const it of m.items) {
    const r = it.spacing * 1.7 * vp.cx, norm = (it.spacing * vp.cx) ** 2 / (Math.PI * r * r);
    for (const t of it.ticks) it.elements.forEach((E0, e) => {
      if (t.w[e] <= 0.002) return;
      const L = E0.look(t, E0.timing ? timed(E0.timing, t.clock[e]) : 1, m); if (!L.paint && !L.emit && !L.emitS && !L.paintS) return;
      const [cx, cy] = vp.p(t.x, t.y), w = t.w[e] * t.h * norm;
      const ks = L.paintS || L.paint ? ksOf(L.paintS ?? specOf(L.paint.slice(0, 3).map(v => v.toFixed(3)).join(), L.paint)) : null;
      const em = L.emitS ?? (L.emit ? rgbToSpectrum(L.emit) : null);
      splats.push({ cx, cy, r, w, a: (L.paint?.[3] ?? 1), ks, em });
    });
  }
  for (let y0 = 0; y0 < H; y0 += SH) {
    const rows = Math.min(SH, H - y0), KS = new Float32Array(16 * W * rows), CV = new Float32Array(W * rows), EM = new Float32Array(16 * W * rows); let any = false;
    for (const s of splats) {
      const E = s.r * 2.1; if (s.cy + E < y0 || s.cy - E > y0 + rows) continue;
      for (let y = Math.max(y0, Math.floor(s.cy - E)); y <= Math.min(y0 + rows - 1, Math.ceil(s.cy + E)); y++) for (let x = Math.max(0, Math.floor(s.cx - E)); x <= Math.min(W - 1, Math.ceil(s.cx + E)); x++) {
        const q = ((x + 0.5 - s.cx) ** 2 + (y + 0.5 - s.cy) ** 2) / (s.r * s.r); if (q > 4.4) continue;
        const k = s.w * Math.exp(-q), i = (y - y0) * W + x; any = true;
        if (s.ks) { const c = k * s.a; CV[i] += c; for (let b = 0; b < 16; b++) KS[b * W * rows + i] += s.ks[b] * c; }
        if (s.em) for (let b = 0; b < 16; b++) EM[b * W * rows + i] += s.em[b] * k;
      }
    }
    if (!any) continue;
    const Rb = new Array(16), Eb = new Array(16);
    for (let i = 0; i < W * rows; i++) {
      const o = 4 * ((y0 * W) + i);
      if (CV[i] > 1e-5) {
        for (let b = 0; b < 16; b++) Rb[b] = KS[b * W * rows + i] / CV[i];
        const c = spectrumRGB(fromKS(Rb), illuminant), a = 1 - Math.exp(-4 * CV[i]);
        for (let k = 0; k < 3; k++) d[o + k] = d[o + k] * (1 - a) + c[k] * a;
      }
      let e = 0; for (let b = 0; b < 16; b++) { Eb[b] = EM[b * W * rows + i]; e += Eb[b]; }
      if (e > 1e-6) { const c = toLinearRGB(toXYZ(Eb, flat), illuminant); for (let k = 0; k < 3; k++) d[o + k] += Math.max(0, c[k]); }
    }
  }
}
