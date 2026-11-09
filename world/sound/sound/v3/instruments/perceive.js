// Perceptual modes: hacks on the listener's hearing, used as craft (pure DSP, any runtime). Each one says what it does
// to perception and what it costs, because each has both edges: the trick that delights can also mislead.
//   phantomBass   the missing fundamental: harmonics 2 to 8 of a note with the fundamental removed. The ear hears the
//                 fundamental anyway, so an 808 'sounds' on a phone speaker that cannot play 40 Hz.
//   haas          the precedence effect: the same sound 1 to 30 ms later on one side moves the image to the early side
//                 without changing level. Costs comb filtering in mono, so it is limited to the band above `fromHz`.
//   maskReveal    masking as composition: a noise band one critical band wide sits on a melody's band and hides it,
//                 then thins, and the line appears out of the noise without getting louder.
//   textRhythm    text to rhythm: letters to steps (vowels long, consonants short, spaces rests), punctuation to accents.
//   seriesNotes   any number series to notes in a mode, so data becomes melody (and back: features() turns sound into data).
//   features      sound to data: RMS, spectral centroid and onset strength every 20 ms, to drive type, image or motion.
import { mtof, Biquad, rng, edges, velocity } from './core.js';

export function phantomBass(m, vel, dur, { harmonics = 7, tilt = 0.7, sr = 48000 } = {}) {
  const f = mtof(m), V = velocity(vel), len = Math.floor((dur + 0.15) * sr), x = new Float32Array(len);
  for (let h = 2; h <= harmonics + 1 && f * h < sr / 2.2; h++) { const a = Math.pow(tilt, h - 2); for (let i = 0; i < len; i++) x[i] += a * Math.sin(2 * Math.PI * f * h * i / sr); }
  for (let i = 0; i < len; i++) { const t = i / sr; x[i] *= Math.min(1, t / 0.005) * Math.exp(-t / Math.max(0.2, dur * 0.6)); }
  new Biquad('hp', f * 1.5, 0.7, sr).run(x);  // make sure the real fundamental is gone: what is heard at f is the ear's
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); for (let i = 0; i < len; i++) x[i] *= pk ? 0.7 * V.gain / pk : 0;
  return edges(x, sr, 0.003, 0.03);
}

export function haas(L, R, sr, { ms = 12, side = 'right', fromHz = 900 } = {}) {
  const d = Math.round(ms / 1000 * sr), src = side === 'right' ? L : R, dst = side === 'right' ? R : L;
  const hi = new Biquad('hp', fromHz, 0.7, sr), lo = new Biquad('lp', fromHz, 0.7, sr), out = new Float32Array(dst.length), hiPart = new Float32Array(dst.length);
  for (let i = 0; i < dst.length; i++) { hiPart[i] = hi.tick(dst[i]); out[i] = lo.tick(dst[i]); }
  for (let i = 0; i < dst.length; i++) out[i] += i >= d ? hiPart[i - d] : 0;  // only the upper band is delayed
  dst.set(out); void src; return { L, R };
}

export function maskReveal(x, sr, { centerHz = 800, seconds = null, depthDb = 18, seed = 3 } = {}) {
  const n = x.length, r = rng(seed), bw = 25 + 75 * Math.pow(1 + 1.4 * (centerHz / 1000) ** 2, 0.69);  // Zwicker's critical bandwidth, Hz
  const bp = new Biquad('bp', centerHz, centerHz / bw, sr), dur = seconds ?? n / sr, out = new Float32Array(n);
  let xr = 0; for (const v of x) xr += v * v; xr = Math.sqrt(xr / n);
  for (let i = 0; i < n; i++) { const t = i / sr, k = Math.max(0, 1 - t / dur); out[i] = x[i] + bp.tick(r() * 2 - 1) * xr * Math.pow(10, depthDb / 20) * 3 * k * k; }
  return out;
}

export function textRhythm(text, { steps = 16 } = {}) {
  const ev = []; let s = 0;
  for (const ch of text.toLowerCase()) {
    if (ch === ' ') { s += 1; continue; }
    if (/[.!?]/.test(ch)) { if (ev.length) ev[ev.length - 1].vel = 1; s += 2; continue; }
    if (!/[a-z0-9]/.test(ch)) continue; const vowel = /[aeiou]/.test(ch);
    ev.push({ step: s, len: vowel ? 2 : 1, vel: vowel ? 0.7 : 0.45, piece: vowel ? 'snare' : 'hat' }); s += vowel ? 2 : 1;
  }
  return { events: ev, bars: Math.ceil(s / steps) };
}

export function seriesNotes(series, { root = 49, mode = [0, 2, 3, 5, 7, 8, 10], octaves = 2 } = {}) {
  const lo = Math.min(...series), hi = Math.max(...series), span = mode.length * octaves;
  return series.map((v) => { const k = Math.round((hi > lo ? (v - lo) / (hi - lo) : 0.5) * (span - 1)); return root + 12 * Math.floor(k / mode.length) + mode[k % mode.length]; });
}

export function features(x, sr, { hop = 0.02 } = {}) {
  const h = Math.floor(hop * sr), rms = [], centroid = [], onset = []; let prev = 0;
  for (let i = 0; i + h <= x.length; i += h) {
    let e = 0, zc = 0; for (let k = i; k < i + h; k++) { e += x[k] * x[k]; if (k > i && (x[k] >= 0) !== (x[k - 1] >= 0)) zc++; }
    const r = Math.sqrt(e / h); rms.push(r); centroid.push(zc * sr / (2 * h)); onset.push(Math.max(0, r - prev)); prev = r;  // zero-crossing rate as a cheap brightness
  }
  return { hop, rms, centroid, onset };
}

export const MODES = {
  phantomBass: { title: 'Missing fundamental', edge: 'bass a small speaker cannot play, or a pitch that is not in the signal at all' },
  haas: { title: 'Precedence (Haas) width', edge: 'width without level, or an image that collapses into comb filtering in mono' },
  maskReveal: { title: 'Masking as reveal', edge: 'a line that emerges, or a message hidden under noise' },
  textRhythm: { title: 'Text to rhythm', edge: 'words made audible, or meaning reduced to a pattern' },
  seriesNotes: { title: 'Data to melody', edge: 'a trend you can hear, or a mood that overstates a small change' },
  features: { title: 'Sound to data', edge: 'visuals that answer the music, or a fingerprint of a voice' },
};
