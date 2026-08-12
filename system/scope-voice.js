// scope-voice.js: oscilloscope XY, both directions. A path becomes stereo
// audio (left drives X, right drives Y, retrace rate = pitch) and audio
// becomes a phosphor trace. The beam law follows the woscope model: light
// deposited per point falls as 1/(2*segment length), so slow beam glows and
// fast beam fades; persistence is an exponential fade of the accumulation
// buffer, never a clear. Corners ring by Gibbs (about 9 percent overshoot);
// rounded paths sound smooth, cornered paths sound buzzy. Units: points are
// interleaved [x0,y0,x1,y1,...] in -1..1.

function hash(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

// A closed Lissajous-family figure the knobs play: a and b pick the X and Y
// frequencies (integer ratio = stable figure), c sets the phase; a slightly
// off-harmonic detune makes the figure precess slowly, the standard motion
// of the form. Deterministic for a given (seed, t, a, b, c).
export function idlePath(seed, t, a, b, c) {
  const r = hash(seed);
  const fx = 1 + Math.round((a === undefined ? 0.5 : a) * 6);
  const fy = 1 + Math.round((b === undefined ? 0.5 : b) * 6);
  const phase = (c === undefined ? 0.5 : c) * Math.PI + t * 0.13 + r * 6.283;
  const wob = 0.05 + r * 0.06;
  const N = 720;
  const out = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const g = 0.8 + wob * Math.sin(3 * th + t * 0.4);
    out[i * 2] = Math.sin(fx * th + phase) * g;
    out[i * 2 + 1] = Math.sin(fy * th) * g;
  }
  return out;
}

// Phase-space embedding for mono sources: x = s[i], y = s[i + delay]. Any
// periodic signal draws a closed organic figure this way.
export function delayEmbed(mono, delaySamples, stride) {
  const d = Math.max(1, delaySamples | 0);
  const st = Math.max(1, stride | 0);
  const n = Math.floor((mono.length - d) / st);
  const out = new Float32Array(Math.max(0, n) * 2);
  for (let i = 0; i < n; i++) {
    out[i * 2] = Math.max(-1, Math.min(1, mono[i * st] * 1.6));
    out[i * 2 + 1] = Math.max(-1, Math.min(1, mono[i * st + d] * 1.6));
  }
  return out;
}

// Trace the path at constant speed for the given duration: arc-length
// parameterization, so the audio spends equal time per unit of drawn line
// and the figure loops (last sample meets the first).
export function pathToStereo(points, sampleRate, seconds) {
  const n = points.length / 2;
  const total = Math.max(8, Math.round(sampleRate * seconds));
  const left = new Float32Array(total), right = new Float32Array(total);
  if (n < 2) return { left, right };
  const cum = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j * 2] - points[i * 2], dy = points[j * 2 + 1] - points[i * 2 + 1];
    cum[i + 1] = cum[i] + Math.hypot(dx, dy);
  }
  const len = cum[n] || 1;
  let seg = 0;
  for (let k = 0; k < total; k++) {
    const target = (k / total) * len;
    while (seg < n - 1 && cum[seg + 1] < target) seg++;
    const span = cum[seg + 1] - cum[seg] || 1;
    const f = (target - cum[seg]) / span;
    const j = (seg + 1) % n;
    left[k] = Math.max(-1, Math.min(1, points[seg * 2] + (points[j * 2] - points[seg * 2]) * f));
    right[k] = Math.max(-1, Math.min(1, points[seg * 2 + 1] + (points[j * 2 + 1] - points[seg * 2 + 1]) * f));
  }
  return { left, right };
}

// Persistence: multiply the buffer toward black. decay 0 keeps everything,
// 1 clears in one frame; the pixel after n frames is v*(1-decay)^n.
export function fadeTrace(ctx, w, h, decay) {
  const d = Math.max(0, Math.min(1, decay === undefined ? 0.08 : decay));
  if (d <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,6,5," + d.toFixed(3) + ")";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// The beam: additive segments, alpha from the dwell-time law (inverse segment
// length), width eased down as speed rises, a wide soft pass under a tight
// bright core. Default phosphor is the P31 class green.
export function drawTrace(ctx, points, w, h, opts = {}) {
  const n = points.length / 2;
  if (n < 2) return;
  const beam = opts.beam === undefined ? 1 : opts.beam;
  const color = opts.color || "64,255,140";
  const sx = (x) => (x * 0.5 + 0.5) * w;
  const sy = (y) => (0.5 - y * 0.5) * h;
  const base = Math.max(1.1, h / 240);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let pass = 0; pass < 2; pass++) {
    const wide = pass === 0;
    for (let i = 0; i < n - 1; i++) {
      const x0 = points[i * 2], y0 = points[i * 2 + 1];
      const x1 = points[i * 2 + 2], y1 = points[i * 2 + 3];
      const l = Math.hypot(x1 - x0, y1 - y0) + 1e-5;
      const dwell = Math.min(1, 0.011 / l);
      const alpha = (wide ? 0.16 : 0.5) * dwell * beam;
      if (alpha < 0.004) continue;
      ctx.strokeStyle = "rgba(" + color + "," + alpha.toFixed(3) + ")";
      ctx.lineWidth = (wide ? 5.2 : 1.4) * base * (0.6 + 1.2 / (1 + l * 90));
      ctx.beginPath();
      ctx.moveTo(sx(x0), sy(y0));
      ctx.lineTo(sx(x1), sy(y1));
      ctx.stroke();
    }
  }
  ctx.restore();
}
