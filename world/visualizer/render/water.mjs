// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// water.mjs: the sounding water. The glass module's wave-equation surface (glass/liquid.js), with a
// drop for every event: each onset falls at a point on the meter figure (the vertex of the beat it lands in), its
// depth set by the event's strength. The surface state at time t is a pure function of (events, params, t): the
// simulation steps forward from the last state it reached and restarts from zero when asked for an earlier time,
// so a sequential render and a seek give the same field.
//
//   surfaceAt(events, t, P) -> { nx, ny, u: Float32Array }   P: { nx, ny, stepsPerSecond, damping, stiffness,
//                                                            wind, drop: { r, gain }, seed, place(e) -> [x, y] }
//   SPEC: grid 192 x 108 by default (one cell is 10 px at 1920 x 1080); 96 steps per second at Courant 0.5, so a
//   ring front moves 48 cells (a quarter of the width) per second; cost about 0.3 ms per step on one core.
import { Water } from '../../glass/liquid.js';

export const WATER = Object.freeze({ nx: 192, ny: 108, stepsPerSecond: 96, damping: 0.012, stiffness: 0.002, wind: 0.0016, windEvery: 8, drop: { r: 2.6, gain: 1.1 }, seed: 31 });

const cache = new Map();   // key -> { water, t, k }

export function surfaceAt(events, t, P = WATER) {
  const p = { ...WATER, ...P, drop: { ...WATER.drop, ...(P.drop ?? {}) } };
  const key = `${p.nx}x${p.ny}/${p.stepsPerSecond}/${p.damping}/${p.stiffness}/${p.wind}/${p.seed}/${p.drop.r}/${p.drop.gain}/${p.placeKey ?? ''}/${events.length}/${events[0]?.t ?? 0}/${events[events.length - 1]?.t ?? 0}`;
  let c = cache.get(key);
  const target = Math.max(0, Math.round(t * p.stepsPerSecond));
  if (!c || c.step > target) {
    c = { water: new Water({ nx: p.nx, ny: p.ny, courant: 0.5, damping: p.damping, stiffness: p.stiffness, edge: 'absorb', seed: p.seed }), step: 0, k: 0 };
    cache.set(key, c);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
  }
  const W = c.water;
  while (c.step < target) {
    const now = c.step / p.stepsPerSecond;
    while (c.k < events.length && events[c.k].t <= now) {
      const e = events[c.k++], [x, y] = p.place(e);
      W.drop(x * p.nx, y * p.ny, p.drop.r * (0.7 + 0.6 * (e.size ?? 0.5)), -p.drop.gain * (0.25 + (e.vel ?? 0.5)));
    }
    if (p.wind > 0 && c.step % p.windEvery === 0) W.wind(p.wind);
    W.step(1); c.step++;
  }
  return { nx: p.nx, ny: p.ny, u: W.u };
}
