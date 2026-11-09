// brush/presets.js: the brush set. Sizes, spacing and grain periods are fractions of the canvas width.
// Numbers come from the reference measurements in ../../CLAIMS.md (stills section): the sponge grain centres on
// a 5.9 to 7.8 px period on a 1500 px wide painting (0.0047 of the width); net strands are 9 to 13 px FWHM
// (0.006 to 0.009); star spikes fall off as about 1/r. Each preset names the mark it is for.

const SPONGE = { kind: 'sponge', period: 0.0047, depth: 0.18 };

export const PRESETS = {
  // A broad airbrush for grounds and haze. Very low flow, so tone builds by glazing (the float surface keeps it smooth).
  haze: { tip: ['round', { hardness: 0 }], size: 0.22, spacing: 0.08, flow: 0.045, pressure: { size: [0.7, 1], flow: [0.4, 1] } },
  // Cumulus billows: a lobed tip, rotated and sized at random, mottled by sponge grain, wet enough to pick up
  // the tone under it so billows melt into each other at the base.
  billow: {
    tip: ['cloud', { seed: 3 }], size: 0.07, spacing: 0.22, flow: 0.42,
    pressure: { size: [0.45, 1], flow: [0.35, 1], gamma: 1.4 }, jitter: { size: 0.35, angle: 1, scatter: 0.22, flow: 0.25 },
    grain: { kind: 'paper', period: 0.0047, depth: 0.12 }, wet: { mix: 0.38, pickup: 0.3 },
  },
  // Smoke wisps: soft, tapered at both ends, thinned by speed, carrying the colour underneath.
  wisp: {
    tip: ['round', { hardness: 0 }], size: 0.024, spacing: 0.06, flow: 0.12, taper: { start: 0.3, end: 0.4 },
    pressure: { size: [0.25, 1], flow: [0.3, 1] }, velocity: { size: -0.35 }, grain: { ...SPONGE, depth: 0.3 }, wet: { mix: 0.5, pickup: 0.2 },
  },
  // The smudge finger with a bristle tip turned along the stroke: drags pixels into combed streaks (image 18's water).
  smear: { tip: ['bristle', { seed: 5 }], size: 0.06, spacing: 0.05, flow: 1, aspect: 1.6, angle: 'stroke', smudge: { strength: 0.4, length: 0.82 }, pressure: { flow: [0.4, 1] } },
  // A plain smudge with a soft round tip, for blending billow bases.
  blend: { tip: ['round', { hardness: 0 }], size: 0.05, spacing: 0.08, flow: 1, smudge: { strength: 0.55, length: 0.8 } },
  // Light: a wide additive halo and a thin hot filament, drawn as two passes along the same path.
  halo: { tip: ['round', { hardness: 0 }], size: 0.034, spacing: 0.1, flow: 0.04, mode: 'add', taper: { start: 0.15, end: 0.15 } },
  filament: { tip: ['round', { hardness: 0.3 }], size: 0.004, spacing: 0.2, flow: 0.22, mode: 'add', taper: { start: 0.1, end: 0.1 }, pressure: { size: [0.6, 1] } },
  // A star: one additive dab of the flare tip.
  flare: { tip: ['flare', {}], size: 0.2, spacing: 10, flow: 1, mode: 'add' },
  // A sponge: scattered small dabs through a deep grain, for the mottled speckle of the upper sky.
  sponge: { tip: ['round', { hardness: 0.3 }], size: 0.045, spacing: 0.3, flow: 0.07, jitter: { size: 0.5, scatter: 1.2, angle: 1 }, grain: { kind: 'speckle', period: 0.0047, depth: 0.7 } },
  // Rim light: a thin hard line laid along the lit edge of a dark form.
  rim: { tip: ['round', { hardness: 0.7 }], size: 0.004, spacing: 0.2, flow: 0.5, taper: { start: 0.25, end: 0.45 }, pressure: { size: [0.3, 1] } },
};

export const PRESET_NAMES = Object.keys(PRESETS);

export function preset(name, over = {}) {
  const b = PRESETS[name];
  if (!b) throw new Error(`brush: unknown preset "${name}"`);
  return { ...b, ...over };
}
