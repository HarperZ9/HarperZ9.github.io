// lib/timing.js: easing curves fitted to motion measured in feed set 20 (see ../2026-10-23-feed-test-20/CLAIMS.md).
// Measured, not copied: the numbers are reach times read off reference clips with OpenCV; the curve shapes are ours.
//   cascade:   10% at 0.53 s, 50% at 1.13 s, 90% at 1.40 s, peak 1.018 at 1.5 s, then settles (a glyph build).
//   revealOut: 10% at 0.25 s, 50% at 0.38 s, 90% at 0.62 s, done by 0.9 s (an engraving's wipe-in).
import { clamp } from './util.js';

// cascade(t): seconds to progress. A power ease-in shaped by an exponential tilt (least squares on the three
// measured points: p = 2.18, c = -0.22), reaching a 1.8% overshoot at 1.5 s, then an exponential settle.
export function cascade(t, T = 1.5, p = 2.18, c = -0.22, over = 0.018, settle = 0.08) {
  if (t <= 0) return 0;
  if (t < T) { const u = t / T; return (1 + over) * Math.pow(u, p) * Math.exp(c * (1 - u)); }
  return 1 + over * Math.exp(-(t - T) / settle);
}

// revealOut(t): seconds to progress. A delayed cubic ease-out (delay 0.224 s, duration 0.758 s), fitted to three points.
export function revealOut(t, delay = 0.224, dur = 0.758) { const u = clamp((t - delay) / dur); return 1 - Math.pow(1 - u, 3); }

// Boil clock: a texture seed that changes on twos at 24 fps, whatever the display rate (the 2:3 cadence measured
// in clip zSG0 is 24 fps drawing inside a 60 fps file).
export const boil = (t, rate = 12) => Math.floor(t * rate);

// Reach time of any curve, for tests and for the wall label numbers.
export function reach(f, level, tmax = 3, dt = 0.001) { for (let t = 0; t <= tmax; t += dt) if (f(t) >= level) return t; return Infinity; }
