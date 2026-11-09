// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// gen.mjs: the common generator interface. Every generator in lib/gen is one defineGen({...}) and exports
//   create(params) -> layer          params carry the weights (law strengths) and an optional timing layer
//   step(layer, dt, context)         advance the layer's ticks; context names other layers it reads (inputs)
//   ticks(layer)                     the state itself: layer.fields (never a copy that could drift)
//   value(layer)                     the cached summary of the ticks (mean, spread, coverage, spectrum)
//   settled(layer)                   true once change per step has stayed under the threshold (BLEED section 11)
//   describe()                       { id, version, law, weights, timing, inputs, mechanism, credits }
//
// The wrapper does the bookkeeping every generator needs and none should re-implement: local time warped by the
// layer's timing layer (timing is its own weighted layer, BLEED section 14), the per-step change and the spatial
// spread of the progress ticks (the section 13 series), and the settle test.
import { summarise } from './layer.mjs';

export const SETTLE = { eps: 2e-4, hold: 12 };

// timing: a timing layer (gen/timing.mjs) lends its rate; with none, time runs at 1
export function rateOf(layer, context) {
  const T = context?.timing ?? layer.timing;
  if (!T || !T.state) return 1;
  return T.state.rate ?? 1;
}

export function defineGen(spec) {
  // kind: is a step conformational (the element's pose changes, its formula stays: motion) or transformational (the
  // weights change the formula: BLEED sections 13 and 19)? Every step a generator takes is tagged with it.
  const { id, version = 1, law, weights = {}, timing = null, inputs = {}, mechanism = '', credits = [], progress = 'amount', kind = 'transformational', metamer = null } = spec;
  if (!/^[a-z0-9]+(\.[a-z0-9-]+)*$/.test(id)) throw new Error(`defineGen: bad id ${id}`);
  const describe = () => ({ id, version, kind, law, weights, timing, inputs, mechanism, credits, progress, metamer });
  const create = (params = {}) => {
    const L = spec.create(params);
    L.gen = id; L.version = version; L.progressField = progress;
    L.prev = Float32Array.from(progressOf(L));
    return L;
  };
  const step = (L, dt, context = {}) => {
    const warped = dt * rateOf(L, context);
    spec.step(L, warped, context, dt);
    L.t += warped; L.steps++; L.stepKind = kind;
    record(L);
    return L;
  };
  return Object.freeze({ id, version, create, step, ticks: L => L.fields, value: L => summarise(L), settled: L => L.settledAt !== null, describe, raw: spec });
}

export function progressOf(L) { return L.fields[L.progressField ?? 'amount'] ?? L.fields.amount; }

// the section 13 numbers for one step: change per step and spatial spread of the progress ticks
export function record(L) {
  const a = progressOf(L), p = L.prev, n = a.length; let d = 0, s = 0, s2 = 0;
  for (let k = 0; k < n; k++) { const v = a[k]; d += Math.abs(v - p[k]); s += v; s2 += v * v; }
  const mean = s / n, change = d / n, spread = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  L.history.change.push(change); L.history.spread.push(spread); L.history.mean.push(mean);
  p.set(a);
  const H = L.history.change, k = SETTLE.hold;
  if (change >= SETTLE.eps * 4) L.moved = true;   // complete means the laws have settled after acting, not that nothing began
  if (L.settledAt === null && L.moved && H.length > k && H.slice(-k).every(c => c < SETTLE.eps)) L.settledAt = L.steps;
  else if (L.settledAt !== null && change >= SETTLE.eps * 4) L.settledAt = null;   // a settled layer that is stirred again is live
  return { change, spread, mean };
}
