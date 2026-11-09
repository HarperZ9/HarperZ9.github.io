// lib/medium/additives.mjs: everything that can be added to the medium, and what it changes. An additive changes
// properties locally; the flow does the rest. Each kind has apply(medium, emitter, progress 0..1, dt), called every
// step while it pours (props.at to props.at + props.for), and some carry a process the medium runs every step
// (settling, the oil film, bubbles, sound, evaporation).
//   ink      colour, opacity and density: pigment that blooms and sinks
//   text     ink in the shape of words; the words are kept as the real text of the piece
//   tiles    particulate pigment: sediment that settles where the flow slows and builds the bed as mosaic
//   salt     density (layering, stratification), refractive index up
//   sugar    density and viscosity
//   oil      lighter than water, gathers as a surface film, spreads (surface tension) and marbles what it meets
//   heat     buoyancy (rising plumes), evaporation into mist; cold does the opposite
//   wind     momentum into the air and shear on the surface (waves, ripples, drift)
//   glass    a lens resting in the water: solid to the flow, refractive index 1.5 to the light
//   sound    a standing vibration in water and surface (Chladni-like nodes)
//   bubbles  air carried up from below, lifting pigment, popping into foam
//   smoke    soot and heat in the air (the fire-and-smoke works of the reference set)
//   mist     water held in the air
//   turbulence  vorticity: puts curls into the flow
//   data     a series that drives another additive's amount over its pour
import { setText } from '../../adapters/type.mjs';
import { fillNonzero } from '../fill.mjs';
import { clamp, KAPPA } from './grid.mjs';
import { tesserae } from './tesserae.mjs';
import { releaseWisps } from './wisps.mjs';
import { prepareBloom } from './inkbloom.mjs';
import { seedReaction } from './reaction.mjs';
import { absorbanceOf, absorbance } from './spectral.mjs';
// a pour's spectral absorbance: props.spectrum (a 16-band reflectance) or its colour's smooth spectrum; cached per pour
const specOf = (e, key = 'color', fallback = '#1d2a3a') => (e.specCache ??= {})[key] ??= (key === 'color' && e.props.spectrum ? absorbance(e.props.spectrum) : absorbanceOf(e.props[key] ?? fallback));

const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const absorb = hex => { const n = parseInt(hex.slice(1), 16); return [16, 8, 0].map(s => -Math.log(Math.max(0.02, lin(((n >> s) & 255) / 255))) / 3.9); };
const cells = (m, w) => {
  const out = [], { nx, ny } = m, x0 = (w.x ?? 0.5) - (w.w ?? (w.r ?? 0.05)), x1 = (w.x ?? 0.5) + (w.w ?? (w.r ?? 0.05)), y0 = (w.y ?? 0.5) - (w.h ?? (w.r ?? 0.05)), y1 = (w.y ?? 0.5) + (w.h ?? (w.r ?? 0.05));
  const round = !w.w && !w.h;
  for (let j = Math.max(0, Math.floor(y0 * ny)); j <= Math.min(ny - 1, Math.ceil(y1 * ny)); j++) for (let i = Math.max(0, Math.floor(x0 * nx)); i <= Math.min(nx - 1, Math.ceil(x1 * nx)); i++) {
    const dx = (i + 0.5) / nx - (w.x ?? 0.5), dy = (j + 0.5) / ny - (w.y ?? 0.5), r = w.r ?? 0.05, fall = round ? clamp(1 - Math.hypot(dx * nx / ny, dy) / r, 0, 1) : 1;
    if (fall > 0) out.push([j * nx + i, fall]);
  }
  return out;
};
const region = (w, m) => (typeof w === 'string' ? ({ surface: { x: 0.5, y: m.waterLevel + 0.03, w: 0.5, h: 0.03 }, bottom: { x: 0.5, y: 0.9, w: 0.5, h: 0.04 }, air: { x: 0.5, y: m.waterLevel / 2, w: 0.5, h: m.waterLevel / 2 } }[w] ?? { x: 0.5, y: 0.5, r: 0.1 }) : w);
const pour = (field, list, v) => { for (const [k, f] of list) field[k] += v * f; };
// props.spread sets how fast this pour's pigment diffuses (0 holds a hard edge, 1 is the water's own rate, 4 blooms);
// the cells it touches move toward that rate in step with how much is poured there
const setSpread = (m, e, list, r) => { if (e.props.spread == null) return; const target = KAPPA * e.props.spread; for (const [k, f] of list) { const w = Math.min(1, r * f * 4); m.kap[k] += (target - m.kap[k]) * w; } };
const rate = (e, dt) => e.amount * (e.props.for > 0 ? dt / e.props.for : 1) * (e.mod ?? 1);

