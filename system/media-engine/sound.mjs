// system/media-engine/sound.mjs
// The engine's sound layer, on the superstack contract (contracts.mjs, section 8 of its SPEC).
//
// Every sound the site makes from its own material is a `superstack.sound/1` scene. An offline
// renderer computes every sample of it in float64 and quantizes once to s16le PCM; that PCM is
// the reference, and its SHA-256 is the receipt's content hash. WebAudio is only ever the live
// path: it plays the reference's samples, and reconcileLive() renders the same graph through an
// OfflineAudioContext and holds what came out against the reference (byte identity, and the
// contract's tolerance of 2 LSB and 60 dB SNR). WebAudio is never the reference.
//
// Four producers: the Seed sound (seed), the Music source's built-in synth (music), the picture
// and cloth scan that plays the Loom's woven rows and the Retro picture as notes (scan), and the
// Retro audio scope's drawn figure (figure). Time is in samples at a rate from the contract's set,
// so every duration is a whole number of flicks.
//
// Access rules (SPEC 8.5): nothing here starts without a call from a user gesture, reducedSound()
// is the site's reduced-sound mode (reduced motion asked for, or the sound preference off), and
// loudness is measured with the contract's BS.1770 meter and normalised to the class target:
// music -14 LUFS, interactive at most -18 LUFS, speech -16 LUFS (narration lives in the explainer
// tool).

import {
  FLICKS_PER_SECOND, quantizeS16, integratedLufs, peakDbfs, loudnessCheck, LOUDNESS_TARGETS, METER,
  reconcilePcmS16, makeReceipt, sha256, verifyReceipt, wavS16, flicksPerSample,
} from "./contracts.mjs";
import { seedComposition, seedSoundSamples } from "../audio.js";

export const SOUND_RATE = 48000;
export const REFERENCE_BACKEND = "js-f64-offline";
export const SOUND_PREF_KEY = "harperz9.sound";
const VERSION = "1.0.0";

// ---------------------------------------------------------------- reduced sound

// Reduced sound mirrors reduced motion: ambient and reactive sound does not start when the reader
// asked for reduced motion or turned the site's sound preference off. A sound the reader starts
// with a play button still plays; it is theirs.
export function reducedSound() {
  try { if (globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) return true; } catch (_) { /* no media queries here */ }
  try { return globalThis.localStorage && globalThis.localStorage.getItem(SOUND_PREF_KEY) === "off"; } catch (_) { return false; }
}
export function setSoundPreference(on) {
  try { globalThis.localStorage.setItem(SOUND_PREF_KEY, on ? "on" : "off"); } catch (_) { /* storage blocked: the default stands */ }
}
export function soundPreferenceOff() {
  try { return globalThis.localStorage.getItem(SOUND_PREF_KEY) === "off"; } catch (_) { return false; }
}

// ---------------------------------------------------------------- scenes

const base = (producer, rest) => ({ kind: "superstack.sound/1", producer, rate: SOUND_RATE, ...rest });

export function seedScene(seed) {
  const comp = seedComposition(seed);
  const total = comp.steps * (60 / comp.bpm / 2) + 0.7;
  return base("seed", { seed: String(seed), channels: 1, duration_samples: Math.max(1, Math.ceil(total * SOUND_RATE)), loudness_class: "music" });
}

// The Music source's built-in chord: a band-limited sawtooth at 110 Hz with a 6 Hz vibrato, a sine
// at 165 Hz and a band-limited triangle at 220 Hz, mixed at 0.22. The vibrato runs at 0.2 Hz (it
// was 0.17 Hz in the WebAudio version) so a 5 s loop closes on whole cycles of every voice.
export function musicScene() {
  return base("music", { channels: 1, duration_samples: 5 * SOUND_RATE, loudness_class: "music",
    voices: [{ wave: "sawtooth", hz: 110, vibrato_hz: 0.2, vibrato_depth_hz: 6 }, { wave: "sine", hz: 165 }, { wave: "triangle", hz: 220 }], mix: 0.22 });
}

