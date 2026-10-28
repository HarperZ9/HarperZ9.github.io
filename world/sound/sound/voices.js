// Synthesis voices. Each is a function (ctx, dest, t, opts) that schedules its own nodes and cleans up after itself.
// Nothing here holds state, so the same voice works on a live AudioContext and an OfflineAudioContext.
import { env, noiseSource, stopAt, mtof, tanhCurve, clipCurve, rng } from './util.js';

const osc = (ctx, type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
const gain = (ctx, v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };

// 808: sine with a fast pitch drop, a slow glide to the next note, and drive. drive is the DMV signature
// (a driven 808 reads as a square-ish wave with the harmonics that carry it on small speakers).
export function kick808(ctx, dest, t, { note = 33, dur = 0.7, glideTo = null, glide = 0.12, drive = 4, vel = 1, drop = 14, clip = false, tail = 1 } = {}) {
  const f0 = mtof(note), o = osc(ctx, 'sine', f0 * Math.pow(2, drop / 12)), o2 = osc(ctx, 'triangle', f0 * 2);
  o.frequency.setValueAtTime(f0 * Math.pow(2, drop / 12), t);
  o.frequency.exponentialRampToValueAtTime(f0, t + 0.045);
  o2.frequency.setValueAtTime(f0 * 2 * Math.pow(2, drop / 12), t);
  o2.frequency.exponentialRampToValueAtTime(f0 * 2, t + 0.04);
  if (glideTo != null) {
    const f1 = mtof(glideTo), g0 = t + Math.max(0.06, dur * 0.35);
    o.frequency.setValueAtTime(f0, g0); o.frequency.exponentialRampToValueAtTime(f1, g0 + glide);
    o2.frequency.setValueAtTime(f0 * 2, g0); o2.frequency.exponentialRampToValueAtTime(f1 * 2, g0 + glide);
  }
  const a = ctx.createGain(), sh = ctx.createWaveShaper(), mix2 = gain(ctx, 0.08), out = gain(ctx, 0.9 * vel);
  sh.curve = clip ? clipCurve(1 / Math.max(drive, 1)) : tanhCurve(drive); sh.oversample = '4x';
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(1, t + 0.004);
  a.gain.setValueAtTime(1, t + 0.01); a.gain.exponentialRampToValueAtTime(0.0001, t + dur * tail);
  o.connect(a); o2.connect(mix2); mix2.connect(a); a.connect(sh); sh.connect(out); out.connect(dest);
  o.start(t); o2.start(t); stopAt(o, t + dur * tail + 0.05); stopAt(o2, t + dur * tail + 0.05);
}

export function kick(ctx, dest, t, { vel = 1, pitch = 52, punch = 140, decay = 0.26 } = {}) {
  const o = osc(ctx, 'sine', punch), g = gain(ctx, 0);
  o.frequency.setValueAtTime(punch * 2.2, t); o.frequency.exponentialRampToValueAtTime(pitch, t + 0.04);
  env(g.gain, t, { a: 0.001, peak: 0.95 * vel, d: decay });
  const c = noiseSource(ctx, 'white'), cf = ctx.createBiquadFilter(), cg = gain(ctx, 0);
  cf.type = 'highpass'; cf.frequency.value = 1500; env(cg.gain, t, { a: 0.0005, peak: 0.25 * vel, d: 0.012 });
  const cl = ctx.createBiquadFilter(); cl.type = 'lowpass'; cl.frequency.value = 9000; cl.Q.value = 0.5;
  c.connect(cf); cf.connect(cl); cl.connect(cg); cg.connect(dest); o.connect(g); g.connect(dest);
  o.start(t); c.start(t); stopAt(o, t + decay + 0.05); stopAt(c, t + 0.05);
}

export function snare(ctx, dest, t, { vel = 1, tone = 185, decay = 0.1, snap = 0.8, bright = 2400 } = {}) {
  const o = osc(ctx, 'triangle', tone), og = gain(ctx, 0);
  o.frequency.setValueAtTime(tone * 1.6, t); o.frequency.exponentialRampToValueAtTime(tone, t + 0.03);
  env(og.gain, t, { a: 0.001, peak: 0.55 * vel, d: decay * 0.9 });
  const n = noiseSource(ctx, 'white'), nf = ctx.createBiquadFilter(), ng = gain(ctx, 0);
  nf.type = 'highpass'; nf.frequency.value = bright; env(ng.gain, t, { a: 0.001, peak: 0.8 * vel * snap, d: decay });
  const sl = ctx.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.value = 13000; sl.Q.value = 0.5;
  o.connect(og); og.connect(dest); n.connect(nf); nf.connect(sl); sl.connect(ng); ng.connect(dest);
  o.start(t); n.start(t); stopAt(o, t + decay + 0.05); stopAt(n, t + decay + 0.05);
}

export function clap(ctx, dest, t, { vel = 1, decay = 0.16, spread = 0.011 } = {}) {
  const n = noiseSource(ctx, 'white'), bp = ctx.createBiquadFilter(), g = gain(ctx, 0);
  bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 0.9;
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 3; i++) { const s = t + i * spread; g.gain.linearRampToValueAtTime(0.9 * vel, s + 0.001); g.gain.exponentialRampToValueAtTime(0.15, s + spread * 0.9); }
  const e = t + 3 * spread; g.gain.linearRampToValueAtTime(0.9 * vel, e + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, e + decay);
  n.connect(bp); bp.connect(g); g.connect(dest); n.start(t); stopAt(n, e + decay + 0.05);
}

