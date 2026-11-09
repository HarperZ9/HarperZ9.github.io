// D19. A picture hidden in the sound, visible only in its spectrogram. Each row of a small bitmap is a sine at its own frequency, and
// the row's brightness over time is that sine's loudness, so the image appears when the audio is drawn as frequency against time.
// Precedent, cited and not copied: Aphex Twin, "Windowlicker" (Warp, 1999), whose end section carries a face in the spectrogram, and
// the older technique of spectrographic synthesis (Metasynth's image synth, among others). The method here is our own: bitmaps are
// made from text or from a small array, and the rows are played by band-limited sine oscillators with curved gains.
// In "Between stations" the static carries the Wow! signal's "6EQUJ5" (Big Ear, 1977). Used on the longing motif's tail.
import { playMotif } from './play.js';
import { noiseSource, stopAt, rng } from '../util.js';
import { stft } from '../dsp.js';

export const meta = { id: 'spectrogram-picture', family: 'Contrasts D19: hidden in the sound', title: 'The spectrogram picture', line: 'Open the spectrogram. The static is writing.' };

// Rasterise text to a brightness grid: rows x cols in 0..1. Needs a canvas; call on the main thread or in an OffscreenCanvas worker.
export function glyphBitmap(text = '6EQUJ5', rows = 48, cols = 200, { weight = 800 } = {}) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(cols, rows) : Object.assign(document.createElement('canvas'), { width: cols, height: rows });
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cols, rows); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = rows; g.font = `${weight} ${size}px sans-serif`; while (g.measureText(text).width > cols * 0.94 && size > 6) { size -= 1; g.font = `${weight} ${size}px sans-serif`; }
  g.fillText(text, cols / 2, rows / 2 + size * 0.04);
  const d = g.getImageData(0, 0, cols, rows).data, out = [];
  for (let r = 0; r < rows; r++) { const row = new Float32Array(cols); for (let k = 0; k < cols; k++) row[k] = d[(r * cols + k) * 4] / 255; out.push(row); }
  return out;
}

// Schedules the picture. bitmap[r][k]: r=0 is the top row (highest frequency). Frequencies are linear between fLow and fHigh so the picture
// is undistorted on a linear-frequency spectrogram. The gain per row is a single smooth curve, and the first and last values are zero.
export function render(ctx, dest, t, { bitmap = null, text = '6EQUJ5', duration = 6, fLow = 2500, fHigh = 9500, level = 0.55, rows = 48, static: bed = 0.04, fade = 0.15 } = {}) {
  const bm = bitmap || glyphBitmap(text, rows, 200), R = bm.length, C = bm[0].length, out = ctx.createGain(); out.gain.value = 1; out.connect(dest);
  // Level: the tones sum like independent sources, so each row's peak scales with 1/sqrt(rows lit at once, about 30 percent of them).
  // Start phases are spread at random (a seeded generator), because equal-spaced tones that start together add into a pulse train.
  const pk = (level * 0.06) / Math.sqrt(R * 0.3), rand = rng(19);
  for (let r = 0; r < R; r++) {
    const f = fHigh - ((fHigh - fLow) * r) / (R - 1), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0;
    const curve = new Float32Array(C + 2); for (let k = 0; k < C; k++) curve[k + 1] = pk * bm[r][k]; // zero ends
    g.gain.setValueCurveAtTime(curve, t, duration); o.connect(g); g.connect(out); o.start(Math.max(0, t - rand() / f)); o.stop(t + duration + 0.05);
  }
  if (bed > 0) { // the static the picture hides in: white noise limited to the picture's band
    const n = noiseSource(ctx, 'white'), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = fLow * 0.8; lp.type = 'lowpass'; lp.frequency.value = fHigh * 1.15; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(bed, t + fade); g.gain.setValueAtTime(bed, t + duration - fade); g.gain.linearRampToValueAtTime(0.0001, t + duration);
    n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); n.start(t); stopAt(n, t + duration + 0.05);
  }
  return { duration: duration + 0.1, rows: R, cols: C, fLow, fHigh, text };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);

// Letterform API: a word drawn into a spectrogram that is both seen and heard. Silent by default: it renders offline into a buffer
// and returns the audio and the spectrogram frames. Nothing reaches the speakers unless the caller passes a live engine to play(),
// which only exists after the visitor turned sound on.
//   const L = await letterform({ text: 'SOUND' });     // or { bitmap: rows x cols array of 0..1, row 0 = highest frequency }
//   L.frames  Float32Array per STFT frame (dB), L.binHz, L.hopSec, L.fLow, L.fHigh: draw them as an image
//   L.samples Float32Array (mono), L.sampleRate, L.buffer (AudioBuffer)
//   L.play(engine)  plays the rendered buffer through engine.out and returns { stop(), ended }
// Options: duration (s), fLow, fHigh (Hz, linear rows), rows, cols, level, static (noise bed, 0 for a clean letter), weight,
// sampleRate (default 48000), n and hop (STFT size). Text needs a canvas (main thread or OffscreenCanvas).
export async function letterform({ text = 'SOUND', bitmap = null, duration = 3, fLow = 1500, fHigh = 9000, rows = 64, cols = 240, level = 0.6, static: bed = 0, weight = 800, sampleRate = 48000, n = 2048, hop = 256 } = {}) {
  const bm = bitmap || glyphBitmap(text, rows, cols, { weight });
  const ctx = new OfflineAudioContext(1, Math.ceil((duration + 0.2) * sampleRate), sampleRate);
  const info = render(ctx, ctx.destination, 0.05, { bitmap: bm, duration, fLow, fHigh, level, static: bed });
  const buffer = await ctx.startRendering(), samples = buffer.getChannelData(0), spec = stft(samples, sampleRate, { n, hop });
  return {
    ...info, buffer, samples, sampleRate, bitmap: bm, frames: spec.frames, bins: spec.bins, binHz: spec.binHz, hopSec: spec.hopSec,
    play(engine) {
      if (!engine || engine.offline) throw new Error('letterform.play needs the live engine the visitor started');
      const c = engine.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = buffer; s.connect(g); g.connect(engine.out); s.start(c.currentTime + 0.03);
      const ended = new Promise((res) => { s.onended = () => res(); });
      return { ended, stop(fade = 0.1) { const t = c.currentTime; g.gain.setTargetAtTime(0, t, fade / 3); stopAt(s, t + fade + 0.05); } };
    },
  };
}