// A picture or a woven cloth as a score: rows are pitches, columns are time, brightness is gain.
// grid holds 0..255 levels (row 0 at the top), freqs one frequency per row. Each column sets every
// row's gain toward level^1.5 with a time constant of 0.45 columns, as the ANS bank did.
export function scanScene(scan, freqs, seconds = 9, { label = "scan" } = {}) {
  const rows = scan.rows, cols = scan.cols;
  const grid = Array.from(scan.grid, (v) => Math.max(0, Math.min(255, Math.round(v * 255))));
  const colSamples = Math.max(1, Math.round((Math.max(2, seconds) * SOUND_RATE) / cols));
  const start = Math.round(0.08 * SOUND_RATE), release = Math.round(0.4 * SOUND_RATE);
  return base("scan", { label, channels: 1, rows, cols, grid, freqs: Array.from(freqs, (f) => +f),
    start_samples: start, col_samples: colSamples, release_samples: release,
    duration_samples: start + cols * colSamples + release, loudness_class: "music" });
}

// A drawn figure as an oscilloscope loop: x on the left channel, y on the right, retraced hz times
// a second at constant speed along the path. Points are kept to four decimals in the scene.
export function figureScene(points, hz) {
  const pts = Array.from(points, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 10000));
  return base("figure", { channels: 2, points_e4: pts, hz: +hz, gain: 0.2,
    duration_samples: Math.max(8, Math.round(SOUND_RATE / hz)), loudness_class: "interactive" });
}

// ---------------------------------------------------------------- reference renderers

function renderSeed(scene) {
  const x = seedSoundSamples(scene.seed, scene.rate);
  return x.length === scene.duration_samples ? x : Float64Array.from({ length: scene.duration_samples }, (_, i) => x[i] || 0);
}

// Band-limited partial sums, every partial below Nyquist, by the sine recurrence
// sin(k p) = 2 cos(p) sin((k-1) p) - sin((k-2) p).
function bandLimited(wave, phase, maxK) {
  const c2 = 2 * Math.cos(phase);
  let s1 = Math.sin(phase), s0 = 0, acc = 0;
  for (let k = 1; k <= maxK; k++) {
    if (wave === "sawtooth") acc += ((k & 1) ? 1 : -1) * s1 / k;
    else if (k & 1) acc += (((k - 1) / 2) & 1 ? -1 : 1) * s1 / (k * k);
    const next = c2 * s1 - s0; s0 = s1; s1 = next;
  }
  return wave === "sawtooth" ? (2 / Math.PI) * acc : (8 / (Math.PI * Math.PI)) * acc;
}

function renderMusic(scene) {
  const n = scene.duration_samples, r = scene.rate, out = new Float64Array(n);
  for (const v of scene.voices) {
    const top = v.hz + (v.vibrato_depth_hz || 0);
    const maxK = Math.max(1, Math.floor((r / 2) / top));
    for (let i = 0; i < n; i++) {
      const t = i / r;
      let ph = 2 * Math.PI * v.hz * t;
      if (v.vibrato_hz) ph += (v.vibrato_depth_hz / v.vibrato_hz) * (1 - Math.cos(2 * Math.PI * v.vibrato_hz * t));
      out[i] += scene.mix * (v.wave === "sine" ? Math.sin(ph) : bandLimited(v.wave, ph, maxK));
    }
  }
  return out;
}

// Gain of one row per sample: setTargetAtTime toward level^1.5 at every column, then toward 0 with
// a 50 ms time constant at the end. Evaluated in closed form per segment.
function rowGains(scene, r, out) {
  const { cols, grid, start_samples: s0, col_samples: cs, rate } = scene;
  const tau = cs * 0.45, decay = Math.exp(-1 / tau);
  out.fill(0, 0, Math.min(out.length, s0));
  let v = 0, i = s0;
  for (let c = 0; c < cols; c++) {
    const target = Math.pow(grid[r * cols + c] / 255, 1.5);
    let diff = v - target;
    const end = Math.min(out.length, s0 + (c + 1) * cs);
    for (; i < end; i++) { out[i] = target + diff; diff *= decay; }
    v = target + diff;
  }
  const rd = Math.exp(-1 / (0.05 * rate));
  for (; i < out.length; i++) { out[i] = v; v *= rd; }
}

function renderScan(scene) {
  const n = scene.duration_samples, out = new Float64Array(n), g = new Float64Array(n);
  const bus = 2.2 / scene.rows;
  for (let r = 0; r < scene.rows; r++) {
    rowGains(scene, r, g);
    const w = 2 * Math.PI * scene.freqs[r] / scene.rate;
    for (let i = scene.start_samples; i < n; i++) if (g[i] !== 0) out[i] += bus * g[i] * Math.sin(w * i);
  }
  return out;
}

