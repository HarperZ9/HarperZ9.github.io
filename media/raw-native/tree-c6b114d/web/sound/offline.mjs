// SPDX-License-Identifier: FSL-1.1-MIT
// Offline work on a sheet: resolve its levels, render it, measure it, and
// write a superstack receipt. Runs in Node (or any host with enough memory).
//
// resolve() turns a sheet's policy into explicit numbers, so the live player
// needs no measuring pass of its own:
//   music gain   the score's loudness sits `bed_lu` under the narration in the gaps
//   duck depth   the score sits `under_lu` under the narration while it speaks
//   sfx gain     a cue at 0 dB peaks `sfx_under_db` under the narration's sample peak
//   master gain  iterated until the mastered mix reads target_lufs on the meter
import * as ss from "../../third_party/superstack/superstack.mjs";
import { Mix } from "./mix.mjs";
import { integrated, measure, samplePeak, METER, TRUE_PEAK, TP_FIR_SOURCE } from "./meter.mjs";
import { interleaveS16, PRODUCER } from "./sheet.mjs";

export const POLICY = Object.freeze({ bed_lu: 12, under_lu: 18, sfx_under_db: 6, target_lufs: -16, ceiling_dbtp: -1.5, tolerance_lu: 0.1 });

const clone = (o) => JSON.parse(JSON.stringify(o));
const stereo = (mono) => [mono, mono];

export function resolve(sheet, narration, policy = {}) {
  const P = { ...POLICY, ...(sheet.policy || {}), ...policy };
  const s = clone(sheet), rate = s.rate;
  s.buses = s.buses || {};
  s.master = { class: "speech", ...(s.master || {}), target_lufs: P.target_lufs, ceiling_dbtp: P.ceiling_dbtp };
  const nar = narration.subarray(0, Math.min(narration.length, s.duration_samples));
  const Ln = integrated(stereo(nar), rate);
  if (Ln === null) throw new Error("resolve: the narration is silent or too short to measure");
  if (s.score) {
    const bare = clone(s); bare.buses = { music: { gain_db: 0, duck: { depth_db: 0 } } };
    const Ls = integrated(new Mix(bare, { solo: "music" }).renderAll(), rate);
    s.buses.music = { ...(s.buses.music || {}), gain_db: Ln - P.bed_lu - Ls, duck: { ...(s.buses.music?.duck || {}), depth_db: -(P.under_lu - P.bed_lu) } };
  }
  s.buses.dialog = { gain_db: 0, ...(s.buses.dialog || {}) };
  s.buses.sfx = { ...(s.buses.sfx || {}), gain_db: samplePeak([nar]) - P.sfx_under_db };
  // Loudness: the compressor and limiter are not linear, so iterate on the measured result.
  let g = s.master.gain_db ?? 0, L = null;
  for (let it = 0; it < 6; it++) {
    s.master.gain_db = g;
    L = integrated(new Mix(s, { narration }).renderAll(), rate);
    if (Math.abs(L - P.target_lufs) <= P.tolerance_lu / 2) break;
    g += P.target_lufs - L;
  }
  return { sheet: s, policy: P, narration_lufs: Ln };
}

// Loudness of a stem inside (or outside) the speech spans [[a, b] samples].
function spanLoudness(stem, spans, rate, inside = true) {
  const n = stem[0].length, keep = new Uint8Array(n);
  for (const [a, b] of spans) for (let i = Math.max(0, a); i < Math.min(n, b); i++) keep[i] = 1;
  const parts = [[], []];
  for (let i = 0; i < n; i++) if (keep[i] === (inside ? 1 : 0)) { parts[0].push(stem[0][i]); parts[1].push(stem[1][i]); }
  return integrated(parts.map((p) => Float64Array.from(p)), rate);
}

export function report(sheet, narration, mixLR, speechSpans = []) {
  const rate = sheet.rate, stems = {};
  for (const b of ["dialog", "music", "sfx"]) stems[b] = new Mix(sheet, { narration, solo: b }).renderAll();
  const m = measure(mixLR, rate);
  const d = (a, b) => (a === null || b === null ? null : a - b);
  const dIn = spanLoudness(stems.dialog, speechSpans, rate, true), mIn = sheet.score ? spanLoudness(stems.music, speechSpans, rate, true) : null;
  return {
    ...m,
    target_lufs: sheet.master.target_lufs, ceiling_dbtp: sheet.master.ceiling_dbtp, true_peak_filter: TP_FIR_SOURCE,
    loudness_verdict: ss.loudnessCheck(sheet.master.class || "speech", m.integrated_lufs, m.true_peak_dbtp),
    music_under_speech_lu: d(dIn, mIn),
    music_in_gaps_lufs: sheet.score ? spanLoudness(stems.music, speechSpans, rate, false) : null,
    sfx_peak_under_dialog_peak_db: d(samplePeak(stems.dialog), samplePeak(stems.sfx)),
    cues: (sheet.cues || []).length,
  };
}

export const DOES_NOT_PROVE = [
  "A matching PCM hash says nothing about how the sound is heard on a given device or whether it helps anyone learn.",
  "The narration is a voice model's output; the mix is reproducible from these narration bytes, not from the script.",
  "Loudness and true peak are this engine's meters (BS.1770-5 algorithms); a second meter is named in the report where one was run.",
];

export function receipt(sheet, mixLR, rep, { version = "0.1.0", narration = null } = {}) {
  const pcm = interleaveS16(mixLR);
  const media = {
    kind: "audio", content: "speech", rate: sheet.rate, channels: 2, format: "s16le", frames: mixLR[0].length,
    duration_flicks: mixLR[0].length * ss.flicksPerSample(sheet.rate), meter: METER, true_peak_meter: TRUE_PEAK,
    integrated_lufs: ss.round6(rep.integrated_lufs), peak_dbfs: ss.round6(rep.sample_peak_dbfs), true_peak_dbtp: ss.round6(rep.true_peak_dbtp),
    loudness_class: sheet.master.class || "speech", loudness_verdict: rep.loudness_verdict,
    access: { autoplay: false, captions: "vtt", transcript: true, reduced_sound: "silent" },
  };
  if (narration) media.narration = narration;
  const rec = ss.makeReceipt({ producer: PRODUCER, version, backend: "js-f64", scene: sheet, content: pcm, media,
    outputs: { "pcm.s16": ss.sha256(pcm) }, doesNotProve: DOES_NOT_PROVE });
  return { rec, pcm, errors: ss.verifyReceipt(rec) };
}