export const KINDS = {
  tesserae,
  ink: {
    where: region,
    // props.fine: the drop also gets a fine detail map, like words (an irregular disc at ten times the grid with its
    // bloom), so a drop keeps a dense core and fibrous edges while the flow pulls it into tendrils
    init(m, e) {
      if (!e.props.fine) return;
      const r = (e.where.r ?? 0.05) * m.ny, g = Math.max(4, Math.ceil(2 * r) + 4), S = 10, cx = g * S / 2, cy = g * S / 2, ph = [m.rng() * 6.28, m.rng() * 6.28];
      const poly = Array.from({ length: 96 }, (_, i) => { const a = i / 96 * 6.283, rr = r * S * (1 + 0.08 * Math.sin(3 * a + ph[0]) + 0.05 * Math.sin(7 * a + ph[1])); return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; });
      const mw = m.nx * 2, mh = m.ny * 2, P = new Float32Array(mw * mh * 2);
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { P[2 * (y * mw + x)] = (x + 0.5) / 2 - 0.5; P[2 * (y * mw + x) + 1] = (y + 0.5) / 2 - 0.5; }
      const ox = Math.round((e.where.x ?? 0.5) * m.nx - g / 2), oy = Math.round((e.where.y ?? 0.5) * m.ny - g / 2);
      const det = { at: e.props.at, mode: 'dissolve', hold: e.props.hold ?? 6, mask: fillNonzero([poly], g * S, g * S), S, ox, oy, gw: g, gh: g, P, mw, mh, a: absorb(e.props.color ?? '#1d2a3a'), aS: m.pigS ? specOf(e) : null, haloS: m.pigS ? specOf(e, e.props.halo ? 'halo' : 'color') : null, amount: e.props.fine };
      prepareBloom(det, absorb(e.props.halo ?? e.props.color ?? '#5d7fb8'), m.details.length + 7);
      m.details.push(det);
    },
    apply(m, e, _, dt) { const a = absorb(e.props.color ?? '#1d2a3a'), L = cells(m, e.where), r = rate(e, dt); for (let c = 0; c < 3; c++) pour(m.pig[c], L, a[c] * r); if (m.pigS) { const A = specOf(e); for (let b = 0; b < 16; b++) pour(m.pigS[b], L, A[b] * r); }
      // props.grain: part of the ink is particulate and settles, so the bed takes the ink's colour in strata
      if (e.props.grain) { for (let c = 0; c < 3; c++) pour(m.sed[c], L, a[c] * r * e.props.grain); if (m.sedS) { const A = specOf(e); for (let b = 0; b < 16; b++) pour(m.sedS[b], L, A[b] * r * e.props.grain); } }
      setSpread(m, e, L, r); },
  },
  text: {
    where: region,
    init(m, e) {
      // set the words in the house face at grid resolution, centred on where, as tall as where.h (or 0.12 of the tank)
      const gw = Math.max(8, Math.round((e.where.w ?? 0.36) * 2 * m.nx)), gh = Math.max(4, Math.round((e.where.h ?? 0.08) * 2 * m.ny));
      const { polys } = setText(e.props.text ?? '', gw, gh, { fill: 0.92 }), mask = fillNonzero(polys, gw, gh), list = [];
      const ox = Math.round((e.where.x ?? 0.5) * m.nx - gw / 2), oy = Math.round((e.where.y ?? 0.5) * m.ny - gh / 2);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const v = mask[y * gw + x], X = ox + x, Y = oy + y; if (v > 0.05 && X >= 0 && Y >= 0 && X < m.nx && Y < m.ny) list.push([Y * m.nx + X, v]); }
      e.cells = list;
      // the same words at ten times the grid, for the fine detail map; the map starts as the identity
      const S = 10, hi = setText(e.props.text ?? '', gw * S, gh * S, { fill: 0.92 }), mw = m.nx * 2, mh = m.ny * 2, P = new Float32Array(mw * mh * 2);
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { P[2 * (y * mw + x)] = (x + 0.5) / 2 - 0.5; P[2 * (y * mw + x) + 1] = (y + 0.5) / 2 - 0.5; }
      const det = { at: e.props.at, mode: 'dissolve', hold: e.props.hold ?? 7, mask: fillNonzero(hi.polys, gw * S, gh * S), S, ox, oy, gw, gh, P, mw, mh, a: absorb(e.props.color ?? '#1d2a3a'), aS: m.pigS ? specOf(e) : null, haloS: m.pigS ? specOf(e, 'halo', '#5d7fb8') : null, amount: e.amount * 0.8 };
      // the bloom: a feathered fibrous edge and a paler halo that separates from the ink as it spreads
      if (e.props.bloom !== false) prepareBloom(det, absorb(e.props.halo ?? '#5d7fb8'), m.details.length + 1);
      m.details.push(det);
    },
    apply(m, e, _, dt) { const a = absorb(e.props.color ?? '#1d2a3a'), r = rate(e, dt); for (let c = 0; c < 3; c++) { pour(m.pigT[c], e.cells, a[c] * r * 0.8); pour(m.sed[c], e.cells, a[c] * r * (e.props.grain ?? 0.25)); } if (m.pigTS) { const A = specOf(e); for (let b = 0; b < 16; b++) { pour(m.pigTS[b], e.cells, A[b] * r * 0.8); pour(m.sedS[b], e.cells, A[b] * r * (e.props.grain ?? 0.25)); } } setSpread(m, e, e.cells, r); },
  },
  // a form with a shape of its own (an image, a picture made by any node, or words) carried by the flow, after Piers
  // Cowburn's cityscapes bent along a flow field. mode: 'rigid' (it drifts and turns as a body), 'stretch' (it is
  // carried and deformed, keeping its texture), 'dissolve' (carried, then handed to the pigment field as it ages).
  form: {
    where: region,
    init(m, e) {
      const R = e.props.raster; if (!R) throw new Error('medium: a form needs props.raster (a superframe raster)');
      const gw = Math.max(4, Math.round((e.where.w ?? 0.2) * 2 * m.nx)), gh = Math.max(4, Math.round((e.where.h ?? 0.2) * 2 * m.ny));
      const ox = Math.round((e.where.x ?? 0.5) * m.nx - gw / 2), oy = Math.round((e.where.y ?? 0.5) * m.ny - gh / 2), img = new Float32Array(R.w * R.h * 3);
      for (let i = 0; i < R.w * R.h; i++) for (let c = 0; c < 3; c++) img[3 * i + c] = -Math.log(Math.max(0.02, R.data[4 * i + c] * R.data[4 * i + 3] + (1 - R.data[4 * i + 3]))) / 3.9;
      const mw = m.nx * 2, mh = m.ny * 2, P = new Float32Array(mw * mh * 2);
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { P[2 * (y * mw + x)] = (x + 0.5) / 2 - 0.5; P[2 * (y * mw + x) + 1] = (y + 0.5) / 2 - 0.5; }
      m.details.push({ at: e.props.at, mode: e.props.mode ?? 'stretch', hold: e.props.hold ?? 8, img, iw: R.w, ih: R.h, ox, oy, gw, gh, P, mw, mh, amount: e.amount, pose: { x: 0, y: 0, a: 0 } });
      e.cells = [];
    },
    apply() {},
  },
  tiles: { where: region, apply(m, e, _, dt) { const a = absorb(e.props.color ?? '#b0603a'), L = cells(m, e.where), r = rate(e, dt); for (let c = 0; c < 3; c++) pour(m.sed[c], L, a[c] * r); if (m.sedS) { const A = specOf(e, 'color', '#b0603a'); for (let b = 0; b < 16; b++) pour(m.sedS[b], L, A[b] * r); } } },
  salt: { where: region, apply(m, e, _, dt) { pour(m.S, cells(m, e.where), rate(e, dt)); } },
  // a stratified band set at once: salt, sugar or heat brought to a level across a band (a halocline, a syrup floor,
  // a warm cap), so the water starts layered and what falls in stops where its density matches. amount scales all.
  layer: { where: region, apply(m, e) { const L = cells(m, e.where), p = e.props; for (const [k, f] of L) { if (!m.phase[k] || m.solid[k]) continue; if (p.salt) m.S[k] = Math.max(m.S[k], p.salt * e.amount * f); if (p.sugar) m.sugar[k] = Math.max(m.sugar[k], p.sugar * e.amount * f); if (p.heat) m.T[k] = Math.max(m.T[k], p.heat * e.amount * f); } } },
  sugar: { where: region, apply(m, e, _, dt) { pour(m.sugar, cells(m, e.where), rate(e, dt)); } },
  oil: {
    where: region, apply(m, e, _, dt) { pour(m.oil, cells(m, e.where), rate(e, dt)); },
    // oil rises, gathers as a film, spreads and pushes the surface water outward (Marangoni), marbling the pigment
    surface(m) {
      const { nx, ny } = m;
      for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!m.oil[k]) continue; const up = k - nx; if (m.phase[up] && !m.solid[up]) { const d = m.oil[k] * 0.3; m.oil[k] -= d; m.oil[up] += d; } else { m.film[i] += m.oil[k]; m.oil[k] = 0; } }
      const f0 = Float32Array.from(m.film);
      for (let i = 0; i < nx; i++) {
        const js = clamp(Math.ceil(m.surfaceY(i)), 0, ny - 1), us = m.u[js * nx + i], src = clamp(i - us, 0, nx - 1.001), a = src | 0, t = src - a;
        m.film[i] = f0[a] * (1 - t) + f0[a + 1] * t;
        const grad = (f0[Math.min(nx - 1, i + 1)] - f0[Math.max(0, i - 1)]) / 2;
        for (let j = js; j < Math.min(ny, js + 3); j++) m.u[j * nx + i] -= 0.6 * grad;
      }
      const f1 = Float32Array.from(m.film); for (let i = 1; i < nx - 1; i++) m.film[i] = f1[i] + 0.15 * (f1[i - 1] + f1[i + 1] - 2 * f1[i]);
    },
  },
  // a real burner is uneven: hot spots across its width, fixed per pour from the medium's seed. With the hydrostatic
  // part of buoyancy removed, a perfectly even band would rest in a deterministic solver; the unevenness seeds the
  // convection a heated floor shows
  heat: {
    where: region,
    init(m, e) { const ph = [m.rng() * 6.283, m.rng() * 6.283]; e.spots = i => 1 + 0.35 * Math.sin(i * 0.37 + ph[0]) * Math.sin(i * 0.11 + ph[1]); },
    apply(m, e, _, dt) { const r = rate(e, dt) * (e.props.cold ? -1 : 1); for (const [k, f] of cells(m, e.where)) m.T[k] += r * f * e.spots(k % m.nx); },
    // warm surface water lends water to the air as mist
    evaporate(m, dt) { const { nx } = m; for (let i = 0; i < nx; i++) { const js = Math.ceil(m.surfaceY(i)); if (js < 1 || js >= m.ny) continue; const T = m.T[js * nx + i]; if (T > 0.05) { m.mist[(js - 1) * nx + i] += dt * 2.5 * T; m.T[js * nx + i] -= dt * 0.2 * T; } } },
  },
  cold: { where: region, init(m, e) { KINDS.heat.init(m, e); }, apply(m, e, _, dt) { const r = -rate(e, dt); for (const [k, f] of cells(m, e.where)) m.T[k] += r * f * e.spots(k % m.nx); } },
  // a reaction-diffusion pair (reaction.mjs): seeds V where poured, once
  reaction: { where: region, apply(m, e) { seedReaction(m, cells(m, e.where), e.props); } },
  // a tracer: a named dissolved substance poured in (props.name, props.kappa its diffusion), carried and conserved like
  // salt; it has no colour of its own (props.color also pours that much visible pigment), and an element's law can
  // read it (ticks.mjs drive: { tracer: { name, gain, scale } })
  tracer: { where: region, apply(m, e, _, dt) { const T = (m.tracers[e.props.name] ??= { f: new Float32Array(m.n), kappa: e.props.kappa ?? 0.12 }), L = cells(m, e.where), r = rate(e, dt); pour(T.f, L, r); if (e.props.color) { const a = absorb(e.props.color); for (let c = 0; c < 3; c++) pour(m.pig[c], L, a[c] * r * (e.props.visible ?? 1)); } } },
  // a ripple: an impulse on the surface (amount = height in cells, props.r = width as a fraction of the tank), shared
  // with the UI's top-down view so both views know the kind
  ripple: { where: region, apply(m, e) { const cx = (e.where.x ?? 0.5) * m.nx, r = Math.max(1, (e.props.r ?? e.where.r ?? 0.03) * m.nx); for (let i = 0; i < m.nx; i++) { const d = (i - cx) / r; m.hv[i] -= e.amount * Math.exp(-d * d); } } },
  // strata: a bed already laid by earlier settling, set once: props.layers = [{ color, t (cells), wave }], bottom up;
  // each stratum's thickness swells along the floor (a seeded wave), and its colour is kept as RGB and as a spectrum
  strata: { apply(m, e) { const ph = m.rng() * 6.283; for (const [n, S] of (e.props.layers ?? []).entries()) { const a = absorb(S.color), A = m.pigS ? absorbanceOf(S.color) : null; for (let i = 0; i < m.nx; i++) { const t = S.t * (1 + (S.wave ?? 0.35) * Math.sin(i / m.nx * 6.283 * (1.2 + n * 0.37) + ph + n)), k = t / 6 / (a[0] + a[1] + a[2]); m.layers[i].push({ t, rgb: a.map(v => (3 * v) / (a[0] + a[1] + a[2])), spec: A ? (() => { const s3 = A.reduce((x, v) => x + v, 0) / 16; return A.map(v => v / s3); })() : null }); m.bed[i] += t; void k; } } } },
  // a current: water in the region is drawn toward a speed and heading (props.angle, radians, 0 = rightward),
  // as a channel, a jet or a platform's push would draw it; amount is the speed in cells per frame
  current: { where: region, apply(m, e, _, dt) { const a = e.props.angle ?? 0, tu = e.amount * Math.cos(a), tv = e.amount * Math.sin(a), k = Math.min(1, dt * (e.props.grip ?? 3)); for (const [c, f] of cells(m, e.where)) { if (!m.phase[c] || m.solid[c]) continue; m.u[c] += (tu - m.u[c]) * k * f; m.v[c] += (tv - m.v[c]) * k * f; } } },
  wind: { apply(m, e, progress) { m.wind = e.amount * (e.props.gust ? 0.7 + 0.3 * Math.sin(progress * 37) : 1); if (progress > 0.98) m.wind *= 0.5; } },
  glass: { where: region, init(m, e) { m.glass.push({ x: e.where.x ?? 0.5, y: e.where.y ?? 0.8, rx: e.where.w ?? 0.18, ry: e.where.h ?? 0.05 }); m.refresh(); }, apply() {} },
  sound: {
    apply(m, e) { m.sound = { hz: e.props.hz ?? 3, modes: e.props.modes ?? 6, amp: e.amount }; },
    force(m, s, dt) { const { nx, ny } = m, w = Math.sin(2 * Math.PI * s.hz * m.time); for (let i = 0; i < nx; i++) { const f = Math.cos((Math.PI * s.modes * i) / nx) * w * s.amp; m.hv[i] += dt * 0.6 * f; for (let j = 0; j < ny; j++) { const k = j * nx + i; if (m.phase[k] && !m.solid[k]) m.v[k] += dt * 0.3 * f * Math.cos((Math.PI * 2 * j) / ny); } } },
  },
  bubbles: {
    where: region,
    apply(m, e, _, dt) { const n = Math.floor(e.amount * 30 * dt + m.rng()); for (let b = 0; b < n; b++) m.bubbles.push({ x: (e.where.x ?? 0.5) * m.nx + (m.rng() - 0.5) * (e.where.r ?? 0.03) * 2 * m.nx, y: (e.where.y ?? 0.92) * m.ny, r: 0.2 + 0.5 * m.rng(), carry: [0, 0, 0] }); },
    // bubbles rise with the flow, lift a little pigment, pop at the surface into foam
    move(m) {
      const { nx } = m, keep = [];
      for (const b of m.bubbles) {
        const k = clamp(Math.floor(b.y), 0, m.ny - 1) * nx + clamp(Math.floor(b.x), 0, nx - 1);
        b.x += m.u[k] + Math.sin(b.y * 0.7 + b.r * 9) * 0.15; b.y += m.v[k] - (0.5 + b.r);
        for (let c = 0; c < 3; c++) { const g = m.pig[c][k] * 0.04; m.pig[c][k] -= g; b.carry[c] += g; }
        if (b.y <= m.surfaceY(clamp(Math.floor(b.x), 0, nx - 1))) { m.foam.push({ x: b.x, life: 1, r: b.r }); const kk = clamp(Math.ceil(b.y), 0, m.ny - 1) * nx + clamp(Math.floor(b.x), 0, nx - 1); for (let c = 0; c < 3; c++) m.pig[c][kk] += b.carry[c]; m.mist[Math.max(0, kk - nx)] += 0.05; }
        else keep.push(b);
      }
      m.bubbles = keep;
      m.foam = m.foam.filter(f => (f.life -= 0.01) > 0).map(f => ({ ...f, x: f.x + m.wind * 0.05 + m.u[clamp(Math.ceil(m.surfaceY(clamp(Math.floor(f.x), 0, nx - 1))), 0, m.ny - 1) * nx + clamp(Math.floor(f.x), 0, nx - 1)] }));
    },
  },
  smoke: { where: region, apply(m, e, _, dt) { const L = cells(m, e.where), r = rate(e, dt); pour(m.smoke, L, r); pour(m.T, L, r * 0.6); if (e.props.threads !== 0) releaseWisps(m, e, dt); } },
  mist: { where: region, apply(m, e, _, dt) { pour(m.mist, cells(m, e.where), rate(e, dt)); } },
  turbulence: { where: region, apply(m, e) { for (const [k, f] of cells(m, e.where)) m.turb[k] = Math.max(m.turb[k], e.amount * f); } },
  // progress is slightly negative on the step that starts a pour (t + dt > at): the index is clamped at 0, since y[-1]
  // was undefined and made the target's rate NaN (found 2026-10-26 by the visualizer's data tank)
  data: { apply(m, e, progress) { const y = e.props.series ?? [1], lo = Math.min(...y), hi = Math.max(...y), v = y[Math.max(0, Math.min(y.length - 1, Math.floor(progress * y.length)))]; const t = m.emitters[e.props.target]; if (t) t.mod = hi > lo ? 0.2 + 1.8 * (v - lo) / (hi - lo) : 1; } },
  // particulate pigment falls and lays itself down where the water is slow, layer on layer: the bed becomes mosaic
  sediment: {
    apply() {},
    settle(m) {
      const { nx, ny } = m;
      for (let j = ny - 2; j >= 0; j--) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, q = m.sed[0][k] + m.sed[1][k] + m.sed[2][k]; if (q < 1e-5 || !m.phase[k]) continue;
        const below = k + nx, speed = Math.hypot(m.u[k], m.v[k]);
        if (m.solid[below] === 1) {
          if (speed < 0.35) { const d = 0.08 * (1 - speed / 0.35), rgb = [0, 1, 2].map(c => m.sed[c][k] * d); for (let c = 0; c < 3; c++) m.sed[c][k] -= rgb[c]; let spec = null; if (m.sedS) { spec = new Array(16); for (let b = 0; b < 16; b++) { spec[b] = m.sedS[b][k] * d; m.sedS[b][k] -= spec[b]; } } layer(m, i, rgb, spec); }
        } else if (m.solid[below] === 2) {
          // grains on the lens slide off its curved top toward the nearer rim, so they reach the bed instead of
          // resting on a lens-shaped shelf of grid cells (found at 200%: a blurred bar above the lens)
          const g = m.glass[0], side = g && i + 0.5 < g.x * nx ? -1 : 1, to = clamp(i + side, 0, nx - 1) + j * nx;
          for (let c = 0; c < 3; c++) { const f = m.sed[c][k] * 0.2; m.sed[c][k] -= f; m.sed[c][to] += f; } if (m.sedS) for (let b = 0; b < 16; b++) { const f = m.sedS[b][k] * 0.2; m.sedS[b][k] -= f; m.sedS[b][to] += f; }
        } else if (!m.solid[below] && m.phase[below]) { for (let c = 0; c < 3; c++) { const f = m.sed[c][k] * 0.12; m.sed[c][k] -= f; m.sed[c][below] += f; } if (m.sedS) for (let b = 0; b < 16; b++) { const f = m.sedS[b][k] * 0.12; m.sedS[b][k] -= f; m.sedS[b][below] += f; } }
      }
    },
  },
};
KINDS.tiles.settle = KINDS.sediment.settle;

// a deposit joins the top layer of its column while that layer is thin, or starts a new one; a layer's pigment is a
// normalised absorption profile (mean 1), so colour comes from what settled, not from how much
export function layer(m, i, rgb, spec = null) {
  const sum = rgb[0] + rgb[1] + rgb[2]; if (sum <= 0) return;
  const t = sum * 6, prof = rgb.map(v => (3 * v) / sum), L = m.layers[i], top = L.at(-1);
  // in a spectral tank a layer also keeps its deposits' absorbance spectrum, normalised the same way (mean 1 over the
  // RGB profile's scale), so the bed's colour mixes as spectra
  const sp = spec ? (() => { const s3 = spec.reduce((a, v) => a + v, 0) / 16; return s3 > 0 ? spec.map(v => v / s3) : null; })() : null;
  if (top && top.t < 0.6) { const w = top.t / (top.t + t); top.rgb = top.rgb.map((v, c) => v * w + prof[c] * (1 - w)); if (sp) top.spec = top.spec ? top.spec.map((v, b) => v * w + sp[b] * (1 - w)) : sp; top.t += t; }
  else L.push({ t, rgb: prof, spec: sp });
  m.bed[i] += t;
}
