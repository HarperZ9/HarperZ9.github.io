// eqseq.mjs: a drum and tone pattern written as closed-form functions of time, drawn and heard from the same maths.
// The idea (a sequencer that is a graph: decaying envelopes per step, the pattern packed into the digits of an integer
// and read back with floor and mod) is from feed set 32 clip D5E6. The functions, voices, layout and sound here are our own.
//
// SPEC
//   pattern: { bpm 40..240, steps 4..32 per bar, bars 1..16, voices: [{ name, digits: string of 0..9 (velocity per step,
//              0 is rest), decay 2..60 per beat, kind: 'kick' | 'hat' | 'tone', notes?: digit string (scale degrees) }] }
//   digit(P, s, len)      the s-th digit (from the left) of integer P with len digits: floor(P / 10^(len-1-s)) mod 10
//   envelope(voice, x, steps)  amplitude 0..1 at x beats: (d/9) e^(-decay * beat-fraction since the step)
//   events(pattern)       onsets as superframe events { duration, events: [{ t, voice, args: { note, dur, vel } }] }
//   audio(pattern, rate)  Float32Array mono, -1..1, synthesised from the same envelopes (48 kHz by default)
//   formula(pattern)      the piecewise function as plain text (the real-text equivalent of the drawing)
//   draw({ w, h, pattern, t, ground, ink, hotInk }) -> feed-29 raster; one lane per voice, the playhead in the hot ink
//   determinism : the hat noise is seeded from the step index; same pattern gives the same samples and pixels.
import { raster, clamp, rng } from '../../feed-29/build/lib/field.mjs';
import { hexLin } from '../../feed-29/build/lib/color.mjs';
import { splat } from './strata.mjs';

export const digit = (P, s, len) => Math.floor(P / 10 ** (len - 1 - s)) % 10;
const asInt = str => Number(str.replace(/[^0-9]/g, '') || '0');
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15]; // natural minor degrees for the tone voice

export const DEMO = Object.freeze({
  bpm: 112, steps: 8, bars: 4,
  voices: [
    { name: 'kick', kind: 'kick', digits: '90009040', decay: 9 },
    { name: 'hat', kind: 'hat', digits: '05370537', decay: 34 },
    { name: 'tone', kind: 'tone', digits: '70050600', notes: '04070302', decay: 5 },
  ],
});

// Step index and beat-fraction since that step, for x in beats.
function stepAt(x, steps) { const perBeat = steps / 4, u = x * perBeat; return { s: Math.floor(u), f: (u - Math.floor(u)) / perBeat }; }

export function envelope(v, x, steps) {
  const { s, f } = stepAt(x, steps), len = v.digits.length, d = digit(asInt(v.digits), ((s % len) + len) % len, len);
  return (d / 9) * Math.exp(-v.decay * f);
}

export function events(p) {
  const out = [], spb = 60 / p.bpm, stepDur = (4 / p.steps) * spb;
  for (let bar = 0; bar < p.bars; bar++) p.voices.forEach(v => {
    const len = v.digits.length, P = asInt(v.digits);
    for (let s = 0; s < p.steps; s++) {
      const d = digit(P, s % len, len); if (!d) continue;
      const deg = v.notes ? digit(asInt(v.notes), s % v.notes.length, v.notes.length) : 0;
      const note = v.kind === 'kick' ? 36 : v.kind === 'hat' ? 42 : 57 + SCALE[deg];
      out.push({ t: (bar * p.steps + s) * stepDur, voice: v.name, args: { note, dur: Math.min(stepDur, 3 / v.decay * spb), vel: d / 9 } });
    }
  });
  out.sort((a, b) => a.t - b.t || a.voice.localeCompare(b.voice));
  return { duration: p.bars * 4 * spb, events: out };
}