function renderFigure(scene) {
  const pts = scene.points_e4.map((v) => v / 10000), n = pts.length / 2, total = scene.duration_samples;
  const out = new Float64Array(total * 2);
  if (n < 2) return out;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; cum[i + 1] = cum[i] + Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]); }
  const len = cum[n] || 1;
  let seg = 0;
  for (let k = 0; k < total; k++) {
    const target = (k / total) * len;
    while (seg < n - 1 && cum[seg + 1] < target) seg++;
    const f = (target - cum[seg]) / (cum[seg + 1] - cum[seg] || 1), j = (seg + 1) % n;
    out[2 * k] = scene.gain * (pts[seg * 2] + (pts[j * 2] - pts[seg * 2]) * f);
    out[2 * k + 1] = scene.gain * (pts[seg * 2 + 1] + (pts[j * 2 + 1] - pts[seg * 2 + 1]) * f);
  }
  return out;
}

const RENDERERS = { seed: renderSeed, music: renderMusic, scan: renderScan, figure: renderFigure };

// A loop is measured over 2 s of itself, so the meter sees at least five of its 400 ms blocks.
function measured(x, scene) {
  if (scene.producer !== "figure" && scene.producer !== "music") return x;
  const want = 2 * scene.rate * scene.channels, out = new Float64Array(Math.max(want, x.length));
  for (let i = 0; i < out.length; i++) out[i] = x[i % x.length];
  return out;
}

// Normalise to the class target with the contract's meter. Music aims at -14 LUFS; interactive
// sound only comes down to -18 LUFS. A sample-peak ceiling of the class's peak limit always wins,
// so a loud-peaked sound can fall short of its target, and the receipt then says refuted.
function normalise(x, scene) {
  const cls = scene.loudness_class, t = LOUDNESS_TARGETS[cls];
  const lufs = integratedLufs(measured(x, scene), scene.rate, scene.channels);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (lufs === null || !peak) return { gain: 1 };
  const ceiling = 10 ** ((cls === "interactive" ? t.sample_peak_dbfs_max : t.true_peak_dbtp_max) / 20) * 0.999;
  let gain = cls === "interactive" ? Math.min(1, 10 ** ((t.integrated_lufs_max - lufs) / 20)) : 10 ** ((t.integrated_lufs - lufs) / 20);
  gain = Math.min(gain, ceiling / peak);
  for (let i = 0; i < x.length; i++) x[i] *= gain;
  return { gain };
}

const cache = new Map();

// The reference: float64 samples, normalised, quantized once. Cached by scene hash.
export function renderReference(scene) {
  const key = sha256(new TextEncoder().encode(JSON.stringify(scene)));
  if (cache.has(key)) return cache.get(key);
  const render = RENDERERS[scene.producer];
  if (!render) throw new Error("sound: no reference renderer for " + scene.producer);
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const x = render(scene);
  const { gain } = normalise(x, scene);
  const pcm = quantizeS16(x);
  const ms = typeof performance !== "undefined" ? performance.now() - t0 : 0;
  const out = { scene, pcm, gain, renderMs: ms, loudness: measure(pcm, scene) };
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(key, out);
  return out;
}

const toFloats = (pcm) => {
  const dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength), n = pcm.byteLength >> 1, f = new Float32Array(n);
  for (let i = 0; i < n; i++) f[i] = dv.getInt16(2 * i, true) / 32767;
  return f;
};

// Loudness of the quantized PCM, the thing a listener gets.
export function measure(pcm, scene) {
  const f = Float64Array.from(toFloats(pcm));
  const lufs = integratedLufs(measured(f, scene), scene.rate, scene.channels);
  const peak = peakDbfs(f);
  const r6 = (v) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
  return { integrated_lufs: r6(lufs), peak_dbfs: r6(peak), loudness_class: scene.loudness_class,
    loudness_verdict: loudnessCheck(scene.loudness_class, lufs, peak), meter: METER };
}

// ---------------------------------------------------------------- receipts

const LIMITS = [
  "A PCM hash covers samples, not speakers: it says nothing about how a device plays them.",
  "s16 quantization hides float differences under half a step.",
  "The loudness figure is one meter's reading (superstack-bs1770/1); the peak is the sample peak, not true peak.",
];

const SEED_RULE_OF = { seed: "splitmix-fnv/1" };

