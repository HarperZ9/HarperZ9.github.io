// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// drive.mjs: features to motion. A drive maps one feature onto one numeric parameter of one node in a superframe
// graph, so any of the framework's nodes can be played by sound or data. The scene graph is a superframe recipe;
// drives are its wiring to time.
//
//   drive spec (JSON, as in settings.json):
//     { node: 'ribbons', param: 'thickness', from: 'low', range: [0.02, 0.06],
//       in: [lo, hi] | 'auto',          feature domain; 'auto' is the track's 5th to 95th percentile
//       curve: 'lin' | 'smooth' | 'exp' | 'log',
//       attack: s, release: s,          one-pole envelope follower, separate rise and fall times
//       pulse: 'beat' | 'bar' | 'onset', decay: s }  instead of `from`: an impulse on each event, exp(-age/decay)
//   features usable as `from`: any key of features.series (flux, rms, centroid, flatness, sub, low, lowmid, mid,
//     presence, air, lufsM, lufsS, value, raw), the clocks beatPhase, barPhase, beatIndex, barIndex, and 'clock'
//     (seconds, unscaled: drives a time.clock's t), plus 'beatStep' (the beat index eased between beats with an
//     ease-out quad over `ease` seconds: the layout clock that steps on the beat and holds between beats).
//
//   compileDrives(features, drives, { fps }) -> { at(t) -> { nodeId: { param: value } }, trajectories }
//     Trajectories are computed once at the feature rate (envelopes are causal, so a seek gives the same value a
//     sequential run would); at(t) interpolates.
//   drivenStream(recipe, registry, features, drives) -> Promise of { frame(t) -> outputs, stream } (Node: it loads the
//     framework's stream module on first use, so the browser can import compileDrives alone)
//   drivable(registry) -> [{ node, param, min, max, unit }] every numeric parameter of every node
import { at as featuresAt } from './features.mjs';

const CURVES = {
  lin: x => x,
  smooth: x => x * x * (3 - 2 * x),
  exp: x => (Math.exp(3 * x) - 1) / (Math.exp(3) - 1),
  log: x => Math.log1p(9 * x) / Math.log(10),
};

export function percentile(arr, q) { const s = Float32Array.from(arr).filter(Number.isFinite).sort(); return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] : 0; }

function rawTrajectory(F, d, n, dt) {
  const out = new Float32Array(n);
  if (d.pulse) {
    const list = d.pulse === 'beat' ? F.beats : d.pulse === 'bar' ? F.downbeats : F.onsets, decay = d.decay ?? 0.25;
    let k = -1;
    for (let i = 0; i < n; i++) { const t = i * dt; while (k + 1 < list.length && list[k + 1] <= t) k++; out[i] = k < 0 ? 0 : Math.exp(-(t - list[k]) / decay); }
    return { values: out, domain: [0, 1] };
  }
  if (d.from === 'clock') { for (let i = 0; i < n; i++) out[i] = i * dt; return { values: out, domain: null }; }
  if (d.from === 'beatStep' || d.from === 'barStep') {
    const list = d.from === 'beatStep' ? F.beats : F.downbeats, ease = d.ease ?? 0.18; let k = -1;
    for (let i = 0; i < n; i++) { const t = i * dt; while (k + 1 < list.length && list[k + 1] <= t) k++; const u = k < 0 ? 0 : Math.min(1, (t - list[k]) / ease); out[i] = k + (k < 0 ? 0 : 1 - (1 - u) * (1 - u)) ; }
    return { values: out, domain: null };
  }
  if (d.from in F.series) { const s = F.series[d.from]; for (let i = 0; i < n; i++) { const p = Math.min(F.n - 1, i * dt * F.fps), a = Math.floor(p), f = p - a; out[i] = s[a] + ((s[Math.min(F.n - 1, a + 1)] ?? s[a]) - s[a]) * f; } return { values: out, domain: 'series' }; }
  for (let i = 0; i < n; i++) { const v = featuresAt(F, i * dt)[d.from]; out[i] = Number.isFinite(v) ? v : 0; }
  return { values: out, domain: null };
}

export function compileDrives(F, drives, { fps = 100 } = {}) {
  const n = Math.ceil(F.duration * fps) + 2, dt = 1 / fps, traj = [];
  for (const d of drives) {
    if (!d.node || !d.param) throw new Error(`drive: needs node and param (${JSON.stringify(d)})`);
    if (!d.pulse && !d.from) throw new Error(`drive ${d.node}.${d.param}: needs from or pulse`);
    if (d.from && !(d.from in F.series) && !['clock', 'beatStep', 'barStep', 'beatPhase', 'barPhase', 'beatIndex', 'barIndex', 'onsetAge'].includes(d.from)) throw new Error(`drive ${d.node}.${d.param}: unknown feature "${d.from}"`);
    const { values, domain } = rawTrajectory(F, d, n, dt);
    let lo = 0, hi = 1;
    if (Array.isArray(d.in)) [lo, hi] = d.in;
    else if (domain === 'series') { lo = percentile(F.series[d.from], 0.05); hi = percentile(F.series[d.from], 0.95); }
    else if (domain === null && d.range) { lo = 0; hi = 1; }
    const curve = CURVES[d.curve ?? 'lin'] ?? CURVES.lin, out = new Float32Array(n);
    const unscaled = (d.from === 'clock' || d.from === 'beatStep' || d.from === 'barStep') && !d.range;
    const [a, b] = d.range ?? [0, 1];
    // envelope follower on the normalised value, then the curve, then the range
    const kA = d.attack ? 1 - Math.exp(-dt / d.attack) : 1, kR = d.release ? 1 - Math.exp(-dt / d.release) : 1;
    let env = null;
    for (let i = 0; i < n; i++) {
      if (unscaled) { out[i] = values[i] * (d.scale ?? 1) + (d.offset ?? 0); continue; }
      let x = (d.from === 'beatStep' || d.from === 'barStep') ? values[i] : (values[i] - lo) / (hi - lo || 1);
      if (!(d.from === 'beatStep' || d.from === 'barStep')) x = Math.max(0, Math.min(1, x));
      env = env === null ? x : env + (x > env ? kA : kR) * (x - env);
      out[i] = (d.from === 'beatStep' || d.from === 'barStep') ? a + (b - a) * env : a + (b - a) * curve(env);
    }
    traj.push({ d, values: out });
  }
  function at(t) {
    const p = Math.max(0, Math.min(n - 1, t * fps)), i = Math.floor(p), f = p - i, j = Math.min(n - 1, i + 1), out = {};
    for (const { d, values } of traj) {
      const v = values[i] + (values[j] - values[i]) * f;
      const o = (out[d.node] ??= {});
      o[d.param] = d.mode === 'add' && d.param in o ? o[d.param] + v : v;
    }
    return out;
  }
  return { at, trajectories: traj, fps };
}

export async function drivenStream(recipe, registry, F, drives, opts = {}) {
  const { createStream } = await import('../../superframe/lib/stream.mjs');
  const D = compileDrives(F, drives, opts), stream = createStream(recipe, registry);
  for (const d of drives) if (!stream.plan.byId.has(d.node)) throw new Error(`drive: the recipe has no node "${d.node}"`);
  return {
    stream, drives: D,
    async frame(t) {
      for (const [id, params] of Object.entries(D.at(t))) stream.set(id, params);
      return stream.tick();
    },
  };
}

export function drivable(registry) {
  const out = [];
  for (const def of registry.values()) for (const [k, p] of Object.entries(def.params)) if (p.type === 'number' || p.type === 'int') out.push({ node: def.id, param: k, min: p.min, max: p.max, unit: p.unit });
  return out;
}
