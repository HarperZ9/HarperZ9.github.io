// SPDX-License-Identifier: FSL-1.1-MIT
// Test fixtures: a 10 s speech-like signal (seeded noise in syllables, shaped
// toward the voice band, with two sentences and pauses) and a sheet that uses
// every cue type, the score and the ducker. Used by sound.test.mjs and the CI
// smoke render; no recorded voice is needed.
import { rng } from "../../third_party/superstack/superstack.mjs";
import { Biquad, biquadCoefs } from "./dsp.mjs";

const R = 48000;

export function speechLike(seconds = 10, seed = "fixture/speech") {
  const r = rng(seed), n = seconds * R, x = new Float32Array(n);
  const bp = new Biquad(biquadCoefs("bandpass", 700, 0.7, 0, R)), hs = new Biquad(biquadCoefs("peaking", 2500, 1, 6, R));
  const spans = [[1, 4], [6, 9]];
  for (let i = 0; i < n; i++) {
    const t = i / R, on = spans.some(([a, b]) => t >= a && t < b);
    const syl = Math.max(0, Math.sin(2 * Math.PI * 4.3 * t)) ** 2;
    const v = hs.step(bp.step(r.nextFloat() * 2 - 1)) * (on ? syl : 0) * 0.9;
    x[i] = Math.round(Math.max(-1, Math.min(1, v)) * 32767) / 32768; // s16-exact, as a WAV gives it
  }
  return x;
}

export function testSheet() {
  const S = (t) => Math.round(t * R);
  const kinds = [["land", 1.2], ["reveal", 2.0], ["count", 3.0, { from: 1, to: 1e6, dur: 1 }], ["move", 4.5, { x: 300, x1: 1600 }],
    ["scale", 5.0, { dur: 2 }], ["texture", 6.2, { n: 636 }], ["chapter", 7.0], ["recall", 8.4], ["motif", 9.0, { x: 1500 }]];
  return {
    kind: "superstack.sound/1", seed: "fixture/sheet", rate: R, channels: 2, duration_samples: S(10),
    design: [1920, 1080],
    score: { root_hz: 73.416, sections: [{ at: 0, chord: [0, 7, 12, 17] }, { at: S(5), chord: [-4, 3, 8, 12] }], silences: [[S(8), S(8.9)]] },
    cues: kinds.map(([type, t, o]) => ({ at: S(t), type, why: `fixture ${type}`, x: 960, gain_db: -8, ...(o || {}) })),
    buses: { music: { duck: {} } },
    master: { eq: [{ type: "highpass", f: 30 }], comp: {} },
  };
}
