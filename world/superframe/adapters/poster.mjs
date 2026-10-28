// adapters/poster.mjs: feed sets 28 and 29 (2026-10-24). The grainy gradient-field poster generator, painting to pixel
// art, the spot-ink illustration, the bistable rotation and the time bands. Thin wrappers: each calls the original
// module in feed-29/build or feed-28/build and converts its 3-channel linear raster.
import { defineNode } from '../lib/node.mjs';
import { fromRGB3 } from '../lib/pix.mjs';
import { poster } from '../../feed-29/build/gradfield.mjs';
import { MOTIFS } from '../../feed-29/build/motifs.mjs';
import { pixelate } from '../../feed-29/build/pixelart.mjs';
import { illustrate } from '../../feed-29/build/spotink.mjs';
import { paint } from '../../feed-29/build/painting.mjs';
import { frame as bistable, rings } from '../../feed-28/build/illusion.mjs';
import { frame as timebands } from '../../feed-28/build/timebands.mjs';
import { raster as rgb3, grain } from '../../feed-29/build/lib/field.mjs';

const F29 = 'feed-29/build', F28 = 'feed-28/build';
// Our rasters carry grain only at encode; inside a graph the grain is baked in here (mono, linear-safe), so a node's
// output already has the texture the poster spec asks for.
function withGrain(R, sd, seed) {
  if (!sd) return R;
  const G = grain(R.w, R.h, { seed }), k = sd / 255;
  for (let i = 0; i < R.w * R.h; i++) for (let c = 0; c < 3; c++) R.px[3 * i + c] = Math.max(0, R.px[3 * i + c] * (1 + G[i] * k * 2.2));
  return R;
}
const out = R => fromRGB3(R.w, R.h, R.px);
// A superframe raster (RGBA, straight alpha) to our 3-channel raster over black.
const in3 = Rs => { const R = rgb3(Rs.w, Rs.h), d = Rs.data; for (let i = 0; i < Rs.w * Rs.h; i++) for (let c = 0; c < 3; c++) R.px[3 * i + c] = d[4 * i + c] * d[4 * i + 3]; return R; };

