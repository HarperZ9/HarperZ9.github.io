// Player-facing lens settings: a small set of controls a game can show, and how each maps onto
// the engine's lens parameters. The physical controls (glass dispersion, the thin-film coating,
// blade count and shape, f-number, the lens prescription) stay engine-side and are not here.
//
// The settings scale or switch keyed terms after the time-of-day slot curves have been read
// (params.mjs, lensAtHour), so each term keeps its per-slot shape: a player who halves the flare
// halves it at every hour, and night still flares more than noon. The defaults are the identity:
// with them the parameters, and so the rendered frame, are exactly those of the engine (tested).
// No game UI exists yet; this is the data and API layer a settings screen would bind to.
import { lensAtHour } from "./params.mjs";

export const LENS_SETTINGS_SCHEMA = {
  flare: { type: "number", min: 0, max: 1.5, default: 1, label: "Lens flare", help: "Ghosts and starburst around bright lights", scales: ["ghostGain", "starGain"] },
  streaks: { type: "boolean", default: true, label: "Anamorphic streaks", help: "Horizontal light streaks", gates: ["streakGain"] },
  halation: { type: "number", min: 0, max: 1.5, default: 1, label: "Halation", help: "Red glow around bright lights", scales: ["haloGain"] },
  fringing: { type: "boolean", default: true, label: "Colour fringing", help: "Chromatic dispersion toward the frame edges", gates: ["caAmount"] },
  flashSafe: { type: "boolean", default: false, label: "Reduce bright flashes", help: "Only the brightest lights flare, and fewer of them", note: "threshold x2, maxSources / 2" },
};
export const LENS_SETTINGS_DEFAULT = Object.freeze(Object.fromEntries(Object.entries(LENS_SETTINGS_SCHEMA).map(([k, s]) => [k, s.default])));
export const LENS_SETTINGS_PRESETS = {
  default: { ...LENS_SETTINGS_DEFAULT },
  // Accessibility: fewer and dimmer flashes, no streaks, no fringing.
  "reduced-flash": { flare: 0.25, streaks: false, halation: 0.5, fringing: false, flashSafe: true },
  off: { flare: 0, streaks: false, halation: 0, fringing: false, flashSafe: false },
};

// Full settings from a partial object or a preset name; refuses unknown keys, wrong types and
// values out of range (a settings file that is wrong should be reported, not silently fixed).
export function resolveLensSettings(s = {}) {
  if (typeof s === "string") { if (!(s in LENS_SETTINGS_PRESETS)) throw new Error(`lens settings: unknown preset ${s}`); s = LENS_SETTINGS_PRESETS[s]; }
  const out = { ...LENS_SETTINGS_DEFAULT };
  for (const [k, v] of Object.entries(s)) {
    const spec = LENS_SETTINGS_SCHEMA[k];
    if (!spec) throw new Error(`lens settings: unknown setting ${k}`);
    if (spec.type === "boolean" && typeof v !== "boolean") throw new Error(`lens settings: ${k} is true or false`);
    if (spec.type === "number" && !(typeof v === "number" && v >= spec.min && v <= spec.max)) throw new Error(`lens settings: ${k} is a number in [${spec.min}, ${spec.max}]`);
    out[k] = v;
  }
  return out;
}

// Engine parameters (as from lensAtHour) with the player's settings applied.
export function applyLensSettings(params, settings = LENS_SETTINGS_DEFAULT) {
  const s = resolveLensSettings(settings), p = { ...params };
  if (s.flare !== 1) { p.ghostGain *= s.flare; p.starGain *= s.flare; }
  if (!s.streaks) p.streakGain = 0;
  if (s.halation !== 1) p.haloGain *= s.halation;
  if (!s.fringing) p.caAmount = 0;
  if (s.flashSafe) { p.threshold *= 2; p.maxSources = Math.max(1, Math.ceil(p.maxSources / 2)); }
  return p;
}
// The lens at an hour for a player: slot curves first, then the settings.
export const lensForPlayer = (hour, settings, base, table, slots) => applyLensSettings(lensAtHour(hour, base, table, slots), settings);
