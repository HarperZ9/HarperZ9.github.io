// cadence.js: the two-clock scheduler. Layout, texture and tween each run on their own clock, apart from the display.
//
// Five of the seven favourite clips hold most of their frames: NcOl and rNvU re-cut every 7 frames at 25 fps
// (85.7% held), Hf9W holds 2 and 3 frames at 50 fps with longer rests (78.9%), 6sz1 holds 15 to 53 frames at
// 60 fps between dissolves (87.5%). The motion lives in the recut, not in tweening. Joined here with Kamler's
// twos and threes, the 12 Hz boil of limited-ink print, the 7 Hz reasoning-step cloud and the quote beat of the
// narrated films (plate, quote, plate). No single reference runs more than one of these clocks.
//
// A clock is data: { fps, holds: [frames...], pick: 'cycle' | 'seeded', range: [min, max], jitter, phase, seed }.
// Its state index at time t is a pure function of t, so the same seed gives the same cut list at any display rate.
// The Cadence class adds a fixed-timestep simulation clock (QUALITY-SPEC M4): an accumulator with dt clamped at
// 100 ms and at most maxSteps per frame; step counts come from total time, so 60 and 120 Hz runs agree exactly.
import { hash01 } from './lib/util.js';
import { defineNode } from './lib/node.js';
import { image, fill, rect } from './lib/raster.js';

// Measured presets. held = share of frames at the clock's own fps that repeat the previous state.
export const PRESETS = Object.freeze({
  'ones-60': { fps: 60, holds: [1], note: 'continuous, as 2HwN (9.3% held is capture noise)' },
  'recut-3.6': { fps: 25, holds: [7], note: 'NcOl and rNvU: new layout every 7 frames at 25 fps, 85.7% held' },
  'twos-24': { fps: 24, holds: [2], note: 'Kamler twos: 12 drawings a second' },
  'threes-24': { fps: 24, holds: [3], note: 'set 21 8NIH: 24 on threes' },
  'twos-threes-24': { fps: 24, holds: [2, 3], pick: 'seeded', note: 'zSG0: twos and threes mixed' },
  'hold-50': { fps: 50, holds: [2, 3, 2, 3, 2, 3, 6, 9, 14], pick: 'seeded', note: 'Hf9W: 2 and 3 frame holds with rests, about 79% held at 50 fps' },
  'dissolve-60': { fps: 60, holds: [24, 1, 1, 1, 1, 1, 1, 1, 1, 40, 1, 1, 1, 1, 1, 1, 30], note: '6sz1: long holds broken by short continuous dissolves, 84% held' },
  'boil-12': { fps: 12, holds: [1], note: 'texture boil, seed = floor(t x 12), set 20' },
  'step-7': { fps: 57.1, holds: [8], note: 'shridhar: point cloud steps every 8 frames at 57.1 fps, about 7.1 Hz' },
  'beat-quote': { fps: 10, holds: [30, 90, 30], note: 'narrated beat: plate 3 s, quote 9 s, plate 3 s' },
});

const DEF = { fps: 24, holds: [1], pick: 'cycle', range: null, jitter: 0, phase: 0, seed: 1 };

