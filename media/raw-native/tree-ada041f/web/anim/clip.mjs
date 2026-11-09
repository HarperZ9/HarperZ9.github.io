// Phase-timed animation clips, CPU reference. Pure: runs in Node and the browser.
//
// A clip is a set of keys on a timeline laid out by phases whose lengths come from data, so a
// designer retimes a move (startup, active, recovery frames) without touching a key:
//   const clip = { phases: ["startup", "active", "recovery"], keys: [{ at: ["startup", 0], value: { arm: 0 } }, ...] };
//   const L = layout(clip, { startup: 7, active: 3, recovery: 12 });     // { length, starts: { phase: [from, n] } }
//   sampleClip(clip, L, 8.5)                                            // channel values at frame 8.5
// A key's `at` is [phase, u] (u in 0..1 within the phase) or a number u over the whole clip.
// Channels are interpolated with a monotone cubic (Fritsch and Carlson 1980), so motion is smooth
// and never overshoots a key: a held pose stays held.
//
// warp() maps time on one phase layout onto another piecewise linearly, so a clip authored at one
// timing plays in step with gameplay frames at another (the art's windup ends on the move's last
// startup frame, whatever the two lengths are).

export function layout(clip, lengths = {}) {
  if (!clip.phases) { const n = lengths.frames ?? clip.frames; if (!(n > 0)) throw new Error("clip: no length"); return { length: n, starts: { all: [0, n] } }; }
  let f = 0; const starts = {};
  for (const ph of clip.phases) { const n = lengths[ph] ?? clip.lengths?.[ph]; if (!(n >= 0)) throw new Error(`clip: no length for phase ${ph}`); starts[ph] = [f, n]; f += n; }
  return { length: f, starts };
}

export function keyTime(at, L) {
  if (Array.isArray(at)) { const s = L.starts[at[0]]; if (!s) throw new Error(`clip: unknown phase ${at[0]}`); return s[0] + at[1] * s[1]; }
  return at * L.length;
}

// Monotone cubic through (ts[i], vs[i]) at t; clamps outside the keys.
export function monotoneCubic(ts, vs, t) {
  const n = ts.length; if (n === 1 || t <= ts[0]) return vs[0]; if (t >= ts[n - 1]) return vs[n - 1];
  let i = 0; while (t > ts[i + 1]) i++;
  const d = (k) => (vs[k + 1] - vs[k]) / Math.max(1e-9, ts[k + 1] - ts[k]);
  const tan = (k) => { if (k === 0) return d(0); if (k === n - 1) return d(n - 2); const a = d(k - 1), b = d(k); return a * b <= 0 ? 0 : (2 * a * b) / (a + b); };
  const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, m0 = tan(i) * h, m1 = tan(i + 1) * h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * m1;
}

// Channel values at frame f. Keys hold flat { channel: number } objects; a channel a key leaves out
// takes base[channel] (or 0). A looping clip wraps f and closes on its first key.
export function sampleClip(clip, L, f, base = {}) {
  const keys = clip.keys.map((k) => ({ t: keyTime(k.at, L), v: k.value })).sort((a, b) => a.t - b.t);
  if (clip.loop) { f = ((f % L.length) + L.length) % L.length; keys.push({ t: L.length, v: keys[0].v }); }
  const names = new Set(); for (const k of keys) for (const c of Object.keys(k.v)) names.add(c);
  const ts = keys.map((k) => k.t), out = {};
  for (const c of names) out[c] = monotoneCubic(ts, keys.map((k) => k.v[c] ?? base[c] ?? 0), f);
  return out;
}

// The phase at frame f, and whether f is inside each named window ([from, to) frames).
export function phaseAt(L, f, windows = {}) {
  let phase = null; for (const [ph, [s, n]] of Object.entries(L.starts)) if (f >= s && f < s + n) phase = ph;
  const inside = {}; for (const [k, [a, b]] of Object.entries(windows)) inside[k] = f >= a && f < b;
  return { phase, done: f >= L.length, ...inside };
}

// Map frame f on layout `from` to the matching time on layout `to`, phase by phase. Phases missing
// from either side are skipped; with none in common the map is proportional.
export function warp(from, to, f) {
  const common = Object.keys(from.starts).filter((p) => p in to.starts);
  if (!common.length) return (f / from.length) * to.length;
  const a = [0], b = [0];
  for (const p of common) { a.push(from.starts[p][0] + from.starts[p][1]); b.push(to.starts[p][0] + to.starts[p][1]); }
  if (a[a.length - 1] < from.length) { a.push(from.length); b.push(to.length); }
  if (f <= 0) return 0; if (f >= a[a.length - 1]) return b[b.length - 1];
  let i = 0; while (f > a[i + 1]) i++;
  const span = a[i + 1] - a[i]; return span > 0 ? b[i] + ((b[i + 1] - b[i]) * (f - a[i])) / span : b[i + 1];
}
