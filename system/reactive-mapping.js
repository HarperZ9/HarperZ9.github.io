// reactive-mapping.js
// Pure, zero-dependency feature->visual-parameter mapping logic.
// No DOM, no Web Audio, no side effects. Every function is testable in Node.
//
// FEATURE SCHEMA (what the reactive engine computes each frame):
//   {
//     level:    0..1  RMS loudness (fast attack, slow release)
//     flux:     0..1  spectral flux, onset/beat energy (onset when > threshold)
//     bass:     0..1  low-frequency band power (approx 20-250 Hz)
//     mid:      0..1  mid-frequency band power (approx 250-2500 Hz)
//     treble:   0..1  high-frequency band power (approx 2500+ Hz)
//     centroid: 0..1  spectral centroid normalised to [0, Nyquist]
//     chroma:   number[12]  peak-normalised chroma vector (12 pitch classes)
//     tempo:    bpm (0 when unknown), smoothed
//   }
//
// PARAM SCHEMA (what the mapping produces each frame):
//   {
//     pulse:      0..1  burst intensity on onset
//     intensity:  0..1  overall visual energy / scale
//     hueShift:   0..1  hue rotation amount
//     hue:        0..360  absolute hue hint from dominant chroma class
//     speedMult:  0..4   animation speed multiplier (1 = unchanged)
//     lowMod:     0..1  low-frequency visual modulation
//     highMod:    0..1  high-frequency visual modulation
//   }

// Chroma-to-hue: map pitch class index (0=C, 1=C#, ..., 11=B) to a hue in degrees.
// Uses a visually even 30-degree-per-semitone mapping with a warm bias for C/A.
const CHROMA_HUE = [
  0,   // C  -> red
  30,  // C# -> orange-red
  60,  // D  -> orange
  90,  // D# -> yellow
  120, // E  -> yellow-green
  150, // F  -> green
  180, // F# -> cyan
  210, // G  -> teal
  240, // G# -> blue
  270, // A  -> indigo
  300, // A# -> violet
  330, // B  -> magenta
];

// Return the pitch class index (0-11) with the highest chroma energy.
// Returns -1 when chroma is a zero vector.
export function dominantChromaClass(chroma) {
  if (!Array.isArray(chroma) || chroma.length < 12) return -1;
  let best = -1, bestVal = -Infinity;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > bestVal) { bestVal = chroma[i]; best = i; }
  }
  return bestVal > 0 ? best : -1;
}

// Map dominant chroma class to a hue in degrees [0, 360).
export function chromaToHue(chroma) {
  const pc = dominantChromaClass(chroma);
  return pc >= 0 ? CHROMA_HUE[pc] : 0;
}

// Clamp a number into [lo, hi].
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Apply the default feature->param mapping.
// mapping is an optional config object that overrides sensitivity/curve knobs.
export function applyMapping(features, mapping) {
  const m = mapping || {};
  const sensitivity = (m.sensitivity !== undefined) ? m.sensitivity : 1.0;

  const level    = clamp(features.level    || 0, 0, 1);
  const flux     = clamp(features.flux     || 0, 0, 1);
  const bass     = clamp(features.bass     || 0, 0, 1);
  const mid      = clamp(features.mid      || 0, 0, 1);
  const treble   = clamp(features.treble   || 0, 0, 1);
  const centroid = clamp(features.centroid || 0, 0, 1);
  const chroma   = features.chroma || new Array(12).fill(0);
  const bpm      = features.tempo  || 0;

  // pulse: onset/beat -> burst, boosted by sensitivity
  const onsetThreshold = (m.onsetThreshold !== undefined) ? m.onsetThreshold : 0.45;
  const isOnset = flux > onsetThreshold;
  const rawPulse = isOnset
    ? clamp(flux * 1.4 * sensitivity, 0, 1)
    : clamp(flux * 0.4 * sensitivity, 0, 1);
  const pulse = m.pulseCurve === "linear"
    ? rawPulse
    : rawPulse * rawPulse;  // squared default: sharper attack

  // intensity: loudness -> visual energy; mid adds warmth
  const intensity = clamp(
    (level * 0.7 + mid * 0.3) * sensitivity,
    0, 1
  );

  // hueShift: spectral centroid -> hue rotation
  const hueShift = clamp(centroid * sensitivity, 0, 1);

  // hue: absolute pitch-class-to-hue hint
  const hue = chromaToHue(chroma);

  // speedMult: tempo (bpm) -> animation speed [0.5, 3]; 120 bpm is the 1x reference.
  // When bpm is unknown (0), clamp to 1.
  const speedRef = (m.speedRef !== undefined) ? m.speedRef : 120;
  const speedMult = bpm > 0
    ? clamp((bpm / speedRef) * (m.speedSensitivity !== undefined ? m.speedSensitivity : 1), 0.5, 3)
    : 1;

  // lowMod: bass -> low visual modulation (rumble, depth)
  const lowMod = clamp(bass * 1.2 * sensitivity, 0, 1);

  // highMod: treble -> high visual modulation (sparkle, edge sharpness)
  const highMod = clamp(treble * 1.1 * sensitivity, 0, 1);

  return { pulse, intensity, hueShift, hue, speedMult, lowMod, highMod };
}

// Built-in presets: named mapping configs you can pass to applyMapping.
// Each preset overrides only the knobs it cares about; the rest default.
export const MAPPING_PRESETS = {
  // Default: balanced, all features mapped, moderate sensitivity.
  default: {},

  // Pulse: onsets dominate, louder threshold, punchier pulses.
  pulse: {
    onsetThreshold: 0.55,
    sensitivity: 1.3,
  },

  // Ambient: softer, reduced sensitivity, pulses are gentle swells.
  ambient: {
    sensitivity: 0.55,
    pulseCurve: "linear",
    speedSensitivity: 0.6,
  },

  // Bass-heavy: boost bass and low-mod, reduce treble contribution.
  bass: {
    sensitivity: 1.2,
    onsetThreshold: 0.4,
  },

  // Treble-bright: centroid and high-mod lead the visual response.
  bright: {
    sensitivity: 1.1,
    onsetThreshold: 0.5,
    speedSensitivity: 1.2,
  },
};

// Extract a representative scalar from the chroma vector.
// Returns the max chroma value (peak strength), 0..1.
export function chromaPeak(chroma) {
  if (!Array.isArray(chroma) || chroma.length === 0) return 0;
  let peak = 0;
  for (let i = 0; i < chroma.length; i++) if (chroma[i] > peak) peak = chroma[i];
  return peak;
}
