// lanes/motion.mjs: a material's motion. Timing curves from measured references, the declared cadence, boil.
//
//   const mo = motion(material);
//   mo.value(t)        progress at t seconds, held on the declared cadence (M5): 24 on twos holds each drawing 2 frames
//   mo.raw(u)          the curve on normalised time 0..1, unheld
//   mo.frame(t)        { index, held, boilSeed } for a fixed-clock renderer (M4)
//   mo.samples(n)      [[u, v]] for drawing the curve or for goldens
//
// Curves come from ../../../substrate/lib/motion.mjs (MEASURED, curveFromSamples, expoOut) and
// ../../../techniques/lib/timing.js (cascade, revealOut) and rope.js (ropeEase). Nothing is CSS `ease`.
import { MEASURED, curveFromSamples, expoOut } from '../../../substrate/lib/motion.mjs';
import { cascade, revealOut } from '../../../techniques/lib/timing.js';
import { ropeEase } from '../../../techniques/lib/rope.js';
import { normalize } from '../schema.mjs';

const engrave = curveFromSamples(MEASURED.engravingReveal).fn;
const glyph = curveFromSamples(MEASURED.glyphCascade).fn;
const T_ENGRAVE = MEASURED.engravingReveal.at(-1)[0], T_GLYPH = 1.8;

// Each curve maps u in [0, 1] to progress; the measured ones are stretched from their own duration.
export function curveFn(name, core) {
  const k = 3 + 9 * core.tension;
  switch (name) {
    case 'engravingReveal': return u => engrave(u * T_ENGRAVE);
    case 'glyphCascade': return u => (core.tension > 0.5 ? cascade(u * T_GLYPH) : glyph(u * T_GLYPH));
    case 'revealOut': return u => revealOut(u * 0.982);
    case 'rope': return u => ropeEase(u, { pulls: Math.max(3, Math.round(core.durationS * 1.6)), slip: 0.12 + 0.12 * (1 - core.tension) });
    case 'linear': return u => u;
    case 'sineInOut': return u => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));
    case 'expoOut': return expoOut(k);
    case 'stepped': {
      // collage holds of 0.28 s (QUALITY-SPEC M7, NcOl and rNvU), each step landing on an ease-out quad
      const steps = Math.max(2, Math.round(core.durationS / 0.28));
      return u => { const s = Math.min(steps - 1, Math.floor(u * steps)), f = u * steps - s, q = 1 - (1 - Math.min(1, f * 3)) ** 2; return Math.min(1, (s + q) / steps); };
    }
    default: throw new RangeError(`motion: unknown curve ${name}`);
  }
}

export function motion(material) {
  const m = normalize(material), c = m.core, mix = m.hints.motion.mix;
  const fns = mix ? mix.parts.map(p => [curveFn(p.curve, c), p.w]) : [[curveFn(m.hints.motion.curve, c), 1]];
  const raw = u => { u = Math.min(1, Math.max(0, u)); let v = 0; for (const [f, w] of fns) v += w * f(u); return v; };
  const hold = c.on / c.fps; // seconds each drawing is held
  const quant = t => Math.floor(t / hold + 1e-9) * hold;
  return {
    curve: mix ? mix.parts.map(p => `${p.curve} ${Math.round(p.w * 100)}%`).join(' + ') : m.hints.motion.curve,
    durationS: c.durationS, fps: c.fps, on: c.on, hold, boilHz: c.fps / c.on,
    raw,
    value: t => raw(quant(Math.max(0, t)) / c.durationS),
    frame: t => { const idx = Math.floor(Math.max(0, t) * c.fps + 1e-9); return { index: idx, held: idx % c.on !== 0, boilSeed: Math.floor(idx / c.on) }; },
    samples: (n = 64) => Array.from({ length: n + 1 }, (_, i) => [i / n, +raw(i / n).toFixed(5)]),
    // Speed of the build at u, progress per second (the visual-to-audio driver reads it as pitch).
    speed: u => (raw(Math.min(1, u + 0.005)) - raw(Math.max(0, u - 0.005))) / (0.01 * c.durationS),
    // Stagger for items in reading order (letters, tiles, dabs): the measured glyph group delay, scaled by tension.
    stagger: (i, n) => (n > 1 ? (i / (n - 1)) * c.durationS * (0.25 + 0.35 * (1 - c.tension)) : 0),
  };
}
