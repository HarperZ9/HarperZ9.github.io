// SPDX-License-Identifier: FSL-1.1-MIT
// The mastering chain: EQ, a gentle compressor and a true-peak limiter, all
// stateful and stepped one stereo sample at a time, so offline and live run
// the same arithmetic in the same order.
//
//   EQ          RBJ biquads per channel (dsp.mjs)
//   Compressor  feed-forward, stereo-linked, log-domain gain computer with a
//               soft knee and smooth branching attack/release (Giannoulis,
//               Massberg and Reiss 2012, JAES 60(6))
//   Limiter     lookahead gain from 4x-interpolated peaks (the TP_FIR
//               interpolator), a sliding minimum then a box average so the gain
//               is down before the peak arrives, and a one-pole release
import { Biquad, biquadCoefs, coef, undb } from "./dsp.mjs";
import { TP_FIR } from "./truepeak-fir.mjs";

export class Eq {
  constructor(bands = [], rate) {
    this.ch = [0, 1].map(() => bands.map((b) => new Biquad(biquadCoefs(b.type, b.f, b.q ?? Math.SQRT1_2, b.gain_db ?? 0, rate))));
  }
  step(io) {
    for (let c = 0; c < 2; c++) for (const f of this.ch[c]) io[c] = f.step(io[c]);
    return io;
  }
}

export class Compressor {
  constructor({ threshold_db = -18, ratio = 2, knee_db = 6, attack_ms = 10, release_ms = 200 } = {}, rate) {
    Object.assign(this, { T: threshold_db, R: ratio, W: knee_db });
    this.aA = coef(attack_ms / 1000, rate); this.aR = coef(release_ms / 1000, rate);
    this.y = 0; // smoothed gain reduction in dB (>= 0)
  }
  curve(xdb) {
    const { T, R, W } = this, d = xdb - T;
    if (2 * d < -W) return 0;
    if (2 * Math.abs(d) <= W) return ((1 / R - 1) * (d + W / 2) ** 2) / (2 * W) * -1;
    return d * (1 - 1 / R);
  }
  step(io) {
    const lv = Math.max(Math.abs(io[0]), Math.abs(io[1]));
    const xdb = lv > 1e-9 ? 20 * Math.log10(lv) : -180;
    const gr = this.curve(xdb);
    this.y = gr > this.y ? this.aA * this.y + (1 - this.aA) * gr : this.aR * this.y + (1 - this.aR) * gr;
    const g = undb(-this.y);
    io[0] *= g; io[1] *= g;
    return io;
  }
}

// A fixed-size ring of numbers.
class Ring {
  constructor(n) { this.b = new Float64Array(n); this.n = n; this.i = 0; }
  push(v) { this.b[this.i] = v; this.i = (this.i + 1) % this.n; }
  ago(k) { return this.b[(this.i - 1 - k + this.n * 2) % this.n]; } // k = 0 is the newest
}

export class Limiter {
  // window: samples of attack; the delay is window + 10, which covers the
  // interpolator's 12 taps (see the derivation in docs/sound/DESIGN.md).
  constructor({ ceiling_dbtp = -1.5, margin_db = 0.3, window = 96, release_ms = 80 } = {}, rate) {
    this.c = undb(ceiling_dbtp - margin_db);
    this.W = window; this.M = window + 11; this.D = window + 10;
    this.rel = coef(release_ms / 1000, rate);
    this.taps = TP_FIR.length / 4;
    this.hist = [new Ring(this.taps), new Ring(this.taps)];
    this.delay = [new Ring(this.D + 1), new Ring(this.D + 1)];
    // Sliding minimum over M samples: a monotonic deque of [index, value].
    this.dq = []; this.k = 0;
    this.box = new Ring(this.W); this.boxSum = this.W; for (let i = 0; i < this.W; i++) this.box.push(1);
    this.r = 1;
    this.gainMin = 1; // smallest gain applied, for the report
  }
  peakAt() {
    let p = 0;
    for (let c = 0; c < 2; c++) {
      const h = this.hist[c];
      const a0 = Math.abs(h.ago(0));
      if (a0 > p) p = a0;
      for (let ph = 0; ph < 4; ph++) {
        let acc = 0;
        for (let k = 0; k < this.taps; k++) acc += TP_FIR[ph + 4 * k] * h.ago(k);
        const a = Math.abs(acc);
        if (a > p) p = a;
      }
    }
    return p;
  }
  // Push one stereo sample; io receives the sample from D steps ago, limited.
  step(io) {
    for (let c = 0; c < 2; c++) { this.hist[c].push(io[c]); this.delay[c].push(io[c]); }
    const p = this.peakAt(), g = p > this.c ? this.c / p : 1;
    const dq = this.dq, k = this.k++;
    while (dq.length && dq[dq.length - 1][1] >= g) dq.pop();
    dq.push([k, g]);
    while (dq[0][0] <= k - this.M) dq.shift();
    const h = dq[0][1];
    this.boxSum += h - this.box.ago(this.W - 1);
    this.box.push(h);
    const a = this.boxSum / this.W;
    this.r = a < this.r ? a : this.rel * this.r + (1 - this.rel) * a;
    if (this.r < this.gainMin) this.gainMin = this.r;
    io[0] = this.delay[0].ago(this.D) * this.r;
    io[1] = this.delay[1].ago(this.D) * this.r;
    return io;
  }
}

// The whole chain. `gain_db` is the static loudness gain the offline
// normaliser solved for; it is part of the sheet, so the live path uses it too.
export class Master {
  constructor(spec = {}, rate) {
    this.eq = new Eq(spec.eq || [], rate);
    this.comp = spec.comp === null ? null : new Compressor(spec.comp || {}, rate);
    this.g = spec.gain_linear ?? undb(spec.gain_db || 0);
    this.lim = spec.limiter === null ? null : new Limiter({ ceiling_dbtp: spec.ceiling_dbtp ?? -1.5, ...(spec.limiter || {}) }, rate);
    this.latency = this.lim ? this.lim.D : 0;
  }
  step(io) {
    this.eq.step(io);
    if (this.comp) this.comp.step(io);
    io[0] *= this.g; io[1] *= this.g;
    if (this.lim) this.lim.step(io);
    return io;
  }
}
