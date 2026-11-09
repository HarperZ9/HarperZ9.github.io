// Trauma (Inner signal 12, the skipping groove). A groove with one skip: the last sixteenth catches and repeats
// four times with a hard tick. The loop is copied again and again. Each copy loses highs, bit depth and level
// to noise, while the skip stays where it was, as sharp as the first time. The wound is the best-kept part.
// Limit: the tick is mixed after the loss on purpose. A lossy codec would smear it (see memory.js).
import { playMotif } from './play.js';
import { rng, mtof } from '../util.js';

export const meta = { id: 'trauma', family: 'Inner signal: trauma (the skipping groove)', title: 'Trauma', line: 'Every copy kept the skip.' };

const SR = 22050;
// Build the groove in plain arrays so each generation can be processed offline of the audio clock.
export function groove(bars = 2, bpm = 84) {
  const beat = 60 / bpm, n = Math.floor(bars * 4 * beat * SR), d = new Float32Array(n), skipAt = Math.floor((bars * 4 * beat - beat / 4) * SR), r = rng(11);
  const add = (t, fn, len) => { const s = Math.floor(t * SR); for (let i = 0; i < len && s + i < n; i++) d[s + i] += fn(i / SR); };
  for (let b = 0; b < bars; b++) {
    const o = b * 4 * beat;
    add(o, (t) => Math.sin(2 * Math.PI * (48 + 120 * Math.exp(-t * 40)) * t) * Math.exp(-t * 9) * 0.9, SR * 0.4);
    add(o + 2 * beat, (t) => (r() * 2 - 1) * Math.exp(-t * 30) * 0.4 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 25) * 0.3, SR * 0.2);
    for (let h = 0; h < 8; h++) add(o + (h * beat) / 2, (t) => (r() * 2 - 1) * Math.exp(-t * 90) * 0.12, SR * 0.06);
    [57, 60, 64, 60].forEach((m, i) => add(o + i * beat, (t) => Math.sin(2 * Math.PI * mtof(m) * t) * Math.exp(-t * 6) * 0.2, SR * 0.4));
  }
  // the skip: the final slice is replaced by four copies of the slice before it
  const sl = Math.floor(beat / 4 * SR), src = d.slice(skipAt - sl, skipAt), out = new Float32Array(n);
  out.set(d.subarray(0, skipAt));
  for (let k = 0; k < 4; k++) for (let i = 0; i < sl / 2 && skipAt + k * (sl / 2) + i < n; i++) out[skipAt + k * Math.floor(sl / 2) + i] = src[Math.floor(i * 2)] * 0.9;
  return { data: out, skipAt: skipAt / SR, sl: sl / SR };
}

export function degrade(data, g, seed = 3) {
  const r = rng(seed + g), out = new Float32Array(data.length), a = Math.exp(-2 * Math.PI * Math.max(900, 9000 - g * 1500) / SR), bits = Math.max(5, 12 - g), lv = Math.pow(2, bits - 1);
  let y = 0;
  for (let i = 0; i < data.length; i++) { y = (1 - a) * data[i] + a * y; out[i] = Math.round((y * (1 - g * 0.06) + (r() * 2 - 1) * (0.004 + g * 0.006)) * lv) / lv; }
  return out;
}

export function render(ctx, dest, t, { generations = 6, bars = 2 } = {}) {
  const g0 = groove(bars), dur = g0.data.length / SR;
  let cur = g0.data;
  const tick = (at) => { const s = ctx.createBufferSource(), b = ctx.createBuffer(1, 200, SR), d = b.getChannelData(0); for (let i = 0; i < 200; i++) d[i] = (i % 2 ? -1 : 1) * Math.exp(-i / 18); s.buffer = b; const gn = ctx.createGain(); gn.gain.value = 0.5; s.connect(gn); gn.connect(dest); s.start(at); };
  for (let g = 0; g < generations; g++) {
    const b = ctx.createBuffer(1, cur.length, SR); b.getChannelData(0).set(cur);
    const s = ctx.createBufferSource(), gn = ctx.createGain(); s.buffer = b; gn.gain.value = 0.7; s.connect(gn); gn.connect(dest);
    const at = t + g * (dur + 0.25); s.start(at);
    for (let k = 0; k < 4; k++) tick(at + g0.skipAt + (k * g0.sl) / 2); // the skip survives every copy
    cur = degrade(cur, g + 1);
  }
  return { duration: generations * (dur + 0.25) + 0.3, skipAt: g0.skipAt, generations };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
