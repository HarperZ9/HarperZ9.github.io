// loudness.mjs: ITU-R BS.1770-4 integrated loudness and a 4x true-peak estimate, pure (node and browser).
// QUALITY-SPEC O3: masters at -14 LUFS integrated, true peak at most -1 dBTP with the ceiling at -1.6.
//
//   integratedLufs(channels, sampleRate)  -> LUFS (gated: 400 ms blocks, 75% overlap, -70 LUFS absolute gate,
//                                            -10 LU relative gate); -Infinity for silence
//   truePeakDb(channels)                  -> dBTP, 4x oversampled with a windowed-sinc interpolator
//   levelLufs(channels, sr, { target, ceilingDbtp }) -> gain applied in place, with the result it reached
//
// K-weighting: the two biquads of BS.1770 (high shelf, then high pass), derived for any sample rate from the
// analog prototypes the standard's 48 kHz coefficients come from (shelf f0 1681.97 Hz, gain 4.0 dB,
// Q 0.7072; high pass f0 38.135 Hz, Q 0.5003). Channel weights 1.0 (L, R, C).

function biquad(b, a) {
  return (x) => {
    const y = new Float64Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
}

export function kWeighting(sr) {
  // stage 1: high shelf
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / sr), Vh = 10 ** (G / 20), Vb = Vh ** 0.4996667741545416, a0 = 1 + K / Q + K * K;
  const shelf = biquad([(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0],
    [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]);
  // stage 2: high pass (RLB)
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / sr);
  const den = 1 + K / Q + K * K;
  const hp = biquad([1, -2, 1], [1, 2 * (K * K - 1) / den, (1 - K / Q + K * K) / den]);
  return (x) => hp(shelf(x));
}

export function integratedLufs(channels, sr) {
  const kw = kWeighting(sr), z = channels.map((c) => { const y = kw(c); for (let i = 0; i < y.length; i++) y[i] *= y[i]; return y; });
  const n = channels[0].length, block = Math.round(0.4 * sr), hop = Math.round(0.1 * sr);
  if (n < block) return -Infinity;
  // prefix sums so each block is O(1)
  const sums = z.map((y) => { const s = new Float64Array(y.length + 1); for (let i = 0; i < y.length; i++) s[i + 1] = s[i] + y[i]; return s; });
  const blocks = [];
  for (let s0 = 0; s0 + block <= n; s0 += hop) {
    let p = 0; for (const s of sums) p += (s[s0 + block] - s[s0]) / block;
    blocks.push(p);
  }
  const lk = (p) => -0.691 + 10 * Math.log10(p);
  const abs = blocks.filter((p) => p > 0 && lk(p) > -70);
  if (!abs.length) return -Infinity;
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((p) => lk(p) > rel);
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length);
}

// 4x oversampled peak: a 33-tap Hann-windowed sinc per phase, which tracks inter-sample peaks to about 0.1 dB.
const TAPS = 16, PH = 4, KERN = (() => {
  const k = [];
  for (let p = 1; p < PH; p++) {
    const f = p / PH, row = new Float64Array(2 * TAPS);
    for (let j = -TAPS + 1; j <= TAPS; j++) { const x = j - f, w = 0.5 + 0.5 * Math.cos(Math.PI * x / (TAPS + 1)); row[j + TAPS - 1] = (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; }
    k.push(row);
  }
  return k;
})();
export function truePeakDb(channels) {
  let peak = 0;
  for (const d of channels) {
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]); if (a > peak) peak = a;
      if (a < peak * 0.5) continue;                        // inter-sample overs only happen near large samples
      for (const row of KERN) {
        let s = 0;
        for (let j = -TAPS + 1; j <= TAPS; j++) { const k = i + j; if (k >= 0 && k < d.length) s += d[k] * row[j + TAPS - 1]; }
        if (Math.abs(s) > peak) peak = Math.abs(s);
      }
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

// Scale in place to the target loudness, unless that would push the true peak over the ceiling, in which
// case the ceiling sets the gain and the result says how far short the loudness fell.
export function levelLufs(channels, sr, { target = -14, ceilingDbtp = -1.6 } = {}) {
  const lufs = integratedLufs(channels, sr), tp = truePeakDb(channels);
  if (!Number.isFinite(lufs)) return { gain: 1, lufs, truePeak: tp, limitedBy: 'silence' };
  const gLoud = target - lufs, gPeak = ceilingDbtp - tp, gDb = Math.min(gLoud, gPeak), g = 10 ** (gDb / 20);
  for (const d of channels) for (let i = 0; i < d.length; i++) d[i] *= g;
  return { gain: g, lufs: lufs + gDb, truePeak: tp + gDb, limitedBy: gPeak < gLoud ? 'true-peak' : 'loudness' };
}
