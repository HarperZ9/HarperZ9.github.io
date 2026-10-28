// The vanishing record (family F4). A loop plays through tape. Dropouts come, each longer than the last, the
// pitch sagging and the highs closing as the signal goes. The last dropout does not come back.
import { playMotif } from './play.js';
import { tape, vinyl } from '../fx.js';
import { pluck, bell, kick, hat } from '../voices.js';

export const meta = { id: 'vanishing-record', family: 'F4 Visibility and the vanishing record', title: 'The vanishing record', line: 'It was there at ten seconds. Ask what you remember at twenty.' };

export function render(ctx, dest, t, { bpm = 92, bars = 8 } = {}) {
  const beat = 60 / bpm, barDur = beat * 4, total = bars * barDur;
  const tp = tape(ctx, { wow: 0.8, flutter: 0.5, hiss: 0.018, cutoff: 7800 }), v = vinyl(ctx, { dust: 0.35, rumble: 0.5, hiss: 0.012 });
  const trim = ctx.createGain(); trim.gain.value = 0.6; trim.connect(dest); tp.output.connect(trim); v.output.connect(dest); v.start(t); v.stop(t + total + 0.2);
  const m = [69, 72, 76, 72, 71, 67, 64, 67];
  for (let b = 0; b < bars; b++) {
    const b0 = t + b * barDur;
    kick(ctx, tp.input, b0, { vel: 0.8 }); kick(ctx, tp.input, b0 + beat * 2.5, { vel: 0.55 });
    for (let s = 0; s < 8; s++) { hat(ctx, tp.input, b0 + (s * beat) / 2, { vel: 0.22 + (s % 2) * 0.1 }); pluck(ctx, tp.input, b0 + (s * beat) / 2, { note: m[s] - 12, dur: 0.3, vel: 0.14, bright: 2200 }); }
    bell(ctx, tp.input, b0, { note: m[b % 8] + 12, dur: 1.4, vel: 0.12 }); bell(ctx, tp.input, b0 + beat * 2, { note: m[(b + 3) % 8] + 12, dur: 1.4, vel: 0.1 });
  }
  // dropouts: lengths grow, the last one stays gone
  const drops = [[2.1, 0.12], [3.4, 0.2], [4.6, 0.35], [5.6, 0.6], [6.4, 1.1]];
  drops.forEach(([bar, d]) => tp.dropout(t + bar * barDur + beat * 1.5, d, { back: true, sag: 0.014 }));
  tp.dropout(t + 7.1 * barDur, 3, { back: false, sag: 0.03 });
  tp.stop(t + total + 0.5);
  return { duration: total + 0.5, dropouts: drops.length + 1 };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
