// SPDX-License-Identifier: FSL-1.1-MIT
// The superstack.sound/1 example scene through the mixer. The contract's
// example instrument (sine voices with linear envelopes, summed in score order,
// then a master gain) becomes a sheet of exact notes on the music bus with the
// EQ, compressor and limiter bypassed, so the mixer's own summing and gain
// stages must reproduce the contract's reference PCM bit for bit.
import { rng } from "../../third_party/superstack/superstack.mjs";
import { Mix } from "./mix.mjs";

export function sheetFromContract(scene) {
  const r = rng(scene.seed), scale = scene.scale_hz;
  const notes = Array.from({ length: scene.voices }, (_, i) => ({
    start: i * scene.step_samples, freq: scale[Math.floor(r.nextFloat() * scale.length)],
    length: scene.note_samples, attack: scene.attack_samples, release: scene.release_samples, gain: scene.voice_gain }));
  return {
    kind: "superstack.sound/1", seed: scene.seed, rate: scene.rate, channels: 2, duration_samples: scene.duration_samples,
    notes, buses: {}, master: { eq: [], comp: null, limiter: null, gain_linear: scene.master_gain },
  };
}

// Mono float64 samples of the contract scene, rendered by the mixer.
export function renderContract(scene, block = 4096) {
  const [L] = new Mix(sheetFromContract(scene)).renderAll(block);
  return L;
}