// A clock with a lazily extended table of state start frames.
export function clock(def, { seed } = {}) {
  const d = typeof def === 'string' ? PRESETS[def] : def;
  if (!d) throw new Error(`cadence: unknown clock ${def}`);
  const c = { ...DEF, ...d, seed: seed ?? d.seed ?? DEF.seed, id: typeof def === 'string' ? def : d.id || 'custom' };
  if (!(c.fps > 0)) throw new RangeError('cadence: fps must be above 0');
  const starts = [0];
  const holdOf = (k) => {
    let n;
    if (c.range) n = c.range[0] + Math.floor(hash01(c.seed, k) * (c.range[1] - c.range[0] + 1));
    else if (c.pick === 'seeded') n = c.holds[Math.floor(hash01(c.seed, k) * c.holds.length)];
    else n = c.holds[k % c.holds.length];
    if (c.jitter > 0 && hash01(c.seed ^ 0x51ed, k) < c.jitter) n += hash01(c.seed ^ 0x7a3, k) < 0.5 ? -1 : 1;
    return Math.max(1, n | 0);
  };
  const extend = (frame) => { while (starts[starts.length - 1] <= frame) starts.push(starts[starts.length - 1] + holdOf(starts.length - 1)); };
  const frameAt = (t) => Math.floor((t - c.phase) * c.fps + 1e-7);
  function indexAt(t) {
    const f = frameAt(t); if (f < 0) return 0; extend(f);
    let lo = 0, hi = starts.length - 1; // last start <= f
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= f) lo = m; else hi = m - 1; }
    return lo;
  }
  function at(t) {
    const index = indexAt(t); extend(starts[index] + 1);
    const start = starts[index] / c.fps + c.phase, end = starts[index + 1] / c.fps + c.phase;
    return { index, start, end, local: Math.min(1, Math.max(0, (t - start) / (end - start))), seed: Math.floor(hash01(c.seed, index) * 4294967296) >>> 0 };
  }
  return { ...c, frameAt, indexAt, at, holdOf, startOf: (k) => { while (starts.length <= k) extend(starts[starts.length - 1]); return starts[k] / c.fps + c.phase; } };
}

// Share of display frames that repeat the previous state, sampled at displayFps over a span.
export function heldShare(ck, displayFps = ck.fps, seconds = 10) {
  const n = Math.round(displayFps * seconds); let held = 0, prev = ck.indexAt(0);
  for (let i = 1; i < n; i++) { const k = ck.indexAt(i / displayFps); if (k === prev) held++; prev = k; }
  return held / (n - 1);
}

// Distinct states per second seen at a display rate (what pacing.py video measures as the unique-frame rate).
export function uniqueRate(ck, displayFps = 60, seconds = 10) {
  const n = Math.round(displayFps * seconds); let changes = 1, prev = ck.indexAt(0);
  for (let i = 1; i < n; i++) { const k = ck.indexAt(i / displayFps); if (k !== prev) changes++; prev = k; }
  return changes / seconds;
}

// Pick a hold pattern whose held share at fps lands on a target (for example 0.85 inside the 0.79 to 0.88 band).
// Mean hold H gives held share 1 - 1/H; two neighbouring integer holds are mixed in the right proportion.
export function holdsForShare(share, { cycle = 20 } = {}) {
  if (!(share >= 0 && share < 1)) throw new RangeError('cadence: share must be in [0, 1)');
  const H = 1 / (1 - share), lo = Math.floor(H), nHi = Math.round(cycle * (H - lo)); // mean hold = lo + nHi / cycle
  const out = []; let acc = 0; // spread the longer holds evenly through the cycle
  for (let i = 0; i < cycle; i++) { acc += nHi; if (acc >= cycle) { acc -= cycle; out.push(lo + 1); } else out.push(lo); }
  return out;
}

