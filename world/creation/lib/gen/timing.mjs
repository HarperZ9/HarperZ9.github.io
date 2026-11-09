// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// timing: motion design as its own weighted layer (BLEED section 14). When a change happens is kept apart from what
// changes. A timing layer is a weighted blend of named curves; its state is progress p(t) in 0..1 and a rate,
// p'(t) scaled so that the curve's mean rate over its span is 1. Any generator that takes it as context runs its own
// law on warped time dt * rate, so a hue can come from autumn on the timing of a forge.
//
// The curves are lib/medium/timing.mjs (sqrt_t, exp, logistic, beat, linear), imported, plus four this engine adds:
//   forge      heat-up then Newton cooling: p rises as 1 - exp(-t/up) until `peak`, then falls as exp(-(t-peak)/tau)
//   heartbeat  a lub-dub pulse at bpm: two gaussian beats per period (the second smaller), on a slow drift
//   spring     a critically under-damped spring toward 1 (overshoot ratio set by zeta)
//   walk       progress follows a path layer's travelled fraction (forward motion as the clock)
// Ticks: the layer's amount field is the progress history laid along x (one tick per sampled instant), so a timing
// layer can be drawn, measured and recombined like any other layer.
import { CURVES as MEDIUM_CURVES } from '../../../superframe/lib/medium/timing.mjs';
import * as measured from '../../../techniques/lib/timing.js';
import { defineGen } from '../core/gen.mjs';
import { makeLayer, clamp } from '../core/layer.mjs';

export const CURVES = {
  ...MEDIUM_CURVES,
  forge: (t, { up = 1.2, peak = 3, tau = 2.5 } = {}) => (t < peak ? 1 - Math.exp(-t / up) : (1 - Math.exp(-peak / up)) * Math.exp(-(t - peak) / tau)),
  heartbeat: (t, { bpm = 60 } = {}) => { const ph = (t * bpm / 60) % 1, g = (c, s) => Math.exp(-(((ph - c) / s) ** 2)); return clamp(0.15 + 0.85 * g(0.08, 0.04) + 0.5 * g(0.26, 0.05), 0, 1); },
  spring: (t, { tau = 0.6, zeta = 0.35 } = {}) => { const w = 2 * Math.PI / Math.max(1e-3, tau), wd = w * Math.sqrt(1 - zeta * zeta); return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + zeta / Math.sqrt(1 - zeta * zeta) * Math.sin(wd * t)); },
  walk: (t, { path = null } = {}) => (path ? path.state.travel : 0),
  tide: (t, { period = 9 } = {}) => 0.5 - 0.5 * Math.cos(2 * Math.PI * t / period),   // a tidal swing (semidiurnal shape, compressed)
  // measured curves, imported from techniques/lib/timing.js (fitted to reach times in feed set 20; S05)
  cascade: (t, { scale = 1 } = {}) => Math.min(1.02, measured.cascade(t / scale)),
  revealOut: (t, { scale = 1 } = {}) => measured.revealOut(t / scale),
  // held-frame clocks (cadence.js presets, S05): progress advances only on its own ticks, holding between them
  boil: (t, { rate = 12, span = 4 } = {}) => Math.min(1, measured.boil(t, rate) / (rate * span)),
  recut: (t, { fps = 25, hold = 7, span = 4 } = {}) => Math.min(1, Math.floor(t * fps / hold) * hold / fps / span),
};

export const timing = defineGen({
  id: 'timing',
  kind: 'clock',
  law: { shape: 'clock', params: { combine: 'weighted mean of curves' } },
  weights: { curves: 'array of { curve, weight, params }; weights need not sum to 1' },
  timing: 'is a timing layer',
  mechanism: 'p(t) = sum_i w_i c_i(t) / sum_i w_i; rate = dp/dt normalised to unit mean over [0, span]',
  credits: ['lib/medium/timing.mjs (superframe)', 'reference-library lib/timings.json', 'Newton (cooling law)', 'Fick (sqrt t spread)'],
  create({ curves = [{ curve: 'sqrt_t', weight: 1 }], span = 8, w = 64, h = 1, rateCap = 4 } = {}) {
    for (const c of curves) if (!CURVES[c.curve]) throw new Error(`timing: no curve ${c.curve}`);
    const L = makeLayer('timing', { w, h, law: { shape: 'clock', params: {} }, weights: { curves }, state: { curves, span, rateCap, progress: 0, rate: 1, norm: 1 } });
    L.state.norm = meanRate(L.state);
    return L;
  },
  step(L, dt, ctx, rawDt) {
    const S = L.state, t = L.t + rawDt, p = at(S, t, ctx), p0 = at(S, L.t, ctx);
    S.progress = p; S.rate = clamp(Math.abs(p - p0) / Math.max(1e-6, rawDt) / S.norm, 0, S.rateCap);
    const i = Math.min(L.w - 1, Math.floor(t / S.span * L.w)); if (i >= 0) L.fields.amount[i] = p;
    L.t = t - dt;   // the wrapper adds dt (warped by this layer's own rate of 1): keep raw time
  },
});

function at(S, t, ctx) { let s = 0, w = 0; for (const c of S.curves) { s += c.weight * CURVES[c.curve](t, { ...c.params, path: ctx?.path }); w += c.weight; } return w ? s / w : 0; }
function meanRate(S) { const N = 200; let d = 0; for (let i = 0; i < N; i++) d += Math.abs(at(S, (i + 1) * S.span / N, null) - at(S, i * S.span / N, null)); return Math.max(1e-6, d / S.span); }
