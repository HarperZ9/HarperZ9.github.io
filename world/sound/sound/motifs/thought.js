// Thought (Inner signal 11, Sampling). A voice sings a rising line. It is resampled downward with sample-and-hold
// and no anti-alias filter, and the line folds into a different melody the voice never sang.
// A frequency f sampled at rate fs reads as |f - k*fs| for the nearest whole k, which is the fold computed here.
import { playMotif } from './play.js';
import { mtof } from '../util.js';
import { voice } from '../voices.js';

export const meta = { id: 'thought', family: 'Inner signal: thought (analog to digital)', title: 'Thought', line: 'What falls between the samples was never recorded at all.' };

export const alias = (f, fs) => Math.abs(f - fs * Math.round(f / fs));

export function sungLine(ctx, notes, noteDur) {
  const sr = ctx.sampleRate, n = Math.floor(notes.length * noteDur * sr), d = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.min(notes.length - 1, Math.floor(i / (noteDur * sr))), tn = (i % (noteDur * sr)) / sr;
    const f = mtof(notes[k]) * (1 + 0.004 * Math.sin(2 * Math.PI * 5.3 * (i / sr)));
    ph += (2 * Math.PI * f) / sr;
    const e = Math.min(1, tn / 0.03) * Math.min(1, (noteDur - tn) / 0.05);
    d[i] = e * (Math.sin(ph) * 0.8 + Math.sin(2 * ph) * 0.18 + Math.sin(3 * ph) * 0.05);
  }
  return d;
}
// Sample-and-hold decimation by whole factor m, with no filter in front. This is the mistake that makes the alias.
export function decimateHold(src, m) { const o = new Float32Array(src.length); for (let i = 0; i < src.length; i++) o[i] = src[i - (i % m)]; return o; }
export function aliasBuffer(ctx, buf, m) {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(decimateHold(buf.getChannelData(c), m));
  return out;
}

export function render(ctx, dest, t, { notes = [79, 81, 83, 86, 83], noteDur = 0.55, m = 40 } = {}) {
  const sr = ctx.sampleRate, fs2 = sr / m, src = sungLine(ctx, notes, noteDur), len = src.length / sr;
  const mk = (data) => { const b = ctx.createBuffer(1, data.length, sr); b.getChannelData(0).set(data); return b; };
  const play = (buf, at, g = 0.4) => { const s = ctx.createBufferSource(), gn = ctx.createGain(); s.buffer = buf; gn.gain.value = g; s.connect(gn); gn.connect(dest); s.start(at); return s; };
  play(mk(src), t); // the thought as said
  const mid = decimateHold(src, Math.max(2, Math.round(m / 4)));
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = (sr / Math.max(2, Math.round(m / 4))) * 0.45; lp.connect(dest);
  const s1 = ctx.createBufferSource(); s1.buffer = mk(mid); const g1 = ctx.createGain(); g1.gain.value = 0.4; s1.connect(g1); g1.connect(lp); s1.start(t + len + 0.35);
  // the thought as stored: held samples through the reconstruction filter a DAC would apply
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = fs2 * 0.45; lp2.Q.value = 0.5; lp2.connect(dest);
  const s2 = ctx.createBufferSource(); s2.buffer = mk(decimateHold(src, m)); const g2 = ctx.createGain(); g2.gain.value = 0.5; s2.connect(g2); g2.connect(lp2); s2.start(t + 2 * len + 0.7);
  // the melody it never sang, drawn on top as soft voices at the folded pitches so the new line can be heard as a line
  const folded = notes.map((n) => alias(mtof(n), fs2));
  folded.forEach((f, i) => voice(ctx, dest, t + 2 * len + 0.7 + i * noteDur, { note: 69 + 12 * Math.log2(Math.max(f, 30) / 440), dur: noteDur * 0.9, vel: 0.06, vowel: 'u', vibrato: 0, depth: 0 }));
  return { duration: 3 * len + 1.2, sung: notes.map(mtof), folded, fs: fs2 };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
