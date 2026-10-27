// Sound: the word is written into a sound and read back out of it. Each row of the word's bitmap becomes a sine at its
// own frequency (high rows high), and the row's ink over time becomes that sine's loudness: spectrographic synthesis,
// as in the spectrogram-picture motif of sound. The picture shown is not the bitmap: it is the short-time
// Fourier transform of the synthesised signal (bufferSpectrogram in the sound engine's reveal.js), so what you see is
// what the sound contains. A playhead reads it left to right. Sound is off until the reader presses play.
import { stft } from '../../../sound/sound/dsp.js';
import { canvas, rng, clamp } from '../paint.mjs';

export const meta = {
  id: 'sound', title: 'Sound', renderer: '2d', ground: 'own', weight: 800,
  lineage: 'Spectrographic synthesis (Metasynth\'s image synth); the face in the spectrogram of "Windowlicker" (Warp, 1999), cited, not copied.',
  does: 'The word is synthesised as sound; the picture is that sound\'s spectrogram, seen and, on request, heard.',
  params: { rows: 'frequency rows, 24 to 96 (default 56)', fLow: 'Hz, 200 to 2000 (default 600)', fHigh: 'Hz, 3000 to 10000 (default 7000)', colSec: 'seconds per bitmap column, 0.008 to 0.03 (default 0.014)' },
};

// The word's bitmap: rows x cols coverage over the letters' bounding box.
export function bitmap(g, rows) {
  const b = g.bbox, bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, cols = Math.max(8, Math.round((rows * bw / bh) * 1.15)), out = [];
  for (let r = 0; r < rows; r++) { const row = new Float32Array(cols); for (let c = 0; c < cols; c++) { let s = 0, n = 0; const x0 = b.x0 + (c / cols) * bw, y0 = b.y0 + (r / rows) * bh; for (let yy = 0; yy < bh / rows; yy += 1) for (let xx = 0; xx < bw / cols; xx += 1) { const x = Math.min(g.w - 1, (x0 + xx) | 0), y = Math.min(g.h - 1, (y0 + yy) | 0); s += g.mask[y * g.w + x]; n++; } row[c] = n ? s / n : 0; } out.push(row); }
  return out;
}

// Additive synthesis of the bitmap. Rows are linear in frequency so the picture is undistorted on a linear axis.
export function synth(bm, { sr = 22050, fLow = 600, fHigh = 7000, colSec = 0.014, seed = 19 } = {}) {
  const R = bm.length, C = bm[0].length, N = Math.ceil(C * colSec * sr) + Math.round(sr * 0.05), x = new Float32Array(N), rand = rng(seed);
  for (let r = 0; r < R; r++) {
    const f = fHigh - ((fHigh - fLow) * r) / (R - 1), w = (2 * Math.PI * f) / sr, ph = rand() * 6.2832, row = bm[r];
    // the gain follows the row with a short raised-cosine glide between columns, so no column edge clicks
    for (let n = 0; n < N; n++) { const u = n / (colSec * sr), c = Math.floor(u), fr = u - c, a = c < C ? row[c] : 0, b = c + 1 < C ? row[c + 1] : 0, s = 0.5 - 0.5 * Math.cos(Math.PI * fr), gain = a + (b - a) * s; if (gain > 0.002) x[n] += gain * Math.sin(w * n + ph); }
  }
  let peak = 0; for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(x[n])); const k = peak ? 0.5 / peak : 1; for (let n = 0; n < N; n++) x[n] *= k;
  return { x, sr, fLow, fHigh, colSec, seconds: N / sr };
}

// Spectrogram image of the signal: columns are STFT frames, rows are bins between fMin and fMax (top is high).
export function spectrogram(sig, { n = 512, hop = 96, floor = -78, ceil = -18 } = {}) {
  const S = stft(sig.x, sig.sr, { n, hop }), fMin = sig.fLow - 300, fMax = sig.fHigh + 300, b0 = Math.floor(fMin / S.binHz), b1 = Math.ceil(fMax / S.binHz), H = b1 - b0 + 1, W = S.frames.length;
  const v = new Float32Array(W * H);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) v[y * W + x] = clamp((S.frames[x][b1 - y] - floor) / (ceil - floor));
  return { v, W, H, hopSec: S.hopSec, binHz: S.binHz, fTop: b1 * S.binHz };
}

// The engine's monochrome ramp: near-black through ink to one warm end (reveal.js keeps the spectrum as evidence).
let engine = null; // one live engine per page, created on the first press of play
const ramp = t => [12 + 243 * Math.pow(t, 0.8), 10 + 215 * Math.pow(t, 1.4), 17 + 180 * Math.pow(t, 2.2)];

export async function create(g, env) {
  const o = env.opts, rows = o.rows ?? 56, bm = bitmap(g, rows), sig = synth(bm, { fLow: o.fLow, fHigh: o.fHigh, colSec: o.colSec, seed: env.seed % 101 }), sp = spectrogram(sig);
  const img = canvas(sp.W, sp.H), ix = img.getContext('2d'), id = ix.createImageData(sp.W, sp.H);
  for (let i = 0; i < sp.v.length; i++) { const [r, gg, b] = ramp(sp.v[i]); id.data.set([r, gg, b, 255], i * 4); }
  ix.putImageData(id, 0, 0);
  const b = g.bbox, padX = g.half * 0.6, padY = g.half * 1.1, dx = b.x0 - padX, dy = b.y0 - padY, dw = b.x1 - b.x0 + 2 * padX, dh = b.y1 - b.y0 + 2 * padY;
  // the frames past the last column are the 50 ms tail; crop them so the word fills the box
  const used = Math.min(sp.W, Math.round((bm[0].length * sig.colSec) / sp.hopSec));
  const dur = sig.seconds; let done = false, src = null, ctxA = null, playing = null;
  return {
    signal: sig, seconds: dur,
    draw(ctx, t) {
      const p = done ? 1 : clamp((playing ? (ctxA.currentTime - playing) : t - 0.4) / (bm[0].length * sig.colSec));
      ctx.fillStyle = '#0c0a11'; ctx.fillRect(0, 0, g.w, g.h);
      ctx.imageSmoothingQuality = 'high';
      const cut = Math.max(1, Math.round(used * p));
      ctx.drawImage(img, 0, 0, cut, sp.H, dx, dy, dw * (cut / used), dh);
      if (p < 1) { ctx.fillStyle = 'rgba(255,214,150,.9)'; ctx.fillRect(dx + dw * p, dy, Math.max(1, g.half * 0.12), dh); }
      return p < 1 || !!playing;
    },
    finish() { done = true; }, replay() { done = false; },
    // Plays the exact signal drawn above through the sound engine's limiter. Must be called from a click.
    async play() {
      const { Engine } = await import('../../../sound/sound/engine.js');
      const E = engine || (engine = await Engine.live()); E.mute(false); ctxA = E.ctx;
      const buf = ctxA.createBuffer(1, sig.x.length, sig.sr); buf.copyToChannel(sig.x, 0);
      src = ctxA.createBufferSource(); src.buffer = buf; src.connect(E.master); done = false; playing = ctxA.currentTime + 0.05; src.start(playing);
      src.onended = () => { playing = null; done = true; E.mute(true); };
      return dur;
    },
    stop() { try { src?.stop(); } catch (e) { console.warn('lettering: sound stop', e); } playing = null; done = true; },
  };
}
