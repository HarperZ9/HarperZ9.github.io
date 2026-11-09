// Lens suite parameters: engine-side controls, each keyed to the eight time-of-day slots.
//
// These are engine data for designers and the environment state, not player settings (which
// handles a player sees is an open question for the author). Physical names are kept where the
// term is physical: f-number sets the size of ghosts (smaller when stopped down) and of the
// diffraction spikes (larger when stopped down); the coating sets the ghost and streak tint.
// The gains are handles: real flares are visible because real lights are many stops brighter
// than the scene, which a display-referred demo cannot show at true scale.
import { createLookKeys } from "../../look/keys.mjs";

export const DEFAULT_LENS = {
  threshold: 2.0,        // scene-linear luminance above which light feeds the lens terms
  refHeight: 1080,       // lengths below in px are px at this frame height, scaled to the frame
  tile: 16,              // source extraction tile, px (not scaled)
  maxSources: 24,
  fNumber: 2.8,
  sensorHalfDiagMm: 21.63, // a 36 x 24 mm frame
  ghostGain: 25,         // times the physical double reflection R_i R_j
  minGhostPx: 2,
  squeeze: 1,            // anamorphic squeeze: ghost shapes narrow by this factor in x
  streakGain: 0.05, streakLenPx: 140, streakThickPx: 0.9, streakAngle: 0,
  starGain: 0.03, starCellPxPerStop: 0.35, // spike scale grows with the f-number (diffraction)
  haloGain: 0.04, haloRadiusPx: 5,
  caAmount: 0.06,        // lateral dispersion, as a fraction of the crown glass's own
  coating: { n1: 1.38, quarterAt: 550, ns: 1.52 },
  iris: { blades: 6, roundness: 0.15, rotation: 0.3 },
};

// Per-slot values (SLOTS_8 order: midnight, predawn, dawn, morning, noon, golden, dusk, night).
// Night opens the iris and lowers the threshold so street lights flare; noon stops down, so
// ghosts shrink and spikes grow, and only the sun's glints pass the threshold.
export const LENS_KEYS = {
  threshold: { values: [2, 2, 2.5, 5, 8, 4, 2.5, 2], min: 0.05 },
  fNumber: { values: [2.8, 2.8, 4, 8, 11, 5.6, 4, 2.8], min: 1.4, max: 22 },
  ghostGain: { values: [30, 28, 18, 8, 6, 14, 22, 30], min: 0 },
  streakGain: { values: [0.06, 0.06, 0.04, 0.015, 0.01, 0.03, 0.05, 0.06], min: 0 },
  starGain: { values: [0.025, 0.025, 0.03, 0.04, 0.045, 0.035, 0.03, 0.025], min: 0 },
  haloGain: { values: [0.05, 0.05, 0.04, 0.02, 0.015, 0.035, 0.045, 0.05], min: 0 },
  caAmount: { values: [0.06, 0.06, 0.06, 0.05, 0.05, 0.06, 0.06, 0.06], min: 0 },
};

let keys = null;
// The lens parameters at an hour: DEFAULT_LENS with every keyed term read from its slot curve.
export function lensAtHour(hour, base = DEFAULT_LENS, table = LENS_KEYS, slots = 8) {
  const k = table === LENS_KEYS && slots === 8 ? (keys ||= createLookKeys({ slots, params: table })) : createLookKeys({ slots, params: table });
  return { ...base, ...k.at(hour) };
}
