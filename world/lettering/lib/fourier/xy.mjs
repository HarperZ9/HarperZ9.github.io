// lib/fourier/xy.mjs: the shape as a stereo sound. Left is x, right is y: fed to an XY oscilloscope (or read back
// here) the sound draws the letters. Each video frame of the sound traces every contour once, each given samples
// in proportion to its length, so the beam's speed is even along the word. The harmonic count can rise frame by
// frame, so the word is heard and seen going from gist to crisp. Pure: node and page alike.
import { trace } from './kernel.mjs';

// series: [{ k, re, im }] in pixels. Returns { L, R, sr, map } with map turning samples back into pixels.
export function xySignal(series, { sr = 48000, fps = 40, seconds = 3, H = () => Infinity, gain = 0.8 } = {}) {
  const per = series.map((s) => { const p = trace(s, s.re.length, 64); let L = 0; for (let i = 0; i < 64; i++) { const j = (i + 1) % 64; L += Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]); } return L; });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of series) { const p = trace(s, s.re.length, 128); for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } }
  const map = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, half: Math.max(x1 - x0, y1 - y0) / 2 / gain };
  const S = Math.round(sr / fps), frames = Math.max(1, Math.round(seconds * fps)), total = per.reduce((a, b) => a + b, 0) || 1;
  const counts = per.map((p) => Math.max(8, Math.floor((S * p) / total)));
  const len = counts.reduce((a, b) => a + b, 0), L = new Float32Array(len * frames), R = new Float32Array(len * frames);
  let o = 0;
  for (let f = 0; f < frames; f++) {
    const h = H(f, frames);
    series.forEach((s, i) => {
      const p = trace(s, Math.min(h, s.re.length), counts[i]);
      for (let n = 0; n < counts[i]; n++, o++) { L[o] = (p[2 * n] - map.cx) / map.half; R[o] = -(p[2 * n + 1] - map.cy) / map.half; } // y up on a scope
    });
  }
  return { L, R, sr, map, frameLen: len, frames, counts };
}

// Samples back to pixels: what an oscilloscope draws.
export function readXY(L, R, map, from = 0, to = L.length) {
  const out = new Float64Array(2 * (to - from));
  for (let i = from; i < to; i++) { out[2 * (i - from)] = map.cx + L[i] * map.half; out[2 * (i - from) + 1] = map.cy - R[i] * map.half; }
  return out;
}

// The 16-bit PCM a file or a sound card carries.
export const pcm16 = (x) => Float32Array.from(x, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767) / 32767);
