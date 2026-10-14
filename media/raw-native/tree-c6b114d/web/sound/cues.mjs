// SPDX-License-Identifier: FSL-1.1-MIT
// Procedural cue voices. Each cue is synthesised from its parameters and a
// seeded noise stream, so there are no samples to license and the same sheet
// always gives the same sound. A cue type names a job in the explanation, not
// a sound: what the viewer should notice (see docs/sound/DESIGN.md).
//
//   land     a number or mark lands: a short soft pluck
//   reveal   something new appears: a quiet two-partial glint
//   count    a quantity grows: a faint glide whose pitch follows log(value), ending on `land`
//   move     a shape morphs or travels: filtered air whose pan follows the shape
//   scale    the camera moves through scale: a slow, low swell
//   texture  many marks land together: a grain cloud, not one click per mark
//   chapter  a section turns: a low bell
//   recall   a question for the viewer: two rising notes, then silence
//   motif    the hot mark: one fixed three-note figure per film
//
// synth(cue, rng, rate) returns { mono: Float64Array, pan: Float64Array|null }
// with the mono peak at 1.0; the mixer applies gain and pan.
import { sinCycles, biquadCoefs, Biquad, normalizePeak, rise, panOfX } from "./dsp.mjs";

export const CUE_TYPES = Object.freeze(["land", "reveal", "count", "move", "scale", "texture", "chapter", "recall", "motif"]);
const semis = (f, s) => f * Math.pow(2, s / 12);

// A decaying partial: sum into `out` from sample `at`, frequency f, amplitude a, time constant tau (s).
function partial(out, at, f, a, tau, rate, attack = 0.002) {
  const n = out.length, A = Math.max(1, Math.round(attack * rate)), k = Math.exp(-1 / (tau * rate));
  let e = 1;
  for (let i = at; i < n; i++) {
    const j = i - at;
    if (j >= A) e *= k;
    if (e < 1e-5) break;
    out[i] += a * e * rise(j, A) * sinCycles((f * j) / rate);
  }
}

function noise(n, rng) {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = rng.nextFloat() * 2 - 1;
  return x;
}

// Band-passed noise whose centre glides from f0 to f1 (log), shaped by sin^2.
function air(n, rng, f0, f1, q, rate) {
  const src = noise(n, rng), out = new Float64Array(n), bq = new Biquad(biquadCoefs("bandpass", f0, q, 0, rate));
  const step = 64;
  for (let i = 0; i < n; i++) {
    if (i % step === 0) bq.c = biquadCoefs("bandpass", f0 * Math.pow(f1 / f0, i / Math.max(1, n - 1)), q, 0, rate);
    const env = Math.sin((Math.PI * i) / n);
    out[i] = bq.step(src[i]) * env * env;
  }
  return out;
}

const S = (s, rate) => Math.max(1, Math.round(s * rate));

