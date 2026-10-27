// compose.mjs: the public entry of our layer-stack compositor. A Hydra-like chain in our own code:
//
//   source      solid, noise, chladni, hamming, film, swimmers, plate      (sources.mjs)
//   modulate    modulate, modulateScale, modulatePixelate                   (glitch.mjs)
//   pixelate    pixelate, mosh, streak, scanwave, blocks, lines             (glitch.mjs)
//   posterize   posterize, ramp, duotone, threshold, invert, saturate, ...  (tone.mjs)
//   mosaic      sheet.mosaic({ x, y, pitch, cols, rows, fill })             (layer.mjs)
//   mask        layer.mask({ by, t, invert })                               (tone.mjs)
//   blend       sheet.place(layer, x, y, { mode, opacity })  (alias blend)  (layer.mjs)
//   noise       noise() source; speckle() in a layer; grain at out()       (sources, tone, layer)
//   out         sheet.out({ grain: { std, size } }) -> 8-bit RGBA          (layer.mjs)
//
//   const s = sheet(1024, 1024, { seed: 7 });
//   s.place(chladni(400, 400, { n: 3, m: 5 }).posterize({ levels: 5 }).duotone('#141a2e', '#a9b7d6').mosh({ block: 8 }), 100, 100);
//   const rgba = s.out({ grain: { std: 0.015, size: 1024 / 700 } });
//
// Every operator draws its randomness from the layer's seed, so a chain is a pure function of its seed.
// Dependency-free ES modules; runs in node and the browser.
export { Layer, sheet, layer, MODES, grainField } from './layer.mjs';
export * from './sources.mjs';
export { OPS } from './ops.mjs';
export * as hud from './hud.mjs';
export * as numerals from './numerals.mjs';
export * as glyphs from './glyphs.mjs';
export { rng, hash, colour, enc, toLin, toSrgb, hexLin } from './px.mjs';

// ---------- node interface: a chain as data ----------
// A recipe is JSON, so a host framework can store, diff and run chains as nodes:
//   { size: [w, h], seed, source: ['chladni', { n: 3, m: 5 }], ops: [['posterize', { levels: 5 }], ['duotone', '#141a2e', '#a9b7d6']] }
// run(recipe) returns the layer; run(recipe, { into: sheet, at: [x, y], mode }) also places it.
import { Layer as _Layer } from './layer.mjs';
import * as _src from './sources.mjs';
import { OPS as _OPS } from './ops.mjs';

const SOURCES = { solid: _src.solid, noise: _src.noise, chladni: _src.chladni, hamming: _src.hamming, film: _src.film, swimmers: _src.swimmers };

export function run(recipe, { into = null, at = [0, 0], mode = 'normal', opacity = 1, plates = {} } = {}) {
  const [w, h] = recipe.size ?? [256, 256], [name, args = {}] = recipe.source ?? ['solid', '#000000'];
  let L;
  if (name === 'plate') { const img = plates[args.plate]; if (!img) throw new Error(`compose.run: plate "${args.plate}" not supplied`); L = _src.plate(img, w, h, { ...args, seed: recipe.seed ?? 1 }); }
  else if (name === 'solid') L = _src.solid(w, h, typeof args === 'string' ? args : args.colour, { seed: recipe.seed ?? 1 });
  else { const f = SOURCES[name]; if (!f) throw new Error(`compose.run: unknown source "${name}"`); L = f(w, h, { ...args, seed: args.seed ?? recipe.seed ?? 1 }); }
  for (const [op, ...a] of recipe.ops ?? []) { if (!_OPS[op]) throw new Error(`compose.run: unknown operator "${op}"`); L[op](...a); }
  if (into) into.place(L, at[0], at[1], { mode, opacity });
  return L;
}

// SPEC (QUALITY-SPEC S1, S2): inputs, parameters with ranges and units. Sizes are px; colours '#rrggbb'
// or linear [r, g, b]; levels and counts are integers; fractions are of the layer width unless stated.
export const SPEC = Object.freeze({
  layer: { w: 'px, 1..16384', h: 'px, 1..16384', seed: 'uint32', pixels: 'linear-light float RGB, optional alpha 0..1' },
  sources: {
    solid: { colour: 'colour' }, noise: { scale: 'cycles per width, 0.5..64', octaves: '1..8' },
    chladni: { n: '1..12', m: '1..12', mix: 'deg, 0..90', width: 'nodal line half-width in amplitude, 0.02..0.3', sand: 'grain probability, 0..1', R: 'field grid, 64..512' },
    hamming: { mod: '2..32', x0: 'int', y0: 'int', scale: 'px per cell, 1..64' }, film: { dMin: 'nm, 0..1500', dMax: 'nm, 0..1500', scale: 'cycles per width' },
    swimmers: { count: '1..400', pellets: '0..30', steps: 'fixed steps of 1/30 s, 0..10000', gain: '0.5..8' }, plate: { focus: '[0..1, 0..1]', zoom: '1..8' },
  },
  ops: {
    posterize: { levels: '2..64' }, ramp: { stops: '2..8 colours', gamma: '0.2..5' }, duotone: { dark: 'colour', light: 'colour' }, threshold: { t: '0..1 sRGB luma' },
    saturate: { s: '0..3' }, brightness: { b: '-1..1 sRGB' }, contrast: { c: '0..4' }, blur: { r: 'px, 0..64 (three box passes)' }, speckle: { std: 'sRGB code fraction, 0..0.2' },
    mask: { by: 'layer | Float32Array | (u, v) => 0..1', t: '0..1 or null', soft: '0..1' },
    pixelate: { size: 'px, 1..512' }, modulatePixelate: { by: 'field', min: 'px, 1..max', max: 'px, min..512' },
    mosh: { block: 'px, 2..256', steps: '1..32', carry: '0..1', strength: 'blocks, 0..8', drift: '[blocks, blocks]', from: 'layer or null' },
    streak: { count: '0..1e5', rows: '[px, px]', len: '[fraction, fraction]', dir: '-1 | 1', figure: 'luma distance from median, 0..1' },
    scanwave: { wavelength: 'px', amp: 'px', band: 'rows', phase: 'rad', twist: 'rad per row', dim: '0..1', swap: 'bool', region: '{x, y, w, h} fractions' },
    blocks: { count: '0..1e4', bw: '[fraction, fraction]', bh: '[fraction of width, fraction]', copy: '0..1' },
    modulate: { by: 'layer', amount: 'fraction, -1..1' }, modulateScale: { by: 'field', amount: '-1..4' }, lines: { count: '0..200', width: 'px', alpha: '0..1' },
  },
  sheet: { mat: 'fraction of the short side, 0..0.2', unit: 'inner width / 1000' },
  out: { grain: '{ std: sRGB code fraction 0..0.2, size: correlation px 1..32, mono: bool }', depth: '8 | 16', dither: 'TPDF, 1 code value peak' },
  determinism: 'pure function of seed and inputs; tests/layer.test.mjs and tests/pieces.test.mjs compare bytes',
  budget: 'node, one 3840 x 3840 sheet: 10 to 60 s per piece; feedback frame at 1080 x 1080: about 0.25 s (render.mjs meta.json records the measured times)',
});