export function soundReceipt(ref, { backend = REFERENCE_BACKEND, content = ref.pcm, reconcile = null, reference = null, extra = [] } = {}) {
  const s = ref.scene, frames = content.byteLength / 2 / s.channels;
  const lf = content === ref.pcm ? ref.loudness : measure(content, s);
  const media = { kind: "audio", content: s.loudness_class === "speech" ? "speech" : s.loudness_class, rate: s.rate, channels: s.channels,
    format: "s16le", frames, duration_flicks: frames * flicksPerSample(s.rate), ...lf,
    access: { autoplay: false, reduced_sound: "silent" } };
  const limits = [...LIMITS, ...extra];
  if (s.producer === "figure" || s.producer === "music") limits.push("This sound loops; loudness was measured over 2 s of the loop.");
  if (!reconcile) limits.push(backend === REFERENCE_BACKEND ? "This is the reference; no other path was compared with it in this receipt." : "No reference was compared.");
  return makeReceipt({ producer: "harperz9-sound/" + s.producer, version: VERSION, backend, scene: s, media, content,
    outputs: {}, reference, reconcile, doesNotProve: limits, seedRule: SEED_RULE_OF[s.producer] || "xmur3-mulberry32/1" });
}

export function wavOf(ref) { return wavS16(ref.pcm, ref.scene.rate, ref.scene.channels); }

// ---------------------------------------------------------------- live path

const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;

// A context at the reference rate, so the browser plays the reference's samples, not a resampling.
export function liveContext() {
  const C = AC();
  if (!C) return null;
  try { return new C({ sampleRate: SOUND_RATE }); } catch (_) { return new C(); }
}

function bufferOf(ctx, ref) {
  const s = ref.scene, f = toFloats(ref.pcm), frames = f.length / s.channels;
  const buf = ctx.createBuffer(s.channels, frames, s.rate);
  for (let c = 0; c < s.channels; c++) {
    const ch = new Float32Array(frames);
    for (let i = 0; i < frames; i++) ch[i] = f[i * s.channels + c];
    buf.copyToChannel(ch, c);
  }
  return buf;
}

// Play the reference's samples on a live context. Must be called from a user gesture (or from a
// context the gesture already resumed). Returns { source, stop }. connectTo receives the source
// for an analyser tap. Ambient or reactive callers check reducedSound() before calling.
export function playReference(ctx, ref, { loop = false, connectTo = null, destination = true } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = bufferOf(ctx, ref);
  src.loop = loop;
  if (destination) src.connect(ctx.destination);
  if (connectTo) src.connect(connectTo);
  src.start();
  return { source: src, stop() { try { src.stop(); } catch (_) {} try { src.disconnect(); } catch (_) {} } };
}

const interleave = (rendered, channels) => {
  const n = rendered.length, out = new Float64Array(n * channels);
  const chans = Array.from({ length: channels }, (_, c) => rendered.getChannelData(c));
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) out[i * channels + c] = chans[c][i];
  return out;
};

// Render the live graph (the reference's buffer through a buffer source) in an OfflineAudioContext
// and reconcile its output with the reference. Returns the WebAudio receipt, reconciled.
export async function reconcileLive(ref) {
  const O = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const s = ref.scene, frames = ref.pcm.byteLength / 2 / s.channels;
  if (!O) return soundReceipt(ref, { backend: "webaudio-offline", content: new Uint8Array(0),
    reference: { backend: REFERENCE_BACKEND, content_sha256: sha256(ref.pcm) },
    reconcile: { identity: "DRIFT", tolerance: { verdict: "unverifiable", metrics: {}, bounds: { max_abs_lsb: 2, min_snr_db: 60 }, reason: "no OfflineAudioContext in this browser" } } });
  const ctx = new O(s.channels, frames, s.rate);
  playReference(ctx, ref);
  const live = quantizeS16(interleave(await ctx.startRendering(), s.channels));
  const rc = reconcilePcmS16(ref.pcm, live);
  return soundReceipt(ref, { backend: "webaudio-offline", content: live,
    reference: { backend: REFERENCE_BACKEND, content_sha256: sha256(ref.pcm) }, reconcile: rc,
    extra: ["The live check renders the playback graph in an OfflineAudioContext; a real-time context on a device can still glitch or resample."] });
}

export { verifyReceipt, FLICKS_PER_SECOND };
