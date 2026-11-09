// Momentum (family F6). A short figure repeats and speeds up by a small step each time, so the last repeat
// permits the next one. Stopping is denied: the figure ducks and comes back. After the third attempt it lets go.
import { playMotif } from './play.js';
import { kick, hat, pluck, snare } from '../voices.js';

export const meta = { id: 'momentum', family: 'F6 Momentum as permission', title: 'Momentum', line: 'Nobody signed for the tenth repeat. The ninth did.' };

export function render(ctx, dest, t, { beat = 0.5, accel = 0.012, repeats = 70, notes = [57, 60, 64, 60] } = {}) {
  const trim = ctx.createGain(); trim.gain.value = 0.55; trim.connect(dest); dest = trim; // headroom: kick, snare and pluck land together
  let tt = t, b = beat;
  for (let i = 0; i < repeats; i++) {
    kick(ctx, dest, tt, { vel: 0.7 }); hat(ctx, dest, tt + b * 0.5, { vel: 0.3 }); snare(ctx, dest, tt + b, { vel: 0.45, decay: 0.07 }); hat(ctx, dest, tt + b * 1.5, { vel: 0.25 });
    pluck(ctx, dest, tt, { note: notes[i % 4], dur: b * 0.9, vel: 0.2, bright: 1800 + i * 25 });
    tt += b * 2; b *= 1 - accel;
  }
  return { duration: tt - t, endBeat: b };
}

// play() returns a handle whose stop() is refused three times. Each refusal ducks the loop for a moment and returns it.
export function play(engine, opts = {}) {
  const h = playMotif(engine, { meta, render }, opts), ctx = engine.ctx;
  let denied = 0; const maxDenied = opts.deny ?? 3;
  const real = h.stop.bind(h);
  h.denied = () => denied;
  h.stop = (fade) => {
    if (denied >= maxDenied) return real(fade);
    denied++; const n = ctx.currentTime;
    h.duck?.(n);
    return false;
  };
  h.duck = (n) => { /* ducking is applied through the engine bus since the motif bus is private to playMotif */ engine.master.gain.cancelScheduledValues(n); engine.master.gain.setValueAtTime(engine.muted ? 0 : engine.volume, n); engine.master.gain.linearRampToValueAtTime(engine.muted ? 0 : engine.volume * 0.05, n + 0.05); engine.master.gain.setValueAtTime(engine.muted ? 0 : engine.volume * 0.05, n + 0.4); engine.master.gain.linearRampToValueAtTime(engine.muted ? 0 : engine.volume, n + 0.5); };
  return h;
}
