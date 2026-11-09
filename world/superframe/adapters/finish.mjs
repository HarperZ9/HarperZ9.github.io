// adapters/finish.mjs: composition rules as a node. The explorer ends every recipe here, and a person can too.
// The rules come from the review of the first best 12 and the canon: one subject, a calm ground, layered depth, grain
// as a finish pass, and a palette held to a few disciplined hues (ink, ground and one accent band, the one hot mark).
// The spectrum is allowed only on the subject, and only when the recipe marks the subject as spectral art.
//
// Layers, back to front:
//   1. the calm ground (palette ground), with an atmospheric back layer: the depth input (or the subject) blurred to
//      large shapes and laid in at low contrast toward the ink
//   2. a soft shadow of the subject, offset down and right, which lifts it off the ground
//   3. the subject, placed on the grid at a share of the short side, cut out from its own ground (or kept as a plate
//      with a feathered edge when it has no separable figure), tone-mapped to the palette ramp
//   4. grain, clumped 1.9 to 3.1 px, a few code values (QUALITY-SPEC R4), added in display space
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { boxBlur } from '../../techniques/lib/util.js';
import { grainField } from '../../substrate/lib/raster.mjs';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const blur = (F, w, h, r) => { let o = F; for (let i = 0; i < 3; i++) o = boxBlur(o, w, h, Math.max(1, Math.round(r))); return o; };
const PLACES = { centre: [0.5, 0.5], 'thirds-left': [1 / 3, 0.5], 'thirds-right': [2 / 3, 0.5], 'low-third': [0.5, 0.6], 'high-third': [0.5, 0.42] };

// Luma (display-referred, 0..1) of a raster, unpremultiplied over black.
const lumaOf = R => px.luma(R).data;

function subjectMask(L, w, h, plate, feather) {
  const border = [];
  for (let x = 0; x < w; x++) border.push(L[x], L[(h - 1) * w + x]);
  for (let y = 0; y < h; y++) border.push(L[y * w], L[y * w + w - 1]);
  border.sort((a, b) => a - b);
  const g = border[border.length >> 1], edge = (x, y) => smooth(0, feather, Math.min(x, y, w - 1 - x, h - 1 - y));
  // the figure is where the source has structure: either far from its own ground, or locally busy (detail energy),
  // so a texture with a quiet border falls away and the busy part stands as the subject
  let M = new Float32Array(w * h), mean = 0;
  if (!plate) {
    const base = blur(L, w, h, 2), hp = Float32Array.from(L, (v, i) => Math.abs(v - base[i])), e = blur(hp, w, h, Math.max(2, 0.04 * w));
    const es = Float32Array.from(e).sort(), e95 = es[Math.floor(es.length * 0.95)] || 1e-3;
    for (let i = 0; i < w * h; i++) M[i] = Math.max(smooth(0.05, 0.18, Math.abs(L[i] - g)), smooth(0.3, 0.7, e[i] / e95));
    M = blur(M, w, h, 1);
    for (const v of M) mean += v; mean /= w * h;
  }
  const usePlate = plate || mean < 0.04 || mean > 0.85;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; M[i] = (usePlate ? 1 : M[i]) * edge(x, y); }
  return { M, plate: usePlate, g };
}

