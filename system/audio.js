// audio.js: a seed authors a short piece of music.
//
// No samples and no model ship. The SEED derives the key, the scale, the melody,
// the timbre, and the tempo, and the piece is synthesized from sine partials with
// pure math. Deterministic and reproducible: the same seed renders the same PCM,
// sample for sample, so a sound is as re-checkable as a plate or a typeface.
//
//   seedComposition(seed) - the score a seed produces (key, scale, sequence,...).
//   renderAudioBuffer(seed) - Float32 mono PCM, normalized to [-1, 1].
//   audioToWav(samples, rate) - a real .wav (16-bit PCM) you can save.
//
// Same FNV-1a + splitmix mix as neural.js / typeface.js, so a seed is one DNA
// across the field, the solid, the face, and now the sound.

const MASK = 0xffffffff;

// FNV-1a, matching neuralSeed().
export function audioSeed(value) {
  let h = 2166136261;
  const s = String(value == null ? "audio" : value);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// splitmix draw in [0, 1) from (seed, index) - same as _draw01 elsewhere.
function draw(seed, index) {
  let x = (seed ^ Math.imul((index + 0x9e3779b9) >>> 0, 0x85ebca6b)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967295;
}

// Consonant scales, so any seed lands on something musical rather than noise.
const SCALES = {
  "minor pentatonic": [0, 3, 5, 7, 10],
  "major pentatonic": [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  "natural minor": [0, 2, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};
const SCALE_NAMES = Object.keys(SCALES);

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/* The score a seed produces. Bounded, musical, deterministic. */
export function seedComposition(seed) {
  const h = typeof seed === "number" ? seed >>> 0 : audioSeed(seed);
  const u = (i) => draw(h, i);
  const root = 45 + Math.floor(u(1) * 15);            // A2..C4, the tonic
  const scaleName = SCALE_NAMES[Math.floor(u(2) * SCALE_NAMES.length) % SCALE_NAMES.length];
  const scale = SCALES[scaleName];
  const bpm = 68 + Math.floor(u(3) * 60);             // 68..128
  const steps = 16;                                    // two bars of eighths
  const restProb = 0.16 + u(4) * 0.18;

  // Melody: a scale degree per step, some rests, occasional octave lift/drop.
  const seq = [];
  for (let i = 0; i < steps; i += 1) {
    if (u(100 + i) < restProb) { seq.push(null); continue; }
    const deg = Math.floor(u(200 + i) * scale.length) % scale.length;
    const lift = u(300 + i);
    const oct = lift > 0.86 ? 12 : lift < 0.16 ? -12 : 0;
    seq.push(root + scale[deg] + oct);
  }

  // Timbre: seed-weighted harmonic amplitudes (1/k falloff keeps it warm).
  const partials = [];
  for (let k = 1; k <= 6; k += 1) partials.push(Math.pow(u(400 + k), 1.8) / k);
  const bright = partials.reduce((a, b) => a + b, 0);
  for (let k = 0; k < partials.length; k += 1) partials[k] /= bright || 1;

  return {
    tag: (h >>> 0).toString(16).padStart(8, "0"),
    root, scaleName, bpm, steps, restProb: Math.round(restProb * 100) / 100,
    seq, partials,
    noteCount: seq.filter((n) => n != null).length,
  };
}

// Sum one enveloped additive voice into the buffer.
function addVoice(buf, sr, start, dur, hz, partials, amp, soft) {
  const s0 = Math.max(0, Math.floor(start * sr));
  const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
  const atk = Math.max(1, Math.floor(0.006 * sr));
  const rel = Math.max(1, (s1 - s0) * 0.72);
  for (let n = s0; n < s1; n += 1) {
    const t = (n - s0) / sr;
    let v = 0;
    for (let k = 0; k < partials.length; k += 1) v += partials[k] * Math.sin(2 * Math.PI * hz * (k + 1) * t);
    const i = n - s0;
    let env;
    if (i < atk) env = i / atk;
    else env = Math.max(0, Math.min(1, (s1 - s0 - i) / rel));
    buf[n] += v * amp * env * (soft ? 0.78 : 1);
  }
}

function normalize(buf, target) {
  let peak = 1e-6;
  for (let i = 0; i < buf.length; i += 1) peak = Math.max(peak, Math.abs(buf[i]));
  const g = (target || 0.9) / peak;
  for (let i = 0; i < buf.length; i += 1) buf[i] *= g;
}

function fadeEnds(buf, sr, inSec, outSec) {
  const a = Math.max(1, Math.floor(inSec * sr));
  const b = Math.max(1, Math.floor(outSec * sr));
  for (let i = 0; i < a && i < buf.length; i += 1) buf[i] *= i / a;
  for (let i = 0; i < b && i < buf.length; i += 1) buf[buf.length - 1 - i] *= i / b;
}

/* Render the seed's piece to mono Float32 PCM in [-1, 1]. Deterministic for a
   given (seed, sampleRate). opts.sampleRate default 44100. */
export function renderAudioBuffer(seed, opts = {}) {
  const sr = opts.sampleRate || 44100;
  const comp = opts.composition || seedComposition(seed);
  const stepDur = 60 / comp.bpm / 2;                  // eighth note
  const total = comp.steps * stepDur + 0.7;           // + tail
  const buf = new Float32Array(Math.max(1, Math.ceil(total * sr)));

  // Melody line.
  for (let i = 0; i < comp.seq.length; i += 1) {
    const m = comp.seq[i];
    if (m == null) continue;
    addVoice(buf, sr, i * stepDur, stepDur * 1.7, midiToHz(m), comp.partials, 0.17, false);
  }
  // A slow root drone one octave below, on the downbeats, to seat the key.
  for (let i = 0; i < comp.steps; i += 4) {
    addVoice(buf, sr, i * stepDur, stepDur * 3.6, midiToHz(comp.root - 12), [0.7, 0.22, 0.08], 0.14, true);
  }

  normalize(buf, 0.9);
  fadeEnds(buf, sr, 0.02, 0.45);
  return buf;
}

/* Package mono Float32 samples as a 16-bit PCM WAV (Uint8Array). */
export function audioToWav(samples, sampleRate = 44100) {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2);
  const dv = new DataView(bytes.buffer);
  const wr = (o, s) => { for (let i = 0; i < s.length; i += 1) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wr(8, "WAVE");
  wr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, "data"); dv.setUint32(40, n * 2, true);
  let o = 44;
  for (let i = 0; i < n; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return bytes;
}
