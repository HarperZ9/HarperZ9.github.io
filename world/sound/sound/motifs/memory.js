// Memory (Inner signal 15, Lossy). A phrase is squeezed through a transform codec again and again. The codec keeps
// what is cheap to keep: strong low partials survive, the quiet detail goes first, and spectral holes open up.
// Then the hash: a short tick sequence derived from the final bytes. It identifies the memory exactly and holds none of it.
// The codec here is our own STFT quantiser (own code, no dependency). It stands in for a real codec; it is not one.
import { playMotif } from './play.js';
import { mtof } from '../util.js';
import { fft } from '../dsp.js';

export const meta = { id: 'memory', family: 'Inner signal: memory (lossy)', title: 'Memory', line: 'You can prove which memory it was and never hear it again.' };

const SR = 22050, N = 512, H = 128;

// One pass of the codec. gen sets how hard it squeezes. shift misaligns the frames, as a re-encode would.
export function codec(x, gen, shift = 37) {
  const n = x.length, out = new Float32Array(n), win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = Math.sin((Math.PI * (i + 0.5)) / N);
  const norm = (N / H) / 2;
  for (let s = -shift; s < n; s += H) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) { const k = s + i; re[i] = k >= 0 && k < n ? x[k] * win[i] : 0; }
    fft(re, im);
    for (let b = 0; b <= N / 2; b++) {
      const m = Math.hypot(re[b], im[b]), ph = Math.atan2(im[b], re[b]);
      const step = 0.4 * (1 + gen * 0.9) * (1 + (b / (N / 2)) * 3), qm = Math.round(m / step) * step;
      const pstep = Math.PI / Math.max(2, 10 - gen), qp = Math.round(ph / pstep) * pstep;
      const c = qm * Math.cos(qp), d = qm * Math.sin(qp);
      re[b] = c; im[b] = d; if (b > 0 && b < N / 2) { re[N - b] = c; im[N - b] = -d; }
    }
    fft(re, im, true);
    for (let i = 0; i < N; i++) { const k = s + i; if (k >= 0 && k < n) out[k] += (re[i] * win[i]) / norm; }
  }
  return out;
}

export function phrase(seconds = 3.2) {
  const n = Math.floor(seconds * SR), d = new Float32Array(n), notes = [76, 74, 71, 69, 71, 74, 79, 76];
  notes.forEach((m, i) => { const s = Math.floor(i * 0.4 * SR); for (let k = 0; k < SR * 0.9 && s + k < n; k++) { const t = k / SR, f = mtof(m); d[s + k] += Math.exp(-t * 3.2) * (Math.sin(2 * Math.PI * f * t) * 0.4 + Math.sin(2 * Math.PI * f * 2.01 * t) * 0.16 + Math.sin(2 * Math.PI * f * 3.97 * t) * 0.08 + Math.sin(2 * Math.PI * f * 7.1 * t) * 0.04 * Math.exp(-t * 8)); } });
  return d;
}
export function fnv(x) { let h = 2166136261; const step = 7; for (let i = 0; i < x.length; i += step) { h ^= Math.round(x[i] * 32767) & 0xffff; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

export function render(ctx, dest, t, { gens = [0, 1, 2, 4, 7], seconds = 3.2 } = {}) {
  let cur = phrase(seconds), at = t, done = 0; const hashes = [];
  const play = (data, when) => { const b = ctx.createBuffer(1, data.length, SR); b.getChannelData(0).set(data); const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = 0.55; s.connect(g); g.connect(dest); s.start(when); };
  const last = Math.max(...gens);
  for (let g = 0; g <= last; g++) {
    if (g > 0) cur = codec(cur, g);
    if (gens.includes(g)) { play(cur, at); hashes.push(fnv(cur)); at += seconds + 0.4; }
  }
  const h = hashes[hashes.length - 1], scale = [60, 62, 64, 67, 69, 72, 74, 76];
  for (let i = 0; i < 8; i++) { const m = scale[(h >>> (i * 3)) & 7], o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(m + 12); g.gain.setValueAtTime(0.0001, at + i * 0.12); g.gain.linearRampToValueAtTime(0.18, at + i * 0.12 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.12 + 0.1); o.connect(g); g.connect(dest); o.start(at + i * 0.12); o.stop(at + i * 0.12 + 0.12); }
  return { duration: at - t + 1.2, hashes };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