const VOICES = {
  land(c, rng, rate) {
    const f = semis(c.hz || 880, c.pitch || 0), out = new Float64Array(S(0.45, rate));
    partial(out, 0, f, 1.0, 0.07, rate, 0.0015);
    partial(out, 0, f * 2.76, 0.35, 0.025, rate, 0.0015);
    partial(out, 0, f * 0.5, 0.25, 0.12, rate, 0.003);
    return out;
  },
  reveal(c, rng, rate) {
    const f = semis(c.hz || 660, c.pitch || 0), out = new Float64Array(S(1.4, rate));
    partial(out, 0, f, 1.0, 0.45, rate, 0.015);
    partial(out, 0, f * 1.5, 0.45, 0.3, rate, 0.02);
    partial(out, 0, f * 2.0, 0.2, 0.2, rate, 0.02);
    return out;
  },
  count(c, rng, rate) {
    // A glide up by one octave per factor of `per` between `from` and `to` (at most
    // two octaves), so a bigger change sounds bigger; it ends on a `land`.
    const n = S(c.dur || 1, rate), out = new Float64Array(n + S(0.45, rate));
    const per = c.per || 10, base = c.hz || 330;
    const oct = Math.min(2, Math.max(0.25, Math.log(Math.max(1, c.to || 10) / Math.max(1, c.from || 1)) / Math.log(per)));
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      ph += (base * Math.pow(2, oct * u)) / rate;
      out[i] += 0.35 * sinCycles(ph) * rise(i, S(0.08, rate)) * (1 - 0.3 * u);
    }
    const land = VOICES.land({ hz: base * Math.pow(2, oct + 1) }, rng, rate);
    for (let i = 0; i < land.length && n + i < out.length; i++) out[n + i] += land[i];
    return out;
  },
  move(c, rng, rate) {
    const n = S(c.dur || 0.8, rate);
    return air(n, rng, c.f0 || 500, c.f1 || 1800, 1.4, rate);
  },
  scale(c, rng, rate) {
    const n = S(c.dur || 4, rate);
    return air(n, rng, c.f0 || 180, c.f1 || 700, 0.9, rate);
  },
  texture(c, rng, rate) {
    // Grains spread over the span with seeded times; at most `cap` grains whatever
    // the count, and level grows with the square root of the count, not the count.
    const n = S(c.dur || 1.5, rate), out = new Float64Array(n + S(0.12, rate));
    const count = Math.max(1, Math.min(c.cap || 240, c.n || 40)), f = c.hz || 1400;
    for (let g = 0; g < count; g++) {
      const at = Math.floor(Math.pow(rng.nextFloat(), c.front ? 1.6 : 1) * n);
      partial(out, at, semis(f, (rng.nextFloat() - 0.5) * 6), 0.5 + 0.5 * rng.nextFloat(), 0.012, rate, 0.0008);
    }
    return out;
  },
  chapter(c, rng, rate) {
    const f = semis(c.hz || 146.83, c.pitch || 0), out = new Float64Array(S(3.2, rate));
    for (const [r, a, tau] of [[1, 1.0, 1.1], [2.0, 0.5, 0.6], [2.76, 0.3, 0.35], [5.4, 0.12, 0.12]]) partial(out, 0, f * r, a, tau, rate, 0.006);
    const br = air(S(0.5, rate), rng, 900, 600, 0.8, rate);
    for (let i = 0; i < br.length; i++) out[i] += 0.12 * br[i];
    return out;
  },
  recall(c, rng, rate) {
    const f = c.hz || 587.33, out = new Float64Array(S(1.2, rate));
    partial(out, 0, f, 1.0, 0.25, rate, 0.006);
    partial(out, S(0.2, rate), semis(f, 5), 1.0, 0.35, rate, 0.006);
    return out;
  },
  motif(c, rng, rate) {
    const f = c.hz || 523.25, out = new Float64Array(S(1.4, rate));
    [0, 3, 7].forEach((s, i) => partial(out, S(0.11 * i, rate), semis(f, s), 1 - 0.15 * i, 0.3, rate, 0.004));
    return out;
  },
};

// Gentle air on every voice: a 120 Hz high-pass keeps cues out of the voice's low end.
const HP = (rate) => biquadCoefs("highpass", 120, Math.SQRT1_2, 0, rate);

export function synth(cue, rng, rate, designWidth = 1920) {
  const v = VOICES[cue.type];
  if (!v) throw new Error("cue: unknown type " + cue.type);
  const mono = v(cue, rng, rate);
  const f = new Biquad(HP(rate));
  for (let i = 0; i < mono.length; i++) mono[i] = f.step(mono[i]);
  normalizePeak(mono, 1);
  let pan = null;
  if (cue.x1 !== undefined && cue.x !== undefined) {
    pan = new Float64Array(mono.length);
    const a = panOfX(cue.x, designWidth, cue.width ?? 0.6), b = panOfX(cue.x1, designWidth, cue.width ?? 0.6);
    for (let i = 0; i < pan.length; i++) pan[i] = a + (b - a) * Math.min(1, i / Math.max(1, pan.length - 1));
  }
  return { mono, pan };
}
