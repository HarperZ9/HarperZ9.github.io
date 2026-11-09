// Lookahead true-peak limiter as an AudioWorklet, plus a DC blocker. Own code, no dependency.
// Design: the audio is delayed by L samples. A gain curve is built from the interpolated (inter-sample) peak of the
// incoming signal: r[n] = ceiling / peak[n] when peak is over the ceiling, else 1. A sliding minimum over the last L+1
// values, a release limiter (fast down, slow up), then a moving average over L+1 values gives the gain for the sample that
// is now leaving the delay. Every term in that average is at or below the gain that sample needs, so the ceiling holds.
// Inter-sample peaks come from 4-point Catmull-Rom interpolation at 1/4, 1/2 and 3/4 between samples (a 4x estimate).
export const LIMITER_SOURCE = `
class TPLimiter extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [
    { name: 'ceiling', defaultValue: 0.8609, minValue: 0.1, maxValue: 1 },
    { name: 'release', defaultValue: 0.08, minValue: 0.005, maxValue: 1 }]; }
  constructor() {
    super(); this.L = Math.max(16, Math.round(sampleRate * 0.0020)); this.N = this.L + 1;
    this.dl = [new Float32Array(this.N + 4), new Float32Array(this.N + 4)]; this.w = 0;      // audio delay lines
    this.hist = [new Float32Array(4), new Float32Array(4)];                                   // last 4 samples per channel
    this.r = new Float32Array(this.N); this.m = new Float32Array(this.N);                   // raw gain, minimum-filtered gain history
    this.rel = 1; this.i = 0; this.sum = 0; this.mfill = 0;
  }
  peakAt(h) { // h = [x0,x1,x2,x3], interpolate between x1 and x2
    const a = h[0], b = h[1], c = h[2], d = h[3]; let p = Math.max(Math.abs(b), Math.abs(c));
    for (let k = 1; k <= 3; k++) { const t = k / 4, t2 = t * t, t3 = t2 * t;
      const v = 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); const q = Math.abs(v); if (q > p) p = q; }
    return p;
  }
  process(inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0]; if (!inp || !inp.length) return true;
    const nch = Math.min(inp.length, 2), ceil = params.ceiling[0], relC = 1 - Math.exp(-1 / (sampleRate * params.release[0])), N = this.N;
    for (let n = 0; n < inp[0].length; n++) {
      let pk = 0;
      for (let c = 0; c < nch; c++) { const h = this.hist[c]; h[0] = h[1]; h[1] = h[2]; h[2] = h[3]; h[3] = inp[c][n]; const p = this.peakAt(h); if (p > pk) pk = p; }
      const r = pk > ceil ? ceil / pk : 1, i = this.i;
      this.r[i] = r; let mn = r; for (let k = 1; k < N; k++) { const v = this.r[(i - k + N) % N]; if (v < mn) mn = v; }
      this.rel = Math.min(mn, this.rel + (1 - this.rel) * relC);
      this.sum += this.rel - this.m[i]; this.m[i] = this.rel;
      const g = Math.min(this.sum / N, 1);
      for (let c = 0; c < out.length; c++) {
        const s = c < nch ? inp[c][n] : 0, dl = this.dl[Math.min(c, 1)], len = dl.length;
        dl[this.w % len] = s; const d = dl[(this.w - this.N - 1 + len * 4) % len]; // delay of N+1 samples: interpolation lookahead plus the window
        out[c][n] = d * g;
      }
      this.w++; this.i = (i + 1) % N;
    }
    return true;
  }
}
registerProcessor('anvil-tp-limiter', TPLimiter);
class DCBlock extends AudioWorkletProcessor {
  constructor() { super(); this.x = [0, 0]; this.y = [0, 0]; this.a = 1 - 2 * Math.PI * 5 / sampleRate; }
  process(inputs, outputs) {
    const i = inputs[0], o = outputs[0]; if (!i || !i.length) return true;
    for (let c = 0; c < o.length; c++) { const s = i[Math.min(c, i.length - 1)], d = o[c], k = Math.min(c, 1);
      for (let n = 0; n < s.length; n++) { const y = s[n] - this.x[k] + this.a * this.y[k]; this.x[k] = s[n]; this.y[k] = y; d[n] = y; } }
    return true;
  }
}
registerProcessor('anvil-dc-block', DCBlock);`;

// Latency of the limiter in seconds (for sync decisions). The delay is N+1 samples.
export const limiterLatency = (sr) => (Math.max(16, Math.round(sr * 0.002)) + 2) / sr;