export function audio(p, rate = 48000) {
  const spb = 60 / p.bpm, n = Math.round(p.bars * 4 * spb * rate), out = new Float32Array(n);
  for (const v of p.voices) {
    let phase = 0, lastStep = -1, noise = null;
    for (let i = 0; i < n; i++) {
      const x = i / rate / spb, e = envelope(v, x, p.steps); if (e < 1e-5) continue;
      const { s, f } = stepAt(x, p.steps), tsec = f * spb;
      if (s !== lastStep) { lastStep = s; phase = 0; noise = rng(`hat:${s}`); }
      let sig;
      if (v.kind === 'kick') { phase += (2 * Math.PI * (48 + 110 * Math.exp(-tsec * 30))) / rate; sig = Math.sin(phase); }
      else if (v.kind === 'hat') sig = (noise() * 2 - 1) * 0.5;
      else { const deg = digit(asInt(v.notes), ((s % v.notes.length) + v.notes.length) % v.notes.length, v.notes.length); phase += (2 * Math.PI * 220 * 2 ** (SCALE[deg] / 12)) / rate; sig = Math.sin(phase) * 0.6 + Math.sin(2 * phase) * 0.15; }
      out[i] += sig * e * 0.42;
    }
  }
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i]);
  return out;
}

export function formula(p) {
  const rows = p.voices.map(v => `${v.name}(x) = (floor(${asInt(v.digits)} / 10^(${v.digits.length - 1} - floor(${p.steps / 4}x) mod ${v.digits.length})) mod 10) / 9 * e^(-${v.decay} frac(${p.steps / 4}x) / ${p.steps / 4})`);
  return [`x in beats, ${p.bpm} beats per minute, ${p.steps} steps per bar`, ...rows].join('\n');
}

// Lanes: each voice drawn as its envelope trace in its own band; time runs left to right over one bar; the playhead
// at beat t is a small hot disc on the lane it is reading.
export function draw({ w, h, pattern: p = DEMO, t = 0, ground = '#ece7dc', ink = '#1b1a17', hotInk = '#c8442a' } = {}) {
  const R = raster(w, h, hexLin(ground)), ln = new Float32Array(w * h), hot = new Float32Array(w * h);
  const mx = w * 0.08, my = h * 0.18, lw = w - 2 * mx, lh = (h - 2 * my) / p.voices.length, beats = 4;
  p.voices.forEach((v, k) => {
    const base = my + (k + 0.82) * lh, amp = lh * 0.68;
    // Trace by arc length: each half-pixel step in x is split so splats sit at most 0.25 px apart along the curve, so
    // the steep onsets carry the same ink as the flat tails.
    let px0 = mx, py0 = base - envelope(v, 0, p.steps) * amp;
    for (let X = 1; X <= lw * 2; X++) {
      const px1 = mx + X / 2, py1 = base - envelope(v, (X / (lw * 2)) * beats, p.steps) * amp, k = Math.max(1, Math.ceil(Math.hypot(px1 - px0, py1 - py0) / 0.25));
      for (let j = 1; j <= k; j++) splat(ln, w, h, px0 + ((px1 - px0) * j) / k, py0 + ((py1 - py0) * j) / k, 0.3);
      px0 = px1; py0 = py1;
    }
    for (let X = 0; X <= lw; X += 0.5) splat(ln, w, h, mx + X, base + 1.5, 0.22); // baseline
    for (let s = 0; s <= p.steps; s++) for (let y = 0; y < 6; y += 0.5) splat(ln, w, h, mx + (s / p.steps) * lw, base + 3 + y, 0.25); // step ticks
    const tx = ((t % beats) + beats) % beats, py = base - envelope(v, tx, p.steps) * amp, px = mx + (tx / beats) * lw;
    for (let a = 0; a < 6.283; a += 0.05) for (let r = 0; r < 3.2; r += 0.5) splat(hot, w, h, px + r * Math.cos(a), py + r * Math.sin(a), 0.2);
  });
  const I = hexLin(ink), Hc = hexLin(hotInk);
  for (let j = 0; j < w * h; j++) {
    const a = clamp(ln[j]), b = clamp(hot[j]);
    for (let c = 0; c < 3; c++) { let v = R.px[3 * j + c]; v += (I[c] - v) * a; v += (Hc[c] - v) * b; R.px[3 * j + c] = v; }
  }
  return R;
}
