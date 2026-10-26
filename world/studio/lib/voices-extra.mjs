// voices-extra.mjs: five material voices the engine did not have, in the engine's own voice contract
// (ctx, dest, t, opts), built from its util helpers. Stateless, so they run live and offline alike.
import { noiseSource, stopAt, mtof } from '../../sound/sound/util.js';

const gain = (ctx, v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
const bp = (ctx, f, q) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; };

// A burin cut: a short band of noise whose centre rises as the tool bites, then a dry click as it lifts.
export function scrape(ctx, dest, t, { dur = 0.09, vel = 0.4, freq = 3200, q = 6 } = {}) {
  const n = noiseSource(ctx, 'white'), f = bp(ctx, freq * 0.7, q), g = gain(ctx, 0);
  f.frequency.setValueAtTime(freq * 0.7, t); f.frequency.exponentialRampToValueAtTime(freq * 1.3, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t); stopAt(n, t + dur + 0.02);
}

// A tear: noise through a band that sweeps up while the fibres part, with crackle from a fast gain flutter.
export function rip(ctx, dest, t, { dur = 0.45, vel = 0.5, from = 500, to = 4200, crackle = 38 } = {}) {
  const n = noiseSource(ctx, 'pink'), f = bp(ctx, from, 2.2), g = gain(ctx, 0), lfo = ctx.createOscillator(), lg = gain(ctx, vel * 0.5);
  lfo.type = 'square'; lfo.frequency.value = crackle; lfo.connect(lg); lg.connect(g.gain);
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.02); g.gain.setValueAtTime(vel * 0.5, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t); lfo.start(t); stopAt(n, t + dur + 0.02); stopAt(lfo, t + dur + 0.02);
}

// A bubble: a sine at the Minnaert frequency of its radius (f = 3.26 / r Hz, r in metres) that rises as the
// bubble rises, with a fast decay. radius in millimetres, 0.5 to 6.
export const minnaert = rMm => 3.26 / (rMm / 1000);
export function bubble(ctx, dest, t, { radius = 2.5, vel = 0.3, dur = 0.08, rise = 0.35 } = {}) {
  const f0 = minnaert(radius), o = ctx.createOscillator(), g = gain(ctx, 0);
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (1 + rise), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); stopAt(o, t + dur + 0.02);
}

// Rope creak: a sawtooth at a low note, bent under load, through a resonant body band; stick-slip as a pulse train.
export function creak(ctx, dest, t, { note = 38, dur = 0.5, vel = 0.3, body = 420, bend = 0.6 } = {}) {
  const o = ctx.createOscillator(), f = bp(ctx, body, 7), g = gain(ctx, 0), slip = ctx.createOscillator(), sg = gain(ctx, vel * 0.4);
  o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(note), t); o.frequency.linearRampToValueAtTime(mtof(note + bend * 3), t + dur);
  slip.type = 'square'; slip.frequency.value = 23; slip.connect(sg); sg.connect(g.gain);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(dest); o.start(t); slip.start(t); stopAt(o, t + dur + 0.02); stopAt(slip, t + dur + 0.02);
}

export const EXTRA = { scrape, rip, bubble, creak };