export const NODES = [
  defineNode({
    id: 'compose.finish', title: 'Composition finish', lane: 'image', domains: ['composition', 'print'], source: 'superframe',
    doc: 'One subject on a calm ground, an atmospheric back layer, a soft shadow, a palette ramp with one accent band, and grain as the last pass.',
    inputs: { subject: 'raster', depth: { type: 'raster', optional: true } }, outputs: { raster: 'raster' },
    params: {
      place: { type: 'enum', options: Object.keys(PLACES), default: 'centre' },
      scale: { type: 'number', min: 0.45, max: 0.84, default: 0.66, unit: 'share of the short side' },
      frame: { type: 'enum', options: ['cutout', 'plate'], default: 'cutout', doc: 'cut the figure from its own ground, or keep a feathered plate' },
      accent: { type: 'number', min: 0, max: 1, default: 0.7, unit: 'position of the accent band on the tone ramp' },
      accentWidth: { type: 'number', min: 0, max: 0.14, default: 0.05, unit: 'share of the ramp' },
      spectrum: { type: 'bool', default: false, doc: 'keep the subject\'s own colour (spectral art is the subject)' },
      depth: { type: 'number', min: 0, max: 0.2, default: 0.08, unit: 'back layer contrast' },
      shadow: { type: 'number', min: 0, max: 0.5, default: 0.2, unit: 'shadow strength' },
      grain: { type: 'number', min: 0.8, max: 6, default: 2.6, unit: 'code values' },
      grainPx: { type: 'number', min: 1.9, max: 3.1, default: 2.3, unit: 'px' },
    },
    cost: () => 60, explore: false,
    render: ({ inputs, params: p, w, h, palette, seedInt }) => {
      const G = px.hexLin(palette.ground), I = px.hexLin(palette.ink), A = px.hexLin(palette.accent), out = make.raster(w, h), d = out.data;
      // 1. calm ground and the atmospheric back layer
      const back = blur(lumaOf(px.resampleRaster(inputs.depth ?? inputs.subject, w, h)), w, h, Math.max(2, 0.1 * w));
      let lo = 1, hi = 0; for (const v of back) { if (v < lo) lo = v; if (v > hi) hi = v; }
      for (let i = 0; i < w * h; i++) { const t = p.depth * (hi > lo ? (back[i] - lo) / (hi - lo) : 0.5); for (let c = 0; c < 3; c++) d[4 * i + c] = G[c] + (I[c] - G[c]) * t; d[4 * i + 3] = 1; }
      // 3a. the subject, fitted on the grid
      const S0 = inputs.subject, short = Math.min(w, h), k = (p.scale * short) / Math.max(S0.w, S0.h);
      const sw = Math.max(8, Math.round(S0.w * k)), sh = Math.max(8, Math.round(S0.h * k)), S = px.resampleRaster(S0, sw, sh);
      const [fx, fy] = PLACES[p.place], ox = Math.round(clamp(fx * w - sw / 2, 0, w - sw)), oy = Math.round(clamp(fy * h - sh / 2, 0, h - sh));
      const L = lumaOf(S), { M, plate, g } = subjectMask(L, sw, sh, p.frame === 'plate', Math.max(2, 0.05 * sw));
      // a cut-out figure is read by its distance from its own ground, whatever its polarity, so a light mark on a dark
      // source and a dark mark on a light one both come out as ink on the calm ground
      const T = plate ? L : Float32Array.from(L, v => 1 - Math.abs(v - g));
      // 2. the shadow, from the mask, offset and softened
      const sx = Math.round(0.012 * w), sy = Math.round(0.018 * h), sm = blur(M, sw, sh, Math.max(1, 0.012 * w));
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const X = ox + x + sx, Y = oy + y + sy; if (X >= w || Y >= h) continue; const i = Y * w + X, a = p.shadow * sm[y * sw + x]; for (let c = 0; c < 3; c++) d[4 * i + c] += (I[c] - d[4 * i + c]) * a; }
      // 3b. tone-map the subject to the ramp (ink to a light tint of the ground) with one accent band
      const sorted = Float32Array.from(T).sort(), l2 = sorted[Math.floor(sorted.length * 0.02)], l98 = sorted[Math.floor(sorted.length * 0.98)], span = Math.max(1e-3, l98 - l2);
      const light = G.map((v, c) => v + (I[c] - v) * (plate ? 0.08 : 0.45));
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const j = y * sw + x, m = M[j]; if (m <= 0) continue;
        const t = clamp((T[j] - l2) / span), i = (oy + y) * w + ox + x;
        const band = p.accentWidth > 0 ? smooth(p.accentWidth / 2, p.accentWidth / 2 - 0.02, Math.abs(t - p.accent)) : 0;
        for (let c = 0; c < 3; c++) {
          let v = I[c] + (light[c] - I[c]) * t;
          v += (A[c] - v) * band;
          if (p.spectrum) v = S.data[4 * j + c] * 0.75 + v * 0.25;
          d[4 * i + c] += (v - d[4 * i + c]) * m;
        }
      }
      // 4. grain as the finish pass, in display space
      const gr = grainField(w, h, { sd: p.grain, clump: p.grainPx, dither: 0, seed: seedInt % 100000 });
      for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) d[4 * i + c] = px.toLin(clamp(px.toSrgb(clamp(d[4 * i + c])) + gr[i] / 255));
      return { raster: out };
    },
  }),
];
