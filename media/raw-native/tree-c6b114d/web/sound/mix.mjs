// SPDX-License-Identifier: FSL-1.1-MIT
// The mixer: a sound sheet in, stereo samples out, one sample at a time.
//
// Sources are pure functions of the absolute sample index (narration buffer,
// score, cue buffers placed at their sample). Everything with memory (the
// ducker, EQ, compressor, limiter) steps in index order. Offline rendering and
// the live AudioWorklet call the same `process`, so they make the same samples;
// block size does not change the result.
//
//   const mix = new Mix(sheet, { narration });   // narration: Float32Array, mono
//   mix.process(left, right, 128);               // the next 128 samples
//   mix.seek(n);                                 // jump; state is rebuilt by a pre-roll
//
// Buses: dialog (the narration), music (the score), sfx (the cues). The music
// bus is ducked under the narration with a lookahead, so it is already down
// when the voice starts (docs/sound/DESIGN.md, "Ducking").
import { rng as ssRng, substream } from "../../third_party/superstack/superstack.mjs";
import { undb, coef, panGains, panOfX } from "./dsp.mjs";
import { synth } from "./cues.mjs";
import { Score } from "./score.mjs";
import { Master } from "./master.mjs";

export const PREROLL_S = 4;

class Ducker {
  constructor(spec = {}, rate) {
    this.depth = spec.depth_db ?? -6;
    this.thr = undb(spec.threshold_db ?? -45);
    this.look = Math.round(((spec.lookahead_ms ?? 150) * rate) / 1000);
    this.hold = Math.round(((spec.hold_ms ?? 350) * rate) / 1000);
    this.aA = coef((spec.attack_ms ?? 60) / 1000, rate);
    this.aR = coef((spec.release_ms ?? 700) / 1000, rate);
    this.reset();
  }
  reset() { this.h = 0; this.cur = 0; }
  // Gain for the music bus at index m, keyed from the narration at m + lookahead.
  step(narr, m) {
    const j = m + this.look, v = j >= 0 && j < narr.length ? Math.abs(narr[j]) : 0;
    if (v > this.thr) this.h = this.hold; else if (this.h > 0) this.h--;
    const target = this.h > 0 ? this.depth : 0;
    const a = target < this.cur ? this.aA : this.aR;
    this.cur = target + (this.cur - target) * a;
    return undb(this.cur);
  }
}

export class Mix {
  constructor(sheet, { narration = null, solo = null } = {}) {
    this.sheet = sheet;
    this.rate = sheet.rate;
    this.N = sheet.duration_samples;
    this.solo = solo; // null, "dialog", "music" or "sfx": render one bus (for stems), master bypassed
    const bus = sheet.buses || {};
    this.gD = undb(bus.dialog?.gain_db ?? 0);
    this.gM = undb(bus.music?.gain_db ?? -18);
    this.gS = undb(bus.sfx?.gain_db ?? 0);
    this.narr = narration || new Float32Array(0);
    this.score = sheet.score ? new Score(sheet.score, sheet.seed, this.rate, this.N) : null;
    this.duckSpec = bus.music?.duck || {};
    const W = sheet.design?.[0] || 1920;
    this.cues = (sheet.cues || []).map((c, i) => {
      const { mono, pan } = synth(c, ssRng(substream(sheet.seed, `cue-${i}`)), this.rate, W);
      const g = undb(c.gain_db ?? 0);
      const [l, r] = panGains(c.x === undefined ? 0 : panOfX(c.x, W, c.width ?? 0.6));
      return { at: c.at, end: c.at + mono.length, mono, pan, g, l, r };
    }).sort((a, b) => a.at - b.at || a.end - b.end);
    // Exact notes (the superstack.sound/1 example instrument): Math.sin, linear envelope, in sheet order.
    this.notes = (sheet.notes || []).map((n) => ({ ...n, w: (2 * Math.PI * n.freq) / this.rate }));
    this.io = [0, 0]; this.sm = [0, 0];
    this.seek(0);
  }

  // Rebuild all state and continue from output sample n. State before n is
  // replayed from n - PREROLL_S seconds (or from 0), so a seek lands within the
  // stated tolerance of the uninterrupted render, and exactly on it at n = 0.
  seek(n) {
    this.out = Math.max(0, Math.min(this.N, n));
    this.duck = new Ducker(this.duckSpec, this.rate);
    this.master = this.solo ? null : new Master(this.sheet.master || {}, this.rate);
    const lat = this.master ? this.master.latency : 0;
    const start = Math.max(0, this.out - Math.round(PREROLL_S * this.rate));
    this.m = start;
    this.ci = 0; this.active = [];
    for (let k = 0; k < (this.out - start) + lat; k++) this.step();
  }

  // The pre-master sum at internal index this.m, pushed through the master;
  // returns the stereo sample that leaves the chain (latency samples behind).
  step() {
    const m = this.m++, io = this.io, solo = this.solo;
    io[0] = 0; io[1] = 0;
    if (m < this.N) {
      if (!solo || solo === "dialog") {
        const d = m < this.narr.length ? this.narr[m] * this.gD : 0;
        io[0] += d; io[1] += d;
      }
      const dg = this.duck.step(this.narr, m);
      if (this.score && (!solo || solo === "music")) {
        const s = this.score.sample(m, this.sm), g = this.gM * dg;
        io[0] += s[0] * g; io[1] += s[1] * g;
      }
      if (!solo || solo === "sfx") this.addCues(m, io);
      if (this.notes.length && (!solo || solo === "music")) this.addNotes(m, io);
    }
    return this.master ? this.master.step(io) : io;
  }

  addCues(m, io) {
    const cs = this.cues;
    while (this.ci < cs.length && cs[this.ci].at <= m) { if (cs[this.ci].end > m) this.active.push(cs[this.ci]); this.ci++; }
    if (!this.active.length) return;
    let keep = 0;
    for (let a = 0; a < this.active.length; a++) {
      const c = this.active[a], k = m - c.at;
      if (k >= c.mono.length) continue;
      const v = c.mono[k] * c.g * this.gS * 1;
      if (c.pan) { const [l, r] = panGains(c.pan[k]); io[0] += v * l; io[1] += v * r; } else { io[0] += v * c.l; io[1] += v * c.r; }
      this.active[keep++] = c;
    }
    this.active.length = keep;
  }

  addNotes(m, io) {
    let v = io[0];
    for (const n of this.notes) {
      const k = m - n.start;
      if (k < 0 || k >= n.length) continue;
      const e = k < n.attack ? (n.gain * k) / n.attack : k < n.length - n.release ? n.gain : (n.gain * (n.length - k)) / n.release;
      v += e * Math.sin(n.w * k);
    }
    io[0] = v; io[1] = v;
  }

  // Fill left/right (Float32Array or Float64Array) with the next `count` samples.
  process(left, right, count = left.length) {
    for (let i = 0; i < count; i++) {
      if (this.out >= this.N) { left[i] = 0; right[i] = 0; continue; }
      const o = this.step();
      left[i] = o[0]; right[i] = o[1];
      this.out++;
    }
    return count;
  }

  // The whole sheet, offline: [left, right] Float64Arrays.
  renderAll(block = 4096) {
    this.seek(0);
    const L = new Float64Array(this.N), R = new Float64Array(this.N);
    for (let i = 0; i < this.N; i += block) {
      const n = Math.min(block, this.N - i);
      this.process(L.subarray(i, i + n), R.subarray(i, i + n), n);
    }
    return [L, R];
  }
}
