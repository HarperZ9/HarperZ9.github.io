// A5. The Shepard tone (Shepard 1964; the continuous glide version is Risset's). A stack of sine partials one octave apart all
// glide upward together. A raised-cosine loudness window over log frequency fades each one in at the bottom and out at the top,
// so the pitch seems to climb for ever and never gets anywhere. Direction -1 gives the endless fall.
// The reveal is the spectrogram: parallel diagonal stripes that fade in and out at the same pitch, cycling.
// Every amplitude and frequency change is a ramp or a curve, and each partial is silent at the moment its frequency wraps.
import { playMotif } from './play.js';

export const meta = { id: 'shepard', family: 'Contrasts A5: the endless rise (longing, momentum)', title: 'The Shepard tone', line: 'It rises for ever and never arrives.' };

// The model behind the sound, for drawing a picture without any audio: frequency and relative level of each partial over time.
export function partials({ octaves = 8, fLow = 27.5, period = 10, duration = 30, dir = 1, step = 0.05 } = {}) {
  const out = [];
  for (let i = 0; i < octaves; i++) {
    const pts = [];
    for (let t = 0; t <= duration + 1e-9; t += step) {
      const pos = ((((i + (dir * t) / period) % octaves) + octaves) % octaves), f = fLow * Math.pow(2, pos), a = 0.5 - 0.5 * Math.cos((2 * Math.PI * pos) / octaves);
      pts.push({ t, f, a });
    }
    out.push(pts);
  }
  return out;
}

export function render(ctx, dest, t, { octaves = 8, fLow = 27.5, period = 10, duration = 30, dir = 1, level = 0.5, fade = 1.5 } = {}) {
  const master = ctx.createGain(); master.gain.setValueAtTime(0.0001, t); master.gain.linearRampToValueAtTime(level, t + fade);
  master.gain.setValueAtTime(level, t + duration - fade); master.gain.linearRampToValueAtTime(0.0001, t + duration); master.connect(dest);
  const norm = 2 / octaves; // the raised cosine sums to octaves/2 across the stack
  for (let i = 0; i < octaves; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; g.gain.value = 0; o.connect(g); g.connect(master);
    const N = Math.ceil(duration / 0.02), curve = new Float32Array(N + 1);
    // frequency: exponential glides, cut where the partial wraps (its level is exactly zero there)
    const pos0 = ((i % octaves) + octaves) % octaves; let tt = 0, pos = pos0;
    o.frequency.setValueAtTime(fLow * Math.pow(2, pos), t);
    while (tt < duration) {
      const toWrap = dir > 0 ? (octaves - pos) * period : pos * period, seg = Math.min(duration - tt, Math.max(toWrap, 1e-3));
      pos += (dir * seg) / period; tt += seg;
      o.frequency.exponentialRampToValueAtTime(fLow * Math.pow(2, Math.min(octaves, Math.max(0, pos))), t + tt);
      if (tt < duration) { pos = dir > 0 ? 0 : octaves; o.frequency.setValueAtTime(fLow * Math.pow(2, pos), t + tt); }
    }
    for (let k = 0; k <= N; k++) { const p = ((((i + (dir * k * 0.02) / period) % octaves) + octaves) % octaves); curve[k] = norm * (0.5 - 0.5 * Math.cos((2 * Math.PI * p) / octaves)); }
    g.gain.setValueCurveAtTime(curve, t, duration); o.start(t); o.stop(t + duration + 0.05);
  }
  return { duration: duration + 0.1, octaves, period };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