export const NODES = [
  defineNode({
    id: 'gradfield.poster', title: 'Grainy gradient-field poster', lane: 'image', domains: ['optics', 'thin-film interference', 'colorimetry', 'graphic design'], source: `${F29}/gradfield.mjs`,
    doc: 'Six motifs (spectral capsules, film-coated spheres with a reflected horizon and halftone, Kanizsa wedges, metaballs, recursive subdivision, stepped interference); colour from thin-film and spectral ramps; clumped mono grain.',
    inputs: {}, outputs: { raster: 'raster' },
    params: {
      motif: { type: 'enum', options: Object.keys(MOTIFS), default: 'capsules' }, palette: { type: 'enum', options: ['film', 'spectral', 'ink'], default: 'film' },
      span: { type: 'number', min: 0.1, max: 1, default: 0.62, unit: 'share of the ramp one shape walks' }, ground: { type: 'color', default: '#d6d0c6' },
      grain: { type: 'number', min: 0, max: 12, default: 5, unit: 'code values' }, aberration: { type: 'number', min: 0, max: 12, default: 0, unit: 'px at 1024' },
      t: { type: 'number', min: 0, max: 1, default: 0, unit: 'loop phase' },
    },
    cost: p => (p.motif === 'metaballs' || p.motif === 'steps' ? 60 : 15),
    render: ({ params, w, h, seed }) => ({ raster: out(withGrain(poster({ ...params, w, h, seed: String(seed), grainSd: 0 }), params.grain, `${seed}:grain`)) }),
  }),
  defineNode({
    id: 'medium.pixelart', title: 'Painting to pixel art', lane: 'image', domains: ['pixel art', 'colour quantisation', 'clustering'], source: `${F29}/pixelart.mjs`,
    doc: 'Contrast-aware shrink to a grid, k-means++ palette in OKLab, ordered dither only on true ramps, orphan cleanup, optional selective outline. Every output pixel is a palette colour.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: {
      cell: { type: 'int', min: 2, max: 32, default: 6, unit: 'source px per art pixel' }, colors: { type: 'int', min: 2, max: 48, default: 16, unit: 'palette entries' },
      dither: { type: 'number', min: 0, max: 1, default: 0.35 }, accent: { type: 'number', min: 0, max: 0.6, default: 0.35 }, outline: { type: 'bool', default: true },
    },
    cost: () => 30,
    render: ({ inputs, params, w, h, seed }) => {
      const X = pixelate(in3(inputs.raster), { ...params, outline: params.outline ? 1 : 0, seed: String(seed) }), R = rgb3(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.min(X.R.w - 1, x), sy = Math.min(X.R.h - 1, y); R.px.set(X.R.px.subarray(3 * (sy * X.R.w + sx), 3 * (sy * X.R.w + sx) + 3), 3 * (y * w + x)); }
      return { raster: out(R) };
    },
  }),
  defineNode({
    id: 'painting.valley', title: 'Painted dusk valley (source plate)', lane: 'image', domains: ['painting', 'non-photorealistic rendering'], source: `${F29}/painting.mjs`,
    doc: 'Our own painted scene: a base colour field, then oriented brush dabs that sample and smear it (layered-brush method), junipers and reeds.',
    inputs: {}, outputs: { raster: 'raster' }, params: { dabs: { type: 'number', min: 0, max: 3, default: 1, unit: 'dab density' } },
    cost: () => 120,
    render: ({ params, w, h, seed }) => ({ raster: out(paint({ w, h, seed: String(seed), dabs: params.dabs })) }),
  }),
  defineNode({
    id: 'ink.spot', title: 'Spot-ink illustration (marker or two-tone)', lane: 'image', domains: ['illustration', 'perspective drawing', 'print'], source: `${F29}/spotink.mjs`,
    doc: 'A street drawn by rule: line weight by kind (silhouette, crease, window), marker passes that converge on the vanishing point with overlap darkening, or two-tone ink with hatching; one spot colour on lit things only.',
    inputs: {}, outputs: { raster: 'raster' },
    params: { mode: { type: 'enum', options: ['marker', 'twotone'], default: 'marker' }, spot: { type: 'color', default: '#2f6bd8' }, ink: { type: 'color', default: '#16151a' }, paper: { type: 'color', default: '#f3efe6' } },
    cost: () => 400,
    render: ({ params, w, h, seed }) => ({ raster: out(illustrate({ ...params, w, h, seed: String(seed), ss: 2 })) }),
  }),
  defineNode({
    id: 'illusion.bistable', title: 'Bistable rotation with drift rings and a reveal', lane: 'image', domains: ['perception', 'colour science', 'projective geometry'], source: `${F28}/illusion.mjs`,
    doc: 'The sRGB cube in OKLab turning in orthographic projection (no depth cue, so the turn reads either way), inside peripheral-drift rings; cue > 0 adds the depth cue that settles it.',
    inputs: {}, outputs: { raster: 'raster' },
    params: { t: { type: 'number', min: 0, max: 8, default: 1.1, unit: 's of an 8 s turn' }, cue: { type: 'number', min: 0, max: 1, default: 0, unit: 'depth cue (the reveal)' }, rings: { type: 'int', min: 0, max: 6, default: 4 } },
    cost: () => 80,
    render: ({ params, w, h }) => { const s = Math.min(w, h), base = rings(rgb3(s, s, [0.012, 0.011, 0.016]), { rings: params.rings }), R = bistable(params.t, { size: s, base, cue: params.cue }), O = rgb3(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.min(s - 1, x), sy = Math.min(s - 1, y); O.px.set(R.px.subarray(3 * (sy * s + sx), 3 * (sy * s + sx) + 3), 3 * (y * w + x)); }
      return { raster: out(O) }; },
  }),
  defineNode({
    id: 'light.timebands', title: 'One sea, four hours (time folded into bands)', lane: 'image', domains: ['ocean waves', 'solar geometry', 'optics'], source: `${F28}/timebands.mjs`,
    doc: 'Deep-water waves (k = omega^2 / g, exact loop) lit at four hours of one day from a solar position model; each band shows the same water, only the light differs.',
    inputs: {}, outputs: { raster: 'raster' },
    params: { t: { type: 'number', min: 0, max: 6, default: 1.3, unit: 's of a 6 s loop' }, lat: { type: 'number', min: -66, max: 66, default: 47.6, unit: 'deg' }, day: { type: 'int', min: 1, max: 365, default: 172, unit: 'day of year' } },
    cost: () => 150,
    render: ({ params, w, h, seed }) => ({ raster: out(timebands(params.t, { w, h, lat: params.lat, day: params.day, seed: String(seed) })) }),
  }),
];
