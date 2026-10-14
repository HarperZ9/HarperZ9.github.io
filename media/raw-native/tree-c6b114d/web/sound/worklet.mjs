// SPDX-License-Identifier: FSL-1.1-MIT
// The live half of the sound engine: an AudioWorkletProcessor that runs the
// same Mix as the offline render, 128 samples at a time on the audio thread.
// WebAudio only carries the samples to the speakers; no browser filter,
// compressor or panner touches them, so the live output reconciles with the
// offline reference (docs/sound/DESIGN.md, "Live and offline").
//
// Messages in:  { seek: sample }  { playing: bool }
// Messages out: { at: sample } about ten times a second while playing
import { Mix } from "./mix.mjs";

class RawSound extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { sheet, narration, start = 0, playing = true } = options.processorOptions;
    this.mix = new Mix(sheet, { narration });
    if (start) this.mix.seek(start);
    this.playing = playing;
    this.blocks = 0;
    this.spare = null;
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (typeof m.seek === "number") this.mix.seek(m.seek);
      if (typeof m.playing === "boolean") this.playing = m.playing;
    };
  }
  process(inputs, outputs) {
    const out = outputs[0], L = out[0];
    let R = out[1];
    if (!R) { if (!this.spare || this.spare.length !== L.length) this.spare = new Float32Array(L.length); R = this.spare; }
    if (!this.playing) { L.fill(0); R.fill(0); return true; }
    this.mix.process(L, R, L.length);
    if (++this.blocks % 37 === 0) this.port.postMessage({ at: this.mix.out });
    return true;
  }
}

registerProcessor("raw-sound", RawSound);
