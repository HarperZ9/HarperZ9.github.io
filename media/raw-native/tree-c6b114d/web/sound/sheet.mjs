// SPDX-License-Identifier: FSL-1.1-MIT
// The sound sheet: a superstack.sound/1 scene that a mix is rendered from.
//
//   { kind: "superstack.sound/1", seed, rate: 48000, channels: 2, duration_samples,
//     producer: "raw-native-sound/1", design: [1920, 1080],
//     narration: { src, sha256 },                  // mono s16 WAV at `rate`
//     score: { root_hz, sections: [{ at, chord }], silences: [[a, b]] },
//     cues: [{ at, type, x, x1?, gain_db, why, ... }],   // `why` says what the cue marks
//     buses: { dialog: { gain_db }, music: { gain_db, duck: {...} }, sfx: { gain_db } },
//     master: { eq, comp, gain_db, ceiling_dbtp, target_lufs, class } }
//
// All times are integer samples. `cueAt(seconds)` rounds once, so a cue on a
// 30 fps frame boundary lands on its exact sample (1,600 samples per frame).
import { validateScene } from "../../third_party/superstack/superstack.mjs";
import { CUE_TYPES } from "./cues.mjs";

export const PRODUCER = "raw-native-sound/1";
export const toSamples = (seconds, rate = 48000) => Math.round(seconds * rate);

export function validateSheet(s) {
  const errs = [...validateScene(s)];
  if (s.kind !== "superstack.sound/1") errs.push("kind");
  if (s.channels !== 2) errs.push("channels: the mixer writes stereo");
  if (s.rate !== 48000) errs.push("rate: the mixer runs at 48000 Hz");
  for (const [i, c] of (s.cues || []).entries()) {
    if (!CUE_TYPES.includes(c.type)) errs.push(`cues[${i}].type`);
    if (!Number.isInteger(c.at) || c.at < 0 || c.at >= s.duration_samples) errs.push(`cues[${i}].at`);
    if (typeof c.why !== "string" || !c.why) errs.push(`cues[${i}].why: every cue says what it marks`);
  }
  for (const [i, sec] of (s.score?.sections || []).entries()) if (!Number.isInteger(sec.at) || !Array.isArray(sec.chord)) errs.push(`score.sections[${i}]`);
  return errs;
}

// Minimal WAV reader: PCM s16 or float32, any channel count; returns floats per channel.
// s16 maps v -> v / 32768, which is exact in float32, so both hosts read the same values.
export function readWav(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("wav: not RIFF/WAVE");
  let o = 12, fmt = null;
  while (o + 8 <= bytes.length) {
    const id = tag(o), len = dv.getUint32(o + 4, true), body = o + 8;
    if (id === "fmt ") fmt = { format: dv.getUint16(body, true), channels: dv.getUint16(body + 2, true), rate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
    if (id === "data") {
      if (!fmt) throw new Error("wav: data before fmt");
      const { channels, bits, format } = fmt, bps = bits / 8, frames = Math.floor(len / (bps * channels));
      const ch = Array.from({ length: channels }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) {
        const p = body + (i * channels + c) * bps;
        ch[c][i] = format === 3 && bits === 32 ? dv.getFloat32(p, true) : bits === 16 ? dv.getInt16(p, true) / 32768 : NaN;
      }
      if (Number.isNaN(ch[0][0])) throw new Error(`wav: unsupported format ${format}/${bits}`);
      return { rate: fmt.rate, channels: ch };
    }
    o = body + len + (len & 1);
  }
  throw new Error("wav: no data chunk");
}

// Interleave [L, R] floats into canonical s16le (superstack SPEC 8.1 quantizer).
export function interleaveS16([L, R]) {
  const out = new Uint8Array(L.length * 4), dv = new DataView(out.buffer);
  for (let i = 0; i < L.length; i++) {
    for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, (c ? R : L)[i]));
      dv.setInt16(i * 4 + c * 2, Math.floor(v * 32767 + 0.5), true);
    }
  }
  return out;
}