// Closed or open hat. The hit is computed once per context and kept as a buffer (high-passed noise plus the odd harmonics of two squares,
// each band-limited below 16 kHz, then a lowpass in the top octave), so a hit costs one source node. Pitch is playbackRate.
function biquad(x, type, f, q, sr) {
  const w = (2 * Math.PI * f) / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w), lp = type === 'lp';
  const b0 = lp ? (1 - c) / 2 : (1 + c) / 2, b1 = lp ? 1 - c : -(1 + c), b2 = b0, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
}
const hatCache = new WeakMap();
function hatBuffer(ctx, open) {
  let m = hatCache.get(ctx); if (!m) hatCache.set(ctx, (m = {}));
  const key = open ? 'o' : 'c'; if (m[key]) return m[key];
  const sr = ctx.sampleRate, dur = open ? 0.34 : 0.07, decay = open ? 0.28 : 0.045, n = Math.floor(dur * sr), d = new Float32Array(n), r = rng(open ? 91 : 17);
  for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  biquad(d, 'hp', 7200, 0.7, sr); biquad(d, 'hp', 7200, 0.7, sr);
  for (const f of [5800, 8310]) for (let k = 1; k * f < 16000; k += 2) { const ph = 2 * Math.PI * f * k / sr; for (let i = 0; i < n; i++) d[i] += (0.06 / k) * Math.sin(ph * i); }
  biquad(d, 'lp', 15500, 0.5, sr);
  let pk = 0; for (let i = 0; i < n; i++) { const t = i / sr, e = Math.min(1, t / 0.0008) * Math.exp(-t / (decay / 4.6)); d[i] *= e; if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]); }
  for (let i = 0; i < n; i++) d[i] /= pk; // peak 1, level set by vel
  const b = ctx.createBuffer(1, n, sr); b.getChannelData(0).set(d); return (m[key] = b);
}
export function hat(ctx, dest, t, { vel = 0.6, open = false, pitch = 1 } = {}) {
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = hatBuffer(ctx, open); s.playbackRate.value = pitch; g.gain.value = 0.5 * vel;
  s.connect(g); g.connect(dest); s.start(t);
}

// Times (in seconds, relative to t) for a roll: n hits across span. curve > 1 speeds up, < 1 slows down.
export function rollTimes(n, span, curve = 1) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(span * Math.pow(i / n, curve));
  return out;
}
export function hatRoll(ctx, dest, t, { n = 8, span = 0.25, from = 0.35, to = 0.8, curve = 1, pitchRise = 0.15 } = {}) {
  const ts = rollTimes(n, span, curve);
  ts.forEach((dt, i) => hat(ctx, dest, t + dt, { vel: from + (to - from) * (i / Math.max(n - 1, 1)), pitch: 1 + pitchRise * (i / n) }));
  return ts.map((dt) => t + dt);
}
// Ratchet: one step cut into a pattern like [1,0,1,1] of equal parts, the DMV choppy-hat figure.
export function ratchet(ctx, dest, t, { span = 0.2, pattern = [1, 1, 0, 1, 1, 1], vel = 0.55 } = {}) {
  const out = [];
  pattern.forEach((p, i) => { if (p) { const tt = t + (span * i) / pattern.length; hat(ctx, dest, tt, { vel: vel * (p === 2 ? 1.25 : 1) }); out.push(tt); } });
  return out;
}

