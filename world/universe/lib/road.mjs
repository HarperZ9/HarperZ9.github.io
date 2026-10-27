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
// The districts and their stops live in lib/districts.mjs (content, from world.json, reshaped by hand). Here each
// stop gains its district id and its place in walking order.
import { DISTRICT_DATA } from "./districts.mjs";
export const DISTRICTS = Object.freeze(DISTRICT_DATA.map((d) => ({ ...d, stops: d.stops.map((st) => ({ builds: [], ...st, medium: st.medium || d.medium })) })));

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