export class Cadence {
  constructor({ clocks = {}, step = 1 / 120, maxSteps = 12, seed = 1 } = {}) {
    this.seed = seed; this.step = step; this.maxSteps = maxSteps; this.clocks = {}; this.layers = [];
    this.t = 0; this.steps = 0; this.dropped = 0;
    for (const [id, d] of Object.entries(clocks)) this.clocks[id] = clock(d, { seed: seed ^ (id.length * 2654435761) });
  }
  add(id, def) { this.clocks[id] = clock(def, { seed: this.seed ^ (id.length * 2654435761) }); return this; }
  // layer: { layout?: clockId, texture?: clockId, update?(dt, sim), onLayout?(state, t), onTexture?(state, t), draw?(frame) }
  subscribe(layer) { layer.__last = {}; this.layers.push(layer); return () => { this.layers = this.layers.filter((l) => l !== layer); }; }
  state(t = this.t) { const s = {}; for (const [id, c] of Object.entries(this.clocks)) s[id] = c.at(t); return s; }
  // Advance by real elapsed seconds. Returns the frame: { t, alpha, clocks }.
  advance(realDt) {
    const dt = Math.min(0.1, Math.max(0, realDt)); this.t += dt;
    const target = Math.floor(this.t / this.step + 1e-6); let n = 0;
    while (this.steps < target) {
      if (n >= this.maxSteps) { this.dropped += target - this.steps; this.steps = target; break; }
      for (const l of this.layers) l.update?.(this.step, this.steps); this.steps++; n++;
    }
    return this.emit();
  }
  emit() {
    const clocks = this.state(), frame = { t: this.t, alpha: this.t / this.step - this.steps, clocks };
    for (const l of this.layers) {
      for (const role of ['layout', 'texture']) {
        const id = l[role]; if (!id || !clocks[id]) continue; const st = clocks[id];
        if (l.__last[role] !== st.index) { l.__last[role] = st.index; l[role === 'layout' ? 'onLayout' : 'onTexture']?.(st, this.t); }
      }
      l.draw?.(frame);
    }
    return frame;
  }
  // Jump to time t deterministically: replays the fixed steps from zero.
  seek(t, reset) { reset?.(); this.t = 0; this.steps = 0; for (const l of this.layers) l.__last = {}; while (this.t < t - 1e-9) this.advance(Math.min(0.1, t - this.t)); return this.emit(); }
}

// A browser loop that drives a Cadence from requestAnimationFrame; under reduced motion it renders once at tEnd.
export function run(cad, { reduced = false, tEnd = 0 } = {}) {
  if (reduced) { cad.seek(tEnd); return () => {}; }
  let last = null, id = 0;
  const tick = (now) => { const dt = last === null ? 0 : (now - last) / 1000; last = now; cad.advance(dt); id = requestAnimationFrame(tick); };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}

// The exposure sheet: one row per clock, one column per display frame; a new state starts a new ink band, a held
// frame repeats it. The animator's X-sheet, drawn from the clocks themselves, so a cut list can be read at a glance.
export function exposureSheet(ids, { fps = 60, seconds = 2, cell = 4, row = 18, inks = ['#eee9df', '#8f8a80'], ground = '#111111', seed = 1 } = {}) {
  const n = Math.round(fps * seconds), w = n * cell, h = ids.length * row, im = image(w, h); fill(im, ground);
  ids.forEach((id, r) => {
    const ck = clock(id, { seed }); let prev = -1, band = 0;
    for (let i = 0; i < n; i++) {
      const k = ck.indexAt(i / fps), cut = k !== prev;
      if (cut) { band ^= 1; prev = k; rect(im, i * cell, r * row + 2, i * cell + 1, r * row + row - 2, '#e0177e'); }
      rect(im, i * cell + (cut ? 1 : 0), r * row + 5, (i + 1) * cell, r * row + row - 5, inks[band], 0.9);
    }
  });
  return im;
}

export const SPEC = Object.freeze({
  inputs: { clocks: 'object of id to clock def or preset name', seed: 'uint32' },
  params: {
    fps: { range: [1, 240], unit: 'frames per second of the clock', default: 24 },
    hold: { range: [1, 120], unit: 'frames each state is held', default: 2 },
    step: { range: [1 / 480, 1 / 30], unit: 's, fixed simulation step', default: 1 / 120 },
    maxSteps: { range: [1, 64], unit: 'fixed steps per display frame', default: 12 },
  },
  determinism: 'state index is a pure function of (t, seed); sim step count is floor(total time / step)',
  budget: 'clock lookup is a binary search: under 1 microsecond per clock per frame',
});

export const node = defineNode({
  id: 'cadence', ports: { in: {}, out: { clock: 'clock' } }, params: SPEC.params, seed: 1,
  render: ({ t, seed, params }) => clock({ fps: params.fps, holds: [params.hold] }, { seed }).at(t),
});