export function sub(ctx, dest, t, { note = 33, dur = 0.5, vel = 0.8, attack = 0.01 } = {}) {
  const o = osc(ctx, 'sine', mtof(note)), g = gain(ctx, 0);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.8 * vel, t + attack); g.gain.setValueAtTime(0.8 * vel, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); stopAt(o, t + dur + 0.02);
}

// Filtered saw pluck. bright sets the cutoff opening.
export function pluck(ctx, dest, t, { note = 69, dur = 0.4, vel = 0.5, bright = 3200, type = 'sawtooth', detune = 6 } = {}) {
  const g = gain(ctx, 0), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(bright, t); f.frequency.exponentialRampToValueAtTime(Math.max(300, bright * 0.12), t + dur);
  env(g.gain, t, { a: 0.003, peak: vel, d: dur });
  [-detune, detune].forEach((c) => { const o = osc(ctx, type, mtof(note)); o.detune.value = c; o.connect(f); o.start(t); stopAt(o, t + dur + 0.05); });
  f.connect(g); g.connect(dest);
}

// FM bell: the eerie keys-and-bells figure. ratio and index shape the metal.
export function bell(ctx, dest, t, { note = 76, dur = 0.9, vel = 0.4, ratio = 3.5, index = 280 } = {}) {
  const c = osc(ctx, 'sine', mtof(note)), m = osc(ctx, 'sine', mtof(note) * ratio), mg = gain(ctx, 0), g = gain(ctx, 0);
  env(mg.gain, t, { a: 0.001, peak: index, d: dur * 0.6 }); env(g.gain, t, { a: 0.002, peak: vel, d: dur });
  m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest);
  c.start(t); m.start(t); stopAt(c, t + dur + 0.05); stopAt(m, t + dur + 0.05);
}

// Detuned saw pad with a slow attack. notes is an array of MIDI numbers; cents is the global detune.
export function pad(ctx, dest, t, { notes = [57, 60, 64], dur = 3, vel = 0.18, attack = 0.6, release = 1, cutoff = 1400, spread = 9, cents = 0 } = {}) {
  const g = gain(ctx, 0), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + attack); g.gain.setValueAtTime(vel, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  notes.forEach((n, i) => [-spread, spread].forEach((c) => { const o = osc(ctx, 'sawtooth', mtof(n)); o.detune.value = c + cents; o.connect(f); o.start(t); stopAt(o, t + dur + 0.05); }));
  f.connect(g); g.connect(dest);
}

export function noise(ctx, dest, t, { dur = 1, kind = 'white', vel = 0.3, lp = 12000, hp = 20, attack = 0.01, release = 0.2 } = {}) {
  const n = noiseSource(ctx, kind), a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(), g = gain(ctx, 0);
  a.type = 'lowpass'; a.frequency.value = lp; b.type = 'highpass'; b.frequency.value = hp;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + attack); g.gain.setValueAtTime(vel, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  n.connect(a); a.connect(b); b.connect(g); g.connect(dest); n.start(t); stopAt(n, t + dur + 0.02);
}

// A vowel from a sawtooth through three band-pass formants, with vibrato. Used by the crowd and thought motifs.
const FORMANTS = { a: [800, 1150, 2900], e: [400, 1600, 2700], i: [350, 2000, 2800], o: [450, 800, 2830], u: [325, 700, 2530] };
export function voice(ctx, dest, t, { note = 57, dur = 1.2, vel = 0.25, vowel = 'a', vibrato = 5.2, depth = 12, cents = 0, attack = 0.08, release = 0.25, pan = 0 } = {}) {
  const o = osc(ctx, 'sawtooth', mtof(note)), g = gain(ctx, 0), lfo = osc(ctx, 'sine', vibrato), lg = gain(ctx, depth);
  o.detune.value = cents; lfo.connect(lg); lg.connect(o.detune);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + attack); g.gain.setValueAtTime(vel, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) p.pan.value = pan;
  const sum = gain(ctx, 1);
  (FORMANTS[vowel] || FORMANTS.a).forEach((fr, i) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = 8 + i * 2; const bg = gain(ctx, [1, 0.6, 0.35][i]); o.connect(b); b.connect(bg); bg.connect(sum); });
  sum.connect(g); if (p) { g.connect(p); p.connect(dest); } else g.connect(dest);
  o.start(t); lfo.start(t); stopAt(o, t + dur + 0.05); stopAt(lfo, t + dur + 0.05);
}

export const VOICES = { kick808, kick, snare, clap, hat, hatRoll, ratchet, sub, pluck, bell, pad, noise, voice };
export { rng };
