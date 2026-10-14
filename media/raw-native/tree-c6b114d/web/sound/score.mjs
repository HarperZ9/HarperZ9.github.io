// SPDX-License-Identifier: FSL-1.1-MIT
// A generated score bed: one sustained chord per section of the film, cross-
// faded at section starts, with silences where the viewer is asked to think.
// The score marks structure (where a section begins, where to pause); it does
// not swell to sell a claim. Every sample is a pure function of its index, so
// playback can start anywhere and land on the offline render's samples.
//
//   sheet.score = { root_hz, sections: [{ at, chord: [semitones...] }], silences: [[a, b]...],
//                   fade: samples, end: samples }
import { rng as ssRng, substream } from "../../third_party/superstack/superstack.mjs";
import { sinCycles, rise } from "./dsp.mjs";

export class Score {
  constructor(spec, seed, rate, duration) {
    this.rate = rate;
    this.root = spec.root_hz || 73.416;
    this.fade = spec.fade ?? Math.round(1.5 * rate);
    this.silenceFade = spec.silence_fade ?? Math.round(0.4 * rate);
    this.end = spec.end ?? duration;
    this.silences = spec.silences || [];
    const secs = [...(spec.sections || [])].sort((a, b) => a.at - b.at);
    this.sections = secs.map((s, k) => {
      const r = ssRng(substream(seed, `score-${k}`));
      const notes = s.chord.map((semi, j) => {
        const f = this.root * Math.pow(2, semi / 12);
        const side = [0, 1].map(() => ({ det: 1 + (r.nextFloat() - 0.5) * 0.004, ph: r.nextFloat() }));
        return { f, side, lfoHz: 0.05 + 0.03 * j, lfoPh: r.nextFloat(), amp: 1 / (1 + j * 0.6) };
      });
      return { a: s.at, b: k + 1 < secs.length ? secs[k + 1].at : this.end, notes };
    });
  }

  // Gain for silences (predict beats) and the start and end of the film.
  shape(n) {
    let g = rise(n, Math.round(2 * this.rate)) * rise(this.end - n, Math.round(3 * this.rate));
    for (const [a, b] of this.silences) {
      if (n > a - this.silenceFade && n < b + this.silenceFade) g *= 1 - Math.min(rise(n - (a - this.silenceFade), this.silenceFade), rise(b + this.silenceFade - n, this.silenceFade));
    }
    return g;
  }

  // Adds the score at absolute sample n into out[0], out[1] (left, right).
  sample(n, out) {
    out[0] = 0; out[1] = 0;
    if (n < 0 || n >= this.end) return out;
    const shape = this.shape(n);
    if (shape <= 0) return out;
    const F = this.fade, t = n / this.rate;
    for (const s of this.sections) {
      if (n < s.a - F || n >= s.b + F) continue;
      const env = Math.min(1, Math.max(0, (n - s.a + F) / (2 * F))) * Math.min(1, Math.max(0, (s.b + F - n) / (2 * F)));
      if (env <= 0) continue;
      for (const v of s.notes) {
        const lfo = 1 + 0.25 * sinCycles(v.lfoHz * t + v.lfoPh);
        for (let c = 0; c < 2; c++) {
          const sd = v.side[c], cyc = v.f * sd.det * t + sd.ph;
          out[c] += env * v.amp * lfo * (sinCycles(cyc) + 0.25 * sinCycles(2 * cyc));
        }
      }
    }
    out[0] *= shape * 0.1; out[1] *= shape * 0.1;
    return out;
  }
}
