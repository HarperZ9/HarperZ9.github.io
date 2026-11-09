// Spec objects to the uniform layouts in wgsl.mjs. Pure: the GPU layers and the parity test
// both pack through here, so the kernel sees exactly what a frame sees.

import { orbSpec } from "./ref.mjs";

const v4 = (c, w = 0) => [c[0], c[1], c[2], w];

// The default orb and atmosphere looks. Linear light. The spectrum lives here, in the art layer
// only: UI type and data marks use the ink and verdict colours (palette.mjs).
export { ORB } from "./ref.mjs";
// Night: the canon's void, near-black to deep navy, with a faint ember horizon.
export const NIGHT = Object.freeze({
  stops: [[0, [0.004, 0.005, 0.012]], [0.55, [0.010, 0.013, 0.032]], [0.88, [0.020, 0.018, 0.034]], [1, [0.006, 0.005, 0.010]]],
  band: 0.86, bandW: 0.06, bandC: [0.060, 0.026, 0.012], aspect: 16 / 9, drift: 0.012, grain: 0.16, seed: 7,
});
// Aurora: a quiet dark ground for figures (DESIGN-RULES.md: a restrained palette; the figure may
// use a limited explanatory palette, and text always wins over the art layer): navy at the top,
// deep violet through the middle, a low ember horizon.
export const AURORA = Object.freeze({
  stops: [[0, [0.006, 0.009, 0.032]], [0.45, [0.030, 0.014, 0.070]], [0.8, [0.090, 0.024, 0.040]], [1, [0.012, 0.006, 0.012]]],
  band: 0.78, bandW: 0.08, bandC: [0.14, 0.045, 0.025], aspect: 16 / 9, drift: 0.015, grain: 0.14, seed: 23,
});
export const PAPER = Object.freeze({
  stops: [[0, [0.88, 0.85, 0.80]], [0.6, [0.86, 0.83, 0.77]], [0.9, [0.85, 0.80, 0.74]], [1, [0.83, 0.78, 0.72]]],
  band: 0.95, bandW: 0.12, bandC: [0.05, 0.02, 0.0], aspect: 16 / 9, drift: 0.006, grain: 0.025, seed: 11,
});

export function orbFloats(spec = {}) {
  const s = orbSpec(spec);
  return [
    ...v4(s.core), ...v4(s.mid), ...v4(s.rim),
    s.soft, s.coreGain, s.coreR, s.haloGain,
    s.haloR, s.ring, s.ringW, s.iris.blades,
    s.iris.open, s.iris.rot, s.gain, 0,
    s.spokes, s.spokeGain, s.spokeSharp, s.prism,
  ];
}

// Four ramp stops (pads a shorter list by repeating its last stop).
export function rampFloats(stops) {
  const st = stops.slice(0, 4);
  while (st.length < 4) st.push([st[st.length - 1][0] + 1e-3 * st.length, st[st.length - 1][1]]);
  return { xs: st.map((s) => s[0]), cs: st.flatMap((s) => v4(s[1])) };
}

export function atmosFloats(spec = {}) {
  const s = { ...NIGHT, ...spec };
  const r = rampFloats(s.stops);
  return {
    floats: [...r.xs, ...r.cs, s.band, s.bandW, 0, 0, s.aspect, s.drift, s.grain, s.seed],
    bandC: v4(s.bandC),
  };
}
