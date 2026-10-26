// wiggle.js: wigglegrams. A wigglegram cycles a few views of one moment taken from slightly different places, so
// depth reads from motion parallax alone. Two sources:
//   synth   one still, views made by the living-still depth warp at fixed camera offsets (no breath, no light);
//   real    2 to 4 frames from a multi-lens camera, a burst or a turntable, aligned so the pivot point holds still.
// The pivot is the one point that does not move between views. Put it on the subject's eye and the room swings
// around the portrait; put it on the background and the subject leans out of the frame.
//
// Views are ordered by a sequence ('pingpong' 0 1 2 1, 'cycle' 0 1 2, or explicit), each held `step` seconds.
// measureWiggle() reads a reference clip and returns the view count, the order, the hold and the period, so any
// wigglegram the author shares can set these numbers instead of a guess.
import { luma, image, sample, sampleField, clamp } from './lib/img.js';
import { warp, estimateDepth, LiveStill, DEFAULTS as STILL } from './livestill.js';

export const SPEC = Object.freeze({
  params: {
    views: { range: [2, 6], unit: 'views per cycle', default: 3 },
    step: { range: [0.04, 0.5], unit: 's each view is held', default: 0.1 },
    amp: { range: [0, 0.05], unit: 'fraction of width between the outer views', default: 0.016 },
    order: { options: ['pingpong', 'cycle'], unit: 'view order', default: 'pingpong' },
  },
  notes: 'step default 0.1 s is a starting value, not a measurement: feed set 26 holds no wigglegram (CLAIMS.md 2). Measure a reference with measureWiggle().',
});

export function sequence(n, order = 'pingpong') {
  if (Array.isArray(order)) return order.slice();
  const up = [...Array(n).keys()];
  if (order === 'cycle' || n < 3) return up;
  return [...up, ...up.slice(1, -1).reverse()];
}

// The view index at time t, for a sequence held `step` seconds per view. phase shifts the start (seconds).
export const viewAt = (t, seq, step, phase = 0) => seq[((Math.floor((t - phase) / step) % seq.length) + seq.length) % seq.length];

// Camera offsets for n views spread over amp, centred on zero.
export const cams = (n, amp) => [...Array(n)].map((_, k) => (n === 1 ? 0 : -amp / 2 + (amp * k) / (n - 1)));

// Synthesized views of one still. pivot: [u, v] in 0..1, the point that holds still.
export function synthViews(src, { views = 3, amp = 0.016, pivot = [0.5, 0.5], depth = null, seed = 7 } = {}) {
  const dep = depth || estimateDepth(src), pd = sampleField(dep, pivot[0] * dep.w - 0.5, pivot[1] * dep.h - 0.5);
  const q = { ...STILL, pivot: pd, wind: 0, water: 0, light: 0, breathe: 0 }, px = [0, 0, 0, 0];
  return cams(views, amp).map((c) => {
    const o = image(src.w, src.h), ps = { cam: [c, 0], scale: 1, lightPhase: -9 };
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const s = warp((x + 0.5) / src.w, (y + 0.5) / src.h, 0, q, ps, dep, null, null, seed);
      sample(src, s.u * src.w - 0.5, s.v * src.h - 0.5, px); o.data.set(px, (y * src.w + x) * 4);
    }
    return o;
  });
}

// Translation of b against a inside a window around pivot (px), by SAD search then a parabola for the sub-pixel.
export function shiftAt(a, b, pivot, { win = 0.18, radius = 12 } = {}) {
  const La = luma(a), Lb = luma(b), cx = pivot[0] * a.w, cy = pivot[1] * a.h, hw = (win * a.w) / 2, hh = (win * a.h) / 2;
  const cost = (dx, dy) => {
    let s = 0, n = 0;
    for (let y = Math.round(cy - hh); y < cy + hh; y += 1) for (let x = Math.round(cx - hw); x < cx + hw; x += 1) {
      if (x < 0 || y < 0 || x >= a.w || y >= a.h) continue;
      s += Math.abs(La.data[y * a.w + x] - sampleField(Lb, x + dx, y + dy)); n++;
    }
    return n ? s / n : 1e9;
  };
  let best = [0, 0], bc = Infinity;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) { const c = cost(dx, dy); if (c < bc) { bc = c; best = [dx, dy]; } }
  const para = (m, c0, p) => { const d = m - 2 * c0 + p; return d > 1e-9 ? (0.5 * (m - p)) / d : 0; };
  const [bx, by] = best;
  return [bx + clamp(para(cost(bx - 1, by), bc, cost(bx + 1, by)), -0.5, 0.5), by + clamp(para(cost(bx, by - 1), bc, cost(bx, by + 1)), -0.5, 0.5)];
}

