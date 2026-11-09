// Spectrogram views: the reveal for the Shepard tone and for the hidden picture.
//   liveSpectrogram(canvas, engine, opts)  scrolls the engine's analyser output as a picture. Returns { stop }.
//   bufferSpectrogram(canvas, samples, sr, opts)  draws a whole signal at once (also works with sound off, and for reduced motion).
// Frequency is on a linear axis by default, which is how a picture encoded with linear spacing appears.
import { stft } from './dsp.js';

// A colour ramp from near-black through ink to one warm tone. The spectrum is evidence here, so it stays monochrome plus one hot end.
function ramp(v) { const t = Math.max(0, Math.min(1, v)); const r = Math.round(12 + 243 * Math.pow(t, 0.8)), g = Math.round(10 + 215 * Math.pow(t, 1.4)), b = Math.round(17 + 180 * Math.pow(t, 2.2)); return [r, g, b]; }

export function bufferSpectrogram(canvas, x, sr, { fMin = 0, fMax = 10000, floor = -90, ceil = -30, n = 2048, hop = 512, log = false } = {}) {
  const S = stft(x, sr, { n, hop }), g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, img = g.createImageData(W, H);
  for (let px = 0; px < W; px++) {
    const m = S.frames[Math.min(S.frames.length - 1, Math.floor((px / W) * S.frames.length))];
    for (let py = 0; py < H; py++) {
      const u = 1 - py / (H - 1), f = log ? fMin + (fMax - fMin) * (Math.pow(10, u * 3) - 1) / 999 : fMin + (fMax - fMin) * u;
      const b = Math.min(S.bins - 1, Math.round(f / S.binHz)), v = (m[b] - floor) / (ceil - floor), [r, gg, bb] = ramp(v), o = (py * W + px) * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = bb; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); return S;
}

export function liveSpectrogram(canvas, engine, { fMax = 10000, floor = -90, ceil = -25, pxPerFrame = 2 } = {}) {
  const an = engine.analyser, g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, buf = new Float32Array(an.frequencyBinCount), binHz = engine.ctx.sampleRate / an.fftSize;
  let raf = 0, alive = true; g.fillStyle = '#0c0a11'; g.fillRect(0, 0, W, H);
  const prevSmooth = an.smoothingTimeConstant; an.smoothingTimeConstant = 0.2; an.fftSize = 4096;
  const step = () => {
    if (!alive) return; an.getFloatFrequencyData(buf);
    g.drawImage(canvas, -pxPerFrame, 0);
    const col = g.createImageData(pxPerFrame, H);
    for (let py = 0; py < H; py++) { const f = fMax * (1 - py / (H - 1)), v = (buf[Math.min(buf.length - 1, Math.round(f / (engine.ctx.sampleRate / an.fftSize)))] - floor) / (ceil - floor), [r, gg, b] = ramp(v); for (let k = 0; k < pxPerFrame; k++) { const o = (py * pxPerFrame + k) * 4; col.data[o] = r; col.data[o + 1] = gg; col.data[o + 2] = b; col.data[o + 3] = 255; } }
    g.putImageData(col, W - pxPerFrame, 0); raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { stop() { alive = false; cancelAnimationFrame(raf); an.smoothingTimeConstant = prevSmooth; an.fftSize = 1024; } };
}
