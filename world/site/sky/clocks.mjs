// clocks.mjs: a fast surface over a slow body. The scene runs on one clock, and its parts change on different
// timescales because of their physics: chop and spray (periods near a second, from the deep-water dispersion
// omega^2 = g k at short wavelengths) over the swell (periods of 8 to 15 s) and the clouds (minutes). Like a
// breakbeat over a long pad. periodTracker finds the period a signal repeats at inside a window of periods, by the
// peak of its normalised autocorrelation; two trackers with different windows should lock to different timescales.
export function periodTracker(signal, dt, minP, maxP) {
  const n = signal.length, mean = signal.reduce((a, b) => a + b) / n, x = signal.map((v) => v - mean);
  const var0 = x.reduce((a, v) => a + v * v, 0) || 1;
  let best = -2, bestLag = 0;
  for (let lag = Math.max(1, Math.round(minP / dt)); lag <= Math.min(n - 2, Math.round(maxP / dt)); lag++) {
    let c = 0; for (let i = 0; i + lag < n; i++) c += x[i] * x[i + lag];
    c /= var0 * ((n - lag) / n);
    if (c > best) { best = c; bestLag = lag; }
  }
  return { period: bestLag * dt, strength: best };
}
// a moving average over w seconds: the slow part of a signal; the signal minus it is the fast part
export function smooth(signal, dt, w) {
  const k = Math.max(1, Math.round(w / dt / 2)), out = new Array(signal.length);
  for (let i = 0; i < signal.length; i++) { let s = 0, m = 0; for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < signal.length) { s += signal[j]; m++; } out[i] = s / m; }
  return out;
}
// the envelope of a signal: its magnitude, smoothed
export const envelope = (signal, dt, w) => smooth(signal.map(Math.abs), dt, w);