// Align real frames so the pivot point holds still. Returns new images, each resampled by its shift against frame 0.
export function alignViews(frames, pivot = [0.5, 0.5], opts = {}) {
  const shifts = frames.map((f, i) => (i ? shiftAt(frames[0], f, pivot, opts) : [0, 0])), px = [0, 0, 0, 0];
  const out = frames.map((f, i) => {
    const o = image(f.w, f.h), [dx, dy] = shifts[i];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { sample(f, x + dx, y + dy, px); o.data.set(px, (y * f.w + x) * 4); }
    return o;
  });
  return { views: out, shifts };
}

// Read a reference clip: frames are luma fields at a small proxy size. Finds the distinct views, their order, the
// hold per view and the period. tol is the mean absolute difference (0..1 luma) under which two frames are one view.
export function measureWiggle(frames, fps, { tol = 0.012 } = {}) {
  const reps = [], labels = [];
  const mad = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]); return s / a.data.length; };
  for (const f of frames) { let k = reps.findIndex((r) => mad(r, f) < tol); if (k < 0) { reps.push(f); k = reps.length - 1; } labels.push(k); }
  const runs = []; for (let i = 0; i < labels.length; ) { let j = i; while (j < labels.length && labels[j] === labels[i]) j++; runs.push({ v: labels[i], n: j - i }); i = j; }
  const inner = runs.slice(1, -1).map((r) => r.n), holds = inner.length ? inner : runs.map((r) => r.n);
  const hold = median(holds), seq = runs.map((r) => r.v);
  let period = seq.length; // shortest repeat of the run sequence
  for (let p = 2; p <= seq.length / 2; p++) if (seq.every((v, i) => i < p || v === seq[i - p])) { period = p; break; }
  const one = seq.slice(0, period), pp = sequence(reps.length, 'pingpong'), cyc = sequence(reps.length, 'cycle');
  const rot = (a, b) => a.length === b.length && a.some((_, s) => a.every((v, i) => v === b[(i + s) % b.length]));
  const order = rot(one, pp) ? 'pingpong' : rot(one, cyc) ? 'cycle' : 'other';
  return { views: reps.length, order, sequence: one, holdFrames: hold, step: hold / fps, period: (period * hold) / fps, labels };
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// Browser: a living frame. Pass an <img> for a synthesized wiggle or an array of 2 to 4 images for real views.
export class Wiggle {
  constructor(canvas, source, { views = 3, step = 0.1, amp = 0.016, order = 'pingpong', pivot = [0.5, 0.4], seed = 7, depth = null } = {}) {
    this.canvas = canvas; this.step = step; this.real = Array.isArray(source);
    if (this.real) {
      const { views: v } = alignViews(source, pivot); this.seq = sequence(v.length, order); this.ctx = canvas.getContext('2d');
      this.frames = v.map((f) => { const c = Object.assign(document.createElement('canvas'), { width: f.w, height: f.h }); c.getContext('2d').putImageData(new ImageData(f.data, f.w, f.h), 0, 0); return c; });
    } else {
      this.still = new LiveStill(canvas, source, { params: { breathe: 0, light: 0, wind: 0, water: 0 }, seed, depth });
      const d = this.still.depth; this.still.p.pivot = sampleField(d, pivot[0] * d.w - 0.5, pivot[1] * d.h - 0.5);
      this.cams = cams(views, amp); this.seq = sequence(views, order);
    }
  }
  index(t) { return viewAt(t, this.seq, this.step); }
  draw(t) {
    const k = this.index(t);
    if (this.real) { this.ctx.drawImage(this.frames[k], 0, 0, this.canvas.width, this.canvas.height); return; }
    this.still.fixedCam = [this.cams[k], 0]; this.still.draw(t);
  }
  dispose() { this.still?.dispose(); }
}

