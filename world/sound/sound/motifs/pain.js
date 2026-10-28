// Pain (Inner signal 13, Clipping). A sine rises past the ceiling of the medium and goes flat. Louder input does not
// give more information past the line; it gives harsher harmonics. The 808 driven into saturation is the DMV
// signature, and here it is walked up through five drive stages, then through hard clip, then folded.
// Reading, not a claim about any artist: distortion worn as texture.
import { playMotif } from './play.js';
import { kick808 } from '../voices.js';

export const meta = { id: 'pain', family: 'Inner signal: pain (clipping)', title: 'Pain', line: 'Past the ceiling it does not get louder. It gets flatter.' };

// Share of a unit sine that survives a hard ceiling, for display: 1 means untouched.
export const clippedShare = (drive) => (drive <= 1 ? 1 : 1 / drive);

export function render(ctx, dest, t, { note = 33, stages = [1, 2.5, 6, 14, 40], gap = 0.95 } = {}) {
  stages.forEach((d, i) => kick808(ctx, dest, t + i * gap, { note, dur: 0.8, drive: d, vel: 0.85 - i * 0.04, glideTo: i === stages.length - 1 ? null : note + 3 }));
  const t2 = t + stages.length * gap + 0.2;
  kick808(ctx, dest, t2, { note, dur: 1, drive: 30, clip: true, vel: 0.5 });
  kick808(ctx, dest, t2 + 1.2, { note: note + 12, dur: 1, drive: 12, clip: true, vel: 0.5 });
  return { duration: t2 - t + 2.4, stages };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
