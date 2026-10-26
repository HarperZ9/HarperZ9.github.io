// road.mjs: the winding road, as pure numbers (no DOM). Distance along the road is the clock: every reveal on
// the path is a function of where the visitor stands, never of a timer, so the visitor sets the pace and can
// walk back. The water district is the reference library's path order (world.json path_order) reshaped by hand
// for the journey: ink, surface tension, layering, sedimentation, then the archive, so the road descends through
// the strata (material 0, property 1, process 2, meaning 6). lib/world.mjs joins each stop to its world records.
//
//   const road = makeRoad(DISTRICTS);           // stops laid end to end; each keeps its own clock
//   road.at(s)        -> { district, stop, local, approach, beat }   beat: the step index on the stop's own clock
//   road.centre(s)    -> { x, slope }         the road's sideways wander at distance s (for drawing)
//   road.length

// Each district: a theme, a colour temperature (the ground's two inks), medium properties for the FLOW ground,
// and no clock of its own (there is no master clock; a stop keeps its own time). Each stop: an id, the concept it introduces, the move it shows most
// (unravel, mosaic, sheets or junction), and the places it leads to.
export const DISTRICTS = Object.freeze([
  {
    id: "water", title: "Water and fluids", temperature: "cool", ink: "#1f3d5c", wall: "#e6ebe8", accent: "#3b7f8f",
    medium: { viscosity: 0.9, current: 0.6 },  // no district beat: each stop keeps its own clock
    stops: [
      // clock and steps: the place's own time (lib/stop.mjs CLOCKS); form: the shape its element takes when it
      // travels (lib/carry.js FORMS). lead: the world place the stop stands on (its stratum is the depth); rule: the law shown in force;
      // bridge: the connecting element the stop rides; leave: bridges a junction offers out of the district
      { id: "ink", clock: "sqrt", steps: 6, form: "drop", title: "Ink", builds: [], move: "unravel", lead: "ink", rule: "law-diffusion", bridge: "drop" },
      { id: "ink-in-water", clock: "even", steps: 6, form: "tile", title: "Ink in water", builds: ["ink"], move: "mosaic", lead: "surface-tension", rule: "rule-andamento-follows-form", bridge: "front" },
      { id: "layers", clock: "even", steps: 4, form: "stroke", title: "Layers of water", builds: ["ink", "ink-in-water"], move: "sheets", lead: "layering", rule: "law-overprint-absorption", bridge: "sheet" },
      { id: "tide-line", clock: "drying", steps: 8, form: "grain", title: "Tide line", builds: ["ink", "layers"], move: "bridge", lead: "sedimentation", rule: "law-coffee-ring", bridge: "tide-line" },
      { id: "palimpsest", clock: "ratio", steps: 6, form: "glyph", title: "Palimpsest", builds: ["tide-line"], move: "junction", place: "palimpsest", lead: "archive-memory", rule: "law-weber-fechner", leave: ["tile", "sheet", "front"],
        branches: [{ to: "sound", title: "Sound", via: "listen" }, { to: "map", title: "The map", via: null }] },
    ],
  },
  // placeholders: these districts are named by the brief and not yet built; their order waits on PATH-ORDER.md
  { id: "type", title: "Type and lettering", temperature: "neutral", ink: "#1a1712", wall: "#ece6da", accent: "#8f3a19", medium: { viscosity: 1.4 }, stops: [] },
  { id: "glass", title: "Glass and light", temperature: "warm", ink: "#2a1d10", wall: "#f1e9dc", accent: "#c98a2a", medium: { viscosity: 0.6 }, stops: [] },
  { id: "mosaic", title: "Mosaic", temperature: "neutral", ink: "#151314", wall: "#e8e3d9", accent: "#c8322b", medium: { viscosity: 1.2 }, stops: [] },
  { id: "sound", title: "Sound", temperature: "warm", ink: "#24151c", wall: "#efe5df", accent: "#a33a5a", medium: { viscosity: 0.8 }, stops: [] },
  { id: "tools", title: "Tools", temperature: "cool", ink: "#16130f", wall: "#e8e3d9", accent: "#0a6b61", medium: { viscosity: 2.0 }, stops: [] },
  { id: "investigations", title: "Investigations", temperature: "neutral", ink: "#16130f", wall: "#e4e0d8", accent: "#4e4d85", medium: { viscosity: 3.2 }, stops: [] },
]);

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Lay the built stops end to end. A stop occupies one unit of road; distance s runs from 0 to road.length.
export function makeRoad(districts = DISTRICTS) {
  const stops = [];
  for (const d of districts) for (const st of d.stops) stops.push({ ...st, district: d.id, index: stops.length });
  const length = stops.length;
  const byDistrict = Object.fromEntries(districts.map((d) => [d.id, d]));
  return {
    stops, length, districts: byDistrict,
    // where the visitor is: the stop they are at or walking toward, how far into it, and how close
    at(s) {
      const x = Math.min(length - 1e-6, Math.max(0, s)), i = Math.floor(x), local = x - i, stop = stops[i], d = byDistrict[stop.district];
      // approach rises over the first 70% of a stop's length and holds at 1: the stop is "arrived" for its last stretch
      const approach = smooth(0, 0.7, local), beat = Math.floor(approach * (stop.steps || 6) + 1e-6);
      return { stop, district: d, index: i, local, approach, beat, progress: x / length };
    },
    // the road's sideways wander: a sum of two slow sines, so the way ahead bends one way and then the other
    centre(s) {
      const x = 0.18 * Math.sin(s * 1.7 + 0.4) + 0.07 * Math.sin(s * 4.3 + 1.1);
      const slope = 0.18 * 1.7 * Math.cos(s * 1.7 + 0.4) + 0.07 * 4.3 * Math.cos(s * 4.3 + 1.1);
      return { x, slope };
    },
    nextStop(s) { return Math.min(length - 1, Math.floor(s) + 1); },
    prevStop(s) { const i = Math.floor(s); return s - i < 0.05 ? Math.max(0, i - 1) : i; },
  };
}
