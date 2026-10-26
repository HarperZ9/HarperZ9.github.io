// Longing (Inner signal 14, Between stations). A dial sweeps slowly through static. Near a hidden station a faint
// tune and a heterodyne whistle rise out of the noise. The sweep reaches 0.7 of a clear signal at most and moves on:
// it never lands. The listener can only keep turning.
import { playMotif } from './play.js';
import { noiseSource, mtof } from '../util.js';
import * as picture from './spectrogram-picture.js';

export const meta = { id: 'longing', family: 'Inner signal: longing (between stations)', title: 'Longing', line: 'It almost resolves. The dial does not stop.' };

export function render(ctx, dest, t, { duration = 16, passes = 3, station = 1100, peak = 0.7, tune = [69, 72, 76, 72], hidden = '6EQUJ5', tail = 6 } = {}) {
  const N = 400, sweepF = new Float32Array(N), clarity = new Float32Array(N), whistle = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1), ph = x * passes, tri = 1 - Math.abs(((ph % 2) + 2) % 2 - 1); // 0..1..0 per pass
    const pos = 0.12 + 0.8 * tri * (0.75 + 0.25 * (1 - x * 0.7));
    const f = 180 * Math.pow(6000 / 180, pos); sweepF[i] = f;
    const dist = Math.log2(f / station); clarity[i] = peak * Math.exp(-(dist * dist) / 0.05) * (0.55 + 0.45 * (1 - x));
    whistle[i] = Math.min(4000, Math.max(30, Math.abs(f - station)));
  }
  const n = noiseSource(ctx, 'white'), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  bp.type = 'bandpass'; bp.Q.value = 2.2; bp.frequency.setValueCurveAtTime(sweepF, t, duration); ng.gain.value = 0.33; n.connect(bp); bp.connect(ng); ng.connect(dest); n.start(t); n.stop(t + duration + 0.1);
  // the tune that almost arrives: four notes, sine plus its octave, wobbling like a distant signal
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), tg = ctx.createGain(), wob = ctx.createOscillator(), wg = ctx.createGain();
  o.type = 'sine'; o2.type = 'sine'; wob.frequency.value = 6.1; wg.gain.value = 9; wob.connect(wg); wg.connect(o.detune); wg.connect(o2.detune);
  const tl = duration / 6;
  const steps = Math.floor(duration / (tl * 0.25));
  for (let k = 0; k < steps; k++) { const f = mtof(tune[k % tune.length]); o.frequency.setValueAtTime(f, t + k * tl * 0.25); o2.frequency.setValueAtTime(f * 2, t + k * tl * 0.25); }
  tg.gain.setValueCurveAtTime(clarity.map((c) => c * 0.55), t, duration); const og = ctx.createGain(); og.gain.value = 0.5;
  o.connect(tg); o2.connect(og); og.connect(tg); tg.connect(dest);
  const w = ctx.createOscillator(), wgn = ctx.createGain(); w.type = 'sine'; w.frequency.setValueCurveAtTime(whistle, t, duration);
  wgn.gain.setValueCurveAtTime(clarity.map((c) => Math.min(0.05, c * 0.1)), t, duration); w.connect(wgn); wgn.connect(dest);
  [o, o2, wob, w].forEach((x) => { x.start(t); x.stop(t + duration + 0.1); });
  // After the dial the static keeps going, and in it, drawn in frequency against time, is the Wow! signal's 6EQUJ5 (see spectrogram-picture.js).
  let hid = null;
  if (hidden && tail > 0 && typeof document !== 'undefined') hid = picture.render(ctx, dest, t + duration + 0.2, { text: hidden, duration: tail });
  return { duration: duration + 0.2 + (hid ? tail + 0.2 : 0), peakClarity: Math.max(...clarity), hidden: hid && hidden };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
