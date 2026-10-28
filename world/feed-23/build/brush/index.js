// brush: a stamp-based paint engine with grain, wet mixing, smudge, pressure and tilt, painting in linear light
// on a float surface and exporting lossless 8 or 16-bit PNG. Dependency-free ES modules; runs in node and the browser.
export { Surface } from './surface.js';
export { tip, TIP_NAMES } from './tips.js';
export { Grain, grainFor } from './grain.js';
export { paintStroke, liveStroke, smoothPath } from './stroke.js';
export { dabParams, tiltToPolar, speedPressure } from './dynamics.js';
export { PRESETS, PRESET_NAMES, preset } from './presets.js';
export { SCENES, nocturne, starcloud, render } from './scenes.js';
export { encodePNG, browserDeflate, crc32 } from './png.js';
export { linear, toSrgb, toLinear } from './core.js';

// S1 to S6: what the engine takes, its parameter ranges and units, determinism, budget and output.
export const SPEC = Object.freeze({
  inputs: { samples: '[{ x, y } px, p 0..1 pressure, tiltX/tiltY degrees -90..90, t seconds}]; mouse input omits p and pressure comes from speed', scene: '{ aspect, ground: [#hex, #hex], ops: [{ b: preset, c: #hex, pts in canvas-width units, seed, over }] }' },
  params: {
    size: 'fraction of canvas width, 0.002 to 0.6', spacing: 'fraction of dab diameter, 0.03 to 10', flow: 'alpha per dab, 0 to 1', gain: 'alpha multiplier, 1 to 6',
    grain: '{ kind: paper | sponge | speckle, period: fraction of width (0.0047 is 7 px at 1500), depth: 0 to 1 }',
    wet: '{ mix 0..1, pickup 0..1 }', smudge: '{ strength 0..1, length 0..1 (how long the finger carries) }', taper: 'fractions of stroke length 0..1',
    tilt: '{ aspect: extra stretch at full tilt, 0 to 4 }', shade: '{ color #hex, dir [x, y] unit }: two-colour dab', filmGrain: 'period fraction of width (0.0038), amount 0 to 0.05 display units',
  },
  colour: 'linear-light premultiplied float32 surface; input and output sRGB (IEC 61966-2-1)',
  determinism: 'same seed, inputs and size give the same float surface, byte for byte (tests hash it)',
  cloud: 'cloud.json/1 (feed-archive PLAYBOOK.md 5.1): lobes [{ c [x,y,z], r [rx,ry,rz], children }], base { y, soft }, erosion [{ kind billow|worley, scale per width, amount }], medium { extinction, albedo, hg, powder, ambient, bounce }, light { pos [x,y,z] | dir, color, falloff, intensity }, style volume|wash|dither|halftone, seed',
  budget: 'live painting on a 2880 x 1800 surface (1440 x 900 at DPR 2): one pointer sample with the billow brush, painted and converted for blit, p95 under 8.3 ms (test)',
  output: 'PNG 16-bit master and 8-bit TPDF-dithered view, sRGB chunk; any size by re-painting the stroke list (4K: 3840 long side)',
});
export { makeCloud, growLobes, shade, flatLobes, CLOUD_SCHEMA } from './cloud2d.js';
export { renderCloud, CLOUD_STYLES } from './cloud.js';
export { bloom, reflect } from './post.js';
