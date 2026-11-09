// world.mjs: the reference library's world (world.json, slimmed by build/world_slim.py) as pure numbers, no DOM.
// The world has seven strata (material, property, process, form, composition, rules, meaning), places that each
// live on one stratum, bridges that join places across strata, and rules that govern places. The road walks it:
// a stop stands on a place, so it has a depth (its stratum), a rule in force and a bridge it rides.
//
//   const world = indexWorld(json);
//   world.depth("sedimentation")        -> 2 (process)
//   world.rulesFor(["water", "ink"])    -> rules whose governs touch those places, strongest evidence first
//   world.bridgesFor(["water"])         -> bridges that join any of them
//   world.stones("tide-line")           -> the bridge's places, in walking order, each with depth and colour
//   enrichRoad(road, world)             -> each stop gains { lead, depth, rule, bridge } records
//   depthAt(road, s)                    -> the stratum depth at distance s, eased between stops
//   beer(depth) / coffeeRing(rho, dry) / diffusionRadius(t)   the water region's laws, as functions

// The strata's colours are the library's, tuned by eye for a calm ground (the library says its colours rest on
// thin evidence). Tuning keeps each hue family and lowers chroma so seven translucent sheets can overprint.
export const STRATA_TUNE = Object.freeze({
  material: "#4a7393", property: "#b8995a", process: "#a5644f", form: "#5d7d62",
  composition: "#7c6f9a", rules: "#4a4a4a", meaning: "#c98552",
});

export function indexWorld(w) {
  const order = w.sheets.map((s) => s.id), place = new Map(w.places.map((p) => [p.id, p])), bridge = new Map(w.bridges.map((b) => [b.id, b]));
  const rule = new Map(w.rules.map((r) => [r.id, r]));
  const depth = (id) => { const p = place.get(id); return p ? order.indexOf(p.sheet) : -1; };
  const strata = w.sheets.map((s, i) => ({ id: s.id, index: i, colour: s.colour, tuned: STRATA_TUNE[s.id] || s.colour, density: s.density ?? 1 }));
  const touches = (list, ids) => list.some((x) => ids.includes(x));
  return {
    raw: w, strata, order, place: (id) => place.get(id) || null, bridge: (id) => bridge.get(id) || null, rule: (id) => rule.get(id) || null, depth,
    rulesFor: (ids) => w.rules.filter((r) => touches(r.governs, ids)).sort((a, b) => b.evidence - a.evidence),
    bridgesFor: (ids) => w.bridges.filter((b) => touches(b.joins, ids)).sort((a, b) => b.evidence - a.evidence),
    // a bridge's places as stepping stones: in the order the library's path meets them, so the walk across a
    // bridge goes from the concept met first to the one met last
    stones(id) {
      const b = bridge.get(id); if (!b) return [];
      const at = (x) => { const k = w.path_order.indexOf(x); return k < 0 ? 1e9 : k; };
      return [...b.joins].sort((a, c) => at(a) - at(c)).map((x) => ({ id: x, depth: depth(x), colour: place.get(x)?.colour?.hex || "#777777", tuned: strata[depth(x)]?.tuned || "#777777", sheet: place.get(x)?.sheet || null }));
    },
  };
}

// Join the road's hand-written stops to the world. A stop names its lead place, the rule shown in force and the
// bridge it rides; missing ids are reported once (a typo must not pass as an empty stratum).
export function enrichRoad(road, world) {
  for (const st of road.stops) {
    const missing = [st.lead && !world.place(st.lead) && st.lead, st.rule && !world.rule(st.rule) && st.rule, st.bridge && !world.bridge(st.bridge) && st.bridge].filter(Boolean);
    if (missing.length) console.warn("world: unknown ids on stop", st.id, missing);
    st.depth = st.lead ? Math.max(0, world.depth(st.lead)) : 0;
    st.ruleRec = st.rule ? world.rule(st.rule) : null;
    st.bridgeRec = st.bridge ? world.bridge(st.bridge) : null;
    st.leaveRecs = (st.leave || []).map((id) => world.bridge(id)).filter(Boolean);
  }
  return road;
}

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
// The stratum depth at distance s: a stop holds its depth while the visitor stands at it and the road descends
// (or climbs) to the next stop's depth over the last 40% of the stop's length.
export function depthAt(road, s) {
  const x = Math.min(road.length - 1e-6, Math.max(0, s)), i = Math.floor(x), local = x - i;
  const a = road.stops[i]?.depth ?? 0, b = road.stops[Math.min(road.length - 1, i + 1)]?.depth ?? a;
  return a + (b - a) * smooth((local - 0.6) / 0.4);
}

// ---- the water region's laws (world.json rules), as the functions the drawings use ----

// law-beer-absorption: light through water falls off exponentially with depth, red first. Per-channel
// attenuation (per stratum) chosen by eye to read as water: red goes first, blue last.
export const BEER_K = Object.freeze([0.08, 0.032, 0.014]);
export function beer(depth, k = BEER_K) { return k.map((kc) => Math.exp(-kc * Math.max(0, depth))); }

// law-diffusion: a dye's radius grows as the square root of time.
export function diffusionRadius(t, D = 1) { return Math.sqrt(Math.max(0, 2 * D * t)); }

// law-coffee-ring: as a drop dries, outward flow carries pigment to the pinned edge. rho is the radius over the
// drop's radius (0 centre .. 1 edge), dry is 0 wet .. 1 dry. Returns the pigment density 0..1 at rho. The wet drop
// is an even tone; drying moves pigment into a rim whose profile rises steeply toward the edge (Deegan et al.
// 1997 give a power law near the contact line; the exponential here is a drawing model, not a fit).
export function coffeeRing(rho, dry) {
  if (rho > 1) return 0;
  const d = smooth(dry), even = 0.34, floor = 0.05, rim = Math.exp(-(1 - rho) / 0.045);
  return (1 - d) * even + d * (floor + 0.92 * rim);
}
